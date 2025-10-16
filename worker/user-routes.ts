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

// FIXED: New helper for detailed ServiceNow API logging
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
} catch (e) {
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

// — VENDOR CRUD —
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

// — VENDOR STATUS (Now Dynamic & Resilient) —
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

// — SERVICENOW CONFIG —
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

// — ACTIVE OUTAGES (Now Dynamic) - FIXED —
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

  const { outageTable, fieldMapping, impactLevelMapping } = config;
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
      eta: safeParseDate(getProperty(item, fieldMapping.eta)),
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

// — SOLARWINDS CONFIG —
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

// — MONITORING ALERTS (Now Dynamic) —
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

// — SERVICENOW TICKETS (Now Dynamic) - FIXED —
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

// — OUTAGE HISTORY (Now Dynamic) - FIXED —
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

// ServiceNow query for records where 'end' time is in the last 7 days
// AND type is either 'outage' or 'degradation'
const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd HH:mm:ss');
const typeField = fieldMapping.impactLevel;
const query = `end>=${sevenDaysAgo}^${typeField}IN outage,degradation`;
const encodedQuery = encodeURIComponent(query);
const url = `${config.instanceUrl}/api/now/table/${outageTable}?sysparm_display_value=true&sysparm_query=${encodedQuery}&sysparm_fields=sys_id,number,${fields}`;

try {
  const request = new Request(url, {
    headers: {
      'Authorization': 'Basic ' + btoa(`${username}:${password}`),
      'Accept': 'application/json',
    },
  });

  const response = await fetch(request);
  const { response: loggedResponse, data } = await logServiceNowInteraction('OutageHistory', request, response);

  if (!loggedResponse.ok) {
    return bad(c, `Failed to fetch outage history from ServiceNow: ${loggedResponse.statusText}`);
  }

  if (!data || !data.result) {
    return bad(c, 'Invalid response from ServiceNow');
  }

  const outages: Outage[] = data.result.map((item: any) => {
    const rawImpact = getProperty(item, fieldMapping.impactLevel);
    const servicenowImpact = String(rawImpact || '').toLowerCase().trim();
    const mappedImpact = impactMapping.get(servicenowImpact) || 'Degradation';
    return {
      id: item.number || item.sys_id,
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
