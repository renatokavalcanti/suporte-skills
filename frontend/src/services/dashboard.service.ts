import { api } from './api';
import type { DashboardOverview } from '@/types/entities';

export const dashboardService = {
  async get(): Promise<DashboardOverview> {
    const { data } = await api.get<DashboardOverview>('/dashboard');
    return data;
  },
};
