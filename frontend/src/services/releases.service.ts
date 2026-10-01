import { api } from './api';
import type { Paginated, Release } from '@/types/entities';

export interface ReleaseListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  current?: boolean;
}

export interface ReleaseItemPayload {
  category: string;
  description: string;
  position?: number;
}

export interface ReleasePayload {
  version?: string;
  title?: string;
  summary?: string | null;
  releasedAt?: string;
  current?: boolean;
  items?: ReleaseItemPayload[];
}

export const releasesService = {
  async list(params: ReleaseListParams): Promise<Paginated<Release>> {
    const { data } = await api.get<Paginated<Release>>('/releases', { params });
    return data;
  },
  async get(id: string): Promise<Release> {
    const { data } = await api.get<Release>(`/releases/${id}`);
    return data;
  },
  async create(payload: ReleasePayload): Promise<Release> {
    const { data } = await api.post<Release>('/releases', payload);
    return data;
  },
  async update(id: string, payload: ReleasePayload): Promise<Release> {
    const { data } = await api.put<Release>(`/releases/${id}`, payload);
    return data;
  },
  async setCurrent(id: string): Promise<Release> {
    const { data } = await api.patch<Release>(`/releases/${id}/current`);
    return data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/releases/${id}`);
  },
};
