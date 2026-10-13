import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AppConfiguration } from '../../../config/configuration';
import { PrismaService } from '../../../database/prisma.service';
import { AuditService } from '../../../shared/audit/audit.service';
import { AuthenticatedUser } from '../../../shared/common/authenticated-user.interface';
import { resolveEncryptionSecret } from '../../../shared/crypto/encryption-secret';
import { decryptSecret, encryptSecret } from '../../../shared/crypto/secret-crypto';
import { UpdateZohoSettingsDto } from '../dto/update-zoho-settings.dto';
import {
  DEFAULT_CLOSED_STATUSES,
  DEFAULT_ZOHO_SCOPES,
  ZohoClientSource,
  ZohoDataCenter,
  ZohoSyncFrequency,
  frequencyToMinutes,
  isZohoDataCenter,
  minutesToFrequency,
  zohoBaseUrls,
} from './zoho-domains';

const ZOHO_SETTING_KEY = 'zoho';

interface StoredZohoSettings {
  dataCenter?: ZohoDataCenter;
  clientId?: string;
  clientSecretEnc?: string;
  refreshTokenEnc?: string;
  orgId?: string;
  scopes?: string[];
  technologyField?: string | null;
  clientSource?: ZohoClientSource;
  closedStatuses?: string[];
  syncFrequency?: ZohoSyncFrequency;
}

/** Valores resolvidos (banco sobrepoe ambiente) para o runtime. */
export interface ResolvedZohoSettings {
  configured: boolean;
  secretSource: 'settings' | 'env' | 'none';
  dataCenter: ZohoDataCenter;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  orgId: string;
  apiBaseUrl: string;
  accountsBaseUrl: string;
  fetchTimeoutMs: number;
  scopes: string[];
  technologyField: string | null;
  clientSource: ZohoClientSource;
  closedStatuses: string[];
  syncEnabled: boolean;
  syncFrequency: ZohoSyncFrequency;
  syncIntervalMinutes: number;
  maxTicketsPerRun: number;
}

/** Visao segura para a interface: nunca devolve segredos. */
export interface ZohoSettingsView {
  configured: boolean;
  secretSource: 'settings' | 'env' | 'none';
  dataCenter: ZohoDataCenter;
  clientId: string;
  orgId: string;
  clientSecretSet: boolean;
  refreshTokenSet: boolean;
  redirectUri: string;
  apiBaseUrl: string;
  accountsBaseUrl: string;
  scopes: string[];
  technologyField: string | null;
  clientSource: ZohoClientSource;
  closedStatuses: string[];
  syncEnabled: boolean;
  syncFrequency: ZohoSyncFrequency;
  syncIntervalMinutes: number;
}

/**
 * Configuracao da integracao com o Zoho Desk (D-030), editavel pela interface
 * (ADMIN). Guardada em `app_settings` (key `zoho`); Client Secret e Refresh
 * Token sao **cifrados em repouso** (AES-256-GCM, mesma cifra da D-023) e nunca
 * devolvidos pela API. O banco sobrepoe o ambiente; falta de valor cai no env
 * (`ZOHO_*`). Mantem um cache em memoria para leitura sincrona no runtime.
 */
