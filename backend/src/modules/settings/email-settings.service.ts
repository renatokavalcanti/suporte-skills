import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../shared/audit/audit.service';
import { AuthenticatedUser } from '../../shared/common/authenticated-user.interface';
import { resolveEncryptionSecret } from '../../shared/crypto/encryption-secret';
import { decryptSecret, encryptSecret } from '../../shared/crypto/secret-crypto';
import { UpdateEmailSettingsDto } from './dto/update-email-settings.dto';

const EMAIL_SETTING_KEY = 'email';

export type EmailTransport = 'SMTP' | 'GRAPH';

interface StoredEmailSettings {
  enabled?: boolean;
  transport?: EmailTransport;
  fromName?: string;
  fromAddress?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPasswordEnc?: string;
  graphTenantId?: string;
  graphClientId?: string;
  graphClientSecretEnc?: string;
}

export interface ResolvedEmailSettings {
  configured: boolean;
  enabled: boolean;
  transport: EmailTransport;
  fromName: string;
  fromAddress: string;
  secretSource: 'settings' | 'none';
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPassword: string;
  graphTenantId: string;
  graphClientId: string;
  graphClientSecret: string;
}

export interface EmailSettingsView {
  configured: boolean;
  enabled: boolean;
  transport: EmailTransport;
  fromName: string;
  fromAddress: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPasswordSet: boolean;
  graphTenantId: string;
  graphClientId: string;
  graphClientSecretSet: boolean;
}

/**
 * Configuracao de envio de e-mail (D-030) usada pelos Relatorios de Chamados.
 * Editavel pela interface (ADMIN); guardada em `app_settings` (key `email`). Os
 * segredos (senha SMTP, client secret do Graph) sao **cifrados em repouso** e
 * nunca devolvidos. Mantem cache em memoria para leitura sincrona no runtime.
 */
@Injectable()
export class EmailSettingsService implements OnModuleInit {
  private readonly logger = new Logger(EmailSettingsService.name);
  private cache: StoredEmailSettings = {};
  private ready: Promise<void> | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  onModuleInit(): void {
    this.ready = this.reload();
  }

  async ensureLoaded(): Promise<void> {
    if (!this.ready) this.ready = this.reload();
    await this.ready;
  }

  private async reload(): Promise<void> {
    try {
      const row = await this.prisma.appSetting.findUnique({
        where: { key: EMAIL_SETTING_KEY },
      });
      this.cache =
        row && row.value && typeof row.value === 'object'
          ? (row.value as unknown as StoredEmailSettings)
          : {};
    } catch (error) {
      this.logger.warn(`Falha ao carregar a config de e-mail: ${String(error)}`);
      this.cache = {};
    }
  }

  private encryptionSecret(): string {
    return resolveEncryptionSecret(this.config);
  }

  getResolved(): ResolvedEmailSettings {
    const stored = this.cache;
    const transport: EmailTransport = stored.transport ?? 'SMTP';

    let smtpPassword = '';
    let graphClientSecret = '';
    let secretSource: ResolvedEmailSettings['secretSource'] = 'none';
    if (stored.smtpPasswordEnc) {
      const decrypted = decryptSecret(stored.smtpPasswordEnc, this.encryptionSecret());
      if (decrypted) {
        smtpPassword = decrypted;
        secretSource = 'settings';
      }
    }
    if (stored.graphClientSecretEnc) {
      const decrypted = decryptSecret(
        stored.graphClientSecretEnc,
        this.encryptionSecret(),
      );
      if (decrypted) {
        graphClientSecret = decrypted;
        secretSource = 'settings';
      }
    }

    const fromAddress = stored.fromAddress?.trim() ?? '';
    const enabled = stored.enabled ?? false;
    const configured =
      enabled &&
      fromAddress !== '' &&
      (transport === 'GRAPH'
        ? Boolean(stored.graphTenantId && stored.graphClientId && graphClientSecret)
        : Boolean(stored.smtpHost && stored.smtpPort));

    return {
      configured,
      enabled,
      transport,
      fromName: stored.fromName?.trim() ?? 'Suporte Informática',
      fromAddress,
      secretSource,
      smtpHost: stored.smtpHost?.trim() ?? '',
      smtpPort: stored.smtpPort ?? 587,
      smtpSecure: stored.smtpSecure ?? false,
      smtpUser: stored.smtpUser?.trim() ?? '',
      smtpPassword,
      graphTenantId: stored.graphTenantId?.trim() ?? '',
      graphClientId: stored.graphClientId?.trim() ?? '',
      graphClientSecret,
    };
  }

