import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AuditService } from '../../../shared/audit/audit.service';
import { AuthenticatedUser } from '../../../shared/common/authenticated-user.interface';
import {
  zonedDateStartUtc,
  zonedDayRange,
  zonedMonthRange,
} from '../../../shared/common/business-time';
import {
  Paginated,
  buildMeta,
  paginationArgs,
} from '../../../shared/common/pagination';
import { buildOrderBy } from '../../../shared/common/sorting';
import { BillingResult, computeBilling, computeCarriedMinutes } from '../billing';
import { GenerateTicketReportDto } from './dto/generate-ticket-report.dto';
import { PreviewTicketReportDto } from './dto/preview-ticket-report.dto';
import { QueryTicketReportsDto } from './dto/query-ticket-reports.dto';

export interface ResolvedPeriod {
  start: Date;
  end: Date;
  year?: number;
  month?: number;
  from?: string;
  to?: string;
}

export interface TechnologyMetric {
  name: string;
  tickets: number;
  minutes: number;
  hoursLabel: string;
}

export interface TicketAlert {
  type: 'NO_HOURS' | 'NO_TECHNOLOGY' | 'NO_CONTRACT';
  message: string;
  ticketId?: string;
  clientId?: string;
}

export interface TicketReportPreview {
  client: { id: string; name: string } | null;
  period: ResolvedPeriod & { startIso: string; endIso: string };
  timezone: string;
  metrics: {
    closedCount: number;
    openedCount: number;
    openAtEndCount: number;
    totalMinutes: number;
    hoursLabel: string;
    averageResolutionMinutes: number | null;
    averageResolutionLabel: string | null;
    technologies: TechnologyMetric[];
  };
  billing: BillingResult | null;
  alerts: TicketAlert[];
}

const REPORT_SELECT = {
  id: true,
  clientId: true,
  type: true,
  periodStart: true,
  periodEnd: true,
  billingStatus: true,
  fileName: true,
  generatedAt: true,
  sentAt: true,
  sentTo: true,
  createdAt: true,
  client: { select: { id: true, name: true } },
  generatedBy: { select: { id: true, name: true } },
} satisfies Prisma.GeneratedReportSelect;

type ReportRow = Prisma.GeneratedReportGetPayload<{ select: typeof REPORT_SELECT }>;

const SORTABLE = ['generatedAt', 'periodStart', 'createdAt'] as const;

