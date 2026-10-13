import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ZohoSyncService } from './zoho-sync.service';
import { ZohoSettingsService } from './zoho/zoho-settings.service';

/**
 * Agendador leve (setInterval) do espelhamento do Zoho Desk, no mesmo padrao
 * do Tec News. A frequencia vem da configuracao efetiva (tela de Configuracoes
 * sobrepondo `ZOHO_SYNC_ENABLED`/`ZOHO_SYNC_INTERVAL_MINUTES`); `MANUAL`
 * desliga o agendamento. Sempre da' para rodar sob demanda pelo ADMIN.
 */
@Injectable()
export class ZohoSyncScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ZohoSyncScheduler.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly zohoSettings: ZohoSettingsService,
    private readonly sync: ZohoSyncService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.zohoSettings.ensureLoaded();
    const resolved = this.zohoSettings.getResolved();

    if (!resolved.syncEnabled) {
      this.logger.log(
        'Sincronizacao do Zoho Desk desligada (frequencia manual)',
      );
      return;
    }

    const minutes = Math.max(5, resolved.syncIntervalMinutes);
    this.timer = setInterval(() => void this.run(), minutes * 60_000);
    this.timer.unref();
    this.logger.log(
      `Sincronizacao do Zoho Desk agendada a cada ${minutes} minuto(s)`,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async run(): Promise<void> {
    try {
      const summary = await this.sync.syncAll(null);
      this.logger.log(
        `Zoho: ${summary.created} criado(s), ${summary.updated} atualizado(s), ` +
          `${summary.unmapped} nao mapeado(s), ${summary.errors.length} erro(s)`,
      );
    } catch (error) {
      this.logger.warn(`Falha na sincronizacao do Zoho: ${String(error)}`);
    }
  }
}
