import { api } from './api';
import type { Paginated } from '@/types/entities';
import type { Client } from '@/types/tickets';

export interface ClientListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  active?: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface ClientPayload {
  name?: string;
  document?: string | null;
  zohoAccountId?: string | null;
  active?: boolean;
}

export const clientsService = {
  async list(params: ClientListParams): Promise<Paginated<Client>> {
    const { data } = await api.get<Paginated<Client>>('/clients', { params });
    return data;
  },
  async create(payload: ClientPayload): Promise<Client> {
    const { data } = await api.post<Client>('/clients', payload);
    return data;
  },
  async update(id: string, payload: ClientPayload): Promise<Client> {
    const { data } = await api.put<Client>(`/clients/${id}`, payload);
    return data;
  },
  async setActive(id: string, active: boolean): Promise<Client> {
    const { data } = await api.patch<Client>(`/clients/${id}/status`, { active });
    return data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/clients/${id}`);
  },
};
