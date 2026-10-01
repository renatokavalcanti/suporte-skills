import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { AppConfiguration } from '../../config/configuration';
import { PrismaService } from '../../database/prisma.service';
import { parseFeed } from './feed-parser';
import { classifyNewsKind } from './news-classifier';
import { scoreNewsRelevance } from './news-relevance';

export interface SyncSourceResult {
  fetched: number;
  created: number;
  updated: number;
}

export interface SyncSummary {
  sources: number;
  fetched: number;
  created: number;
  updated: number;
  errors: { sourceId: string; source: string; message: string }[];
}

interface SyncSourceInput {
  id: string;
  name: string;
  url: string | null;
  vendorId: string | null;
  technologyId: string | null;
}

const DEFAULT_SETTINGS: AppConfiguration['news'] = {
  syncEnabled: false,
  syncIntervalMinutes: 360,
  fetchTimeoutMs: 10000,
  maxItemsPerSource: 30,
  digestEnabled: false,
  digestWindowDays: 7,
  digestMaxItems: 20,
};

@Injectable()
export class NewsSyncService {
  private readonly logger = new Logger(NewsSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Sincroniza todas as fontes automaticas ativas. Uma fonte com erro nao
   * interrompe as demais: o erro e' registrado na propria fonte e no resumo.
   */
  async syncAll(): Promise<SyncSummary> {
    const sources = await this.prisma.newsSource.findMany({
      where: {
        active: true,
        connectorType: { not: 'MANUAL' },
        url: { not: null },
      },
      select: {
        id: true,
        name: true,
        url: true,
        vendorId: true,
        technologyId: true,
      },
      orderBy: { name: 'asc' },
    });

    const summary: SyncSummary = {
      sources: sources.length,
      fetched: 0,
      created: 0,
      updated: 0,
      errors: [],
    };

    for (const source of sources) {
      try {
        const result = await this.syncSource(source);
        summary.fetched += result.fetched;
        summary.created += result.created;
        summary.updated += result.updated;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        summary.errors.push({
          sourceId: source.id,
          source: source.name,
          message,
        });
        this.logger.warn(`Falha ao sincronizar "${source.name}": ${message}`);
        await this.markSource(source.id, 'ERROR', message, 0);
      }
    }

    return summary;
  }

  /** Sincroniza uma unica fonte (usado pelo botao "Sincronizar agora"). */
  async syncSourceById(id: string): Promise<SyncSourceResult> {
    const source = await this.prisma.newsSource.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        url: true,
        vendorId: true,
        technologyId: true,
      },
    });
    if (!source) {
      throw new NotFoundException('Fonte de noticias nao encontrada');
    }
    if (!source.url || (await this.isManual(source.id))) {
      throw new BadRequestException(
        'Fonte manual nao possui feed para sincronizar',
      );
    }
    return this.syncSource(source);
  }

  private async isManual(id: string): Promise<boolean> {
    const source = await this.prisma.newsSource.findUnique({
      where: { id },
      select: { connectorType: true },
    });
    return source?.connectorType === 'MANUAL';
  }

  private async syncSource(
    source: SyncSourceInput,
  ): Promise<SyncSourceResult> {
    if (!source.url) return { fetched: 0, created: 0, updated: 0 };

    const settings = this.settings();
    const xml = await this.fetchText(source.url, settings.fetchTimeoutMs);
    const feed = parseFeed(xml);
    const entries = feed.entries.slice(
      0,
      Math.max(1, settings.maxItemsPerSource),
    );

    let created = 0;
    let updated = 0;

    for (const entry of entries) {
      const url =
        entry.url ?? this.fallbackUrl(source.url, entry.externalId ?? entry.title);
      const kind = classifyNewsKind(entry.title, entry.summary);
      const publishedAt = entry.publishedAt ?? null;
      const relevance = scoreNewsRelevance({
        title: entry.title,
        summary: entry.summary ?? null,
        kind,
        publishedAt,
      });

      const existing = await this.prisma.newsItem.findUnique({
        where: { url },
        select: { id: true },
      });

      await this.prisma.newsItem.upsert({
        where: { url },
        create: {
          sourceId: source.id,
          vendorId: source.vendorId,
          technologyId: source.technologyId,
          externalId: entry.externalId ?? null,
          url,
          title: entry.title,
          summary: entry.summary ?? null,
          author: entry.author ?? null,
          kind,
          origin: 'feed',
          publishedAt,
          relevanceScore: relevance.score,
          relevanceFocus: relevance.focus,
          relevanceNote: relevance.note,
          scoredAt: new Date(),
        },
        update: {
          sourceId: source.id,
          vendorId: source.vendorId,
          technologyId: source.technologyId,
          externalId: entry.externalId ?? null,
          title: entry.title,
          summary: entry.summary ?? null,
          author: entry.author ?? null,
          kind,
          publishedAt,
          relevanceScore: relevance.score,
          relevanceFocus: relevance.focus,
          relevanceNote: relevance.note,
          scoredAt: new Date(),
        },
      });

      if (existing) updated += 1;
      else created += 1;
    }

    await this.markSource(source.id, 'OK', null, entries.length);
    return { fetched: entries.length, created, updated };
  }

  private settings(): AppConfiguration['news'] {
    return this.config.get<AppConfiguration['news']>('news') ?? DEFAULT_SETTINGS;
  }

  private async fetchText(url: string, timeoutMs: number): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'user-agent': 'SuporteSkills-TecNews/1.0 (uso interno)',
          accept:
            'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.text();
    } finally {
      clearTimeout(timer);
    }
  }

  private fallbackUrl(sourceUrl: string, seed: string): string {
    const hash = createHash('sha1').update(seed).digest('hex').slice(0, 16);
    return `${sourceUrl}#${hash}`;
  }

  private async markSource(
    id: string,
    status: string,
    error: string | null,
    count: number,
  ): Promise<void> {
    try {
      await this.prisma.newsSource.update({
        where: { id },
        data: {
          lastFetchedAt: new Date(),
          lastStatus: status,
          lastError: error,
          lastItemCount: count,
        },
      });
    } catch (updateError) {
      this.logger.warn(
        `Falha ao atualizar status da fonte ${id}: ${String(updateError)}`,
      );
    }
  }
}
