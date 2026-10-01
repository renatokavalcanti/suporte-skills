import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../shared/audit/audit.service';
import { AuthenticatedUser } from '../../shared/common/authenticated-user.interface';
import {
  Paginated,
  buildMeta,
  paginationArgs,
} from '../../shared/common/pagination';
import { CreateNewsItemDto } from './dto/create-news-item.dto';
import { CreateNewsSourceDto } from './dto/create-news-source.dto';
import { QueryNewsDto } from './dto/query-news.dto';
import { QueryNewsSourcesDto } from './dto/query-news-sources.dto';
import { UpdateNewsItemDto } from './dto/update-news-item.dto';
import { UpdateNewsSourceDto } from './dto/update-news-source.dto';

const NEWS_ITEM_SELECT = {
  id: true,
  sourceId: true,
  vendorId: true,
  technologyId: true,
  externalId: true,
  url: true,
  title: true,
  summary: true,
  author: true,
  kind: true,
  origin: true,
  publishedAt: true,
  pinned: true,
  hidden: true,
  createdAt: true,
  updatedAt: true,
  vendor: { select: { id: true, name: true } },
  technology: { select: { id: true, name: true } },
  source: { select: { id: true, name: true, connectorType: true } },
} satisfies Prisma.NewsItemSelect;

type NewsItemRow = Prisma.NewsItemGetPayload<{
  select: typeof NEWS_ITEM_SELECT;
}>;

export type NewsItemView = NewsItemRow & { read: boolean; saved: boolean };

const NEWS_SOURCE_SELECT = {
  id: true,
  vendorId: true,
  technologyId: true,
  name: true,
  url: true,
  connectorType: true,
  active: true,
  fetchIntervalMinutes: true,
  lastFetchedAt: true,
  lastStatus: true,
  lastError: true,
  lastItemCount: true,
  createdAt: true,
  updatedAt: true,
  vendor: { select: { id: true, name: true } },
  technology: { select: { id: true, name: true } },
  _count: { select: { items: true } },
} satisfies Prisma.NewsSourceSelect;

export type NewsSourceView = Prisma.NewsSourceGetPayload<{
  select: typeof NEWS_SOURCE_SELECT;
}>;

const ITEM_SORTABLE = ['publishedAt', 'createdAt', 'title'] as const;

interface ReadState {
  readAt: Date | null;
  savedAt: Date | null;
}

