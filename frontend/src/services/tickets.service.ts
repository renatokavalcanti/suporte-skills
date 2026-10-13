import { api } from './api';
import type { Paginated } from '@/types/entities';
import type {
  BulkLinkResult,
  RefreshTimeEntriesResult,
  Ticket,
  TicketSyncStatus,
  TicketSyncSummary,
  UnmappedGroup,
  UnmappedTicket,
} from '@/types/tickets';

export interface TicketListParams {
  page?: number;
  pageSize?: number;
  clientId?: string;
  status?: string;
  search?: string;
  from?: string;
  to?: string;
  billable?: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
}

export const ticketsService = {
  async list(params: TicketListParams): Promise<Paginated<Ticket>> {
    const { data } = await api.get<Paginated<Ticket>>('/tickets', { params });
    return data;
  },
  async get(id: string): Promise<Ticket> {
    const { data } = await api.get<Ticket>(`/tickets/${id}`);
    return data;
  },
  async sync(): Promise<TicketSyncSummary> {
    const { data } = await api.post<TicketSyncSummary>('/tickets/sync');
    return data;
  },
  async syncStatus(): Promise<TicketSyncStatus> {
    const { data } = await api.get<TicketSyncStatus>('/tickets/sync/status');
    return data;
  },
  async refreshTimeEntries(): Promise<RefreshTimeEntriesResult> {
    const { data } = await api.post<RefreshTimeEntriesResult>(
      '/tickets/sync/time-entries',
    );
    return data;
  },
  async unmapped(params: {
    page?: number;
    pageSize?: number;
  }): Promise<Paginated<UnmappedTicket>> {
    const { data } = await api.get<Paginated<UnmappedTicket>>(
      '/tickets/unmapped',
      { params },
    );
    return data;
  },
  async linkUnmapped(
    id: string,
    clientId: string,
  ): Promise<{ id: string; zohoTicketId: string; clientId: string }> {
    const { data } = await api.post<{
      id: string;
      zohoTicketId: string;
      clientId: string;
    }>(`/tickets/unmapped/${id}/link`, { clientId });
    return data;
  },
  async unmappedGroups(): Promise<UnmappedGroup[]> {
    const { data } = await api.get<UnmappedGroup[]>('/tickets/unmapped/groups');
    return data;
  },
  async linkUnmappedBulk(payload: {
    clientId: string;
    ids?: string[];
    accountId?: string;
  }): Promise<BulkLinkResult> {
    const { data } = await api.post<BulkLinkResult>(
      '/tickets/unmapped/link',
      payload,
    );
    return data;
  },
};
