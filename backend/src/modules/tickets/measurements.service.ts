import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../shared/audit/audit.service';
import { AuthenticatedUser } from '../../shared/common/authenticated-user.interface';
import { zonedMonthRange } from '../../shared/common/business-time';
import {
  Paginated,
  buildMeta,
  paginationArgs,
} from '../../shared/common/pagination';
import { ReportResult, toCsv } from '../../shared/reporting/csv';
import { PdfRow, buildPdf } from '../../shared/reporting/pdf';
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

  /** Exporta a medicao FECHADA em CSV (mesmo formato dos Relatorios). */
  async exportCsv(id: string): Promise<{ filename: string; body: string }> {
    const { measurement, code } = await this.loadForExport(id);
    const period = `${String(measurement.month).padStart(2, '0')}/${measurement.year}`;

    const summary: Record<string, number> = {
      chamados: measurement.ticketCount,
      minutos: measurement.timeSpentMinutes,
    };
    if (measurement.slaEvaluatedCount > 0) {
      summary['sla_percentual'] = this.slaPercent(measurement);
    }

    const report: ReportResult = {
      key: 'medicao-mensal',
      title: `Medição Mensal — ${measurement.client.name} (${period})`,
      columns: [
        { key: 'client', label: 'Cliente' },
        { key: 'period', label: 'Período' },
        { key: 'number', label: 'Nº' },
        { key: 'title', label: 'Chamado' },
        { key: 'status', label: 'Status' },
        { key: 'closeDate', label: 'Encerrado em' },
        { key: 'minutes', label: 'Minutos' },
        { key: 'sla', label: 'SLA' },
      ],
      rows: measurement.items.map((item) => ({
        client: measurement.client.name,
        period,
        number: item.ticketNumber ?? item.zohoTicketId,
        title: item.title,
        status: item.status,
        closeDate: this.formatDate(item.closeDate),
        minutes: item.timeSpentMinutes,
        sla:
          item.slaCompliant === null
            ? '-'
            : item.slaCompliant
              ? 'Conforme'
              : 'Violado',
      })),
      summary,
      generatedAt: new Date().toISOString(),
    };

    void code;
    return { filename: this.filename(measurement, 'csv'), body: toCsv(report) };
  }

  /** Exporta a medicao FECHADA em PDF (comprovante com codigo de verificacao). */
  async exportPdf(id: string): Promise<{ filename: string; body: Buffer }> {
    const { measurement, code } = await this.loadForExport(id);
    return {
      filename: this.filename(measurement, 'pdf'),
      body: buildPdf(this.pdfRows(measurement, code)),
    };
  }

  private async loadForExport(id: string) {
    const measurement = await this.prisma.monthlyMeasurement.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, document: true } },
        closedBy: { select: { name: true } },
        items: { orderBy: [{ closeDate: 'asc' }, { createdAt: 'asc' }] },
      },
    });
    if (!measurement) throw new NotFoundException('Medicao nao encontrada');
    if (measurement.status !== 'CLOSED') {
      throw new BadRequestException(
        'Somente uma medicao fechada pode ser exportada',
      );
    }
    return { measurement, code: this.verificationCode(measurement) };
  }

  private verificationCode(measurement: {
    id: string;
    closedAt: Date | null;
    year: number;
    month: number;
    ticketCount: number;
    timeSpentMinutes: number;
  }): string {
    const payload = [
      measurement.id,
      measurement.closedAt?.toISOString() ?? '',
      `${measurement.year}-${measurement.month}`,
      measurement.ticketCount,
      measurement.timeSpentMinutes,
    ].join('|');
    return createHash('sha256').update(payload).digest('hex').slice(0, 16).toUpperCase();
  }

  private pdfRows(
    measurement: {
      id: string;
      year: number;
      month: number;
      ticketCount: number;
      timeSpentMinutes: number;
      slaEvaluatedCount: number;
      slaCompliantCount: number;
      closedAt: Date | null;
      client: { name: string; document: string | null };
      closedBy: { name: string } | null;
      items: {
        zohoTicketId: string;
        ticketNumber: string | null;
        title: string;
        status: string;
        closeDate: Date | null;
        timeSpentMinutes: number;
        slaCompliant: boolean | null;
      }[];
    },
    code: string,
  ): PdfRow[] {
    const col = { num: 40, title: 95, status: 335, close: 405, min: 485, sla: 520 };
    const period = `${String(measurement.month).padStart(2, '0')}/${measurement.year}`;
    const slaPct =
      measurement.slaEvaluatedCount > 0
        ? `${this.slaPercent(measurement)}%`
        : '—';

    const rows: PdfRow[] = [
      [{ x: 40, text: `Medição Mensal — ${measurement.client.name}`, bold: true, size: 14 }],
      [{ x: 40, text: `CNPJ/NIF: ${measurement.client.document ?? '—'}`, size: 10 }],
      [{ x: 40, text: `Período: ${period}`, size: 10 }],
      [
        {
          x: 40,
          text: `Chamados: ${measurement.ticketCount}    Minutos: ${measurement.timeSpentMinutes}    SLA: ${slaPct}`,
          size: 10,
        },
      ],
      [{ x: 40, text: `Medição: ${measurement.id}`, size: 9 }],
      [
        {
          x: 40,
          text: `Fechada em: ${this.formatDateTime(measurement.closedAt)} por ${measurement.closedBy?.name ?? '—'}`,
          size: 9,
        },
      ],
      [],
      [
        { x: col.num, text: 'Nº', bold: true },
        { x: col.title, text: 'Chamado', bold: true },
        { x: col.status, text: 'Status', bold: true },
        { x: col.close, text: 'Encerrado', bold: true },
        { x: col.min, text: 'Min', bold: true },
        { x: col.sla, text: 'SLA', bold: true },
      ],
      [{ x: 40, text: '-'.repeat(84) }],
    ];

    for (const item of measurement.items) {
      rows.push([
        { x: col.num, text: item.ticketNumber ?? item.zohoTicketId, size: 9 },
        { x: col.title, text: this.truncate(item.title, 40), size: 9 },
        { x: col.status, text: item.status, size: 9 },
        { x: col.close, text: this.formatDate(item.closeDate), size: 9 },
        { x: col.min, text: String(item.timeSpentMinutes), size: 9 },
        {
          x: col.sla,
          text:
            item.slaCompliant === null
              ? '—'
              : item.slaCompliant
                ? 'Conforme'
                : 'Violado',
          size: 9,
        },
      ]);
    }

    rows.push(
      [],
      [{ x: 40, text: `Código de verificação: ${code}`, bold: true, size: 9 }],
      [{ x: 40, text: `Gerado em ${this.formatDateTime(new Date())} — Suporte Skills`, size: 8 }],
    );

    return rows;
  }

  private filename(
    measurement: { year: number; month: number; client: { name: string } },
    ext: string,
  ): string {
    const slug = measurement.client.name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
    const month = String(measurement.month).padStart(2, '0');
    return `medicao-${slug || 'cliente'}-${measurement.year}-${month}.${ext}`;
  }

  private slaPercent(measurement: {
    slaEvaluatedCount: number;
    slaCompliantCount: number;
  }): number {
    return Math.round(
      (measurement.slaCompliantCount / measurement.slaEvaluatedCount) * 100,
    );
  }

  private formatDate(value: Date | string | null): string {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: this.timezone(),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  private formatDateTime(value: Date | string | null): string {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: this.timezone(),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  private truncate(value: string, max: number): string {
    return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
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