@Injectable()
export class NewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // -------------------------------------------------------------------------
  // Itens (novidades)
  // -------------------------------------------------------------------------

  async list(
    query: QueryNewsDto,
    user: AuthenticatedUser,
  ): Promise<Paginated<NewsItemView>> {
    const where: Prisma.NewsItemWhereInput = { hidden: false };

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { summary: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.vendorId) where.vendorId = query.vendorId;
    if (query.technologyId) where.technologyId = query.technologyId;
    if (query.sourceId) where.sourceId = query.sourceId;
    if (query.kind) where.kind = query.kind;
    if (query.pinned) where.pinned = true;

    if (query.from || query.to) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (query.from) dateFilter.gte = new Date(query.from);
      if (query.to) dateFilter.lte = new Date(query.to);
      where.publishedAt = dateFilter;
    }

    const and: Prisma.NewsItemWhereInput[] = [];
    if (query.unread) {
      and.push({
        readStates: {
          none: { professionalId: user.id, readAt: { not: null } },
        },
      });
    }
    if (query.saved) {
      and.push({
        readStates: {
          some: { professionalId: user.id, savedAt: { not: null } },
        },
      });
    }
    if (and.length > 0) where.AND = and;

    const orderBy: Prisma.NewsItemOrderByWithRelationInput[] = [
      { pinned: 'desc' },
    ];
    const sortField =
      query.sort && (ITEM_SORTABLE as readonly string[]).includes(query.sort)
        ? query.sort
        : null;
    if (sortField) {
      orderBy.push({
        [sortField]: query.order ?? 'desc',
      } as Prisma.NewsItemOrderByWithRelationInput);
    } else {
      orderBy.push({ publishedAt: 'desc' }, { createdAt: 'desc' });
    }

    const { skip, take } = paginationArgs(query);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.newsItem.count({ where }),
      this.prisma.newsItem.findMany({
        where,
        orderBy,
        skip,
        take,
        select: NEWS_ITEM_SELECT,
      }),
    ]);

    const states = await this.loadStates(
      user.id,
      rows.map((row) => row.id),
    );

    return {
      data: rows.map((row) => this.withState(row, states)),
      meta: buildMeta(total, query),
    };
  }

  async getById(id: string, user: AuthenticatedUser): Promise<NewsItemView> {
    const row = await this.findItemOrFail(id);
    const states = await this.loadStates(user.id, [id]);
    return this.withState(row, states);
  }

  async summary(user: AuthenticatedUser) {
    const base: Prisma.NewsItemWhereInput = { hidden: false };
    const [total, pinned, unread, saved] = await this.prisma.$transaction([
      this.prisma.newsItem.count({ where: base }),
      this.prisma.newsItem.count({ where: { ...base, pinned: true } }),
      this.prisma.newsItem.count({
        where: {
          ...base,
          readStates: {
            none: { professionalId: user.id, readAt: { not: null } },
          },
        },
      }),
      this.prisma.newsItem.count({
        where: {
          ...base,
          readStates: {
            some: { professionalId: user.id, savedAt: { not: null } },
          },
        },
      }),
    ]);
    return { total, pinned, unread, saved };
  }

  async createItem(
    dto: CreateNewsItemDto,
    actor: AuthenticatedUser,
  ): Promise<NewsItemView> {
    await this.assertReferences(dto.vendorId, dto.technologyId);

    try {
      const created = await this.prisma.newsItem.create({
        data: {
          vendorId: dto.vendorId ?? null,
          technologyId: dto.technologyId ?? null,
          title: dto.title.trim(),
          url: dto.url.trim(),
          summary: dto.summary?.trim() ?? null,
          author: dto.author?.trim() ?? null,
          kind: dto.kind ?? 'GENERAL',
          origin: 'manual',
          publishedAt: dto.publishedAt ? new Date(dto.publishedAt) : new Date(),
          pinned: dto.pinned ?? false,
        },
        select: NEWS_ITEM_SELECT,
      });

      await this.audit.record({
        actorId: actor.id,
        entity: 'news_items',
        entityId: created.id,
        action: 'CREATE',
        after: created,
      });

      return this.withState(created, new Map());
    } catch (error) {
      throw this.translateUniqueUrl(error);
    }
  }

  async updateItem(
    id: string,
    dto: UpdateNewsItemDto,
    actor: AuthenticatedUser,
  ): Promise<NewsItemView> {
    const existing = await this.findItemOrFail(id);
    await this.assertReferences(dto.vendorId, dto.technologyId);

    const data: Prisma.NewsItemUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.url !== undefined) data.url = dto.url.trim();
    if (dto.summary !== undefined) data.summary = dto.summary?.trim() ?? null;
    if (dto.author !== undefined) data.author = dto.author?.trim() ?? null;
    if (dto.kind !== undefined) data.kind = dto.kind;
    if (dto.publishedAt !== undefined) {
      data.publishedAt = dto.publishedAt ? new Date(dto.publishedAt) : null;
    }
    if (dto.pinned !== undefined) data.pinned = dto.pinned;
    if (dto.vendorId !== undefined) {
      data.vendor = dto.vendorId
        ? { connect: { id: dto.vendorId } }
        : { disconnect: true };
    }
    if (dto.technologyId !== undefined) {
      data.technology = dto.technologyId
        ? { connect: { id: dto.technologyId } }
        : { disconnect: true };
    }

    try {
      const updated = await this.prisma.newsItem.update({
        where: { id },
        data,
        select: NEWS_ITEM_SELECT,
      });

      await this.audit.record({
        actorId: actor.id,
        entity: 'news_items',
        entityId: id,
        action: 'UPDATE',
        before: existing,
        after: updated,
      });

      return this.withState(updated, new Map());
    } catch (error) {
      throw this.translateUniqueUrl(error);
    }
  }

  async setPinned(
    id: string,
    pinned: boolean,
    actor: AuthenticatedUser,
  ): Promise<NewsItemView> {
    const existing = await this.findItemOrFail(id);
    const updated = await this.prisma.newsItem.update({
      where: { id },
      data: { pinned },
      select: NEWS_ITEM_SELECT,
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'news_items',
      entityId: id,
      action: 'UPDATE',
      before: { pinned: existing.pinned },
      after: { pinned: updated.pinned },
    });

    return this.withState(updated, new Map());
  }

  async setRead(
    id: string,
    read: boolean,
    user: AuthenticatedUser,
  ): Promise<{ id: string; read: boolean; saved: boolean }> {
    await this.findItemOrFail(id);
    const existing = await this.prisma.newsReadState.findUnique({
      where: {
        newsItemId_professionalId: {
          newsItemId: id,
          professionalId: user.id,
        },
      },
    });

    await this.prisma.newsReadState.upsert({
      where: {
        newsItemId_professionalId: {
          newsItemId: id,
          professionalId: user.id,
        },
      },
      create: {
        newsItemId: id,
        professionalId: user.id,
        readAt: read ? new Date() : null,
      },
      update: { readAt: read ? new Date() : null },
    });

    return { id, read, saved: Boolean(existing?.savedAt) };
  }

  async setSaved(
    id: string,
    saved: boolean,
    user: AuthenticatedUser,
  ): Promise<{ id: string; read: boolean; saved: boolean }> {
    await this.findItemOrFail(id);
    const existing = await this.prisma.newsReadState.findUnique({
      where: {
        newsItemId_professionalId: {
          newsItemId: id,
          professionalId: user.id,
        },
      },
    });

    await this.prisma.newsReadState.upsert({
      where: {
        newsItemId_professionalId: {
          newsItemId: id,
          professionalId: user.id,
        },
      },
      create: {
        newsItemId: id,
        professionalId: user.id,
        savedAt: saved ? new Date() : null,
      },
      update: { savedAt: saved ? new Date() : null },
    });

    return { id, read: Boolean(existing?.readAt), saved };
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    const existing = await this.findItemOrFail(id);
    await this.prisma.newsItem.update({
      where: { id },
      data: { hidden: true },
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'news_items',
      entityId: id,
      action: 'DELETE',
      before: { hidden: existing.hidden },
      after: { hidden: true },
    });
  }

  // -------------------------------------------------------------------------
  // Fontes (canais oficiais)
  // -------------------------------------------------------------------------

  async listSources(
    query: QueryNewsSourcesDto,
  ): Promise<Paginated<NewsSourceView>> {
    const where: Prisma.NewsSourceWhereInput = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { url: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.vendorId) where.vendorId = query.vendorId;
    if (typeof query.active === 'boolean') where.active = query.active;

    const { skip, take } = paginationArgs(query);
    const [total, data] = await this.prisma.$transaction([
      this.prisma.newsSource.count({ where }),
      this.prisma.newsSource.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take,
        select: NEWS_SOURCE_SELECT,
      }),
    ]);

    return { data, meta: buildMeta(total, query) };
  }

  async getSource(id: string): Promise<NewsSourceView> {
    const row = await this.prisma.newsSource.findUnique({
      where: { id },
      select: NEWS_SOURCE_SELECT,
    });
    if (!row) throw new NotFoundException('Fonte de noticias nao encontrada');
    return row;
  }

  async createSource(
    dto: CreateNewsSourceDto,
    actor: AuthenticatedUser,
  ): Promise<NewsSourceView> {
    await this.assertReferences(dto.vendorId, dto.technologyId);
    this.assertSourceHasUrl(dto.connectorType ?? 'RSS', dto.url);

    const created = await this.prisma.newsSource.create({
      data: {
        vendorId: dto.vendorId,
        technologyId: dto.technologyId ?? null,
        name: dto.name.trim(),
        url: dto.url?.trim() ?? null,
        connectorType: dto.connectorType ?? 'RSS',
        active: dto.active ?? true,
        fetchIntervalMinutes: dto.fetchIntervalMinutes ?? null,
      },
      select: NEWS_SOURCE_SELECT,
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'news_sources',
      entityId: created.id,
      action: 'CREATE',
      after: created,
    });

    return created;
  }

  async updateSource(
    id: string,
    dto: UpdateNewsSourceDto,
    actor: AuthenticatedUser,
  ): Promise<NewsSourceView> {
    const existing = await this.getSource(id);
    await this.assertReferences(dto.vendorId, dto.technologyId);

    const connectorType = dto.connectorType ?? existing.connectorType;
    const url = dto.url !== undefined ? dto.url : existing.url;
    this.assertSourceHasUrl(connectorType, url ?? undefined);

    const data: Prisma.NewsSourceUpdateInput = {};
    if (dto.vendorId !== undefined) {
      data.vendor = { connect: { id: dto.vendorId } };
    }
    if (dto.technologyId !== undefined) {
      data.technology = dto.technologyId
        ? { connect: { id: dto.technologyId } }
        : { disconnect: true };
    }
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.url !== undefined) data.url = dto.url?.trim() ?? null;
    if (dto.connectorType !== undefined) data.connectorType = dto.connectorType;
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.fetchIntervalMinutes !== undefined) {
      data.fetchIntervalMinutes = dto.fetchIntervalMinutes ?? null;
    }

    const updated = await this.prisma.newsSource.update({
      where: { id },
      data,
      select: NEWS_SOURCE_SELECT,
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'news_sources',
      entityId: id,
      action: 'UPDATE',
      before: existing,
      after: updated,
    });

    return updated;
  }

  async setSourceActive(
    id: string,
    active: boolean,
    actor: AuthenticatedUser,
  ): Promise<NewsSourceView> {
    const existing = await this.getSource(id);
    const updated = await this.prisma.newsSource.update({
      where: { id },
      data: { active },
      select: NEWS_SOURCE_SELECT,
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'news_sources',
      entityId: id,
      action: 'UPDATE',
      before: { active: existing.active },
      after: { active: updated.active },
    });

    return updated;
  }

  async deactivateSource(id: string, actor: AuthenticatedUser): Promise<void> {
    const existing = await this.getSource(id);
    await this.prisma.newsSource.update({
      where: { id },
      data: { active: false },
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'news_sources',
      entityId: id,
      action: 'DELETE',
      before: { active: existing.active },
      after: { active: false },
    });
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private async loadStates(
    professionalId: string,
    itemIds: string[],
  ): Promise<Map<string, ReadState>> {
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

  private withState(
    row: NewsItemRow,
    states: Map<string, ReadState>,
  ): NewsItemView {
    const state = states.get(row.id);
    return {
      ...row,
      read: Boolean(state?.readAt),
      saved: Boolean(state?.savedAt),
    };
  }

  private async findItemOrFail(id: string): Promise<NewsItemRow> {
    const row = await this.prisma.newsItem.findUnique({
      where: { id },
      select: NEWS_ITEM_SELECT,
    });
    if (!row) throw new NotFoundException('Novidade nao encontrada');
    return row;
  }

  private async assertReferences(
    vendorId?: string,
    technologyId?: string,
  ): Promise<void> {
    if (vendorId) {
      const vendor = await this.prisma.vendor.findUnique({
        where: { id: vendorId },
        select: { id: true },
      });
      if (!vendor) {
        throw new BadRequestException('Fabricante informado nao existe');
      }
    }
    if (technologyId) {
      const technology = await this.prisma.technology.findUnique({
        where: { id: technologyId },
        select: { id: true },
      });
      if (!technology) {
        throw new BadRequestException('Tecnologia informada nao existe');
      }
    }
  }

  private assertSourceHasUrl(
    connectorType: string,
    url: string | undefined | null,
  ): void {
    if (connectorType !== 'MANUAL' && !url) {
      throw new BadRequestException(
        'Informe a URL do feed para fontes automaticas',
      );
    }
  }

  private translateUniqueUrl(error: unknown): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException(
        'Ja existe uma novidade cadastrada com este link',
      );
    }
    return error;
  }
}
