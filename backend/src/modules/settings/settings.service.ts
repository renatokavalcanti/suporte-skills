import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { AppConfiguration } from '../../config/configuration';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../shared/audit/audit.service';
import { AiClient } from '../../shared/ai/ai-client.service';
import { AuthenticatedUser } from '../../shared/common/authenticated-user.interface';
import { TestAiSettingsDto } from './dto/test-ai-settings.dto';
import { UpdateAiSettingsDto } from './dto/update-ai-settings.dto';
import { decryptSecret, encryptSecret } from './secret-crypto';

const AI_SETTING_KEY = 'ai';

interface StoredAiSettings {
  enabled?: boolean;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  apiKeyEnc?: string;
  digestEnabled?: boolean;
  digestWindowDays?: number;
  digestMaxItems?: number;
}

export interface ResolvedAiSettings {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  apiKeySource: 'settings' | 'env' | 'none';
  model: string;
  timeoutMs: number;
  digestEnabled: boolean;
  digestWindowDays: number;
  digestMaxItems: number;
}

export interface AiSettingsView {
  enabled: boolean;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  apiKeySet: boolean;
  apiKeySource: 'settings' | 'env' | 'none';
  digestEnabled: boolean;
  digestWindowDays: number;
  digestMaxItems: number;
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly aiClient: AiClient,
    private readonly audit: AuditService,
  ) {}

  private aiConfig(): AppConfiguration['ai'] {
    return (
      this.config.get<AppConfiguration['ai']>('ai') ?? {
        enabled: false,
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        model: 'gpt-4o-mini',
        timeoutMs: 20000,
      }
    );
  }

  private newsConfig(): AppConfiguration['news'] {
    return (
      this.config.get<AppConfiguration['news']>('news') ?? {
        syncEnabled: false,
        syncIntervalMinutes: 360,
        fetchTimeoutMs: 10000,
        maxItemsPerSource: 30,
        digestEnabled: false,
        digestWindowDays: 7,
        digestMaxItems: 20,
      }
    );
  }

  private encryptionSecret(): string {
    const configured =
      this.config.get<AppConfiguration['settings']>('settings')?.encryptionKey;
    if (configured) return configured;
    return this.config.get<AppConfiguration['auth']>('auth')?.accessSecret ?? '';
  }

  private async loadStored(): Promise<StoredAiSettings> {
    const row = await this.prisma.appSetting.findUnique({
      where: { key: AI_SETTING_KEY },
    });
    if (!row || !row.value || typeof row.value !== 'object') return {};
    return row.value as unknown as StoredAiSettings;
  }

  /** Configuracao efetiva: valores salvos sobrepoem o ambiente. */
  async getResolved(): Promise<ResolvedAiSettings> {
    const envAi = this.aiConfig();
    const envNews = this.newsConfig();
    const stored = await this.loadStored();

    let apiKey = '';
    let apiKeySource: ResolvedAiSettings['apiKeySource'] = 'none';
    if (stored.apiKeyEnc) {
      const decrypted = decryptSecret(stored.apiKeyEnc, this.encryptionSecret());
      if (decrypted) {
        apiKey = decrypted;
        apiKeySource = 'settings';
      }
    }
    if (!apiKey && envAi.apiKey.trim() !== '') {
      apiKey = envAi.apiKey;
      apiKeySource = 'env';
    }

    const enabledFlag = stored.enabled ?? envAi.enabled;

    return {
      enabled: enabledFlag && apiKey !== '',
      baseUrl: stored.baseUrl ?? envAi.baseUrl,
      apiKey,
      apiKeySource,
      model: stored.model ?? envAi.model,
      timeoutMs: stored.timeoutMs ?? envAi.timeoutMs,
      digestEnabled: stored.digestEnabled ?? envNews.digestEnabled,
      digestWindowDays: stored.digestWindowDays ?? envNews.digestWindowDays,
      digestMaxItems: stored.digestMaxItems ?? envNews.digestMaxItems,
    };
  }

  async getView(): Promise<AiSettingsView> {
    const resolved = await this.getResolved();
    return {
      enabled: resolved.enabled,
      baseUrl: resolved.baseUrl,
      model: resolved.model,
      timeoutMs: resolved.timeoutMs,
      apiKeySet: resolved.apiKey !== '',
      apiKeySource: resolved.apiKeySource,
      digestEnabled: resolved.digestEnabled,
      digestWindowDays: resolved.digestWindowDays,
      digestMaxItems: resolved.digestMaxItems,
    };
  }

  async update(
    dto: UpdateAiSettingsDto,
    actor: AuthenticatedUser,
  ): Promise<AiSettingsView> {
    const stored = await this.loadStored();
    const next: StoredAiSettings = { ...stored };

    if (dto.enabled !== undefined) next.enabled = dto.enabled;
    if (dto.baseUrl !== undefined) next.baseUrl = dto.baseUrl.trim();
    if (dto.model !== undefined) next.model = dto.model.trim();
    if (dto.timeoutMs !== undefined) next.timeoutMs = dto.timeoutMs;
    if (dto.digestEnabled !== undefined) next.digestEnabled = dto.digestEnabled;
    if (dto.digestWindowDays !== undefined) {
      next.digestWindowDays = dto.digestWindowDays;
    }
    if (dto.digestMaxItems !== undefined) {
      next.digestMaxItems = dto.digestMaxItems;
    }

    if (dto.clearApiKey) {
      delete next.apiKeyEnc;
    } else if (dto.apiKey !== undefined && dto.apiKey.trim() !== '') {
      next.apiKeyEnc = encryptSecret(
        dto.apiKey.trim(),
        this.encryptionSecret(),
      );
    }

    await this.prisma.appSetting.upsert({
      where: { key: AI_SETTING_KEY },
      create: {
        key: AI_SETTING_KEY,
        value: next as unknown as Prisma.InputJsonValue,
      },
      update: { value: next as unknown as Prisma.InputJsonValue },
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'app_settings',
      entityId: AI_SETTING_KEY,
      action: 'UPDATE',
      before: this.redact(stored),
      after: this.redact(next),
    });

    return this.getView();
  }

  /** Testa a conexao com o provedor usando (overrides ?? config efetiva). */
  async test(
    dto: TestAiSettingsDto,
  ): Promise<{ ok: true; model: string; message: string }> {
    const resolved = await this.getResolved();
    const baseUrl = dto.baseUrl?.trim() || resolved.baseUrl;
    const model = dto.model?.trim() || resolved.model;
    const timeoutMs = dto.timeoutMs ?? resolved.timeoutMs;
    const apiKey = dto.apiKey?.trim() || resolved.apiKey;

    if (!apiKey) {
      throw new BadRequestException(
        'Informe a chave da API para testar a conexao',
      );
    }

    try {
      await this.aiClient.complete(
        { baseUrl, apiKey, model, timeoutMs },
        [
          {
            role: 'system',
            content: 'Responda apenas com a palavra OK, sem mais nada.',
          },
          { role: 'user', content: 'ping' },
        ],
      );
      return { ok: true, model, message: 'Conexao com o provedor bem-sucedida' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Teste de IA falhou: ${message}`);
      throw new BadRequestException(`Falha ao conectar ao provedor: ${message}`);
    }
  }

  /** Remove o texto cifrado e expoe apenas o que nao e' segredo. */
  private redact(settings: StoredAiSettings): Record<string, unknown> {
    const { apiKeyEnc, ...rest } = settings;
    return { ...rest, apiKeySet: Boolean(apiKeyEnc) };
  }
}