export function minutesToLabel(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Relatorios de Chamados (D-030). Calcula as metricas da secao B2 (fechados por
 * `closeDate`, abertos ao fim do periodo, horas por lancamento/`executedTime`,
 * horas e chamados por tecnologia, tempo medio de solucao) e a regra de
 * faturamento B3 (`computeBilling`). Tambem registra os relatorios gerados
 * (`generated_reports`) para auditoria.
 */
@Injectable()
export class TicketReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  private timezone(): string {
    return this.config.get<string>('business.timezone') ?? 'America/Sao_Paulo';
  }

  /** Resolve o periodo: por mes/ano OU por intervalo (from/to). */
  resolvePeriod(dto: PreviewTicketReportDto | GenerateTicketReportDto): ResolvedPeriod {
    const tz = this.timezone();
    if (dto.year && dto.month) {
      const { start, end } = zonedMonthRange(dto.year, dto.month, tz);
      return { start, end, year: dto.year, month: dto.month };
    }
    if (dto.from && dto.to) {
      if (dto.from > dto.to) {
        throw new BadRequestException('from deve ser anterior a to');
      }
      const { start, end } = zonedDayRange(dto.from, dto.to, tz);
      return { start, end, from: dto.from, to: dto.to };
    }
    throw new BadRequestException(
      'Informe o periodo: year+month ou from+to (YYYY-MM-DD)',
    );
  }

  async preview(dto: PreviewTicketReportDto): Promise<TicketReportPreview> {
    const period = this.resolvePeriod(dto);
    const tz = this.timezone();
    const clientFilter = dto.clientId ? { clientId: dto.clientId } : {};

    const client = dto.clientId
      ? await this.prisma.client.findUnique({
          where: { id: dto.clientId },
          select: { id: true, name: true },
        })
      : null;
    if (dto.clientId && !client) {
      throw new NotFoundException('Cliente nao encontrado');
    }

    const [closedTickets, openedCount, openAtEndCount, entries] =
      await Promise.all([
        this.prisma.ticket.findMany({
          where: {
            ...clientFilter,
            closeDate: { gte: period.start, lt: period.end },
          },
          select: {
            id: true,
            openDate: true,
            closeDate: true,
            technologyName: true,
            timeSpentMinutes: true,
          },
        }),
        this.prisma.ticket.count({
          where: {
            ...clientFilter,
            openDate: { gte: period.start, lt: period.end },
          },
        }),
        this.prisma.ticket.count({
          where: {
            ...clientFilter,
            closeDate: null,
            openDate: { lt: period.end },
          },
        }),
        this.prisma.timeEntry.findMany({
          where: {
            executedAt: { gte: period.start, lt: period.end },
            ticket: dto.clientId ? { clientId: dto.clientId } : undefined,
          },
          select: {
            minutes: true,
            ticket: { select: { id: true, technologyName: true } },
          },
        }),
      ]);

    // Horas totais e por tecnologia (soma dos lancamentos no periodo).
    let totalMinutes = 0;
    const byTech = new Map<string, { tickets: Set<string>; minutes: number }>();
    for (const entry of entries) {
      totalMinutes += entry.minutes;
      const name = entry.ticket.technologyName ?? '(sem tecnologia)';
      const bucket = byTech.get(name) ?? { tickets: new Set<string>(), minutes: 0 };
      bucket.tickets.add(entry.ticket.id);
      bucket.minutes += entry.minutes;
      byTech.set(name, bucket);
    }

    const technologies: TechnologyMetric[] = [...byTech.entries()]
      .map(([name, bucket]) => ({
        name,
        tickets: bucket.tickets.size,
        minutes: bucket.minutes,
        hoursLabel: minutesToLabel(bucket.minutes),
      }))
      .sort((a, b) => b.minutes - a.minutes);

    // Tempo medio de solucao (closeDate - openDate) dos chamados fechados.
    let averageResolutionMinutes: number | null = null;
    const resolutions = closedTickets
      .filter((t): t is typeof t & { closeDate: Date } => t.closeDate !== null)
      .map((t) => (t.closeDate.getTime() - t.openDate.getTime()) / 60000);
    if (resolutions.length > 0) {
      averageResolutionMinutes = Math.round(
        resolutions.reduce((sum, value) => sum + value, 0) / resolutions.length,
      );
    }

    // Faturamento (B3) quando ha cliente e contrato cobrindo o periodo.
    let billing: BillingResult | null = null;
    if (dto.clientId) {
      billing = await this.billingFor(dto.clientId, period, totalMinutes);
    }

    const alerts = this.buildAlerts(
      closedTickets,
      Boolean(dto.clientId) && billing === null,
      dto.clientId,
    );

    return {
      client,
      period: {
        ...period,
        startIso: period.start.toISOString(),
        endIso: period.end.toISOString(),
      },
      timezone: tz,
      metrics: {
        closedCount: closedTickets.length,
        openedCount,
        openAtEndCount,
        totalMinutes,
        hoursLabel: minutesToLabel(totalMinutes),
        averageResolutionMinutes,
        averageResolutionLabel:
          averageResolutionMinutes === null
            ? null
            : minutesToLabel(averageResolutionMinutes),
        technologies,
      },
      billing,
      alerts,
    };
  }

  async generate(
    dto: GenerateTicketReportDto,
    actor: AuthenticatedUser,
  ): Promise<{ report: ReportRow; preview: TicketReportPreview }> {
    const period = this.resolvePeriod(dto);
    const preview = await this.preview(dto);

    const report = await this.prisma.generatedReport.create({
      data: {
        clientId: dto.clientId,
        type: dto.type,
        periodStart: period.start,
        periodEnd: this.inclusiveEndDay(period),
        billingStatus: preview.billing?.status ?? null,
        generatedById: actor.id,
      },
      select: REPORT_SELECT,
    });

    await this.audit.record({
      actorId: actor.id,
      entity: 'generated_reports',
      entityId: report.id,
      action: 'CREATE',
      after: {
        clientId: report.clientId,
        type: report.type,
        periodStart: report.periodStart,
        periodEnd: report.periodEnd,
        billingStatus: report.billingStatus,
      },
    });

    return { report, preview };
  }

  async list(query: QueryTicketReportsDto): Promise<Paginated<ReportRow>> {
    const where: Prisma.GeneratedReportWhereInput = {};
    if (query.clientId) where.clientId = query.clientId;
    if (query.type) where.type = query.type;
    const periodStart: Prisma.DateTimeFilter = {};
    if (query.from) periodStart.gte = new Date(`${query.from}T00:00:00.000Z`);
    if (query.to) periodStart.lte = new Date(`${query.to}T23:59:59.999Z`);
    if (periodStart.gte || periodStart.lte) where.periodStart = periodStart;

    const orderBy = buildOrderBy(
      query.sort,
      SORTABLE,
      'generatedAt',
      query.order ?? 'desc',
    );
    const { skip, take } = paginationArgs(query);

    const [total, data] = await this.prisma.$transaction([
      this.prisma.generatedReport.count({ where }),
      this.prisma.generatedReport.findMany({
        where,
        orderBy,
        skip,
        take,
        select: REPORT_SELECT,
      }),
    ]);

    return { data, meta: buildMeta(total, query) };
  }

  async getById(id: string): Promise<ReportRow> {
    const report = await this.prisma.generatedReport.findUnique({
      where: { id },
      select: REPORT_SELECT,
    });
    if (!report) throw new NotFoundException('Relatorio nao encontrado');
    return report;
  }

  private async billingFor(
    clientId: string,
    period: ResolvedPeriod,
    consumedMinutes: number,
  ): Promise<BillingResult | null> {
    const contract = await this.prisma.contract.findFirst({
      where: {
        clientId,
        active: true,
        startDate: { lte: period.end },
        OR: [{ endDate: null }, { endDate: { gte: period.start } }],
      },
      orderBy: { startDate: 'desc' },
    });
    if (!contract) return null;

    let carriedMinutes = 0;
    if (contract.balancePolicy === 'ACCUMULATE') {
      carriedMinutes = await this.carriedMinutesFor(
        clientId,
        contract.includedMinutes,
        period.start,
      );
    }

    return computeBilling({
      includedMinutes: contract.includedMinutes,
      monthlyValue: Number(contract.monthlyValue),
      extraHourValue: Number(contract.extraHourValue),
      balancePolicy: contract.balancePolicy,
      consumedMinutes,
      carriedMinutes,
    });
  }

  /** Saldo (minutos) dos meses anteriores a `start`, agrupado no fuso. */
  private async carriedMinutesFor(
    clientId: string,
    includedMinutes: number,
    start: Date,
  ): Promise<number> {
    const entries = await this.prisma.timeEntry.findMany({
      where: { executedAt: { lt: start }, ticket: { clientId } },
      select: { executedAt: true, minutes: true },
    });
    const byMonth = new Map<string, number>();
    for (const entry of entries) {
      const key = this.monthKey(entry.executedAt);
      byMonth.set(key, (byMonth.get(key) ?? 0) + entry.minutes);
    }
    const consumptions = [...byMonth.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([, value]) => value);
    return computeCarriedMinutes(
      'ACCUMULATE',
      includedMinutes,
      consumptions,
    );
  }

  /** Ultimo dia do periodo (00:00 no fuso), para exibicao estavel da data. */
  private inclusiveEndDay(period: ResolvedPeriod): Date {
    const lastInstant = new Date(period.end.getTime() - 1);
    const dayStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timezone(),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(lastInstant);
    return zonedDateStartUtc(dayStr, this.timezone());
  }

  private monthKey(date: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: this.timezone(),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(date)
      .slice(0, 7);
  }

  private buildAlerts(
    closedTickets: {
      id: string;
      technologyName: string | null;
      timeSpentMinutes: number;
    }[],
    missingContract: boolean,
    clientId?: string,
  ): TicketAlert[] {
    const alerts: TicketAlert[] = [];
    for (const ticket of closedTickets) {
      if (ticket.timeSpentMinutes === 0) {
        alerts.push({
          type: 'NO_HOURS',
          message: 'Chamado fechado no periodo sem horas lancadas',
          ticketId: ticket.id,
        });
      }
      if (ticket.technologyName === null) {
        alerts.push({
          type: 'NO_TECHNOLOGY',
          message: 'Chamado fechado no periodo sem tecnologia definida',
          ticketId: ticket.id,
        });
      }
    }
    if (missingContract) {
      alerts.push({
        type: 'NO_CONTRACT',
        message: 'Cliente sem contrato ativo para o periodo',
        clientId,
      });
    }
    return alerts;
  }
}
