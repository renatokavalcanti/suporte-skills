import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ZohoCredentials, ZohoCredentialsService } from './zoho-credentials.service';
import { ZohoDataCenter, zohoBaseUrls } from './zoho-domains';

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
  assigneeId?: string;
  contactId?: string;
  departmentId?: string;
  /** Campos personalizados do Zoho Desk, por nome de API (ex.: Tecnologia). */
  cf?: Record<string, unknown>;
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

/** Lancamento de tempo de um chamado do Zoho Desk (`/timeEntries`). */
export interface ZohoTimeEntryPayload {
  id: string | number;
  ownerId?: string;
  ownerName?: string;
  owner?: { id?: string; name?: string } | null;
  executedTime?: string;
  hoursSpent?: number | string;
  minutesSpent?: number | string;
  secondsSpent?: number | string;
  description?: string;
  isBillable?: boolean;
  [key: string]: unknown;
}

/** Overrides para o teste de conexao (nao salvos). */
export interface ZohoConnectionOverrides {
  dataCenter?: ZohoDataCenter;
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  orgId?: string;
}

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

interface TicketsResponse {
  data?: ZohoTicketPayload[];
}

/** Erro estruturado da API do Zoho (sem segredos no texto). */
export class ZohoApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | null,
    message: string,
  ) {
    super(message);
    this.name = 'ZohoApiError';
  }
}

/**
 * Cliente HTTP do Zoho Desk (somente leitura, D-029/D-030): obtem o access token
 * via refresh token (OAuth) e lista os chamados de forma paginada. Nao registra
 * segredos nem tokens em log. O token e' cacheado em memoria e renovado antes de
 * expirar; `testConnection` faz um ping leve para validar a configuracao.
 */
