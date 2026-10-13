import { Injectable } from '@nestjs/common';
import { ZohoSettingsService } from './zoho-settings.service';

export interface ZohoCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  orgId: string;
  apiBaseUrl: string;
  accountsBaseUrl: string;
  fetchTimeoutMs: number;
}

/**
 * Resolve as credenciais do Zoho Desk em runtime (D-030). Delega para a
 * configuracao efetiva (tela de Configuracoes, cifrada, sobrepondo o ambiente)
 * mantendo a mesma interface sincrona usada pelo cliente HTTP e pelo sync. As
 * credenciais **nunca** sao devolvidas pela API nem registradas em log.
 */
@Injectable()
export class ZohoCredentialsService {
  constructor(private readonly settings: ZohoSettingsService) {}

  isSyncEnabled(): boolean {
    return this.settings.getResolved().syncEnabled;
  }

  isConfigured(): boolean {
    return this.settings.getResolved().configured;
  }

  get(): ZohoCredentials | null {
    const resolved = this.settings.getResolved();
    if (!resolved.configured) return null;
    return {
      clientId: resolved.clientId,
      clientSecret: resolved.clientSecret,
      refreshToken: resolved.refreshToken,
      orgId: resolved.orgId,
      apiBaseUrl: resolved.apiBaseUrl,
      accountsBaseUrl: resolved.accountsBaseUrl,
      fetchTimeoutMs: resolved.fetchTimeoutMs,
    };
  }

  maxTicketsPerRun(): number {
    return this.settings.getResolved().maxTicketsPerRun;
  }
}
