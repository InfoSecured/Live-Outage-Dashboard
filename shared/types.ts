export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
// --- Aegis Dashboard Types ---
export type ImpactLevel = 'SEV1' | 'SEV2' | 'SEV3' | 'Degraded';
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
export interface VendorStatus {
  id: string;
  vendorName: string;
  status: VendorStatusOption;
  statusPageUrl: string;
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