  getView(): EmailSettingsView {
    const resolved = this.getResolved();
    return {
      configured: resolved.configured,
      enabled: resolved.enabled,
      transport: resolved.transport,
      fromName: resolved.fromName,
      fromAddress: resolved.fromAddress,
      smtpHost: resolved.smtpHost,
      smtpPort: resolved.smtpPort,
      smtpSecure: resolved.smtpSecure,
      smtpUser: resolved.smtpUser,
      smtpPasswordSet: Boolean(this.cache.smtpPasswordEnc),
      graphTenantId: resolved.graphTenantId,
      graphClientId: resolved.graphClientId,
      graphClientSecretSet: Boolean(this.cache.graphClientSecretEnc),
    };
  }

  async update(
    dto: UpdateEmailSettingsDto,
    actor: AuthenticatedUser,
  ): Promise<EmailSettingsView> {
    if (dto.transport !== undefined && !['SMTP', 'GRAPH'].includes(dto.transport)) {
      throw new BadRequestException('Transporte de e-mail invalido');
    }

    const before = this.redact(this.cache);
    const next: StoredEmailSettings = { ...this.cache };

    if (dto.enabled !== undefined) next.enabled = dto.enabled;
    if (dto.transport !== undefined) next.transport = dto.transport;
    if (dto.fromName !== undefined) next.fromName = dto.fromName.trim();
    if (dto.fromAddress !== undefined) next.fromAddress = dto.fromAddress.trim();
    if (dto.smtpHost !== undefined) next.smtpHost = dto.smtpHost.trim();
    if (dto.smtpPort !== undefined) next.smtpPort = dto.smtpPort;
    if (dto.smtpSecure !== undefined) next.smtpSecure = dto.smtpSecure;
    if (dto.smtpUser !== undefined) next.smtpUser = dto.smtpUser.trim();
    if (dto.graphTenantId !== undefined)
      next.graphTenantId = dto.graphTenantId.trim();
    if (dto.graphClientId !== undefined)
      next.graphClientId = dto.graphClientId.trim();

    if (dto.clearSmtpPassword) {
      delete next.smtpPasswordEnc;
    } else if (dto.smtpPassword !== undefined && dto.smtpPassword !== '') {
      next.smtpPasswordEnc = encryptSecret(
        dto.smtpPassword,
        this.encryptionSecret(),
      );
    }
    if (dto.clearGraphClientSecret) {
      delete next.graphClientSecretEnc;
    } else if (
      dto.graphClientSecret !== undefined &&
      dto.graphClientSecret !== ''
    ) {
      next.graphClientSecretEnc = encryptSecret(
        dto.graphClientSecret,
        this.encryptionSecret(),
      );
    }

    await this.persist(next);
    await this.audit.record({
      actorId: actor.id,
      entity: 'app_settings',
      entityId: EMAIL_SETTING_KEY,
      action: 'UPDATE',
      before,
      after: this.redact(next),
    });

    return this.getView();
  }

  private async persist(value: StoredEmailSettings): Promise<void> {
    await this.prisma.appSetting.upsert({
      where: { key: EMAIL_SETTING_KEY },
      create: { key: EMAIL_SETTING_KEY, value: value as unknown as Prisma.InputJsonValue },
      update: { value: value as unknown as Prisma.InputJsonValue },
    });
    this.cache = value;
  }

  private redact(settings: StoredEmailSettings): Record<string, unknown> {
    const { smtpPasswordEnc, graphClientSecretEnc, ...rest } = settings;
    return {
      ...rest,
      smtpPasswordSet: Boolean(smtpPasswordEnc),
      graphClientSecretSet: Boolean(graphClientSecretEnc),
    };
  }
}
