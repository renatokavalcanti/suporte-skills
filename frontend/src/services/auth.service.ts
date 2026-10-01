import { api } from './api';
import type { AuthUser, LoginResponse } from '@/types/api';

export const authService = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>('/auth/login', {
      email,
      password,
    });
    return data;
  },

  async refresh(): Promise<LoginResponse> {
    const { data } = await api.post<LoginResponse>('/auth/refresh');
    return data;
  },

  async me(): Promise<AuthUser> {
    const { data } = await api.get<AuthUser>('/auth/me');
    return data;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout');
  },
};
