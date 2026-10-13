import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../shared/audit/audit.service';
import { AuthenticatedUser } from '../../shared/common/authenticated-user.interface';
import { zonedMonthRange } from '../../shared/common/business-time';
import {
  Paginated,
  buildMeta,
  paginationArgs,
} from '../../shared/common/pagination';
import { CreateMeasurementDto } from './dto/create-measurement.dto';
import { QueryMeasurementsDto } from './dto/query-measurements.dto';

const MEASUREMENT_INCLUDE = {
  client: { select: { id: true, name: true, document: true } },
} satisfies Prisma.MonthlyMeasurementInclude;

type MeasurementRow = Prisma.MonthlyMeasurementGetPayload<{
  include: typeof MEASUREMENT_INCLUDE;
}>;

type MeasurementDetail = MeasurementRow & {
  slaPercentage: number | null;
  items: unknown[];
};

interface Totals {
  ticketCount: number;
  timeSpentMinutes: number;
  slaEvaluatedCount: number;
  slaCompliantCount: number;
}

/**
 * Medicoes Mensais (D-029): consolida, por cliente/mes, os chamados faturaveis
 * (comprovacao de servico). O mes e' interpretado em BUSINESS_TIMEZONE e a
 * referencia e' `close_date` com `isBillable=true`. A medicao FECHADA e'
 * imutavel (snapshot); reabertura so' por ADMIN, com justificativa auditada.
 */
