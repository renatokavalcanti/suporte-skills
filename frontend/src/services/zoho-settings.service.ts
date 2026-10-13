import { api } from './api';
import type { TicketSyncSummary } from '@/types/tickets';
import type {
  ZohoSettingsPayload,
  ZohoSettingsView,
  ZohoSyncLogEntry,
} from '@/types/reports';

export const zohoSettingsService = {
  async get(): Promise<ZohoSettingsView> {
    const { data } = await api.get<ZohoSettingsView>('/settings/zoho');
    return data;
  },
  async update(payload: ZohoSettingsPayload): Promise<ZohoSettingsView> {
    const { data } = await api.put<ZohoSettingsView>('/settings/zoho', payload);
    return data;
  },
  async test(
    payload: Partial<
      Pick<
        ZohoSettingsPayload,
        'dataCenter' | 'clientId' | 'clientSecret' | 'refreshToken' | 'orgId'
      >
    >,
  ): Promise<{ ok: true; message: string }> {
    const { data } = await api.post<{ ok: true; message: string }>(
      '/settings/zoho/test',
      payload,
    );
    return data;
  },
  async authUrl(): Promise<{ url: string }> {
    const { data } = await api.get<{ url: string }>('/settings/zoho/auth-url');
    return data;
  },
  async sync(): Promise<TicketSyncSummary> {
    const { data } = await api.post<TicketSyncSummary>('/settings/zoho/sync');
    return data;
  },
  async syncLog(): Promise<ZohoSyncLogEntry[]> {
    const { data } = await api.get<ZohoSyncLogEntry[]>(
      '/settings/zoho/sync-log',
    );
    return data;
  },
  async disconnect(): Promise<ZohoSettingsView> {
    const { data } = await api.post<ZohoSettingsView>(
      '/settings/zoho/disconnect',
    );
    return data;
  },
};
