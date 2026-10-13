import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfiguration } from '../../config/configuration';
import { ZohoSyncService } from './zoho-sync.service';

/**
 * Agendador leve (setInterval) do espelhamento do Zoho Desk, no mesmo padrao
 * do Tec News. Desligado por padrao (ZOHO_SYNC_ENABLED=false) para nao gerar
 * trafego de saida nem depender do Zoho em ambientes controlados.
 */
@Injectable()
export class ZohoSyncScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ZohoSyncScheduler.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly sync: ZohoSyncService,
  ) {}

  onModuleInit(): void {
    const zoho = this.config.get<AppConfiguration['zoho']>('zoho');
    if (!zoho?.syncEnabled) {
      this.logger.log(
        'Sincronizacao do Zoho Desk desligada (ZOHO_SYNC_ENABLED=false)',
      );
      return;
    }

    const minutes = Math.max(5, zoho.syncIntervalMinutes);
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
