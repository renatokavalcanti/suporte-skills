import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { AuthenticatedUser } from '../../../shared/common/authenticated-user.interface';
import { ZohoClientService } from './zoho-client.service';
import { ZohoSettingsService } from './zoho-settings.service';

interface PendingAuthorization {
  actorId: string;
  createdAt: number;
}

const STATE_TTL_MS = 10 * 60_000;

/**
 * Fluxo OAuth 2.0 (Authorization Code) do Zoho Desk (D-030): monta a URL de
 * consentimento e troca o `code` pelo refresh token, que e' cifrado e salvo.
 * O `state` e' um nonce de uso unico com validade curta (protecao CSRF). O
 * navegador volta pelo callback (`/settings/zoho/callback`).
 */
@Injectable()
export class ZohoOAuthService {
  private readonly logger = new Logger(ZohoOAuthService.name);
  private readonly pending = new Map<string, PendingAuthorization>();

  constructor(
    private readonly settings: ZohoSettingsService,
    private readonly client: ZohoClientService,
    private readonly config: ConfigService,
  ) {}

  /** URL de consentimento do Zoho (aberta no navegador pelo ADMIN). */
  startUrl(actor: AuthenticatedUser): { url: string } {
    const resolved = this.settings.getResolved();
    if (!resolved.clientId || !resolved.clientSecret) {
      throw new BadRequestException(
        'Preencha e salve o Client ID e o Client Secret antes de conectar',
      );
    }

    this.prune();
    const state = randomBytes(24).toString('base64url');
    this.pending.set(state, { actorId: actor.id, createdAt: Date.now() });

    const params = new URLSearchParams({
      scope: resolved.scopes.join(','),
      client_id: resolved.clientId,
      response_type: 'code',
      access_type: 'offline',
      redirect_uri: this.settings.redirectUri(),
      state,
      prompt: 'consent',
    });

    return { url: `${resolved.accountsBaseUrl}/oauth/v2/auth?${params.toString()}` };
  }

  /**
   * Trata o retorno do Zoho: valida o `state`, troca o `code` pelo refresh
   * token, salva (cifrado) e tenta uma validacao leve. Devolve `warn` quando o
   * token foi salvo mas a validacao falhou (ex.: orgId ainda nao informado).
   */
  async handleCallback(
    code: string,
    state: string,
  ): Promise<{ warn?: string }> {
    const entry = this.pending.get(state);
    this.pending.delete(state);
    if (!entry) throw new Error('state invalido ou expirado');
    if (Date.now() - entry.createdAt > STATE_TTL_MS) {
      throw new Error('state expirado, tente conectar novamente');
    }

    const resolved = this.settings.getResolved();
    if (!resolved.clientId || !resolved.clientSecret || !resolved.accountsBaseUrl) {
      throw new Error('Client ID/Secret nao configurados');
    }

    const { refreshToken } = await this.client.exchangeCode(
      {
        clientId: resolved.clientId,
        clientSecret: resolved.clientSecret,
        accountsBaseUrl: resolved.accountsBaseUrl,
        fetchTimeoutMs: resolved.fetchTimeoutMs,
      },
      code,
      this.settings.redirectUri(),
    );

    await this.settings.saveRefreshToken(refreshToken, entry.actorId);
    this.logger.log('Conta do Zoho Desk conectada via OAuth');

    try {
      await this.client.testConnection({});
      return {};
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { warn: message };
    }
  }

  /** URL da interface para onde o navegador volta apos o callback. */
  webRedirect(params: Record<string, string>): string {
    const base = (
      this.config.get<string>('publicWebUrl') ?? 'http://localhost:5173'
    ).replace(/\/+$/, '');
    const query = new URLSearchParams(params).toString();
    return `${base}/configuracoes?${query}`;
  }

  private prune(): void {
    const now = Date.now();
    for (const [key, value] of this.pending) {
      if (now - value.createdAt > STATE_TTL_MS) this.pending.delete(key);
    }
  }
}
