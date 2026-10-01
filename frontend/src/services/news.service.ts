import { api } from './api';
import type {
  NewsDigest,
  NewsDigestResponse,
  NewsItem,
  NewsSource,
  NewsSummary,
  Paginated,
  SyncSourceResult,
  SyncSummary,
} from '@/types/entities';

export interface NewsListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  vendorId?: string;
  technologyId?: string;
  sourceId?: string;
  kind?: string;
  unread?: boolean;
  saved?: boolean;
  pinned?: boolean;
  from?: string;
  to?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface NewsItemPayload {
  vendorId?: string | null;
  technologyId?: string | null;
  title?: string;
  url?: string;
  summary?: string | null;
  author?: string | null;
  kind?: string;
  publishedAt?: string | null;
  pinned?: boolean;
}

export interface NewsSourcePayload {
  vendorId?: string;
  technologyId?: string | null;
  name?: string;
  url?: string | null;
  connectorType?: string;
  active?: boolean;
  fetchIntervalMinutes?: number | null;
}

export interface NewsSourceListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  vendorId?: string;
  active?: boolean;
}

export const newsService = {
  async list(params: NewsListParams): Promise<Paginated<NewsItem>> {
    const { data } = await api.get<Paginated<NewsItem>>('/news', { params });
    return data;
  },
  async summary(): Promise<NewsSummary> {
    const { data } = await api.get<NewsSummary>('/news/summary');
    return data;
  },
  async getDigest(): Promise<NewsDigestResponse> {
    const { data } = await api.get<NewsDigestResponse>('/news/digest');
    return data;
  },
  async generateDigest(): Promise<NewsDigest> {
    const { data } = await api.post<NewsDigest>('/news/digest');
    return data;
  },
  async get(id: string): Promise<NewsItem> {
    const { data } = await api.get<NewsItem>(`/news/${id}`);
    return data;
  },
  async create(payload: NewsItemPayload): Promise<NewsItem> {
    const { data } = await api.post<NewsItem>('/news', payload);
    return data;
  },
  async update(id: string, payload: NewsItemPayload): Promise<NewsItem> {
    const { data } = await api.put<NewsItem>(`/news/${id}`, payload);
    return data;
  },
  async setPinned(id: string, pinned: boolean): Promise<NewsItem> {
    const { data } = await api.patch<NewsItem>(`/news/${id}/pin`, { pinned });
    return data;
  },
  async setRead(id: string, read: boolean): Promise<void> {
    await api.patch(`/news/${id}/read`, { read });
  },
  async setSaved(id: string, saved: boolean): Promise<void> {
    await api.patch(`/news/${id}/save`, { saved });
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/news/${id}`);
  },
  async syncAll(): Promise<SyncSummary> {
    const { data } = await api.post<SyncSummary>('/news/sync');
    return data;
  },
};

export const newsSourcesService = {
  async list(params: NewsSourceListParams): Promise<Paginated<NewsSource>> {
    const { data } = await api.get<Paginated<NewsSource>>('/news/sources', {
      params,
    });
    return data;
  },
  async create(payload: NewsSourcePayload): Promise<NewsSource> {
    const { data } = await api.post<NewsSource>('/news/sources', payload);
    return data;
  },
  async update(id: string, payload: NewsSourcePayload): Promise<NewsSource> {
    const { data } = await api.put<NewsSource>(`/news/sources/${id}`, payload);
    return data;
  },
  async setActive(id: string, active: boolean): Promise<NewsSource> {
    const { data } = await api.patch<NewsSource>(
      `/news/sources/${id}/status`,
      { active },
    );
    return data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/news/sources/${id}`);
  },
  async sync(id: string): Promise<SyncSourceResult> {
    const { data } = await api.post<SyncSourceResult>(
      `/news/sources/${id}/sync`,
    );
    return data;
  },
};
