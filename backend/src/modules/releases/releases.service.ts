import {
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
import { CreateReleaseDto } from './dto/create-release.dto';
import { CreateReleaseItemDto } from './dto/create-release-item.dto';
import { QueryReleasesDto } from './dto/query-releases.dto';
import { UpdateReleaseDto } from './dto/update-release.dto';

const RELEASE_SELECT = {
  id: true,
  version: true,
  title: true,
  summary: true,
  releasedAt: true,
  current: true,
  hidden: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: { id: true, category: true, description: true, position: true },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  },
} satisfies Prisma.ReleaseSelect;

export type ReleaseView = Prisma.ReleaseGetPayload<{
  select: typeof RELEASE_SELECT;
}>;

@Injectable()
export class ReleasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: QueryReleasesDto): Promise<Paginated<ReleaseView>> {
    const where: Prisma.ReleaseWhereInput = { hidden: false };
    if (query.search) {
      where.OR = [
        { version: { contains: query.search, mode: 'insensitive' } },
        { title: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (typeof query.current === 'boolean') where.current = query.current;

    const { skip, take } = paginationArgs(query);
    const [total, data] = await this.prisma.$transaction([
      this.prisma.release.count({ where }),
      this.prisma.release.findMany({
        where,
        orderBy: [{ releasedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take,
        select: RELEASE_SELECT,
      }),
    ]);

    return { data, meta: buildMeta(total, query) };
  }

  async getById(id: string): Promise<ReleaseView> {
    return this.findOrFail(id);
  }

  async create(
    dto: CreateReleaseDto,
    actor: AuthenticatedUser,
  ): Promise<ReleaseView> {
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        if (dto.current) {
          await tx.release.updateMany({
            where: { current: true },
            data: { current: false },
          });
        }
        return tx.release.create({
          data: {
            version: dto.version.trim(),
            title: dto.title.trim(),
            summary: dto.summary?.trim() ?? null,
            releasedAt: new Date(dto.releasedAt),
            current: dto.current ?? false,
            items: dto.items?.length
              ? { create: this.buildItems(dto.items) }
              : undefined,
          },
          select: RELEASE_SELECT,
        });
      });

      await this.audit.record({
        actorId: actor.id,
        entity: 'releases',
        entityId: created.id,
        action: 'CREATE',
        after: created,
      });

      return created;
    } catch (error) {
      throw this.translateVersion(error);
    }
  }

  async update(
    id: string,
    dto: UpdateReleaseDto,
    actor: AuthenticatedUser,
  ): Promise<ReleaseView> {
    const existing = await this.findOrFail(id);

    try {
      await this.prisma.$transaction(async (tx) => {
        if (dto.current === true) {
          await tx.release.updateMany({
            where: { current: true, NOT: { id } },
            data: { current: false },
          });
        }

        const data: Prisma.ReleaseUpdateInput = {};
        if (dto.version !== undefined) data.version = dto.version.trim();
        if (dto.title !== undefined) data.title = dto.title.trim();
        if (dto.summary !== undefined) {
          data.summary = dto.summary?.trim() ?? null;
        }
        if (dto.releasedAt !== undefined) {
          data.releasedAt = new Date(dto.releasedAt);
        }
        if (dto.current !== undefined) data.current = dto.current;

        await tx.release.update({ where: { id }, data });

        if (dto.items !== undefined) {
          await tx.releaseItem.deleteMany({ where: { releaseId: id } });
          if (dto.items.length) {
            await tx.releaseItem.createMany({
              data: this.buildItems(dto.items).map((item) => ({
                ...item,
                releaseId: id,
              })),
            });
          }
        }
      });
    } catch (error) {
      throw this.translateVersion(error);
    }

    const updated = await this.findOrFail(id);
    await this.audit.record({
      actorId: actor.id,
      entity: 'releases',
      entityId: id,
      action: 'UPDATE',
      before: existing,
      after: updated,
    });
    return updated;
  }

  async setCurrent(id: string, actor: AuthenticatedUser): Promise<ReleaseView> {
    const existing = await this.findOrFail(id);
    const [, updated] = await this.prisma.$transaction([
      this.prisma.release.updateMany({
        where: { current: true, NOT: { id } },
        data: { current: false },
      }),
      this.prisma.release.update({
        where: { id },
        data: { current: true },
        select: RELEASE_SELECT,
      }),
    ]);

    await this.audit.record({
      actorId: actor.id,
      entity: 'releases',
      entityId: id,
      action: 'UPDATE',
      before: { current: existing.current },
      after: { current: true },
    });
    return updated;
  }

  async remove(id: string, actor: AuthenticatedUser): Promise<void> {
    const existing = await this.findOrFail(id);
    await this.prisma.release.update({
      where: { id },
      data: { hidden: true },
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'releases',
      entityId: id,
      action: 'DELETE',
      before: { hidden: existing.hidden },
      after: { hidden: true },
    });
  }

  private buildItems(items: CreateReleaseItemDto[]) {
    return items.map((item, index) => ({
      category: item.category ?? ('FEATURE' as const),
      description: item.description.trim(),
      position: item.position ?? index,
    }));
  }

  private async findOrFail(id: string): Promise<ReleaseView> {
    const row = await this.prisma.release.findUnique({
      where: { id },
      select: RELEASE_SELECT,
    });
    if (!row) throw new NotFoundException('Release nao encontrada');
    return row;
  }

  private translateVersion(error: unknown): unknown {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      return new ConflictException('Ja existe uma release com esta versao');
    }
    return error;
  }
}
