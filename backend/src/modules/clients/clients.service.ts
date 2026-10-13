import { Injectable, NotFoundException } from '@nestjs/common';
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
import { CreateClientDto } from './dto/create-client.dto';
import { QueryClientsDto } from './dto/query-clients.dto';
import { UpdateClientDto } from './dto/update-client.dto';

const CLIENT_SELECT = {
  id: true,
  name: true,
  document: true,
  zohoAccountId: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { tickets: true } },
} satisfies Prisma.ClientSelect;

type ClientRow = Prisma.ClientGetPayload<{ select: typeof CLIENT_SELECT }>;

const SORTABLE = ['name', 'createdAt', 'updatedAt'] as const;

@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: QueryClientsDto): Promise<Paginated<ClientRow>> {
    const where: Prisma.ClientWhereInput = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { document: { contains: query.search, mode: 'insensitive' } },
        { zohoAccountId: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (typeof query.active === 'boolean') where.active = query.active;

    const orderBy = buildOrderBy(
      query.sort,
      SORTABLE,
      'name',
      query.order ?? 'asc',
    );
    const { skip, take } = paginationArgs(query);

    const [total, data] = await this.prisma.$transaction([
      this.prisma.client.count({ where }),
      this.prisma.client.findMany({
        where,
        orderBy,
        skip,
        take,
        select: CLIENT_SELECT,
      }),
    ]);

    return { data, meta: buildMeta(total, query) };
  }

  async getById(id: string): Promise<ClientRow> {
    const client = await this.prisma.client.findUnique({
      where: { id },
      select: CLIENT_SELECT,
    });
    if (!client) throw new NotFoundException('Cliente nao encontrado');
    return client;
  }

  async create(
    dto: CreateClientDto,
    actor: AuthenticatedUser,
  ): Promise<ClientRow> {
    const created = await this.prisma.client.create({
      data: {
        name: dto.name.trim(),
        document: dto.document?.trim() || null,
        zohoAccountId: dto.zohoAccountId?.trim() || null,
        active: dto.active ?? true,
      },
      select: CLIENT_SELECT,
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'clients',
      entityId: created.id,
      action: 'CREATE',
      after: created,
    });

    return created;
  }

  async update(
    id: string,
    dto: UpdateClientDto,
    actor: AuthenticatedUser,
  ): Promise<ClientRow> {
    const existing = await this.prisma.client.findUnique({
      where: { id },
      select: CLIENT_SELECT,
    });
    if (!existing) throw new NotFoundException('Cliente nao encontrado');

    const data: Prisma.ClientUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.document !== undefined)
      data.document = dto.document?.trim() || null;
    if (dto.zohoAccountId !== undefined)
      data.zohoAccountId = dto.zohoAccountId?.trim() || null;
    if (dto.active !== undefined) data.active = dto.active;

    const updated = await this.prisma.client.update({
      where: { id },
      data,
      select: CLIENT_SELECT,
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'clients',
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
  ): Promise<ClientRow> {
    const existing = await this.prisma.client.findUnique({
      where: { id },
      select: { id: true, active: true },
    });
    if (!existing) throw new NotFoundException('Cliente nao encontrado');

    const updated = await this.prisma.client.update({
      where: { id },
      data: { active },
      select: CLIENT_SELECT,
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'clients',
      entityId: id,
      action: 'UPDATE',
      before: { active: existing.active },
      after: { active: updated.active },
    });

    return updated;
  }

  async deactivate(id: string, actor: AuthenticatedUser): Promise<void> {
    const existing = await this.prisma.client.findUnique({
      where: { id },
      select: { id: true, active: true },
    });
    if (!existing) throw new NotFoundException('Cliente nao encontrado');

    await this.prisma.client.update({ where: { id }, data: { active: false } });

    await this.audit.record({
      actorId: actor.id,
      entity: 'clients',
      entityId: id,
      action: 'DELETE',
      before: { active: existing.active },
      after: { active: false },
    });
  }
}
