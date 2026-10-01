import { api } from './api';
import type {
  Paginated,
  RoadmapItem,
  RoadmapStatus,
} from '@/types/entities';

export interface RoadmapListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  professionalId?: string;
  vendorId?: string;
  technologyId?: string;
  certificationId?: string;
  type?: string;
  priority?: string;
  status?: string;
  from?: string;
  to?: string;
  overdue?: boolean;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface RoadmapPayload {
  professionalId?: string;
  technologyId?: string | null;
  certificationId?: string | null;
  title?: string;
  objective?: string | null;
  description?: string | null;
  type?: string;
  priority?: string;
  status?: string;
  startDate?: string | null;
  dueDate?: string | null;
  ownerId?: string | null;
  notes?: string | null;
}

export const roadmapService = {
  async list(params: RoadmapListParams): Promise<Paginated<RoadmapItem>> {
    const { data } = await api.get<Paginated<RoadmapItem>>('/roadmap', { params });
    return data;
  },
  async kanban(
    params: RoadmapListParams,
  ): Promise<Record<RoadmapStatus, RoadmapItem[]>> {
    const { data } = await api.get<Record<RoadmapStatus, RoadmapItem[]>>(
      '/roadmap/kanban',
      { params },
    );
    return data;
  },
  async timeline(params: RoadmapListParams): Promise<RoadmapItem[]> {
    const { data } = await api.get<RoadmapItem[]>('/roadmap/timeline', { params });
    return data;
  },
  async create(payload: RoadmapPayload): Promise<RoadmapItem> {
    const { data } = await api.post<RoadmapItem>('/roadmap', payload);
    return data;
  },
  async update(id: string, payload: RoadmapPayload): Promise<RoadmapItem> {
    const { data } = await api.put<RoadmapItem>(`/roadmap/${id}`, payload);
    return data;
  },
  async setStatus(id: string, status: RoadmapStatus): Promise<RoadmapItem> {
    const { data } = await api.patch<RoadmapItem>(`/roadmap/${id}/status`, {
      status,
    });
    return data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/roadmap/${id}`);
  },
};
