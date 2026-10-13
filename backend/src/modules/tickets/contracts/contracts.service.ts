import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AuditService } from '../../../shared/audit/audit.service';
import { AuthenticatedUser } from '../../../shared/common/authenticated-user.interface';
import {
  Paginated,
  buildMeta,
  paginationArgs,
} from '../../../shared/common/pagination';
import { buildOrderBy } from '../../../shared/common/sorting';
import { CreateContractDto } from './dto/create-contract.dto';
import { QueryContractsDto } from './dto/query-contracts.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

const CONTRACT_SELECT = {
  id: true,
  clientId: true,
  planName: true,
  includedMinutes: true,
  monthlyValue: true,
  extraHourValue: true,
  balancePolicy: true,
  startDate: true,
  endDate: true,
  financeEmail: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true } },
} satisfies Prisma.ContractSelect;

type ContractRow = Prisma.ContractGetPayload<{ select: typeof CONTRACT_SELECT }>;

const SORTABLE = ['planName', 'startDate', 'createdAt', 'updatedAt'] as const;

function toDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/**
 * Contratos de servico do cliente (D-030): franquia, valores e politica de
 * saldo usados pela regra de faturamento. Escrita auditada; desativacao e'
 * soft delete (como em Clients).
 */
@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(query: QueryContractsDto): Promise<Paginated<ContractRow>> {
    const where: Prisma.ContractWhereInput = {};
    if (query.clientId) where.clientId = query.clientId;
    if (typeof query.active === 'boolean') where.active = query.active;
    if (query.search) {
      where.planName = { contains: query.search, mode: 'insensitive' };
    }

    const orderBy = buildOrderBy(
      query.sort,
      SORTABLE,
      'createdAt',
      query.order ?? 'desc',
    );
    const { skip, take } = paginationArgs(query);

    const [total, data] = await this.prisma.$transaction([
      this.prisma.contract.count({ where }),
      this.prisma.contract.findMany({
        where,
        orderBy,
        skip,
        take,
        select: CONTRACT_SELECT,
      }),
    ]);

    return { data, meta: buildMeta(total, query) };
  }

  async getById(id: string): Promise<ContractRow> {
    const contract = await this.prisma.contract.findUnique({
      where: { id },
      select: CONTRACT_SELECT,
    });
    if (!contract) throw new NotFoundException('Contrato nao encontrado');
    return contract;
  }

  async create(
    dto: CreateContractDto,
    actor: AuthenticatedUser,
  ): Promise<ContractRow> {
    await this.ensureClient(dto.clientId);

    const created = await this.prisma.contract.create({
      data: {
        clientId: dto.clientId,
        planName: dto.planName.trim(),
        includedMinutes: dto.includedMinutes,
        monthlyValue: dto.monthlyValue,
        extraHourValue: dto.extraHourValue,
        balancePolicy: dto.balancePolicy,
        startDate: toDate(dto.startDate),
        endDate: dto.endDate ? toDate(dto.endDate) : null,
        financeEmail: dto.financeEmail?.trim() || null,
        active: dto.active ?? true,
      },
      select: CONTRACT_SELECT,
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'contracts',
      entityId: created.id,
      action: 'CREATE',
      after: created,
    });

    return created;
  }

  async update(
    id: string,
    dto: UpdateContractDto,
    actor: AuthenticatedUser,
  ): Promise<ContractRow> {
    const existing = await this.prisma.contract.findUnique({
      where: { id },
      select: CONTRACT_SELECT,
    });
    if (!existing) throw new NotFoundException('Contrato nao encontrado');

    if (dto.clientId !== undefined) await this.ensureClient(dto.clientId);

    const data: Prisma.ContractUpdateInput = {};
    if (dto.clientId !== undefined) data.client = { connect: { id: dto.clientId } };
    if (dto.planName !== undefined) data.planName = dto.planName.trim();
    if (dto.includedMinutes !== undefined) data.includedMinutes = dto.includedMinutes;
    if (dto.monthlyValue !== undefined) data.monthlyValue = dto.monthlyValue;
    if (dto.extraHourValue !== undefined) data.extraHourValue = dto.extraHourValue;
    if (dto.balancePolicy !== undefined) data.balancePolicy = dto.balancePolicy;
    if (dto.startDate !== undefined) data.startDate = toDate(dto.startDate);
    if (dto.endDate !== undefined)
      data.endDate = dto.endDate ? toDate(dto.endDate) : null;
    if (dto.financeEmail !== undefined)
      data.financeEmail = dto.financeEmail?.trim() || null;
    if (dto.active !== undefined) data.active = dto.active;

    const updated = await this.prisma.contract.update({
      where: { id },
      data,
      select: CONTRACT_SELECT,
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'contracts',
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
  ): Promise<ContractRow> {
    const existing = await this.prisma.contract.findUnique({
      where: { id },
      select: { id: true, active: true },
    });
    if (!existing) throw new NotFoundException('Contrato nao encontrado');

    const updated = await this.prisma.contract.update({
      where: { id },
      data: { active },
      select: CONTRACT_SELECT,
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'contracts',
      entityId: id,
      action: 'UPDATE',
      before: { active: existing.active },
      after: { active: updated.active },
    });

    return updated;
  }

  async deactivate(id: string, actor: AuthenticatedUser): Promise<void> {
    const existing = await this.prisma.contract.findUnique({
      where: { id },
      select: { id: true, active: true },
    });
    if (!existing) throw new NotFoundException('Contrato nao encontrado');

    await this.prisma.contract.update({ where: { id }, data: { active: false } });

    await this.audit.record({
      actorId: actor.id,
      entity: 'contracts',
      entityId: id,
      action: 'DELETE',
      before: { active: existing.active },
      after: { active: false },
    });
  }

  private async ensureClient(clientId: string): Promise<void> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });
    if (!client) throw new NotFoundException('Cliente nao encontrado');
  }
}
