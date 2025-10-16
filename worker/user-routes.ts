import { Hono } from "hono";
import type { Env } from './core-utils';
import { ok, bad, notFound, isStr, badWithData } from './core-utils';
import { MOCK_OUTAGES, MOCK_ALERTS, MOCK_TICKETS, MOCK_OUTAGE_HISTORY } from "@shared/mock-data";
import { VendorEntity, ServiceNowConfigEntity, SolarWindsConfigEntity, CollaborationBridgeEntity } from "./entities";
import type { Vendor, VendorStatus, VendorStatusOption, ServiceNowConfig, Outage, SolarWindsConfig, MonitoringAlert, AlertSeverity, ServiceNowTicket, CollaborationBridge, ImpactLevel } from "@shared/types";
import { format, subDays } from 'date-fns';
import { startOfToday, endOfToday } from 'date-fns';

// ---------- KV helpers (NEW) ----------
async function kvGet(c: any, key: string): Promise<string | null> {
  try {
    const kv = (c.env as any).KV;
    if (kv && typeof kv.get === 'function') {
      return await kv.get(key);
    }
  } catch (e) {
    // best-effort; do not throw
    console.error('KV read error for key', key, e);
  }
  return null;
}

async function kvGetBool(c: any, key: string, fallbackEnv?: string | undefined): Promise<boolean> {
  const raw = (await kvGet(c, key)) ?? fallbackEnv ?? '';
  const v = String(raw).trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'on';
}

async function kvGetString(c: any, key: string, fallbackEnv?: string | undefined): Promise<string> {
  const raw = (await kvGet(c, key));
  return (raw != null ? raw : (fallbackEnv ?? '')).toString();
}

