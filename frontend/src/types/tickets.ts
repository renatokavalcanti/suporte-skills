export interface Client {
  id: string;
  name: string;
  document: string | null;
  zohoAccountId: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { tickets: number };
}

export interface Ticket {
  id: string;
  zohoTicketId: string;
  ticketNumber: string | null;
  title: string;
  status: string;
  statusType: string | null;
  priority: string | null;
  category: string | null;
  assigneeName: string | null;
  openDate: string;
  closeDate: string | null;
  timeSpentMinutes: number;
  slaCompliant: boolean | null;
  isBillable: boolean;
  zohoModifiedAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string };
}

export interface UnmappedTicket {
  id: string;
  zohoTicketId: string;
  accountId: string | null;
  accountName: string | null;
  subject: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface UnmappedGroup {
  accountId: string | null;
  accountName: string | null;
  count: number;
}

export interface BulkLinkResult {
  requested: number;
  linked: number;
  created: number;
  updated: number;
  notFound: number;
}

export interface RefreshTimeEntriesResult {
  tickets: number;
  entries: number;
  errors: number;
}

export type MeasurementStatus = 'DRAFT' | 'CLOSED';

export interface MeasurementItem {
  id: string;
  zohoTicketId: string;
  ticketNumber: string | null;
  title: string;
  status: string;
  closeDate: string | null;
  timeSpentMinutes: number;
  slaCompliant: boolean | null;
  isBillable: boolean;
}

export interface Measurement {
  id: string;
  clientId: string;
  year: number;
  month: number;
  status: MeasurementStatus;
  ticketCount: number;
  timeSpentMinutes: number;
  slaEvaluatedCount: number;
  slaCompliantCount: number;
  slaPercentage: number | null;
  closedAt: string | null;
  closedById: string | null;
  createdAt: string;
  updatedAt: string;
  client: { id: string; name: string; document: string | null };
  items?: MeasurementItem[];
}

export interface TicketSyncSummary {
  startedAt: string;
  finishedAt: string;
  fetched: number;
  created: number;
  updated: number;
  unmapped: number;
  errors: { ticketId: string; message: string }[];
  status: 'OK' | 'ERROR';
}

export interface TicketSyncStatus {
  syncEnabled: boolean;
  configured: boolean;
  lastRun: {
    lastRunAt?: string;
    status?: string;
    fetched?: number;
    created?: number;
    updated?: number;
    unmapped?: number;
    errors?: number;
  } | null;
}
