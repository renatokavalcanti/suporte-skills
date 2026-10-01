import { api } from './api';
import type { Paginated, Technology } from '@/types/entities';

export interface TechnologyListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  vendorId?: string;
  category?: string;
  active?: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface TechnologyPayload {
  vendorId?: string;
  name?: string;
  category?: string | null;
  description?: string | null;
  active?: boolean;
}

export const technologiesService = {
  async list(params: TechnologyListParams): Promise<Paginated<Technology>> {
    const { data } = await api.get<Paginated<Technology>>('/technologies', {
      params,
    });
    return data;
  },
  async create(payload: TechnologyPayload): Promise<Technology> {
    const { data } = await api.post<Technology>('/technologies', payload);
    return data;
  },
  async update(id: string, payload: TechnologyPayload): Promise<Technology> {
    const { data } = await api.put<Technology>(`/technologies/${id}`, payload);
    return data;
  },
  async setActive(id: string, active: boolean): Promise<Technology> {
    const { data } = await api.patch<Technology>(
      `/technologies/${id}/status`,
      { active },
    );
    return data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/technologies/${id}`);
  },
};
