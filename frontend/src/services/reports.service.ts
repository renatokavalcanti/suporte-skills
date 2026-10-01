import axios from 'axios';
import { api } from './api';
import type { ReportKey, ReportResult } from '@/types/entities';

export interface ReportParams {
  professionalId?: string;
  vendorId?: string;
  technologyId?: string;
}

export const reportsService = {
  async get(key: ReportKey, params: ReportParams): Promise<ReportResult> {
    const { data } = await api.get<ReportResult>(`/reports/${key}`, {
      params: { ...params, format: 'json' },
    });
    return data;
  },

  async downloadCsv(
    key: ReportKey,
    params: ReportParams,
    filename: string,
  ): Promise<void> {
    const response = await api.get(`/reports/${key}`, {
      params: { ...params, format: 'csv' },
      responseType: 'blob',
    });
    const blob = new Blob([response.data as BlobPart], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};

export function isAxiosForbidden(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 403;
}
