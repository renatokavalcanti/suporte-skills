import {
  BadRequestException,
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
import { buildOrderBy } from '../../shared/common/sorting';
import { CreateTechnologyDto } from './dto/create-technology.dto';
import { QueryTechnologiesDto } from './dto/query-technologies.dto';
import { UpdateTechnologyDto } from './dto/update-technology.dto';

const TECHNOLOGY_SELECT = {
  id: true,
  vendorId: true,
  name: true,
  category: true,
  description: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  vendor: { select: { id: true, name: true } },
  _count: { select: { certifications: true } },
} satisfies Prisma.TechnologySelect;

type TechnologyRow = Prisma.TechnologyGetPayload<{
  select: typeof TECHNOLOGY_SELECT;
}>;

const SORTABLE = ['name', 'category', 'createdAt', 'updatedAt'] as const;

@Injectable()
export class TechnologiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(
    query: QueryTechnologiesDto,
  ): Promise<Paginated<TechnologyRow>> {
    const where: Prisma.TechnologyWhereInput = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.vendorId) where.vendorId = query.vendorId;
    if (query.category) where.category = query.category;
    if (typeof query.active === 'boolean') where.active = query.active;

    const orderBy = buildOrderBy(
      query.sort,
      SORTABLE,
      'name',
      query.order ?? 'asc',
    );
    const { skip, take } = paginationArgs(query);

    const [total, data] = await this.prisma.$transaction([
      this.prisma.technology.count({ where }),
      this.prisma.technology.findMany({
        where,
        orderBy,
        skip,
        take,
        select: TECHNOLOGY_SELECT,
      }),
    ]);

    return { data, meta: buildMeta(total, query) };
  }

  async getById(id: string): Promise<TechnologyRow> {
    const row = await this.prisma.technology.findUnique({
      where: { id },
      select: TECHNOLOGY_SELECT,
    });
    if (!row) throw new NotFoundException('Tecnologia nao encontrada');
    return row;
  }

  async create(
    dto: CreateTechnologyDto,
    actor: AuthenticatedUser,
  ): Promise<TechnologyRow> {
    await this.assertVendorExists(dto.vendorId);

    const created = await this.prisma.technology.create({
      data: {
        vendorId: dto.vendorId,
        name: dto.name.trim(),
        category: dto.category ?? null,
        description: dto.description ?? null,
        active: dto.active ?? true,
      },
      select: TECHNOLOGY_SELECT,
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'technologies',
      entityId: created.id,
      action: 'CREATE',
      after: created,
    });

    return created;
  }

  async update(
    id: string,
    dto: UpdateTechnologyDto,
    actor: AuthenticatedUser,
  ): Promise<TechnologyRow> {
    const existing = await this.prisma.technology.findUnique({
      where: { id },
      select: TECHNOLOGY_SELECT,
    });
    if (!existing) throw new NotFoundException('Tecnologia nao encontrada');

    if (dto.vendorId !== undefined) await this.assertVendorExists(dto.vendorId);

    const data: Prisma.TechnologyUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.category !== undefined) data.category = dto.category ?? null;
    if (dto.description !== undefined)
      data.description = dto.description ?? null;
    if (dto.active !== undefined) data.active = dto.active;
    if (dto.vendorId !== undefined)
      data.vendor = { connect: { id: dto.vendorId } };

    const updated = await this.prisma.technology.update({
      where: { id },
      data,
      select: TECHNOLOGY_SELECT,
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'technologies',
      entityId: id,
      action: 'UPDATE',
      before: existing,
      after: updated,
    });

    return updated;
  }

  async setActive(
    id: string,
    active: boolean,
    actor: AuthenticatedUser,
  ): Promise<TechnologyRow> {
    const existing = await this.prisma.technology.findUnique({
      where: { id },
      select: { id: true, active: true },
    });
    if (!existing) throw new NotFoundException('Tecnologia nao encontrada');

    const updated = await this.prisma.technology.update({
      where: { id },
      data: { active },
      select: TECHNOLOGY_SELECT,
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'technologies',
      entityId: id,
      action: 'UPDATE',
      before: { active: existing.active },
      after: { active: updated.active },
    });

    return updated;
  }

  async deactivate(id: string, actor: AuthenticatedUser): Promise<void> {
    const existing = await this.prisma.technology.findUnique({
      where: { id },
      select: { id: true, active: true },
    });
    if (!existing) throw new NotFoundException('Tecnologia nao encontrada');

    await this.prisma.technology.update({
      where: { id },
      data: { active: false },
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'technologies',
      entityId: id,
      action: 'DELETE',
      before: { active: existing.active },
      after: { active: false },
    });
  }

  private async assertVendorExists(vendorId: string): Promise<void> {
    const vendor = await this.prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { id: true },
    });
    if (!vendor) {
      throw new BadRequestException('Fabricante informado nao existe');
    }
  }
}