function csvToList(raw: string): string[] {
  return (raw ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
}

// Helper to safely access nested properties from a JSON object
const getProperty = (objectData: any, path: string): any => {
  const value = path.split('.').reduce((accumulator, part) => accumulator && accumulator[part], objectData);
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

// Helper for detailed ServiceNow API logging
async function logServiceNowInteraction(endpoint: string, request: Request, response: Response): Promise<{ response: Response; data: any }> {
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

  // Parse the JSON data and return both the new response and parsed data
  let parsedData;
  try {
    parsedData = JSON.parse(responseBody);
  } catch (error) {
    parsedData = null;
  }

  // Create a new response with the same properties
  const newResponse = new Response(responseBody, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });

  return { response: newResponse, data: parsedData };
}

export function userRoutes(app: Hono<{ Bindings: Env }>) {
  // — Aegis Dashboard Routes —

  // Global error handler for all routes
  app.onError((err, c) => {
    console.error('Global error handler caught:', {
      message: err.message,
      stack: err.stack,
      name: err.name,
    });
    return c.json({
      success: false,
      error: 'Internal Server Error',
      details: err.message,
      stack: err.stack
    }, 500);
  });

  // ADDED: Config endpoint to check if management is enabled (now reads KV with env fallback)
  app.get('/api/config', async (c) => {
    const enableManagement = await kvGetBool(c, 'ENABLE_MANAGEMENT', c.env.ENABLE_MANAGEMENT as any);
    return c.json({ enableManagement });
  });

  // ADDED: Middleware to check if management features are enabled (KV-aware)
  const checkManagementEnabled = async (c: any, next: any) => {
    const enableManagement = await kvGetBool(c, 'ENABLE_MANAGEMENT', c.env.ENABLE_MANAGEMENT as any);
    if (!enableManagement) {
      return c.json({ error: 'Management features are disabled' }, 403);
    }
    await next();
  };

  // — VENDOR CRUD —
  app.get('/api/vendors', async (c) => {
    const { items } = await VendorEntity.list(c.env);
    return ok(c, items);
  });

  // MODIFIED: Added checkManagementEnabled middleware
  app.post('/api/vendors', checkManagementEnabled, async (c) => {
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

  // MODIFIED: Added checkManagementEnabled middleware
  app.put('/api/vendors/:id', checkManagementEnabled, async (c) => {
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

  // MODIFIED: Added checkManagementEnabled middleware
  app.delete('/api/vendors/:id', checkManagementEnabled, async (c) => {
    const id = c.req.param('id');
    const deleted = await VendorEntity.delete(c.env, id);
    if (!deleted) return notFound(c, 'Vendor not found');
    return ok(c, { id, deleted });
  });

  // — VENDOR STATUS (Now Dynamic & Resilient & Sorted) —
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
            } else {
              // Split comma-separated expected values and trim spaces
              const allowedValues = vendor.expectedValue
                .split(',')
                .map(v => v.trim().toLowerCase());
            
              const actualValue = String(value).toLowerCase().trim();
            
              if (allowedValues.includes(actualValue)) {
                status = 'Operational';
              } else {
                status = 'Outage';
              }
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

    // Sort: Outage first, then Degraded, then Operational (alphabetically within each group)
    const sortedStatuses = statuses.sort((a, b) => {
      const statusOrder = { 'Outage': 0, 'Degraded': 1, 'Operational': 2 };
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;
      // Within same status, sort alphabetically by name
      return a.name.localeCompare(b.name);
    });

    return ok(c, sortedStatuses);
  });

  // — SERVICENOW CONFIG —
  app.get('/api/servicenow/config', async (c) => {
    const configEntity = new ServiceNowConfigEntity(c.env);
    const config = await configEntity.getState();
    return ok(c, config);
  });

  // MODIFIED: Added checkManagementEnabled middleware
  app.post('/api/servicenow/config', checkManagementEnabled, async (c) => {
    const body = await c.req.json<ServiceNowConfig>();
    const configEntity = new ServiceNowConfigEntity(c.env);
    await configEntity.save(body);
    return ok(c, body);
  });

  // — ACTIVE OUTAGES (Now Dynamic)
  app.get('/api/outages/active', async (c) => {
    try {
      console.log('Step 1: Starting /api/outages/active request');

      const configEntity = new ServiceNowConfigEntity(c.env);
      console.log('Step 1.5: Created config entity');

      const config = await configEntity.getState();
      console.log('Step 2: Got config', {
        enabled: config.enabled,
        hasInstanceUrl: !!config.instanceUrl,
        instanceUrl: config.instanceUrl
      });

      if (!config.enabled || !config.instanceUrl) {
        console.log('Step 3: ServiceNow not enabled or configured - returning empty array');
        // Return empty array instead of error when not configured
        return ok(c, []);
      }

      const username = c.env[config.usernameVar as keyof Env] as string | undefined;
      const password = c.env[config.passwordVar as keyof Env] as string | undefined;
      console.log('Step 4: Checked credentials', { hasUsername: !!username, hasPassword: !!password });

      if (!username || !password) {
        console.log('Step 5: Missing credentials - returning empty array');
        // Return empty array instead of error when credentials missing
        return ok(c, []);
      }

      //const { outageTable, fieldMapping, impactLevelMapping } = config;
      const { outageTable, fieldMapping: rawFieldMapping, impactLevelMapping } = config;
      const fieldMapping = {
        ...rawFieldMapping,
        impactLevel: 'type'
      };
      console.log('Step 6: Got field mappings', { outageTable, fieldMappingKeys: Object.keys(fieldMapping) });

      const impactMapping = new Map(impactLevelMapping.map(item => [item.servicenowValue.toLowerCase(), item.dashboardValue]));
      const fields = Object.values(fieldMapping).join(',');
      // Query for active outages where 'end' field is empty (ongoing outages)
      const query = 'active=true^endISEMPTY';
      const encodedQuery = encodeURIComponent(query);
      // Include 'number' field for the outage number display
      const url = `${config.instanceUrl}/api/now/table/${outageTable}?sysparm_display_value=true&sysparm_query=${encodedQuery}&sysparm_fields=sys_id,number,${fields}`;
      console.log('Step 7: Constructed URL (partial):', url.substring(0, 100));

      const request = new Request(url, {
        headers: {
          'Authorization': 'Basic ' + btoa(`${username}:${password}`),
          'Accept': 'application/json',
        },
      });
      console.log('Step 8: Created request, about to fetch');

      const response = await fetch(request);
      console.log('Step 9: Got response', { status: response.status, ok: response.ok });

      const { response: loggedResponse, data } = await logServiceNowInteraction('ActiveOutages', request, response);
      console.log('Step 10: Logged interaction', { hasData: !!data, hasResult: !!(data && data.result) });

      if (!loggedResponse.ok) {
        console.log('Step 11: Response not OK - returning empty array');
        return ok(c, []);
      }

      if (!data || !data.result) {
        console.log('Step 12: Invalid response structure - returning empty array', { data });
        return ok(c, []);
      }

      console.log('Step 13: Processing results', { count: data.result.length });
      const outages: Outage[] = data.result.map((item: any) => {
        const rawImpact = getProperty(item, fieldMapping.impactLevel);
        const servicenowImpact = String(rawImpact || '').toLowerCase().trim();
        const mappedImpact = impactMapping.get(servicenowImpact) || 'Degradation';

        console.log('Impact mapping:', {
          rawImpact,
          servicenowImpact,
          mappedImpact,
          availableMappings: Array.from(impactMapping.entries())
        });

        return {
          id: item.number || item.sys_id, // Use 'number' field for display, fallback to sys_id
          systemName: getProperty(item, fieldMapping.systemName) || 'Unknown System',
          impactLevel: mappedImpact as ImpactLevel,
          startTime: safeParseDate(getProperty(item, fieldMapping.startTime)),
          eta: (() => {
            const rawEnd = getProperty(item, fieldMapping.eta);
            if (!rawEnd || String(rawEnd).trim().length === 0) {
              return 'Unknown';
            }
            return safeParseDate(rawEnd);
          })(),
          description: getProperty(item, fieldMapping.description) || 'No description provided.',
          teamsBridgeUrl: getProperty(item, fieldMapping.teamsBridgeUrl) || null,
        };
      });

      console.log('Step 14: Returning outages', { count: outages.length });
      return ok(c, outages);
    } catch (error: any) {
      console.error('CRITICAL ERROR in /api/outages/active:', {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
        error: String(error)
      });
      return c.json({
        success: false,
        error: 'Internal server error',
        message: error?.message || String(error),
        stack: error?.stack
      }, 500);
    }
  });

// — MONITORING ALERTS
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

  const url = `${config.apiUrl}/SolarWinds/InformationService/v3/Json/Query`;

  // Primary (B): with TriggeredDateTime + Acknowledged (no TOP limit)
  const queryB =
    "SELECT aa.AlertObjectID, ao.EntityCaption, ao.EntityDetailsUrl, aa.TriggeredDateTime, aa.Acknowledged " +
    "FROM Orion.AlertActive AS aa " +
    "JOIN Orion.AlertObjects AS ao ON aa.AlertObjectID = ao.AlertObjectID " +
    "ORDER BY aa.TriggeredDateTime DESC";

  // Fallback (A): simpler version if B fails (no TOP limit)
  const queryA =
    "SELECT aa.AlertObjectID, ao.EntityCaption, ao.EntityDetailsUrl " +
    "FROM Orion.AlertActive AS aa " +
    "JOIN Orion.AlertObjects AS ao ON aa.AlertObjectID = ao.AlertObjectID " +
    "ORDER BY aa.AlertObjectID DESC";

  const headers: Record<string, string> = {
    'Authorization': 'Basic ' + btoa(`${username}:${password}`),
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  const tunnelCode = c.env.SOLARWINDS_CUSTOM_HEADER;
  if (tunnelCode) headers['X-Tunnel-Code'] = tunnelCode;

  const cfId = (c.env as any).CF_ACCESS_CLIENT_ID;
  const cfSecret = (c.env as any).CF_ACCESS_CLIENT_SECRET;
  if (cfId && cfSecret) {
    headers['CF-Access-Client-Id'] = cfId;
    headers['CF-Access-Client-Secret'] = cfSecret;
  }

  // helper to issue one query
  const run = async (query: string) => {
    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ query }),
    });
    return resp;
  };

  // link builder with optional UI override
  // NEW: prefer KV override; fall back to ENV; else derive from apiUrl
  const kvUiBase = await kvGetString(c, 'SOLARWINDS_UI_BASE', (c.env as any).SOLARWINDS_UI_BASE);
  const uiBase = kvUiBase || ''; // e.g. https://sw.example.com
  const toAbsoluteUrl = (maybeUrl?: string | null) => {
    if (!maybeUrl) return 'N/A';

    // Already absolute?
    const isAbsolute = /^https?:\/\//i.test(maybeUrl);

    // If override base provided, always use it (preserve path+query from original)
    if (uiBase) {
      try {
        if (isAbsolute) {
          const original = new URL(maybeUrl);
          return new URL(`${original.pathname}${original.search}`, uiBase).toString();
        }
        // relative + override
        return new URL(maybeUrl, uiBase).toString();
      } catch {
        // fall through
      }
    }

    // No override: if absolute, keep it
    if (isAbsolute) return maybeUrl;

    // Relative + no override: derive base from apiUrl
    try {
      const base = new URL(config.apiUrl);
      return new URL(maybeUrl, `${base.protocol}//${base.host}`).toString();
    } catch {
      return maybeUrl;
    }
  };

  try {
    // try B first
    let resp = await run(queryB);

    // if schema says “no TriggeredDateTime”, fall back to A
    if (!resp.ok) {
      const txt = await resp.text();
      console.error(`SolarWinds API Error (${resp.status}) on query B: ${txt}`);

      if (resp.status === 400) {
        resp = await run(queryA);
      } else {
        return bad(c, `Failed to fetch from SolarWinds: ${resp.statusText}`);
      }
    }

    if (!resp.ok) {
      const txt = await resp.text();
      console.error(`SolarWinds API Error (${resp.status}) on fallback A: ${txt}`);
      return bad(c, `Failed to fetch from SolarWinds: ${resp.statusText}`);
    }

    const json = await resp.json() as { results?: any[] };
    let rows = Array.isArray(json.results) ? json.results : [];

    // Filter out excluded captions via KV CSV (fallback to ENV)
    const exCsv = await kvGetString(c, 'SOLARWINDS_EXCLUDE_CAPTIONS', (c.env as any).SOLARWINDS_EXCLUDE_CAPTIONS);
    const excludeList = csvToList(exCsv).map(v => v.toLowerCase());

    rows = rows.filter((r) => {
      const caption = String(r.EntityCaption || '').toLowerCase();
      return !excludeList.some((term) => caption === term || caption.startsWith(term));
    });

    const alerts: MonitoringAlert[] = rows.map((r) => ({
      id: String(r.AlertObjectID),
      type: r.EntityCaption || 'Unknown',
      affectedSystem: toAbsoluteUrl(r.EntityDetailsUrl),
      timestamp: new Date(r.TriggeredDateTime ?? Date.now()).toISOString(),
      severity: 'Info',
      validated: Boolean(r.Acknowledged ?? false),
    }));

    return ok(c, alerts);
  } catch (err) {
    console.error('Unexpected error fetching SolarWinds data:', err);
    return bad(c, 'An unexpected error occurred while fetching SolarWinds data.');
  }
});

  // — SERVICENOW TICKETS
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

      const response = await fetch(request);
      const { response: loggedResponse, data } = await logServiceNowInteraction('ServiceNowTickets', request, response);

      if (!loggedResponse.ok) {
        return bad(c, `Failed to fetch tickets from ServiceNow: ${loggedResponse.statusText}`);
      }

      if (!data || !data.result) {
        return bad(c, 'Invalid response from ServiceNow');
      }

      const tickets: ServiceNowTicket[] = data.result.map((item: any) => ({
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

  // — COLLABORATION BRIDGES CRUD —
  app.get('/api/collaboration/bridges', async (c) => {
    await CollaborationBridgeEntity.ensureSeed(c.env);
    const { items } = await CollaborationBridgeEntity.list(c.env);
    return ok(c, items);
  });

  // MODIFIED: Added checkManagementEnabled middleware
  app.post('/api/collaboration/bridges', checkManagementEnabled, async (c) => {
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

  // MODIFIED: Added checkManagementEnabled middleware
  app.put('/api/collaboration/bridges/:id', checkManagementEnabled, async (c) => {
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

  // MODIFIED: Added checkManagementEnabled middleware
  app.delete('/api/collaboration/bridges/:id', checkManagementEnabled, async (c) => {
    const id = c.req.param('id');
    const deleted = await CollaborationBridgeEntity.delete(c.env, id);
    if (!deleted) return notFound(c, 'Bridge not found');
    return ok(c, { id, deleted });
  });

  // — OUTAGE HISTORY (Trends) —
  // Matches SN list filter: **Begin on Last 7 days** AND type IN (degradation,outage)
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

    // Normalize mapping (force 'type' for impact)
    const { outageTable, fieldMapping: rawFieldMapping, impactLevelMapping } = config;
    const fieldMapping = { ...rawFieldMapping, impactLevel: 'type' };

    const impactMapping = new Map(
      impactLevelMapping.map((item) => [item.servicenowValue.toLowerCase(), item.dashboardValue])
    );

    // define sevenDaysAgo (bug #1)
    const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd HH:mm:ss');
    const typeField = fieldMapping.impactLevel; // 'type'

    // Include ongoing (end empty) OR ended within last 7 days
    const query = `${typeField}INoutage,degradation^${typeField}ISNOTEMPTY^endISEMPTY^ORend>=${sevenDaysAgo}`;
    const encodedQuery = encodeURIComponent(query);

    // build fields
    const requestedFields = new Set<string>(['sys_id', 'number', ...Object.values(fieldMapping)]);
    const fieldsParam = Array.from(requestedFields).join(',');

    const url =
      `${config.instanceUrl}/api/now/table/${outageTable}` +
      `?sysparm_display_value=true` +
      `&sysparm_query=${encodedQuery}` +
      `&sysparm_limit=200` +
      `&sysparm_fields=${fieldsParam}` +
      `&sysparm_orderby=begin`;

    try {
      const request = new Request(url, {
        headers: {
          Authorization: 'Basic ' + btoa(`${username}:${password}`),
          Accept: 'application/json',
        },
      });

      const response = await fetch(request);
      const { response: loggedResponse, data } = await logServiceNowInteraction('OutageHistory', request, response);

      if (!loggedResponse.ok) {
        console.error('OutageHistory failed:', loggedResponse.status);
        return ok(c, []);
      }

      if (!data || !data.result) {
        console.error('OutageHistory invalid data:', { data });
        return ok(c, []);
      }

      const outages: Outage[] = data.result
        .filter((record: any) => {
          const rawImpact = getProperty(record, fieldMapping.impactLevel);
          return rawImpact && String(rawImpact).trim().length > 0;
        })
        .map((record: any) => {
          const rawImpact = getProperty(record, fieldMapping.impactLevel);
          const servicenowImpact = String(rawImpact || '').toLowerCase().trim();
          const mappedImpact = impactMapping.get(servicenowImpact) || 'Degradation';

          return {
            id: record.number || record.sys_id,
            systemName: getProperty(record, fieldMapping.systemName) || 'Unknown System',
            impactLevel: mappedImpact as ImpactLevel,
            startTime: safeParseDate(getProperty(record, fieldMapping.startTime)),
            // use 'record' (bug #2) and return "Unknown" when no end
            eta: (() => {
              const rawEnd = getProperty(record, fieldMapping.eta);
              if (!rawEnd || String(rawEnd).trim().length === 0) return 'Unknown';
              return safeParseDate(rawEnd);
            })(),
            description: getProperty(record, fieldMapping.description) || 'No description provided.',
            teamsBridgeUrl: getProperty(record, fieldMapping.teamsBridgeUrl) || null,
          };
        });

      return ok(c, outages);
    } catch (error) {
      console.error('Error fetching outage history from ServiceNow:', error);
      return ok(c, []);
    }
  });


// — Change Control
app.get('/api/changes/today', async (c) => {
  const cfgEnt = new ServiceNowConfigEntity(c.env);
  const cfg = await cfgEnt.getState();
  if (!cfg.enabled || !cfg.instanceUrl) return bad(c, 'ServiceNow not configured.');

  const username = c.env[cfg.usernameVar as keyof Env] as string | undefined;
  const password = c.env[cfg.passwordVar as keyof Env] as string | undefined;
  if (!username || !password) return bad(c, 'ServiceNow creds missing.');

  const table = cfg.changeTable ?? 'change_request';

  // Field keys in your instance
  const F = {
    id: 'number',
    summary: 'short_description',
    state: 'state',
    type: 'type',
    start: 'start_date',
    end: 'end_date',
    plannedStart: 'planned_start_date',
    plannedEnd: 'planned_end_date',
    offering: 'service_offering',
  } as const;

  const fields = [
    'sys_id',
    F.id,
    F.summary,
    F.state,
    F.type,
    F.start,
    F.end,
    F.plannedStart,
    F.plannedEnd,
    F.offering,
  ].join(',');

  // "Today" windows (start OR end within today, OR overlap today), and restrict to desired states
  const q =
    // active + state restriction (include Scheduled -1, Implement 0, Review 1; keep -2 for sites that label it "Review")
    `active=true^stateIN-2,-1,0,1^` +
    // overlap via start/end
    `${F.start}<=javascript:gs.endOfToday()^${F.end}>=javascript:gs.beginningOfToday()` +
    // OR overlap via planned_* (records that only set planned_*)
    `^NQactive=true^stateIN-2,-1,0,1^` +
    `${F.plannedStart}<=javascript:gs.endOfToday()^${F.plannedEnd}>=javascript:gs.beginningOfToday()` +
    // order by earliest concrete start, falls back to planned start
    `^ORDERBY${F.start}^ORDERBY${F.plannedStart}`;

  const url =
    `${cfg.instanceUrl}/api/now/table/${table}` +
    `?sysparm_display_value=all` + // labels + raw values
    `&sysparm_query=${encodeURIComponent(q)}` +
    `&sysparm_fields=${encodeURIComponent(fields)}` +
    `&sysparm_limit=200`;

  // ---- helpers -------------------------------------------------------------

  const toIso = (v?: string | null) => {
    if (!v) return null;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(v)) return v; // already ISO Z
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v)) return v.replace(' ', 'T') + 'Z';
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  const labelOf = (v: any): string => {
    if (v == null) return '';
    if (typeof v === 'object') {
      if ('display_value' in v) return String(v.display_value ?? '');
      if ('value' in v) return String(v.value ?? '');
    }
    return String(v);
  };

  try {
    const req = new Request(url, {
      headers: {
        'Authorization': 'Basic ' + btoa(`${username}:${password}`),
        'Accept': 'application/json',
      },
    });

    const res = await fetch(req);
    const { response: loggedRes, data } =
      await logServiceNowInteraction('ChangesToday', req, res);

    if (!loggedRes.ok) {
      return bad(c, `ServiceNow error: ${loggedRes.statusText}`);
    }

    const raw = (data?.result ?? []) as any[];

    // Allow only these labels (exclude anything "cancel...")
    const ALLOW = ['scheduled', 'implement', 'review'];

    const out = raw
      .filter((r) => {
        const s = labelOf(r[F.state]).toLowerCase();
        if (!s) return false;
        if (s.includes('cancel')) return false;
        return ALLOW.some((w) => s.startsWith(w) || s.includes(w));
      })
      .map((r) => {
        // prefer concrete start/end; fall back to planned_* if concrete is empty
        const startRaw: string | null =
          r[F.start]?.value ?? r[F.start] ?? r[F.plannedStart]?.value ?? r[F.plannedStart] ?? null;
        const endRaw: string | null =
          r[F.end]?.value ?? r[F.end] ?? r[F.plannedEnd]?.value ?? r[F.plannedEnd] ?? null;

        const startISO = toIso(startRaw);
        const endISO = toIso(endRaw);

        const sysId = r.sys_id?.value ?? r.sys_id;

        return {
          id: r[F.id]?.value ?? r[F.id] ?? r.sys_id,
          number: labelOf(r[F.id]) || r.sys_id,
          offering: labelOf(r[F.offering]),
          title: labelOf(r[F.summary]) || 'Change',
          summary: labelOf(r[F.summary]) || 'Change',
          state: labelOf(r[F.state]),
          type: labelOf(r[F.type]),
          start: startISO,
          end: endISO,
          windowStart: startISO,
          windowEnd: endISO,
          url: `${cfg.instanceUrl}/nav_to.do?uri=${encodeURIComponent(
            `change_request.do?sys_id=${sysId}`
          )}`,
        };
      });

    return ok(c, out);
  } catch (e) {
    console.error('SN changes today error:', e);
    return bad(c, 'Unexpected error fetching ServiceNow changes.');
  }
});
}
