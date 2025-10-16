import type { Outage, VendorStatus, MonitoringAlert, ServiceNowTicket, CollaborationBridge } from './types';
import { subMinutes, addHours, subHours, subDays } from 'date-fns';
export const MOCK_OUTAGES: Outage[] = [
  {
    id: 'outage-001',
    systemName: 'API Gateway (Prod-US-East-1)',
    impactLevel: 'Outage',
    startTime: subMinutes(new Date(), 15).toISOString(),
    eta: addHours(new Date(), 1).toISOString(),
    teamsBridgeUrl: 'https://teams.microsoft.com/l/meetup-join/...',
    description: 'Experiencing intermittent 5xx errors. Engineering is investigating.'
  },
  {
    id: 'outage-002',
    systemName: 'Customer Authentication Service',
    impactLevel: 'Outage',
    startTime: subMinutes(new Date(), 45).toISOString(),
    eta: addHours(new Date(), 2).toISOString(),
    teamsBridgeUrl: 'https://teams.microsoft.com/l/meetup-join/...',
    description: 'Increased latency on login and token refresh endpoints.'
  },
  {
    id: 'outage-003',
    systemName: 'Internal Citrix VDI',
    impactLevel: 'Degradation',
    startTime: subMinutes(new Date(), 120).toISOString(),
    eta: addHours(new Date(), 4).toISOString(),
    teamsBridgeUrl: null,
    description: 'Users reporting slow application load times. Root cause analysis in progress.'
  },
  {
    id: 'outage-004',
    systemName: 'Billing Processor Queue',
    impactLevel: 'Degradation',
    startTime: subMinutes(new Date(), 25).toISOString(),
    eta: addHours(new Date(), 1).toISOString(),
    teamsBridgeUrl: null,
    description: 'Message processing is delayed. No data loss expected.'
  },
];
export const MOCK_ALERTS: MonitoringAlert[] = [
  {
    id: 'alert-01',
    type: 'High CPU Utilization',
    affectedSystem: 'kube-cluster-prod-us-east-1',
    timestamp: subMinutes(new Date(), 2).toISOString(),
    severity: 'Critical',
    validated: true,
  },
  {
    id: 'alert-02',
    type: 'Disk Space Low',
    affectedSystem: 'db-primary-prod-us-west-2',
    timestamp: subMinutes(new Date(), 10).toISOString(),
    severity: 'Warning',
    validated: true,
  },
  {
    id: 'alert-03',
    type: 'Pod CrashLoopBackOff',
    affectedSystem: 'auth-service-pod-xyz123',
    timestamp: subMinutes(new Date(), 12).toISOString(),
    severity: 'Critical',
    validated: false,
  },
  {
    id: 'alert-04',
    type: 'Network Latency',
    affectedSystem: 'api-gateway-prod-eu-central-1',
    timestamp: subMinutes(new Date(), 30).toISOString(),
    severity: 'Info',
    validated: true,
  },
  {
    id: 'alert-05',
    type: 'SSL Certificate Expiring',
    affectedSystem: 'portal.example.com',
    timestamp: subHours(new Date(), 2).toISOString(),
    severity: 'Warning',
    validated: false,
  },
];
export const MOCK_TICKETS: ServiceNowTicket[] = [
  {
    id: 'INC001001',
    summary: 'API Gateway 5xx errors in prod',
    affectedCI: 'API Gateway (Prod-US-East-1)',
    status: 'In Progress',
    assignedTeam: 'NetOps',
    ticketUrl: '#',
  },
  {
    id: 'INC001002',
    summary: 'Users reporting slow login times',
    affectedCI: 'Customer Authentication Service',
    status: 'In Progress',
    assignedTeam: 'AppDev-Auth',
    ticketUrl: '#',
  },
  {
    id: 'INC001003',
    summary: 'Citrix VDI performance degradation',
    affectedCI: 'Internal Citrix VDI',
    status: 'New',
    assignedTeam: 'Desktop Support',
    ticketUrl: '#',
  },
  {
    id: 'INC001004',
    summary: 'Investigate high CPU on kube cluster',
    affectedCI: 'kube-cluster-prod-us-east-1',
    status: 'On Hold',
    assignedTeam: 'SRE',
    ticketUrl: '#',
  },
];
export const MOCK_OUTAGE_HISTORY: Outage[] = [
  // Today
  ...MOCK_OUTAGES,
  // Yesterday
  { id: 'hist-01', systemName: 'Data Pipeline', impactLevel: 'Outage', startTime: subDays(new Date(), 1).toISOString(), eta: subDays(new Date(), 1).toISOString(), teamsBridgeUrl: null, description: '' },
  { id: 'hist-02', systemName: 'Reporting Service', impactLevel: 'Degradation', startTime: subDays(new Date(), 1).toISOString(), eta: subDays(new Date(), 1).toISOString(), teamsBridgeUrl: null, description: '' },
  // 2 days ago
  { id: 'hist-03', systemName: 'Internal DNS', impactLevel: 'Outage', startTime: subDays(new Date(), 2).toISOString(), eta: subDays(new Date(), 2).toISOString(), teamsBridgeUrl: null, description: '' },
  // 3 days ago
  { id: 'hist-04', systemName: 'VPN Concentrator', impactLevel: 'Degradation', startTime: subDays(new Date(), 3).toISOString(), eta: subDays(new Date(), 3).toISOString(), teamsBridgeUrl: null, description: '' },
  { id: 'hist-05', systemName: 'CI/CD Platform', impactLevel: 'Degradation', startTime: subDays(new Date(), 3).toISOString(), eta: subDays(new Date(), 3).toISOString(), teamsBridgeUrl: null, description: '' },
  // 5 days ago
  { id: 'hist-06', systemName: 'Object Storage (EU)', impactLevel: 'Outage', startTime: subDays(new Date(), 5).toISOString(), eta: subDays(new Date(), 5).toISOString(), teamsBridgeUrl: null, description: '' },
  { id: 'hist-07', systemName: 'Object Storage (EU)', impactLevel: 'Degradation', startTime: subDays(new Date(), 5).toISOString(), eta: subDays(new Date(), 5).toISOString(), teamsBridgeUrl: null, description: '' },
  // 6 days ago
  { id: 'hist-08', systemName: 'API Gateway (Prod-EU-West-1)', impactLevel: 'Outage', startTime: subDays(new Date(), 6).toISOString(), eta: subDays(new Date(), 6).toISOString(), teamsBridgeUrl: null, description: '' },
];