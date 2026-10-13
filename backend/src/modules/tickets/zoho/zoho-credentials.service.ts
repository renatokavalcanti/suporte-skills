import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfiguration } from '../../../config/configuration';

export interface ZohoCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  orgId: string;
  apiBaseUrl: string;
  accountsBaseUrl: string;
  fetchTimeoutMs: number;
}

const DEFAULT: AppConfiguration['zoho'] = {
  syncEnabled: false,
  syncIntervalMinutes: 360,
  fetchTimeoutMs: 15000,
  maxTicketsPerRun: 200,
  apiBaseUrl: 'https://desk.zoho.com/api/v1',
  accountsBaseUrl: 'https://accounts.zoho.com',
  clientId: '',
  clientSecret: '',
  refreshToken: '',
  orgId: '',
  configured: false,
};

/**
 * Resolve as credenciais do Zoho Desk (D-029). Ficam **somente** em variaveis de
 * ambiente; nunca sao devolvidas pela API nem registradas em log.
 */
@Injectable()
export class ZohoCredentialsService {
  constructor(private readonly config: ConfigService) {}

  private settings(): AppConfiguration['zoho'] {
    return this.config.get<AppConfiguration['zoho']>('zoho') ?? DEFAULT;
  }

  isSyncEnabled(): boolean {
    return this.settings().syncEnabled;
  }

  isConfigured(): boolean {
    return this.settings().configured;
  }

  get(): ZohoCredentials | null {
    const s = this.settings();
    if (!s.configured) return null;
    return {
      clientId: s.clientId,
      clientSecret: s.clientSecret,
      refreshToken: s.refreshToken,
      orgId: s.orgId,
      apiBaseUrl: s.apiBaseUrl,
      accountsBaseUrl: s.accountsBaseUrl,
      fetchTimeoutMs: s.fetchTimeoutMs,
    };
  }

  maxTicketsPerRun(): number {
    return Math.max(1, this.settings().maxTicketsPerRun);
  }
}
