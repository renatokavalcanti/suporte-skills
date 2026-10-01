import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { LoginResponse } from '@/types/api';

const BASE_URL = '/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

type SessionExpiredHandler = () => void;
let sessionExpiredHandler: SessionExpiredHandler | null = null;

/**
 * Registra o callback chamado quando a sessao nao pode mais ser renovada
 * (refresh recusado). O AuthProvider usa isso para limpar o usuario e
 * devolver o app ao login em vez de ficar preso em erros 401.
 */
export function setSessionExpiredHandler(
  handler: SessionExpiredHandler | null,
): void {
  sessionExpiredHandler = handler;
}

async function refreshAccessToken(): Promise<string | null> {
  try {
    const { data } = await axios.post<LoginResponse>(
      `${BASE_URL}/auth/refresh`,
      {},
      { withCredentials: true },
    );
    setAccessToken(data.accessToken);
    return data.accessToken;
  } catch (error) {
    setAccessToken(null);
    const status = axios.isAxiosError(error)
      ? error.response?.status
      : undefined;
    if (status === 401 || status === 403) {
      sessionExpiredHandler?.();
    }
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as
      | (InternalAxiosRequestConfig & { _retry?: boolean })
      | undefined;

    const isAuthRoute = original?.url?.includes('/auth/') ?? false;

    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !isAuthRoute
    ) {
      original._retry = true;
      refreshPromise = refreshPromise ?? refreshAccessToken();
      const token = await refreshPromise;
      refreshPromise = null;

      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
    }

    return Promise.reject(error);
  },
);

export function extractApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as
      | { error?: { message?: string } }
      | undefined;
    if (body?.error?.message) {
      return body.error.message;
    }
    if (error.response?.status === 0 || !error.response) {
      return 'Não foi possível conectar ao servidor.';
    }
  }
  return 'Ocorreu um erro inesperado.';
}

/** Detalhes de validacao devolvidos pelo backend (campo/mensagem). */
export function extractApiErrorDetails(error: unknown): string[] {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as
      | { error?: { details?: unknown } }
      | undefined;
    const details = body?.error?.details;
    if (Array.isArray(details)) {
      return details.map((item) => String(item));
    }
  }
  return [];
}