@Injectable()
export class ZohoSettingsService implements OnModuleInit {
  private readonly logger = new Logger(ZohoSettingsService.name);
  private cache: StoredZohoSettings = {};
  private ready: Promise<void> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    this.ready = this.reload();
  }

  /** Garante que o cache foi carregado (usado por quem depende do banco). */
  async ensureLoaded(): Promise<void> {
    if (!this.ready) this.ready = this.reload();
    await this.ready;
  }

  private async reload(): Promise<void> {
    try {
      const row = await this.prisma.appSetting.findUnique({
        where: { key: ZOHO_SETTING_KEY },
      });
      this.cache =
        row && row.value && typeof row.value === 'object'
          ? (row.value as unknown as StoredZohoSettings)
          : {};
    } catch (error) {
      this.logger.warn(`Falha ao carregar a config do Zoho: ${String(error)}`);
      this.cache = {};
    }
  }

  private encryptionSecret(): string {
    return resolveEncryptionSecret(this.config);
  }

  private envZoho(): AppConfiguration['zoho'] {
    return (
      this.config.get<AppConfiguration['zoho']>('zoho') ?? {
        syncEnabled: false,
        syncIntervalMinutes: 360,
        fetchTimeoutMs: 15000,
        maxTicketsPerRun: 200,
        apiBaseUrlOverride: '',
        accountsBaseUrlOverride: '',
        clientId: '',
        clientSecret: '',
        refreshToken: '',
        orgId: '',
      }
    );
  }

  private publicUrl(): string {
    return (
      this.config.get<string>('publicUrl') ?? 'http://localhost:4000'
    ).replace(/\/+$/, '');
  }

  redirectUri(): string {
    return `${this.publicUrl()}/api/v1/settings/zoho/callback`;
  }

  /** Configuracao efetiva (cache sobrepoe ambiente). */
  getResolved(): ResolvedZohoSettings {
    const env = this.envZoho();
    const stored = this.cache;

    const dataCenter: ZohoDataCenter = isZohoDataCenter(stored.dataCenter)
      ? stored.dataCenter
      : 'com';
    const urls = zohoBaseUrls(dataCenter);

    const clientId = stored.clientId?.trim() || env.clientId;
    const orgId = stored.orgId?.trim() || env.orgId;

    let clientSecret = '';
    let refreshToken = '';
    let secretSource: ResolvedZohoSettings['secretSource'] = 'none';

    if (stored.clientSecretEnc) {
      const decrypted = decryptSecret(
        stored.clientSecretEnc,
        this.encryptionSecret(),
      );
      if (decrypted) {
        clientSecret = decrypted;
        secretSource = 'settings';
      }
    }
    if (stored.refreshTokenEnc) {
      const decrypted = decryptSecret(
        stored.refreshTokenEnc,
        this.encryptionSecret(),
      );
      if (decrypted) {
        refreshToken = decrypted;
        secretSource = 'settings';
      }
    }
    if (secretSource !== 'settings') {
      if (env.clientSecret) {
        clientSecret = env.clientSecret;
        secretSource = 'env';
      }
      if (env.refreshToken) {
        refreshToken = env.refreshToken;
        secretSource = 'env';
      }
    }

    const frequency: ZohoSyncFrequency =
      stored.syncFrequency ??
      (env.syncEnabled
        ? minutesToFrequency(Math.max(5, env.syncIntervalMinutes))
        : 'MANUAL');

    return {
      configured:
        clientId !== '' &&
        clientSecret !== '' &&
        refreshToken !== '' &&
        orgId !== '',
      secretSource,
      dataCenter,
      clientId,
      clientSecret,
      refreshToken,
      orgId,
      apiBaseUrl: env.apiBaseUrlOverride || urls.apiBaseUrl,
      accountsBaseUrl: env.accountsBaseUrlOverride || urls.accountsBaseUrl,
      fetchTimeoutMs: env.fetchTimeoutMs,
      scopes:
        stored.scopes && stored.scopes.length > 0
          ? stored.scopes
          : [...DEFAULT_ZOHO_SCOPES],
      technologyField: stored.technologyField ?? null,
      clientSource: stored.clientSource ?? 'ACCOUNT',
      closedStatuses:
        stored.closedStatuses && stored.closedStatuses.length > 0
          ? stored.closedStatuses
          : [...DEFAULT_CLOSED_STATUSES],
      syncEnabled: frequency !== 'MANUAL',
      syncFrequency: frequency,
      syncIntervalMinutes: frequencyToMinutes(frequency),
      maxTicketsPerRun: env.maxTicketsPerRun,
    };
  }

  getView(): ZohoSettingsView {
    const resolved = this.getResolved();
    return {
      configured: resolved.configured,
      secretSource: resolved.secretSource,
      dataCenter: resolved.dataCenter,
      clientId: resolved.clientId,
      orgId: resolved.orgId,
      clientSecretSet:
        Boolean(this.cache.clientSecretEnc) || this.envZoho().clientSecret !== '',
      refreshTokenSet:
        Boolean(this.cache.refreshTokenEnc) || this.envZoho().refreshToken !== '',
      redirectUri: this.redirectUri(),
      apiBaseUrl: resolved.apiBaseUrl,
      accountsBaseUrl: resolved.accountsBaseUrl,
      scopes: resolved.scopes,
      technologyField: resolved.technologyField,
      clientSource: resolved.clientSource,
      closedStatuses: resolved.closedStatuses,
      syncEnabled: resolved.syncEnabled,
      syncFrequency: resolved.syncFrequency,
      syncIntervalMinutes: resolved.syncIntervalMinutes,
    };
  }

  async update(
    dto: UpdateZohoSettingsDto,
    actor: AuthenticatedUser,
  ): Promise<ZohoSettingsView> {
    if (dto.dataCenter !== undefined && !isZohoDataCenter(dto.dataCenter)) {
      throw new BadRequestException('Data center do Zoho invalido');
    }

    const next: StoredZohoSettings = { ...this.cache };

    if (dto.dataCenter !== undefined) next.dataCenter = dto.dataCenter;
    if (dto.clientId !== undefined) next.clientId = dto.clientId.trim();
    if (dto.orgId !== undefined) next.orgId = dto.orgId.trim();
    if (dto.scopes !== undefined) next.scopes = normalizeList(dto.scopes);
    if (dto.closedStatuses !== undefined) {
      next.closedStatuses = normalizeList(dto.closedStatuses);
    }
    if (dto.technologyField !== undefined) {
      next.technologyField = dto.technologyField.trim() || null;
    }
    if (dto.clientSource !== undefined) next.clientSource = dto.clientSource;
    if (dto.syncFrequency !== undefined) {
      next.syncFrequency = dto.syncFrequency;
    }

    if (dto.clearClientSecret) {
      delete next.clientSecretEnc;
    } else if (dto.clientSecret !== undefined && dto.clientSecret.trim() !== '') {
      next.clientSecretEnc = encryptSecret(
        dto.clientSecret.trim(),
        this.encryptionSecret(),
      );
    }

    if (dto.clearRefreshToken) {
      delete next.refreshTokenEnc;
    } else if (dto.refreshToken !== undefined && dto.refreshToken.trim() !== '') {
      next.refreshTokenEnc = encryptSecret(
        dto.refreshToken.trim(),
        this.encryptionSecret(),
      );
    }

    const before = this.redact(this.cache);

    await this.persist(next);

    await this.audit.record({
      actorId: actor.id,
      entity: 'app_settings',
      entityId: ZOHO_SETTING_KEY,
      action: 'UPDATE',
      before,
      after: this.redact(next),
    });

    return this.getView();
  }

  /** Grava o Refresh Token obtido no fluxo OAuth (cifrado) e audita. */
  async saveRefreshToken(
    refreshToken: string,
    actorId: string | null,
  ): Promise<void> {
    const before = this.redact(this.cache);
    const next: StoredZohoSettings = {
      ...this.cache,
      refreshTokenEnc: encryptSecret(refreshToken, this.encryptionSecret()),
    };
    await this.persist(next);
    await this.audit.record({
      actorId,
      entity: 'app_settings',
      entityId: ZOHO_SETTING_KEY,
      action: 'UPDATE',
      before,
      after: this.redact(next),
    });
  }

  /** Apaga as credenciais salvas (volta a depender so' do ambiente, se houver). */
  async disconnect(actor: AuthenticatedUser): Promise<ZohoSettingsView> {
    const before = this.redact(this.cache);
    await this.persist({});
    await this.audit.record({
      actorId: actor.id,
      entity: 'app_settings',
      entityId: ZOHO_SETTING_KEY,
      action: 'DELETE',
      before,
      after: this.redact({}),
    });
    return this.getView();
  }

  private async persist(value: StoredZohoSettings): Promise<void> {
    await this.prisma.appSetting.upsert({
      where: { key: ZOHO_SETTING_KEY },
      create: {
        key: ZOHO_SETTING_KEY,
        value: value as unknown as Prisma.InputJsonValue,
      },
      update: { value: value as unknown as Prisma.InputJsonValue },
    });
    // Recarrega para o runtime enxergar a mudanca imediatamente.
    this.cache = value;
  }

  /** Remove os textos cifrados e expoe so' o que nao e' segredo. */
  private redact(settings: StoredZohoSettings): Record<string, unknown> {
    const { clientSecretEnc, refreshTokenEnc, ...rest } = settings;
    return {
      ...rest,
      clientSecretSet: Boolean(clientSecretEnc),
      refreshTokenSet: Boolean(refreshTokenEnc),
    };
  }
}

function normalizeList(values: string[]): string[] {
  return values.map((value) => value.trim()).filter((value) => value !== '');
}
