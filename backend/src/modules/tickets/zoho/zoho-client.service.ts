import { Injectable, Logger } from '@nestjs/common';
import { ZohoCredentialsService } from './zoho-credentials.service';

/** Payload cru de um chamado do Zoho Desk (campos usados + espaco p/ extras). */
export interface ZohoTicketPayload {
  id: string | number;
  ticketNumber?: string;
  subject?: string;
  status?: string;
  statusType?: string;
  priority?: string;
  category?: string;
  assignee?: { name?: string } | null;
  assigneeName?: string;
  createdTime?: string;
  closedTime?: string | null;
  modifiedTime?: string;
  timeSpent?: number | string;
  isBillable?: boolean;
  slaCompliant?: boolean | null;
  accountId?: string;
  accountName?: string;
  [key: string]: unknown;
}

export interface ListTicketsParams {
  /** Somente chamados modificados a partir deste instante (ISO 8601). */
  modifiedSince?: string | null;
  limit: number;
  from: number;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

interface TicketsResponse {
  data?: ZohoTicketPayload[];
}

/**
 * Cliente HTTP do Zoho Desk (somente leitura, D-029): obtem o access token via
 * refresh token (OAuth) e lista os chamados de forma paginada. Nao registra
 * segredos nem tokens em log.
 */
@Injectable()
export class ZohoClientService {
  private readonly logger = new Logger(ZohoClientService.name);
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly credentials: ZohoCredentialsService) {}

  async listTickets(params: ListTicketsParams): Promise<ZohoTicketPayload[]> {
    const creds = this.credentials.get();
    if (!creds) throw new Error('Zoho Desk nao configurado');

    const token = await this.accessToken();
    const query = new URLSearchParams({
      limit: String(params.limit),
      from: String(params.from),
      sortBy: 'modifiedTime',
    });
    if (params.modifiedSince) query.set('modifiedTime', params.modifiedSince);

    const response = await this.request(
      `${creds.apiBaseUrl}/tickets?${query.toString()}`,
      {
        method: 'GET',
        headers: {
          authorization: `Zoho-oauthtoken ${token}`,
          orgId: creds.orgId,
        },
      },
      creds.fetchTimeoutMs,
    );

    const json = (await response.json()) as TicketsResponse;
    return Array.isArray(json.data) ? json.data : [];
  }

  private async accessToken(): Promise<string> {
    const creds = this.credentials.get();
    if (!creds) throw new Error('Zoho Desk nao configurado');

    if (this.token && this.token.expiresAt > Date.now() + 30_000) {
      return this.token.value;
    }

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken,
    });

    const response = await this.request(
      `${creds.accountsBaseUrl}/oauth/v2/token`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
      },
      creds.fetchTimeoutMs,
    );

    const json = (await response.json()) as TokenResponse;
    if (!json.access_token) {
      throw new Error(
        `Falha ao obter token do Zoho: ${json.error ?? 'resposta invalida'}`,
      );
    }

    const ttlMs = (json.expires_in ?? 3600) * 1000;
    this.token = { value: json.access_token, expiresAt: Date.now() + ttlMs };
    return json.access_token;
  }

  private async request(
    url: string,
    init: RequestInit,
    timeoutMs: number,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (!response.ok) {
        // Sem logar o corpo da resposta (pode conter dados de negocio).
        this.logger.warn(`Zoho respondeu HTTP ${response.status}`);
        throw new Error(`HTTP ${response.status} ao chamar o Zoho Desk`);
      }
      return response;
    } finally {
      clearTimeout(timer);
    }
  }
}
