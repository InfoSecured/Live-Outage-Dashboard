import { Hono } from "hono";
import type { Env } from './core-utils';
import { ok, bad, notFound, isStr, badWithData } from './core-utils';
import { MOCK_OUTAGES, MOCK_ALERTS, MOCK_TICKETS, MOCK_OUTAGE_HISTORY } from "@shared/mock-data";
import { VendorEntity, ServiceNowConfigEntity, SolarWindsConfigEntity, CollaborationBridgeEntity } from "./entities";
import type { Vendor, VendorStatus, VendorStatusOption, ServiceNowConfig, Outage, SolarWindsConfig, MonitoringAlert, AlertSeverity, ServiceNowTicket, CollaborationBridge, ImpactLevel } from "@shared/types";
import { format, subDays } from 'date-fns';
// Helper to safely access nested properties from a JSON object
const getProperty = (obj: any, path: string): any => {
  const value = path.split('.').reduce((acc, part) => acc && acc[part], obj);
  // Handle ServiceNow reference fields which are returned as objects
  if (typeof value === 'object' && value !== null) {
    return value.display_value || value.name || value.value || JSON.stringify(value);
  }
  return value;
};
// Helper to safely parse date strings from APIs
const safeParseDate = (dateStr: any): string => {
  if (!dateStr) {
    return new Date().toISOString(); // Fallback to now if null or undefined
  }
  const date = new Date(dateStr);
  // Check if the date is valid
  if (isNaN(date.getTime())) {
    return new Date().toISOString(); // Fallback if parsing results in an invalid date
  }
  return date.toISOString();
};
// New helper for detailed ServiceNow API logging
async function logServiceNowInteraction(endpoint: string, request: Request, response: Response) {
  const sanitizedHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    if (key.toLowerCase() !== 'authorization') {
      sanitizedHeaders[key] = value;
    } else {
      sanitizedHeaders[key] = '[REDACTED]';
    }
  });
  const responseBody = await response.text();
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });
  // We need to clone the response to read the body, as it can only be read once.
  // The original response is passed back to the caller.
  console.log(JSON.stringify({
    type: 'ServiceNowAPICall',
    endpoint,
    request: {
      url: request.url,
      method: request.method,
      headers: sanitizedHeaders,
    },
    response: {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      body: responseBody,
    }
  }, null, 2));
  // Return a new response from the text body so it can be used by the caller
  return new Response(responseBody, response);
}
export function userRoutes(app: Hono<{ Bindings: Env }>) {
  // --- Aegis Dashboard Routes ---
  // --- VENDOR CRUD ---
  app.get('/api/vendors', async (c) => {
    const { items } = await VendorEntity.list(c.env);
    return ok(c, items);
  });
  app.post('/api/vendors', async (c) => {
    const body = await c.req.json<Partial<Vendor>>();
    if (!isStr(body.name) || !isStr(body.url) || !isStr(body.statusType)) {
      return bad(c, 'name, url, and statusType are required');
    }
    const newVendor: Vendor = {
      id: crypto.randomUUID(),
      name: body.name,
      url: body.url,
      statusType: body.statusType,
      apiUrl: body.apiUrl,
      jsonPath: body.jsonPath,
      expectedValue: body.expectedValue,
    };
    await VendorEntity.create(c.env, newVendor);
    return ok(c, newVendor);
  });
  app.put('/api/vendors/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json<Partial<Vendor>>();
    if (!isStr(body.name) || !isStr(body.url) || !isStr(body.statusType)) {
      return bad(c, 'name, url, and statusType are required');
    }
    const vendor = new VendorEntity(c.env, id);
    if (!(await vendor.exists())) return notFound(c, 'Vendor not found');
    const updatedVendor: Vendor = {
      id,
      name: body.name,
      url: body.url,
      statusType: body.statusType,
      apiUrl: body.apiUrl,
      jsonPath: body.jsonPath,
      expectedValue: body.expectedValue,
    };
    await vendor.save(updatedVendor);
    return ok(c, updatedVendor);
  });
  app.delete('/api/vendors/:id', async (c) => {
    const id = c.req.param('id');
    const deleted = await VendorEntity.delete(c.env, id);
    if (!deleted) return notFound(c, 'Vendor not found');
    return ok(c, { id, deleted });
  });
  // --- VENDOR STATUS (Now Dynamic & Resilient) ---
  app.get('/api/vendors/status', async (c) => {
    const { items: vendors } = await VendorEntity.list(c.env);
    const statusPromises = vendors.map(async (vendor): Promise<VendorStatus> => {
      let status: VendorStatusOption = 'Operational';
      if (vendor.statusType === 'API_JSON' && vendor.apiUrl && vendor.jsonPath && vendor.expectedValue) {
        try {
          const response = await fetch(vendor.apiUrl, {
            headers: { 'User-Agent': 'AegisDashboard/1.0' }
          });
          if (!response.ok) {
            status = 'Degraded'; // Status page API is failing
          } else {
            const json = await response.json();
            const value = getProperty(json, vendor.jsonPath);
            if (value === undefined) {
              status = 'Degraded'; // Path not found in JSON
            } else if (String(value) === vendor.expectedValue) {
              status = 'Operational';
            } else {
              status = 'Outage';
            }
          }
        } catch (error) {
          console.error(`Failed to fetch status for ${vendor.name}:`, error);
          status = 'Degraded'; // Network error or other issue
        }
      }
      // For 'MANUAL' type, we default to 'Operational'
      return { id: vendor.id, name: vendor.name, url: vendor.url, status };
    });
    const statuses = await Promise.all(statusPromises);
    return ok(c, statuses);
  });
  // --- SERVICENOW CONFIG ---
  app.get('/api/servicenow/config', async (c) => {
    const configEntity = new ServiceNowConfigEntity(c.env);
    const config = await configEntity.getState();
    return ok(c, config);
  });
  app.post('/api/servicenow/config', async (c) => {
    const body = await c.req.json<ServiceNowConfig>();
    const configEntity = new ServiceNowConfigEntity(c.env);
    await configEntity.save(body);
    return ok(c, body);
  });
  // --- ACTIVE OUTAGES (Now Dynamic) ---
  app.get('/api/outages/active', async (c) => {
    const configEntity = new ServiceNowConfigEntity(c.env);
    const config = await configEntity.getState();
    if (!config.enabled || !config.instanceUrl) {
      return bad(c, 'ServiceNow integration is not configured or enabled.');
    }
    const username = c.env[config.usernameVar as keyof Env] as string | undefined;
    const password = c.env[config.passwordVar as keyof Env] as string | undefined;
    if (!username || !password) {
      return bad(c, 'ServiceNow credentials are not set in Worker secrets.');
    }
    const { outageTable, fieldMapping, impactLevelMapping } = config;
    const impactMapping = new Map(impactLevelMapping.map(item => [item.servicenowValue.toLowerCase(), item.dashboardValue]));
    const fields = Object.values(fieldMapping).join(',');
    const query = 'active=true';
    const encodedQuery = encodeURIComponent(query);
    const url = `${config.instanceUrl}/api/now/table/${outageTable}?sysparm_display_value=true&sysparm_query=${encodedQuery}&sysparm_fields=sys_id,${fields}`;
    try {
      const request = new Request(url, {
        headers: {
          'Authorization': 'Basic ' + btoa(`${username}:${password}`),
          'Accept': 'application/json',
        },
      });
      let response = await fetch(request.clone() as any);
      response = await logServiceNowInteraction('ActiveOutages', request, response);
      if (!response.ok) {
        return bad(c, `Failed to fetch from ServiceNow: ${response.statusText}`);
      }
      const { result } = await response.json<{ result: any[] }>();
      const outages: Outage[] = result.map(item => {
        const servicenowImpact = String(getProperty(item, fieldMapping.impactLevel) || '').toLowerCase();
        const mappedImpact = impactMapping.get(servicenowImpact) || 'Degradation';
        return {
          id: item.sys_id,
          systemName: getProperty(item, fieldMapping.systemName) || 'Unknown System',
          impactLevel: mappedImpact as ImpactLevel,
          startTime: safeParseDate(getProperty(item, fieldMapping.startTime)),
          eta: safeParseDate(getProperty(item, fieldMapping.eta)),
          description: getProperty(item, fieldMapping.description) || 'No description provided.',
          teamsBridgeUrl: getProperty(item, fieldMapping.teamsBridgeUrl) || null,
        };
      });
      return ok(c, outages);
    } catch (error) {
      console.error('Error fetching from ServiceNow:', error);
      return bad(c, 'An unexpected error occurred while fetching ServiceNow data.');
    }
  });
  // --- SOLARWINDS CONFIG ---
  app.get('/api/solarwinds/config', async (c) => {
    const configEntity = new SolarWindsConfigEntity(c.env);
    const config = await configEntity.getState();
    return ok(c, config);
  });
  app.post('/api/solarwinds/config', async (c) => {
    const body = await c.req.json<SolarWindsConfig>();
    const configEntity = new SolarWindsConfigEntity(c.env);
    await configEntity.save(body);
    return ok(c, body);
  });
  // --- MONITORING ALERTS (Now Dynamic) ---
  app.get('/api/monitoring/alerts', async (c) => {
    const configEntity = new SolarWindsConfigEntity(c.env);
    const config = await configEntity.getState();
    if (!config.enabled || !config.apiUrl) {
      return bad(c, 'SolarWinds integration is not configured or enabled.');
    }
    const username = c.env[config.usernameVar as keyof Env] as string | undefined;
    const password = c.env[config.passwordVar as keyof Env] as string | undefined;
    if (!username || !password) {
      return bad(c, 'SolarWinds credentials are not set in Worker secrets.');
    }
    const query = "SELECT AlertObjectID, EntityCaption, EntityDetailsUrl, TriggerTimeStamp, Acknowledged, Severity FROM Orion.AlertActive ORDER BY TriggerTimeStamp DESC";
    const url = `${config.apiUrl}/SolarWinds/InformationService/v3/Json/Query`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa(`${username}:${password}`),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`SolarWinds API Error (${response.status}): ${errorText}`);
        return bad(c, `Failed to fetch from SolarWinds: ${response.statusText}`);
      }
      const { results } = await response.json<{ results: any[] }>();
      const severityMap: Record<number, AlertSeverity> = {
        2: 'Critical',
        3: 'Warning',
        1: 'Info',
      };
      const alerts: MonitoringAlert[] = results.map(item => ({
        id: item.AlertObjectID.toString(),
        type: item.EntityCaption,
        affectedSystem: item.EntityDetailsUrl || 'N/A',
        timestamp: new Date(item.TriggerTimeStamp).toISOString(),
        severity: severityMap[item.Severity] || 'Info',
        validated: item.Acknowledged,
      }));
      return ok(c, alerts);
    } catch (error) {
      console.error('Error fetching from SolarWinds:', error);
      return bad(c, 'An unexpected error occurred while fetching SolarWinds data.');
    }
  });
  // --- SERVICENOW TICKETS (Now Dynamic) ---
  app.get('/api/servicenow/tickets', async (c) => {
    const configEntity = new ServiceNowConfigEntity(c.env);
    const config = await configEntity.getState();
    if (!config.enabled || !config.instanceUrl) {
      return bad(c, 'ServiceNow integration is not configured or enabled.');
    }
    const username = c.env[config.usernameVar as keyof Env] as string | undefined;
    const password = c.env[config.passwordVar as keyof Env] as string | undefined;
    if (!username || !password) {
      return bad(c, 'ServiceNow credentials are not set in Worker secrets.');
    }
    const { ticketTable, ticketFieldMapping } = config;
    const fields = Object.values(ticketFieldMapping).join(',');
    const baseQuery = 'stateNOT IN 6,7,8^ORDERBYDESCsys_updated_on';
    const priorityQuery = `^${ticketFieldMapping.priority}=1`;
    const fullQuery = encodeURIComponent(`${baseQuery}${priorityQuery}`);
    const url = `${config.instanceUrl}/api/now/table/${ticketTable}?sysparm_display_value=true&sysparm_query=${fullQuery}&sysparm_limit=20&sysparm_fields=${fields}`;
    try {
      const request = new Request(url, {
        headers: {
          'Authorization': 'Basic ' + btoa(`${username}:${password}`),
          'Accept': 'application/json',
        },
      });
      let response = await fetch(request.clone() as any);
      response = await logServiceNowInteraction('ServiceNowTickets', request, response);
      if (!response.ok) {
        return bad(c, `Failed to fetch tickets from ServiceNow: ${response.statusText}`);
      }
      const { result } = await response.json<{ result: any[] }>();
      const tickets: ServiceNowTicket[] = result.map(item => ({
        id: getProperty(item, ticketFieldMapping.id) || 'N/A',
        summary: getProperty(item, ticketFieldMapping.summary) || 'No summary',
        affectedCI: getProperty(item, ticketFieldMapping.affectedCI) || 'N/A',
        status: (getProperty(item, ticketFieldMapping.status) as any) || 'New',
        assignedTeam: getProperty(item, ticketFieldMapping.assignedTeam) || 'Unassigned',
        ticketUrl: `${config.instanceUrl}/nav_to.do?uri=${ticketTable}.do?sys_id=${item.sys_id}`,
      }));
      return ok(c, tickets);
    } catch (error) {
      console.error('Error fetching tickets from ServiceNow:', error);
      return bad(c, 'An unexpected error occurred while fetching ServiceNow tickets.');
    }
  });
  // --- COLLABORATION BRIDGES CRUD ---
  app.get('/api/collaboration/bridges', async (c) => {
    await CollaborationBridgeEntity.ensureSeed(c.env);
    const { items } = await CollaborationBridgeEntity.list(c.env);
    return ok(c, items);
  });
  app.post('/api/collaboration/bridges', async (c) => {
    const body = await c.req.json<Partial<CollaborationBridge>>();
    if (!isStr(body.title) || !isStr(body.teamsCallUrl) || typeof body.participants !== 'number') {
      return bad(c, 'title, teamsCallUrl, and participants are required');
    }
    const newBridge: CollaborationBridge = {
      id: crypto.randomUUID(),
      title: body.title,
      participants: body.participants,
      duration: body.duration || '0m',
      isHighSeverity: body.isHighSeverity || false,
      teamsCallUrl: body.teamsCallUrl,
    };
    await CollaborationBridgeEntity.create(c.env, newBridge);
    return ok(c, newBridge);
  });
  app.put('/api/collaboration/bridges/:id', async (c) => {
    const id = c.req.param('id');
    const body = await c.req.json<Partial<CollaborationBridge>>();
    if (!isStr(body.title) || !isStr(body.teamsCallUrl) || typeof body.participants !== 'number') {
      return bad(c, 'title, teamsCallUrl, and participants are required');
    }
    const bridge = new CollaborationBridgeEntity(c.env, id);
    if (!(await bridge.exists())) return notFound(c, 'Bridge not found');
    const currentState = await bridge.getState();
    const updatedBridge: CollaborationBridge = { ...currentState, ...body, id };
    await bridge.save(updatedBridge);
    return ok(c, updatedBridge);
  });
  app.delete('/api/collaboration/bridges/:id', async (c) => {
    const id = c.req.param('id');
    const deleted = await CollaborationBridgeEntity.delete(c.env, id);
    if (!deleted) return notFound(c, 'Bridge not found');
    return ok(c, { id, deleted });
  });
  // --- OUTAGE HISTORY (Now Dynamic) ---
  app.get('/api/outages/history', async (c) => {
    const configEntity = new ServiceNowConfigEntity(c.env);
    const config = await configEntity.getState();
    if (!config.enabled || !config.instanceUrl) {
      return bad(c, 'ServiceNow integration is not configured or enabled.');
    }
    const username = c.env[config.usernameVar as keyof Env] as string | undefined;
    const password = c.env[config.passwordVar as keyof Env] as string | undefined;
    if (!username || !password) {
      return bad(c, 'ServiceNow credentials are not set in Worker secrets.');
    }
    const { outageTable, fieldMapping, impactLevelMapping } = config;
    const impactMapping = new Map(impactLevelMapping.map(item => [item.servicenowValue.toLowerCase(), item.dashboardValue]));
    const fields = Object.values(fieldMapping).join(',');
    // ServiceNow query for records where 'end' time is in the last 7 days.
    const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd HH:mm:ss');
    const query = `end>=${sevenDaysAgo}`;
    const encodedQuery = encodeURIComponent(query);
    const url = `${config.instanceUrl}/api/now/table/${outageTable}?sysparm_display_value=true&sysparm_query=${encodedQuery}&sysparm_fields=sys_id,${fields}`;
    try {
      const request = new Request(url, {
        headers: {
          'Authorization': 'Basic ' + btoa(`${username}:${password}`),
          'Accept': 'application/json',
        },
      });
      let response = await fetch(request.clone() as any);
      response = await logServiceNowInteraction('OutageHistory', request, response);
      if (!response.ok) {
        return bad(c, `Failed to fetch outage history from ServiceNow: ${response.statusText}`);
      }
      const { result } = await response.json<{ result: any[] }>();
      const outages: Outage[] = result.map(item => {
        const servicenowImpact = String(getProperty(item, fieldMapping.impactLevel) || '').toLowerCase();
        const mappedImpact = impactMapping.get(servicenowImpact) || 'Degradation';
        return {
          id: item.sys_id,
          systemName: getProperty(item, fieldMapping.systemName) || 'Unknown System',
          impactLevel: mappedImpact as ImpactLevel,
          startTime: safeParseDate(getProperty(item, fieldMapping.startTime)),
          eta: safeParseDate(getProperty(item, fieldMapping.eta)),
          description: getProperty(item, fieldMapping.description) || 'No description provided.',
          teamsBridgeUrl: getProperty(item, fieldMapping.teamsBridgeUrl) || null,
        };
      });
      return ok(c, outages);
    } catch (error) {
      console.error('Error fetching outage history from ServiceNow:', error);
      return bad(c, 'An unexpected error occurred while fetching ServiceNow outage history.');
    }
  });
}