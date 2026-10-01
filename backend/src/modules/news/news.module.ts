import { Module } from '@nestjs/common';
import { NewsController } from './news.controller';
import { NewsSourcesController } from './news-sources.controller';
import { NewsService } from './news.service';
import { NewsSyncScheduler } from './news-sync.scheduler';
import { NewsSyncService } from './news-sync.service';

@Module({
  // Fontes antes de NewsController: garante que "news/sources" seja resolvido
  // antes da rota parametrica "news/:id".
  controllers: [NewsSourcesController, NewsController],
  providers: [NewsService, NewsSyncService, NewsSyncScheduler],
  exports: [NewsService, NewsSyncService],
})
export class NewsModule {}
