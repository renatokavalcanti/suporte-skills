import { api } from './api';
import type { Certification, Paginated } from '@/types/entities';

export interface CertificationListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  vendorId?: string;
  technologyId?: string;
  level?: string;
  catalogStatus?: string;
  active?: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface CertificationPayload {
  vendorId?: string;
  technologyId?: string | null;
  name?: string;
  code?: string | null;
  level?: string | null;
  officialUrl?: string | null;
  validityMonths?: number | null;
  catalogStatus?: string;
  description?: string | null;
  notes?: string | null;
  active?: boolean;
}

export const certificationsService = {
  async list(
    params: CertificationListParams,
  ): Promise<Paginated<Certification>> {
    const { data } = await api.get<Paginated<Certification>>('/certifications', {
      params,
    });
    return data;
  },
  async create(payload: CertificationPayload): Promise<Certification> {
    const { data } = await api.post<Certification>('/certifications', payload);
    return data;
  },
  async update(
    id: string,
    payload: CertificationPayload,
  ): Promise<Certification> {
    const { data } = await api.put<Certification>(
      `/certifications/${id}`,
      payload,
    );
    return data;
  },
  async setActive(id: string, active: boolean): Promise<Certification> {
    const { data } = await api.patch<Certification>(
      `/certifications/${id}/status`,
      { active },
    );
    return data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/certifications/${id}`);
  },
};
