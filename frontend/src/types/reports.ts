export type BalancePolicy = 'EXPIRE' | 'ACCUMULATE';
export type BillingStatus = 'STANDARD' | 'WITH_EXTRA_HOURS';
export type GeneratedReportType = 'FINANCIAL' | 'CLIENT';

export interface Contract {
  id: string;
  clientId: string;
  planName: string;
  includedMinutes: number;
  monthlyValue: string;
  extraHourValue: string;
  balancePolicy: BalancePolicy;
  startDate: string;
  endDate: string | null;
  financeEmail: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string };
}

export interface TechnologyMetric {
  name: string;
  tickets: number;
  minutes: number;
  hoursLabel: string;
}

export interface TicketAlert {
  type: 'NO_HOURS' | 'NO_TECHNOLOGY' | 'NO_CONTRACT';
  message: string;
  ticketId?: string;
  clientId?: string;
}

export interface BillingResult {
  includedMinutes: number;
  carriedMinutes: number;
  availableMinutes: number;
  consumedMinutes: number;
  extraMinutes: number;
  extraHours: number;
  status: BillingStatus;
  monthlyValue: number;
  extraAmount: number;
  totalValue: number;
}

export interface TicketReportPreview {
  client: { id: string; name: string } | null;
  period: {
    start: string;
    end: string;
    startIso: string;
    endIso: string;
    year?: number;
    month?: number;
    from?: string;
    to?: string;
  };
  timezone: string;
  metrics: {
    closedCount: number;
    openedCount: number;
    openAtEndCount: number;
    totalMinutes: number;
    hoursLabel: string;
    averageResolutionMinutes: number | null;
    averageResolutionLabel: string | null;
    technologies: TechnologyMetric[];
  };
  billing: BillingResult | null;
  alerts: TicketAlert[];
}

export interface GeneratedReport {
  id: string;
  clientId: string;
  type: GeneratedReportType;
  periodStart: string;
  periodEnd: string;
  billingStatus: BillingStatus | null;
  fileName: string | null;
  generatedAt: string;
  sentAt: string | null;
  sentTo: string | null;
  createdAt: string;
  client: { id: string; name: string };
  generatedBy: { id: string; name: string } | null;
}

export interface FinancialPreview {
  subject: string;
  to: string;
  text: string;
  html: string;
  attachmentFileName: string;
}

export interface ClientPreview {
  html: string;
  periodLabel: string;
  warnings: string[];
}

export interface PeriodParams {
  clientId?: string;
  year?: number;
  month?: number;
  from?: string;
  to?: string;
}

export type ZohoDataCenter = 'com' | 'eu' | 'in' | 'au' | 'cn' | 'jp';
export type ZohoSyncFrequency = 'MANUAL' | 'HOURLY' | 'SIX_HOURS' | 'DAILY';

export interface ZohoSettingsView {
  configured: boolean;
  secretSource: 'settings' | 'env' | 'none';
  dataCenter: ZohoDataCenter;
  clientId: string;
  orgId: string;
  clientSecretSet: boolean;
  refreshTokenSet: boolean;
  redirectUri: string;
  apiBaseUrl: string;
  accountsBaseUrl: string;
  scopes: string[];
  technologyField: string | null;
  clientSource: 'ACCOUNT' | 'CONTACT';
  closedStatuses: string[];
  syncEnabled: boolean;
  syncFrequency: ZohoSyncFrequency;
  syncIntervalMinutes: number;
}

export interface ZohoSettingsPayload {
  dataCenter?: ZohoDataCenter;
  clientId?: string;
  clientSecret?: string;
  clearClientSecret?: boolean;
  refreshToken?: string;
  clearRefreshToken?: boolean;
  orgId?: string;
  scopes?: string[];
  technologyField?: string;
  clientSource?: 'ACCOUNT' | 'CONTACT';
  closedStatuses?: string[];
  syncFrequency?: ZohoSyncFrequency;
}

export interface ZohoSyncLogEntry {
  at: string;
  status: string;
  fetched: number;
  created: number;
  updated: number;
  unmapped: number;
  errors: number;
}

export interface EmailSettingsView {
  configured: boolean;
  enabled: boolean;
  transport: 'SMTP' | 'GRAPH';
  fromName: string;
  fromAddress: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPasswordSet: boolean;
  graphTenantId: string;
  graphClientId: string;
  graphClientSecretSet: boolean;
}

export interface EmailSettingsPayload {
  enabled?: boolean;
  transport?: 'SMTP' | 'GRAPH';
  fromName?: string;
  fromAddress?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPassword?: string;
  clearSmtpPassword?: boolean;
  graphTenantId?: string;
  graphClientId?: string;
  graphClientSecret?: string;
  clearGraphClientSecret?: boolean;
}

export interface BrandingSettings {
  companyName: string;
  primaryColor: string;
  secondaryColor: string;
  logoDataUrl: string | null;
  contactLine: string;
  website: string;
}