@Injectable()
export class ZohoClientService {
  private readonly logger = new Logger(ZohoClientService.name);
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly credentials: ZohoCredentialsService) {}

  async listTickets(params: ListTicketsParams): Promise<ZohoTicketPayload[]> {
    const creds = this.credentials.get();
    if (!creds) throw new Error('Zoho Desk nao configurado');

    const token = await this.accessToken(creds);
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

  /**
   * Lista os lancamentos de tempo de um chamado (D-030/D-032). O endpoint do
   * Zoho Desk e' **`/tickets/{id}/timeEntry`** (singular) — a forma plural
   * (`timeEntries`) responde `404`. Pagina por `from`/`limit`.
   */
  async listTimeEntries(ticketId: string): Promise<ZohoTimeEntryPayload[]> {
    const creds = this.credentials.get();
    if (!creds) throw new Error('Zoho Desk nao configurado');

    const token = await this.accessToken(creds);
    const pageSize = 100;
    const all: ZohoTimeEntryPayload[] = [];
    let from = 0;

    while (all.length < 500) {
      const query = new URLSearchParams({
        from: String(from),
        limit: String(pageSize),
      });
      const response = await this.request(
        `${creds.apiBaseUrl}/tickets/${encodeURIComponent(ticketId)}/timeEntry?${query.toString()}`,
        {
          method: 'GET',
          headers: {
            authorization: `Zoho-oauthtoken ${token}`,
            orgId: creds.orgId,
          },
        },
        creds.fetchTimeoutMs,
      );
      const json = (await response.json()) as { data?: ZohoTimeEntryPayload[] };
      const batch = Array.isArray(json.data) ? json.data : [];
      all.push(...batch);
      if (batch.length < pageSize) break;
      from += batch.length;
    }

    return all;
  }

  /**
   * Resolve o nome da conta no Zoho Desk (`GET /accounts/{id}`) para exibir a
   * fila de nao mapeados (D-031): a listagem de chamados devolve apenas o
   * `accountId`. Falha de forma silenciosa (retorna null) para nao interromper a
   * sincronizacao.
   */
  async getAccountName(accountId: string): Promise<string | null> {
    const creds = this.credentials.get();
    if (!creds) return null;

    try {
      const token = await this.accessToken(creds);
      const response = await this.request(
        `${creds.apiBaseUrl}/accounts/${encodeURIComponent(accountId)}`,
        {
          method: 'GET',
          headers: {
            authorization: `Zoho-oauthtoken ${token}`,
            orgId: creds.orgId,
          },
        },
        creds.fetchTimeoutMs,
      );
      const json = (await response.json()) as {
        accountName?: string;
        name?: string;
      };
      const name = (json.accountName ?? json.name ?? '').trim();
      return name === '' ? null : name;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Falha ao resolver o nome da conta ${accountId} no Zoho: ${message}`,
      );
      return null;
    }
  }

  /**
   * Resolve o nome do agente (responsavel pelo lancamento de tempo) no Zoho
   * (`GET /agents/{id}`), que devolve `firstName`/`lastName` (D-032) — a listagem
   * de lancamentos traz apenas o `ownerId`. Falha de forma silenciosa.
   */
  async getAgentName(agentId: string): Promise<string | null> {
    const creds = this.credentials.get();
    if (!creds) return null;

    try {
      const token = await this.accessToken(creds);
      const response = await this.request(
        `${creds.apiBaseUrl}/agents/${encodeURIComponent(agentId)}`,
        {
          method: 'GET',
          headers: {
            authorization: `Zoho-oauthtoken ${token}`,
            orgId: creds.orgId,
          },
        },
        creds.fetchTimeoutMs,
      );
      const json = (await response.json()) as {
        firstName?: string;
        lastName?: string;
        emailId?: string;
      };
      const name = [json.firstName, json.lastName]
        .map((part) => (typeof part === 'string' ? part.trim() : ''))
        .filter((part) => part !== '')
        .join(' ')
        .trim();
      if (name !== '') return name;
      const email = (json.emailId ?? '').trim();
      return email === '' ? null : email;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Falha ao resolver o nome do agente ${agentId} no Zoho: ${message}`,
      );
      return null;
    }
  }

  /**
   * Testa a conexao com o Zoho Desk (GET /tickets?limit=1) usando a configuracao
   * efetiva e/ou os overrides informados. Lança `BadRequestException` com o
   * motivo detalhado (credencial, escopo, orgId ou dominio).
   */
  async testConnection(
    overrides: ZohoConnectionOverrides = {},
  ): Promise<{ ok: true; message: string }> {
    const base = this.credentials.get();
    const urls = overrides.dataCenter ? zohoBaseUrls(overrides.dataCenter) : null;

    const creds: ZohoCredentials = {
      clientId: pick(overrides.clientId, base?.clientId),
      clientSecret: pick(overrides.clientSecret, base?.clientSecret),
      refreshToken: pick(overrides.refreshToken, base?.refreshToken),
      orgId: pick(overrides.orgId, base?.orgId),
      apiBaseUrl: urls?.apiBaseUrl ?? base?.apiBaseUrl ?? '',
      accountsBaseUrl: urls?.accountsBaseUrl ?? base?.accountsBaseUrl ?? '',
      fetchTimeoutMs: base?.fetchTimeoutMs ?? 15000,
    };

    if (
      creds.clientId === '' ||
      creds.clientSecret === '' ||
      creds.refreshToken === '' ||
      creds.orgId === ''
    ) {
      throw new BadRequestException(
        'Informe Client ID, Client Secret, Refresh Token e orgId para testar a conexao',
      );
    }
    if (creds.apiBaseUrl === '' || creds.accountsBaseUrl === '') {
      throw new BadRequestException('Dominios do Zoho nao definidos');
    }

    try {
      const token = await this.fetchToken(creds);
      await this.probeTickets(creds, token.accessToken);
      return { ok: true, message: 'Conexao com o Zoho Desk bem-sucedida' };
    } catch (error) {
      throw new BadRequestException(this.describeZohoError(error));
    }
  }

  /**
   * Troca o `code` do fluxo Authorization Code pelo refresh token
   * (`access_type=offline`). Usado pelo callback do OAuth para conectar a conta.
   */
  async exchangeCode(
    creds: Pick<
      ZohoCredentials,
      'clientId' | 'clientSecret' | 'accountsBaseUrl' | 'fetchTimeoutMs'
    >,
    code: string,
    redirectUri: string,
  ): Promise<{ refreshToken: string; accessToken: string }> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: redirectUri,
      code,
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

    const json = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      error?: string;
    };
    if (!json.refresh_token) {
      throw new ZohoApiError(
        response.status,
        json.error ?? null,
        `O Zoho nao devolveu refresh token (${json.error ?? 'sem refresh_token'})`,
      );
    }
    return {
      refreshToken: json.refresh_token,
      accessToken: json.access_token ?? '',
    };
  }

  private async probeTickets(
    creds: ZohoCredentials,
    token: string,
  ): Promise<void> {
    const query = new URLSearchParams({ limit: '1', from: '0' });
    await this.request(
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
  }

  private async accessToken(creds: ZohoCredentials): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 30_000) {
      return this.token.value;
    }
    const { accessToken, expiresIn } = await this.fetchToken(creds);
    this.token = { value: accessToken, expiresAt: Date.now() + expiresIn * 1000 };
    return accessToken;
  }

  private async fetchToken(
    creds: ZohoCredentials,
  ): Promise<{ accessToken: string; expiresIn: number }> {
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
      throw new ZohoApiError(
        response.status,
        json.error ?? null,
        `Falha ao obter token do Zoho: ${json.error ?? 'resposta invalida'}`,
      );
    }
    return { accessToken: json.access_token, expiresIn: json.expires_in ?? 3600 };
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
        const detail = await readZohoError(response);
        // Sem logar o corpo da resposta (pode conter dados de negocio).
        this.logger.warn(
          `Zoho respondeu HTTP ${response.status} (${detail.code ?? 'sem codigo'})`,
        );
        throw new ZohoApiError(
          response.status,
          detail.code,
          detail.message ?? `HTTP ${response.status} ao chamar o Zoho Desk`,
        );
      }
      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Traduz o erro do Zoho para uma mensagem util (sem expor segredos). */
  private describeZohoError(error: unknown): string {
    if (error instanceof ZohoApiError) {
      const map: Record<string, string> = {
        invalid_client: 'Client ID ou Client Secret invalidos',
        invalid_code: 'Codigo/Refresh Token invalido ou expirado',
        INVALID_OAUTH: 'Token invalido ou expirado (verifique o Refresh Token)',
        SCOPE_MISMATCH: 'Escopos insuficientes para acessar os chamados',
        OAUTH_SCOPE_MISMATCH: 'Escopos insuficientes (verifique os escopos configurados)',
        OAUTH_ORG_MISMATCH:
          'orgId nao corresponde a organizacao/conta do Zoho Desk',
        INVALID_ORG: 'orgId invalido',
        NO_PERMISSION: 'Sem permissao para o recurso (verifique orgId e escopos)',
      };
      const friendly = error.code ? map[error.code] : undefined;
      return friendly ?? error.message;
    }
    if (error instanceof Error) return error.message;
    return String(error);
  }
}

function pick(value: string | undefined, fallback: string | undefined): string {
  const trimmed = value?.trim();
  if (trimmed) return trimmed;
  return fallback?.trim() ?? '';
}

async function readZohoError(
  response: Response,
): Promise<{ code: string | null; message: string | null }> {
  try {
    const text = await response.text();
    if (text.trim() === '') return { code: null, message: null };
    const json = JSON.parse(text) as {
      error?: string;
      errorCode?: string;
      message?: string;
    };
    return {
      code: json.errorCode ?? json.error ?? null,
      message: json.message ?? null,
    };
  } catch {
    return { code: null, message: null };
  }
}
