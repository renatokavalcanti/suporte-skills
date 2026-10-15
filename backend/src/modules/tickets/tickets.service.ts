import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  Paginated,
  buildMeta,
  paginationArgs,
} from '../../shared/common/pagination';
import { buildOrderBy } from '../../shared/common/sorting';
import { QueryTicketsDto } from './dto/query-tickets.dto';

const TICKET_SELECT = {
  id: true,
  zohoTicketId: true,
  ticketNumber: true,
  title: true,
  status: true,
  statusType: true,
  priority: true,
  category: true,
  assigneeName: true,
  assigneeId: true,
  contactId: true,
  departmentId: true,
  accountId: true,
  accountName: true,
  technologyName: true,
  openDate: true,
  closeDate: true,
  timeSpentMinutes: true,
  slaCompliant: true,
  isBillable: true,
  zohoModifiedAt: true,
  lastSyncedAt: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true } },
} satisfies Prisma.TicketSelect;

type TicketRow = Prisma.TicketGetPayload<{ select: typeof TICKET_SELECT }>;

/** Campos do lancamento de tempo exibidos no resumo do chamado (D-035). */
const TIME_ENTRY_SELECT = {
  id: true,
  ownerName: true,
  executedAt: true,
  minutes: true,
  description: true,
  isBillable: true,
} satisfies Prisma.TimeEntrySelect;

/** Detalhe do chamado: dados do chamado + lancamentos de tempo (D-035). */
const TICKET_DETAIL_SELECT = {
  ...TICKET_SELECT,
  timeEntries: {
    orderBy: { executedAt: 'asc' as const },
    select: TIME_ENTRY_SELECT,
  },
} satisfies Prisma.TicketSelect;

type TicketDetailRow = Prisma.TicketGetPayload<{
  select: typeof TICKET_DETAIL_SELECT;
}>;

const SORTABLE = [
  'closeDate',
  'openDate',
  'createdAt',
  'timeSpentMinutes',
  'title',
] as const;

@Injectable()
export class TicketsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: QueryTicketsDto): Promise<Paginated<TicketRow>> {
    const where: Prisma.TicketWhereInput = {};
    if (query.clientId) where.clientId = query.clientId;
    if (query.status) where.status = query.status;
    if (typeof query.billable === 'boolean') where.isBillable = query.billable;
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { ticketNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Periodo pela data de referencia da medicao (close_date), inclusivo.
    const closeDate: Prisma.DateTimeNullableFilter = {};
    if (query.from) closeDate.gte = this.startOfDay(query.from);
    if (query.to) closeDate.lte = this.endOfDay(query.to);
    if (closeDate.gte || closeDate.lte) where.closeDate = closeDate;

    const orderBy = buildOrderBy(
      query.sort,
      SORTABLE,
      'closeDate',
      query.order ?? 'desc',
    );
    const { skip, take } = paginationArgs(query);

    const [total, data] = await this.prisma.$transaction([
      this.prisma.ticket.count({ where }),
      this.prisma.ticket.findMany({
        where,
        orderBy,
        skip,
        take,
        select: TICKET_SELECT,
      }),
    ]);

    return { data, meta: buildMeta(total, query) };
  }

  async getById(id: string): Promise<TicketDetailRow> {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      select: TICKET_DETAIL_SELECT,
    });
    if (!ticket) throw new NotFoundException('Chamado nao encontrado');
    return ticket;
  }

  /** Limite inferior inclusivo do dia (UTC). */
  private startOfDay(date: string): Date {
    return new Date(`${date}T00:00:00.000Z`);
  }

  /** Limite superior inclusivo do dia (UTC). */
  private endOfDay(date: string): Date {
    return new Date(`${date}T23:59:59.999Z`);
  }
}
