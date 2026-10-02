import { api } from './api';
import type {
  AuditLogEntry,
  Paginated,
  Professional,
  ProfessionalCertification,
  RoadmapItem,
  TechnologyCoverage,
} from '@/types/entities';

export interface ProfessionalListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  active?: boolean;
  role?: string;
  professionalType?: string;
  seniority?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface ProfessionalPayload {
  name?: string;
  email?: string;
  position?: string | null;
  professionalType?: string | null;
  seniority?: string | null;
  hireDate?: string | null;
  notes?: string | null;
  role?: string;
  password?: string | null;
  mustChangePassword?: boolean;
  active?: boolean;
}

export interface ProfessionalCertificationPayload {
  certificationId?: string;
  obtainedAt?: string | null;
  expiresAt?: string | null;
  certificateNumber?: string | null;
  proofUrl?: string | null;
  notes?: string | null;
}

export const professionalsService = {
  async list(params: ProfessionalListParams): Promise<Paginated<Professional>> {
    const { data } = await api.get<Paginated<Professional>>('/professionals', {
      params,
    });
    return data;
  },
  async get(id: string): Promise<Professional> {
    const { data } = await api.get<Professional>(`/professionals/${id}`);
    return data;
  },
  async create(payload: ProfessionalPayload): Promise<Professional> {
    const { data } = await api.post<Professional>('/professionals', payload);
    return data;
  },
  async update(id: string, payload: ProfessionalPayload): Promise<Professional> {
    const { data } = await api.put<Professional>(`/professionals/${id}`, payload);
    return data;
  },
  async setActive(id: string, active: boolean): Promise<Professional> {
    const { data } = await api.patch<Professional>(`/professionals/${id}/status`, {
      active,
    });
    return data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/professionals/${id}`);
  },

  // --- Relacionamentos (Fase 3) -------------------------------------------

  async certifications(id: string): Promise<ProfessionalCertification[]> {
    const { data } = await api.get<ProfessionalCertification[]>(
      `/professionals/${id}/certifications`,
    );
    return data;
  },
  async addCertification(
    id: string,
    payload: ProfessionalCertificationPayload,
  ): Promise<ProfessionalCertification> {
    const { data } = await api.post<ProfessionalCertification>(
      `/professionals/${id}/certifications`,
      payload,
    );
    return data;
  },
  async updateCertification(
    id: string,
    recordId: string,
    payload: ProfessionalCertificationPayload,
  ): Promise<ProfessionalCertification> {
    const { data } = await api.put<ProfessionalCertification>(
      `/professionals/${id}/certifications/${recordId}`,
      payload,
    );
    return data;
  },
  async removeCertification(id: string, recordId: string): Promise<void> {
    await api.delete(`/professionals/${id}/certifications/${recordId}`);
  },

  // --- Anexo do comprovante (D-025) ---------------------------------------

  async uploadAttachment(
    id: string,
    recordId: string,
    file: File,
  ): Promise<ProfessionalCertification> {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post<ProfessionalCertification>(
      `/professionals/${id}/certifications/${recordId}/attachment`,
      form,
    );
    return data;
  },
  async removeAttachment(id: string, recordId: string): Promise<void> {
    await api.delete(`/professionals/${id}/certifications/${recordId}/attachment`);
  },
  async fetchAttachment(id: string, recordId: string): Promise<Blob> {
    const { data } = await api.get<Blob>(
      `/professionals/${id}/certifications/${recordId}/attachment`,
      { responseType: 'blob' },
    );
    return data;
  },
  async technologies(id: string): Promise<TechnologyCoverage[]> {
    const { data } = await api.get<TechnologyCoverage[]>(
      `/professionals/${id}/technologies`,
    );
    return data;
  },
  async history(id: string): Promise<AuditLogEntry[]> {
    const { data } = await api.get<AuditLogEntry[]>(
      `/professionals/${id}/history`,
    );
    return data;
  },
  async roadmap(id: string): Promise<RoadmapItem[]> {
    const { data } = await api.get<RoadmapItem[]>(
      `/professionals/${id}/roadmap`,
    );
    return data;
  },
};
