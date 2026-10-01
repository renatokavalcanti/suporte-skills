import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfiguration } from '../../config/configuration';
import { NewsSyncService } from './news-sync.service';

/**
 * Agendador leve (setInterval) da ingestao do Tec News. Sem dependencia de
 * cron: a cadencia e' um intervalo em minutos vindo da configuracao.
 * Desligado por padrao (NEWS_SYNC_ENABLED=false) para nao gerar trafego de
 * saida em ambientes sem internet.
 */
@Injectable()
export class NewsSyncScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NewsSyncScheduler.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly sync: NewsSyncService,
  ) {}

  onModuleInit(): void {
    const news = this.config.get<AppConfiguration['news']>('news');
    if (!news?.syncEnabled) {
      this.logger.log(
        'Sincronizacao do Tec News desligada (NEWS_SYNC_ENABLED=false)',
      );
      return;
    }

    const minutes = Math.max(5, news.syncIntervalMinutes);
    this.timer = setInterval(() => void this.run(), minutes * 60_000);
    this.timer.unref();
    this.logger.log(
      `Sincronizacao do Tec News agendada a cada ${minutes} minuto(s)`,
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
      const summary = await this.sync.syncAll();
      this.logger.log(
        `Tec News: ${summary.created} nova(s), ${summary.updated} atualizada(s), ${summary.errors.length} falha(s)`,
      );
    } catch (error) {
      this.logger.error(`Falha na sincronizacao do Tec News: ${String(error)}`);
    }
  }
}
