import { api } from './api';
import type { Paginated } from '@/types/entities';
import type { Measurement, MeasurementStatus } from '@/types/tickets';

export interface MeasurementListParams {
  page?: number;
  pageSize?: number;
  clientId?: string;
  year?: number;
  month?: number;
  status?: MeasurementStatus;
}

export interface GenerateMeasurementPayload {
  clientId: string;
  year: number;
  month: number;
}

export const measurementsService = {
  async list(params: MeasurementListParams): Promise<Paginated<Measurement>> {
    const { data } = await api.get<Paginated<Measurement>>('/measurements', {
      params,
    });
    return data;
  },
  async get(id: string): Promise<Measurement> {
    const { data } = await api.get<Measurement>(`/measurements/${id}`);
    return data;
  },
  async generate(payload: GenerateMeasurementPayload): Promise<Measurement> {
    const { data } = await api.post<Measurement>('/measurements', payload);
    return data;
  },
  async close(id: string): Promise<Measurement> {
    const { data } = await api.post<Measurement>(`/measurements/${id}/close`);
    return data;
  },
  async reopen(id: string, justification: string): Promise<Measurement> {
    const { data } = await api.post<Measurement>(`/measurements/${id}/reopen`, {
      justification,
    });
    return data;
  },
};
