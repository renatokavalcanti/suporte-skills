import { api } from './api';
import type { Paginated, Vendor } from '@/types/entities';

export interface VendorListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  active?: boolean;
  partnershipStatus?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface VendorPayload {
  name?: string;
  website?: string | null;
  logoUrl?: string | null;
  partnershipStatus?: string;
  partnershipLevel?: string | null;
  partnershipStartDate?: string | null;
  partnershipRenewalDate?: string | null;
  notes?: string | null;
  active?: boolean;
}

export const vendorsService = {
  async list(params: VendorListParams): Promise<Paginated<Vendor>> {
    const { data } = await api.get<Paginated<Vendor>>('/vendors', { params });
    return data;
  },
  async create(payload: VendorPayload): Promise<Vendor> {
    const { data } = await api.post<Vendor>('/vendors', payload);
    return data;
  },
  async update(id: string, payload: VendorPayload): Promise<Vendor> {
    const { data } = await api.put<Vendor>(`/vendors/${id}`, payload);
    return data;
  },
  async setActive(id: string, active: boolean): Promise<Vendor> {
    const { data } = await api.patch<Vendor>(`/vendors/${id}/status`, { active });
    return data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/vendors/${id}`);
  },
};
