import { api } from './api';
import type {
  AiSettings,
  AiSettingsPayload,
  AiTestResult,
} from '@/types/entities';

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
};
