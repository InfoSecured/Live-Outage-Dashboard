export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
// --- Aegis Dashboard Types ---
export type ImpactLevel = 'Outage' | 'Degradation';
export type VendorStatusOption = 'Operational' | 'Degraded' | 'Outage';
export type AlertSeverity = 'Critical' | 'Warning' | 'Info';
export type TicketStatus = 'New' | 'In Progress' | 'On Hold' | 'Resolved';
export interface Outage {
  id: string;
  systemName: string;
  impactLevel: ImpactLevel;
  startTime: string; // ISO 8601 string
  eta: string; // ISO 8601 string
  teamsBridgeUrl: string | null;
  description: string;
}
// Extended Vendor entity for dynamic configuration
export type VendorStatusType = 'API_JSON' | 'MANUAL';
export interface Vendor {
  id: string;
  name: string;
  url: string;
  statusType: VendorStatusType;
  apiUrl?: string | null;
  jsonPath?: string | null;
  expectedValue?: string | null;
}
// Updated VendorStatus to align with Vendor entity
export interface VendorStatus {
  id: string;
  name: string;
  status: VendorStatusOption;
  url: string;
}
export interface MonitoringAlert {
  id: string;
  type: string;
  affectedSystem: string;
  timestamp: string; // ISO 8601 string
  severity: AlertSeverity;
  validated: boolean;
}
export interface ServiceNowTicket {
  id: string;
  summary: string;
  affectedCI: string;
  status: TicketStatus;
  assignedTeam: string;
  ticketUrl: string;
}
export interface CollaborationBridge {
  id:string;
  title: string;
  participants: number;
  duration: string; // e.g., "45m"
  isHighSeverity: boolean;
  teamsCallUrl: string;
}
// New ServiceNow Configuration Types
export interface ServiceNowFieldMapping {
  systemName: string;
  impactLevel: string;
  startTime: string;
  eta: string;
  description: string;
  teamsBridgeUrl: string;
}
export interface ServiceNowTicketFieldMapping {
  id: string;
  summary: string;
  affectedCI: string;
  status: string;
  assignedTeam: string;
  priority: string;
}
export interface ImpactLevelMappingItem {
  servicenowValue: string;
  dashboardValue: ImpactLevel;
}
export interface ServiceNowConfig {
  id: string; // Singleton ID
  enabled: boolean;
  instanceUrl: string;
  usernameVar: string;
  passwordVar: string;
  outageTable: string;
  fieldMapping: ServiceNowFieldMapping;
  impactLevelMapping: ImpactLevelMappingItem[];
  ticketTable: string;
  ticketFieldMapping: ServiceNowTicketFieldMapping;
}
// New SolarWinds Configuration Type
export interface SolarWindsConfig {
  id: string; // Singleton ID
  enabled: boolean;
  apiUrl: string;
  usernameVar: string;
  passwordVar: string;
}
// --- Original Template Types (can be removed if not used) ---
export interface User {
  id: string;
  name: string;
}
export interface Chat {
  id: string;
  title: string;
}
export interface ChatMessage {
  id: string;
  chatId: string;
  userId: string;
  text: string;
  ts: number; // epoch millis
}