import { Module } from '@nestjs/common';
import { AiModule } from '../../shared/ai/ai.module';
import { SettingsModule } from '../settings/settings.module';
import { NewsController } from './news.controller';
import { NewsAiService } from './news-ai.service';
import { NewsDigestService } from './news-digest.service';
import { NewsSourcesController } from './news-sources.controller';
import { NewsService } from './news.service';
import { NewsSyncScheduler } from './news-sync.scheduler';
import { NewsSyncService } from './news-sync.service';

@Module({
  imports: [AiModule, SettingsModule],
  // Fontes antes de NewsController: garante que "news/sources" seja resolvido
  // antes da rota parametrica "news/:id".
  controllers: [NewsSourcesController, NewsController],
  providers: [
    NewsService,
    NewsSyncService,
    NewsSyncScheduler,
    NewsAiService,
    NewsDigestService,
  ],
  exports: [NewsService, NewsSyncService],
})
export class NewsModule {}
