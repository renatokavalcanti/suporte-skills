import { api } from './api';
import type {
  AiSettings,
  AiSettingsPayload,
  AiTestResult,
} from '@/types/entities';
import type {
  BrandingSettings,
  EmailSettingsPayload,
  EmailSettingsView,
} from '@/types/reports';

export const settingsService = {
  async getAi(): Promise<AiSettings> {
    const { data } = await api.get<AiSettings>('/settings/ai');
    return data;
  },
  async updateAi(payload: AiSettingsPayload): Promise<AiSettings> {
    const { data } = await api.put<AiSettings>('/settings/ai', payload);
    return data;
  },
  async testAi(
    payload: Omit<AiSettingsPayload, 'enabled' | 'clearApiKey' | 'digestEnabled'>,
  ): Promise<AiTestResult> {
    const { data } = await api.post<AiTestResult>('/settings/ai/test', payload);
    return data;
  },

  async getEmail(): Promise<EmailSettingsView> {
    const { data } = await api.get<EmailSettingsView>('/settings/email');
    return data;
  },
  async updateEmail(payload: EmailSettingsPayload): Promise<EmailSettingsView> {
    const { data } = await api.put<EmailSettingsView>('/settings/email', payload);
    return data;
  },
  async testEmail(
    payload: EmailSettingsPayload & { to?: string } = {},
  ): Promise<{ ok: true; message: string }> {
    const { data } = await api.post<{ ok: true; message: string }>(
      '/settings/email/test',
      payload,
    );
    return data;
  },

  async getBranding(): Promise<BrandingSettings> {
    const { data } = await api.get<BrandingSettings>('/settings/branding');
    return data;
  },
  async updateBranding(
    payload: Partial<BrandingSettings> & { clearLogo?: boolean },
  ): Promise<BrandingSettings> {
    const { data } = await api.put<BrandingSettings>(
      '/settings/branding',
      payload,
    );
    return data;
  },
};