@Injectable()
export class MeasurementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private timezone(): string {
    return this.config.get<string>('business.timezone') ?? 'America/Sao_Paulo';
  }

  async list(
    query: QueryMeasurementsDto,
  ): Promise<Paginated<MeasurementRow & { slaPercentage: number | null }>> {
    const where: Prisma.MonthlyMeasurementWhereInput = {};
    if (query.clientId) where.clientId = query.clientId;
    if (query.year) where.year = query.year;
    if (query.month) where.month = query.month;
    if (query.status) where.status = query.status;

    const { skip, take } = paginationArgs(query);
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.monthlyMeasurement.count({ where }),
      this.prisma.monthlyMeasurement.findMany({
        where,
        include: MEASUREMENT_INCLUDE,
        orderBy: [{ year: 'desc' }, { month: 'desc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
    ]);

    return {
      data: rows.map((row) => this.withSla(row)),
      meta: buildMeta(total, query),
    };
  }

  async getById(id: string): Promise<MeasurementDetail> {
    const measurement = await this.prisma.monthlyMeasurement.findUnique({
      where: { id },
      include: {
        ...MEASUREMENT_INCLUDE,
        items: { orderBy: [{ closeDate: 'asc' }, { createdAt: 'asc' }] },
      },
    });
    if (!measurement) throw new NotFoundException('Medicao nao encontrada');

    const { items, ...rest } = measurement;
    return { ...this.withSla(rest), items };
  }

  /** Recalcula o rascunho do mes. Nao toca uma medicao FECHADA. */
  async generateDraft(
    dto: CreateMeasurementDto,
    actor: AuthenticatedUser,
  ): Promise<MeasurementDetail> {
    const client = await this.prisma.client.findUnique({
      where: { id: dto.clientId },
      select: { id: true, active: true },
    });
    if (!client) throw new NotFoundException('Cliente nao encontrado');

    const key = {
      clientId: dto.clientId,
      year: dto.year,
      month: dto.month,
    };
    const existing = await this.prisma.monthlyMeasurement.findUnique({
      where: { clientId_year_month: key },
      select: { id: true, status: true },
    });
    if (existing?.status === 'CLOSED') {
      throw new ConflictException(
        'Medicao ja fechada; reabra antes de gerar um novo rascunho',
      );
    }

    const { start, end } = zonedMonthRange(dto.year, dto.month, this.timezone());
    const tickets = await this.prisma.ticket.findMany({
      where: {
        clientId: dto.clientId,
        isBillable: true,
        closeDate: { gte: start, lt: end },
      },
      orderBy: [{ closeDate: 'asc' }, { createdAt: 'asc' }],
    });

    const totals = this.sumTotals(tickets);

    const measurement = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.monthlyMeasurement.upsert({
        where: { clientId_year_month: key },
        create: { ...key, status: 'DRAFT', ...totals },
        update: {
          status: 'DRAFT',
          ...totals,
          closedById: null,
          closedAt: null,
        },
        select: { id: true },
      });

      await tx.monthlyMeasurementItem.deleteMany({
        where: { measurementId: saved.id },
      });
      if (tickets.length > 0) {
        await tx.monthlyMeasurementItem.createMany({
          data: tickets.map((ticket) => ({
            measurementId: saved.id,
            ticketId: ticket.id,
            zohoTicketId: ticket.zohoTicketId,
            ticketNumber: ticket.ticketNumber,
            title: ticket.title,
            status: ticket.status,
            closeDate: ticket.closeDate,
            timeSpentMinutes: ticket.timeSpentMinutes,
            slaCompliant: ticket.slaCompliant,
            isBillable: ticket.isBillable,
          })),
        });
      }
      return saved;
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'monthly_measurements',
      entityId: measurement.id,
      action: existing ? 'UPDATE' : 'CREATE',
      after: { ...key, ...totals },
    });

    return this.getById(measurement.id);
  }

  async close(id: string, actor: AuthenticatedUser): Promise<MeasurementDetail> {
    const measurement = await this.prisma.monthlyMeasurement.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!measurement) throw new NotFoundException('Medicao nao encontrada');
    if (measurement.status === 'CLOSED') {
      throw new ConflictException('Medicao ja esta fechada');
    }

    await this.prisma.monthlyMeasurement.update({
      where: { id },
      data: { status: 'CLOSED', closedById: actor.id, closedAt: new Date() },
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'monthly_measurements',
      entityId: id,
      action: 'UPDATE',
      before: { status: 'DRAFT' },
      after: { status: 'CLOSED', closedById: actor.id },
    });

    return this.getById(id);
  }

  /** Reabre uma medicao FECHADA (somente ADMIN). Justificativa obrigatoria. */
  async reopen(
    id: string,
    justification: string,
    actor: AuthenticatedUser,
  ): Promise<MeasurementDetail> {
    const measurement = await this.prisma.monthlyMeasurement.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!measurement) throw new NotFoundException('Medicao nao encontrada');
    if (measurement.status !== 'CLOSED') {
      throw new BadRequestException('Somente uma medicao fechada pode ser reaberta');
    }

    await this.prisma.monthlyMeasurement.update({
      where: { id },
      data: { status: 'DRAFT', closedById: null, closedAt: null },
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'monthly_measurements',
      entityId: id,
      action: 'UPDATE',
      before: { status: 'CLOSED' },
      after: { status: 'DRAFT', justification },
    });

    return this.getById(id);
  }

  private withSla<T extends { slaEvaluatedCount: number; slaCompliantCount: number }>(
    row: T,
  ): T & { slaPercentage: number | null } {
    return {
      ...row,
      slaPercentage:
        row.slaEvaluatedCount > 0
          ? Math.round((row.slaCompliantCount / row.slaEvaluatedCount) * 100)
          : null,
    };
  }

  private sumTotals(tickets: {
    timeSpentMinutes: number;
    slaCompliant: boolean | null;
  }[]): Totals {
    let timeSpentMinutes = 0;
    let slaEvaluatedCount = 0;
    let slaCompliantCount = 0;

    for (const ticket of tickets) {
      timeSpentMinutes += ticket.timeSpentMinutes;
      if (ticket.slaCompliant !== null) {
        slaEvaluatedCount += 1;
        if (ticket.slaCompliant) slaCompliantCount += 1;
      }
    }

    return {
      ticketCount: tickets.length,
      timeSpentMinutes,
      slaEvaluatedCount,
      slaCompliantCount,
    };
  }
}
