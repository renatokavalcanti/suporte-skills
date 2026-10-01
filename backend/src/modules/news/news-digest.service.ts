import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { NewsFocus, NewsKind, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../shared/audit/audit.service';
import { AuthenticatedUser } from '../../shared/common/authenticated-user.interface';
import { SettingsService } from '../settings/settings.service';
import { DigestCandidate, NewsAiService } from './news-ai.service';
import { scoreNewsRelevance } from './news-relevance';

export interface NewsDigestHighlight {
  id: string;
  title: string;
  url: string;
  kind: NewsKind;
  focus: NewsFocus | null;
  vendor: string | null;
  technology: string | null;
  note: string;
  score: number;
  read: boolean;
  saved: boolean;
}

export interface NewsDigestView {
  id: string;
  title: string;
  summary: string;
  itemCount: number;
  periodStart: string | null;
  periodEnd: string | null;
  model: string | null;
  origin: string;
  createdAt: string;
  highlights: NewsDigestHighlight[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

const CANDIDATE_SELECT = {
  id: true,
  title: true,
  url: true,
  summary: true,
  kind: true,
  publishedAt: true,
  relevanceScore: true,
  relevanceFocus: true,
  relevanceNote: true,
  vendor: { select: { name: true } },
  technology: { select: { name: true } },
} satisfies Prisma.NewsItemSelect;

type CandidateRow = Prisma.NewsItemGetPayload<{
  select: typeof CANDIDATE_SELECT;
}>;

interface HighlightSnapshot {
  id: string;
  title: string;
  url: string;
  kind: NewsKind;
  focus: NewsFocus | null;
  vendor: string | null;
  technology: string | null;
  note: string;
  score: number;
}

@Injectable()
export class NewsDigestService implements OnModuleInit {
  private readonly logger = new Logger(NewsDigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly ai: NewsAiService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Backfill idempotente: pontua pela heuristica os itens que ainda nao tem
   * relevancia calculada (ex.: criados antes desta funcionalidade). Roda uma
   * unica vez no start; itens novos ja sao pontuados na origem.
   */
  onModuleInit(): void {
    void this.scorePending()
      .then((count) => {
        if (count > 0) {
          this.logger.log(`Relevancia calculada para ${count} novidade(s)`);
        }
      })
      .catch((error) => {
        this.logger.warn(`Falha no backfill de relevancia: ${String(error)}`);
      });
  }

  /** A IA esta configurada e pronta para gerar resumos. */
  isAiEnabled(): Promise<boolean> {
    return this.ai.isEnabled();
  }

  /** Resumo automatico na sincronizacao esta ligado (e a IA disponivel). */
  async isAutoEnabled(): Promise<boolean> {
    const config = await this.settings.getResolved();
    return config.digestEnabled && config.enabled;
  }

  async getLatest(user: AuthenticatedUser): Promise<NewsDigestView | null> {
    const digest = await this.prisma.newsDigest.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    if (!digest) return null;

    const snapshots = this.asSnapshots(digest.highlights);
    const ids = snapshots.map((snapshot) => snapshot.id);
    const [states, current] = await Promise.all([
      this.loadStates(user.id, ids),
      ids.length > 0
        ? this.prisma.newsItem.findMany({
            where: { id: { in: ids }, hidden: false },
            select: {
              id: true,
              title: true,
              url: true,
              kind: true,
              relevanceFocus: true,
              relevanceScore: true,
              vendor: { select: { name: true } },
              technology: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
    ]);

    const currentById = new Map(current.map((row) => [row.id, row]));

    const highlights: NewsDigestHighlight[] = snapshots.map((snapshot) => {
      const live = currentById.get(snapshot.id);
      const state = states.get(snapshot.id);
      return {
        id: snapshot.id,
        title: live?.title ?? snapshot.title,
        url: live?.url ?? snapshot.url,
        kind: live?.kind ?? snapshot.kind,
        focus: live?.relevanceFocus ?? snapshot.focus,
        vendor: live?.vendor?.name ?? snapshot.vendor,
        technology: live?.technology?.name ?? snapshot.technology,
        note: snapshot.note,
        score: live?.relevanceScore ?? snapshot.score,
        read: Boolean(state?.readAt),
        saved: Boolean(state?.savedAt),
      };
    });

    return this.toView(digest, highlights);
  }

  /**
   * Gera (e persiste) um novo resumo. Exige IA ligada. `origin` distingue o
   * disparo automatico ("sync") do manual ("manual").
   */
  async generate(
    actor: AuthenticatedUser | null,
    origin: 'manual' | 'sync',
  ): Promise<NewsDigestView> {
    await this.scorePending();

    const config = await this.settings.getResolved();
    const periodEnd = new Date();
    const periodStart = new Date(
      periodEnd.getTime() - config.digestWindowDays * DAY_MS,
    );

    const candidates = await this.selectCandidates(
      periodStart,
      config.digestMaxItems,
    );
    const byId = new Map(candidates.map((row) => [row.id, row]));

    const result = await this.ai.summarize(
      candidates.map((row) => this.toCandidate(row)),
    );

    const highlights: HighlightSnapshot[] = result.highlights
      .filter((highlight) => byId.has(highlight.id))
      .map((highlight) => {
        const row = byId.get(highlight.id) as CandidateRow;
        return {
          id: row.id,
          title: row.title,
          url: row.url,
          kind: row.kind,
          focus: highlight.focus ?? row.relevanceFocus,
          vendor: row.vendor?.name ?? null,
          technology: row.technology?.name ?? null,
          note: highlight.note,
          score: highlight.score ?? row.relevanceScore,
        };
      });

    const digest = await this.prisma.newsDigest.create({
      data: {
        title: result.title,
        summary: result.summary,
        highlights: highlights as unknown as Prisma.InputJsonValue,
        itemCount: candidates.length,
        periodStart,
        periodEnd,
        model: result.model,
        origin,
        generatedBy: actor?.id ?? 'system',
      },
    });

    // Reflete o ranking da IA nos itens (usado pela ordenacao da lista).
    for (const highlight of result.highlights) {
      await this.prisma.newsItem
        .update({
          where: { id: highlight.id },
          data: {
            relevanceScore: highlight.score ?? undefined,
            relevanceFocus: highlight.focus ?? undefined,
            relevanceNote: highlight.note,
            scoredAt: new Date(),
          },
        })
        .catch((error) => {
          this.logger.warn(
            `Falha ao atualizar relevancia de ${highlight.id}: ${String(error)}`,
          );
        });
    }

    await this.audit.record({
      actorId: actor?.id ?? null,
      entity: 'news_digests',
      entityId: digest.id,
      action: 'CREATE',
      after: {
        title: digest.title,
        itemCount: digest.itemCount,
        highlights: highlights.map((highlight) => highlight.id),
        origin,
        model: result.model,
      },
    });

    return this.toView(digest, highlights.map((snapshot) => ({
      ...snapshot,
      read: false,
      saved: false,
    })));
  }

  /**
   * Aplica a relevancia heuristica aos itens ainda nao pontuados. Barato e
   * idempotente: roda antes de gerar o resumo e na sincronizacao.
   */
  async scorePending(limit = 300): Promise<number> {
    const pending = await this.prisma.newsItem.findMany({
      where: { hidden: false, scoredAt: null },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        summary: true,
        kind: true,
        publishedAt: true,
      },
    });

    for (const item of pending) {
      const relevance = scoreNewsRelevance(item);
      await this.prisma.newsItem.update({
        where: { id: item.id },
        data: {
          relevanceScore: relevance.score,
          relevanceFocus: relevance.focus,
          relevanceNote: relevance.note,
          scoredAt: new Date(),
        },
      });
    }

    return pending.length;
  }

  private async selectCandidates(
    since: Date,
    limit: number,
  ): Promise<CandidateRow[]> {
    return this.prisma.newsItem.findMany({
      where: {
        hidden: false,
        OR: [
          { publishedAt: { gte: since } },
          { publishedAt: null, createdAt: { gte: since } },
        ],
      },
      orderBy: [
        { relevanceScore: 'desc' },
        { publishedAt: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
      select: CANDIDATE_SELECT,
    });
  }

  private toCandidate(row: CandidateRow): DigestCandidate {
    return {
      id: row.id,
      title: row.title,
      summary: row.summary,
      vendor: row.vendor?.name ?? null,
      kind: row.kind,
      publishedAt: row.publishedAt,
    };
  }

  private async loadStates(
    professionalId: string,
    itemIds: string[],
  ): Promise<Map<string, { readAt: Date | null; savedAt: Date | null }>> {
    if (itemIds.length === 0) return new Map();
    const states = await this.prisma.newsReadState.findMany({
      where: { professionalId, newsItemId: { in: itemIds } },
      select: { newsItemId: true, readAt: true, savedAt: true },
    });
    return new Map(
      states.map((state) => [
        state.newsItemId,
        { readAt: state.readAt, savedAt: state.savedAt },
      ]),
    );
  }

  private asSnapshots(value: Prisma.JsonValue): HighlightSnapshot[] {
    if (!Array.isArray(value)) return [];
    const rows = (value as unknown[]).filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === 'object' && 'id' in (entry as object),
    );
    return rows as unknown as HighlightSnapshot[];
  }

  private toView(
    digest: {
      id: string;
      title: string;
      summary: string;
      itemCount: number;
      periodStart: Date | null;
      periodEnd: Date | null;
      model: string | null;
      origin: string;
      createdAt: Date;
    },
    highlights: NewsDigestHighlight[],
  ): NewsDigestView {
    return {
      id: digest.id,
      title: digest.title,
      summary: digest.summary,
      itemCount: digest.itemCount,
      periodStart: digest.periodStart?.toISOString() ?? null,
      periodEnd: digest.periodEnd?.toISOString() ?? null,
      model: digest.model,
      origin: digest.origin,
      createdAt: digest.createdAt.toISOString(),
      highlights,
    };
  }
}
