import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../shared/audit/audit.service';
import { AuthenticatedUser } from '../../shared/common/authenticated-user.interface';
import {
  Paginated,
  PaginationQuery,
  buildMeta,
  paginationArgs,
} from '../../shared/common/pagination';
import { mapZohoTicket } from './zoho/ticket-mapper';
import { ZohoClientService, ZohoTicketPayload } from './zoho/zoho-client.service';
import { ZohoCredentialsService } from './zoho/zoho-credentials.service';

const SYNC_STATE_KEY = 'zoho_sync';
const PAGE_SIZE = 100;

export interface ZohoSyncSummary {
  startedAt: string;
  finishedAt: string;
  fetched: number;
  created: number;
  updated: number;
  unmapped: number;
  errors: { ticketId: string; message: string }[];
  status: 'OK' | 'ERROR';
}

interface ZohoSyncState {
  lastRunAt?: string;
  status?: string;
  fetched?: number;
  created?: number;
  updated?: number;
  unmapped?: number;
  errors?: number;
  lastModifiedAt?: string | null;
}

interface ProcessResult {
  kind: 'created' | 'updated' | 'unmapped';
  modifiedAt: Date | null;
}

interface UnmappedListItem {
  id: string;
  zohoTicketId: string;
  accountId: string | null;
  accountName: string | null;
  subject: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Espelhamento (somente leitura) dos chamados do Zoho Desk para o banco local
 * (D-029). Opt-in e idempotente: upsert por `zohoTicketId`. Chamados sem
 * `Client` mapeado vao para a fila `unmapped_tickets` (nao se adivinha o
 * cliente nem se perde o chamado). Cada execucao e' auditada e resumida em
 * `app_settings` (key `zoho_sync`).
 */
@Injectable()
export class ZohoSyncService {
  private readonly logger = new Logger(ZohoSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly credentials: ZohoCredentialsService,
    private readonly client: ZohoClientService,
  ) {}

  async status(): Promise<{
    syncEnabled: boolean;
    configured: boolean;
    lastRun: ZohoSyncState | null;
  }> {
    return {
      syncEnabled: this.credentials.isSyncEnabled(),
      configured: this.credentials.isConfigured(),
      lastRun: await this.loadState(),
    };
  }

  /** Sincroniza todos os chamados modificados desde a ultima execucao. */
  async syncAll(actorId: string | null = null): Promise<ZohoSyncSummary> {
    if (!this.credentials.isConfigured()) {
      throw new ServiceUnavailableException('Sincronizacao com o Zoho desativada');
    }

    const startedAt = new Date();
    const summary: ZohoSyncSummary = {
      startedAt: startedAt.toISOString(),
      finishedAt: '',
      fetched: 0,
      created: 0,
      updated: 0,
      unmapped: 0,
      errors: [],
      status: 'OK',
    };

    const previous = await this.loadState();
    const watermark = previous.lastModifiedAt ?? null;
    let lastModified: Date | null = watermark ? new Date(watermark) : null;

    const maxPerRun = this.credentials.maxTicketsPerRun();
    let from = 0;

    try {
      while (summary.fetched < maxPerRun) {
        const limit = Math.min(PAGE_SIZE, maxPerRun - summary.fetched);
        const batch = await this.client.listTickets({
          modifiedSince: watermark,
          limit,
          from,
        });
        if (batch.length === 0) break;

        for (const payload of batch) {
          summary.fetched += 1;
          try {
            const result = await this.processTicket(payload);
            if (result.kind === 'created') summary.created += 1;
            else if (result.kind === 'updated') summary.updated += 1;
            else summary.unmapped += 1;

            if (result.modifiedAt && (!lastModified || result.modifiedAt > lastModified)) {
              lastModified = result.modifiedAt;
            }
          } catch (error) {
            summary.errors.push({
              ticketId: String(payload.id),
              message: error instanceof Error ? error.message : String(error),
            });
          }
        }

        from += batch.length;
        if (batch.length < limit) break;
      }
    } catch (error) {
      summary.status = 'ERROR';
      const message = error instanceof Error ? error.message : String(error);
      summary.errors.push({ ticketId: '-', message });
      this.logger.error(`Falha na sincronizacao do Zoho: ${message}`);
    }

    summary.finishedAt = new Date().toISOString();
    const newWatermark = lastModified ? lastModified.toISOString() : watermark;

    await this.saveState({
      lastRunAt: summary.finishedAt,
      status: summary.status,
      fetched: summary.fetched,
      created: summary.created,
      updated: summary.updated,
      unmapped: summary.unmapped,
      errors: summary.errors.length,
      lastModifiedAt: newWatermark,
    });

    await this.audit.record({
      actorId,
      entity: 'zoho_sync',
      entityId: SYNC_STATE_KEY,
      action: 'UPDATE',
      after: {
        status: summary.status,
        fetched: summary.fetched,
        created: summary.created,
        updated: summary.updated,
        unmapped: summary.unmapped,
        errors: summary.errors.length,
      },
    });

    this.logger.log(
      `Zoho: ${summary.created} criado(s), ${summary.updated} atualizado(s), ` +
        `${summary.unmapped} nao mapeado(s), ${summary.errors.length} erro(s)`,
    );

    return summary;
  }

  async listUnmapped(
    query: PaginationQuery,
  ): Promise<Paginated<UnmappedListItem>> {
    const { skip, take } = paginationArgs(query);
    const [total, data] = await this.prisma.$transaction([
      this.prisma.unmappedTicket.count(),
      this.prisma.unmappedTicket.findMany({
        orderBy: { lastSeenAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          zohoTicketId: true,
          accountId: true,
          accountName: true,
          subject: true,
          firstSeenAt: true,
          lastSeenAt: true,
        },
      }),
    ]);
    return { data, meta: buildMeta(total, query) };
  }

  /** Vincula manualmente um chamado da fila ao cliente correto. */
  async linkUnmapped(
    id: string,
    clientId: string,
    actor: AuthenticatedUser,
  ): Promise<{ id: string; zohoTicketId: string; clientId: string }> {
    const row = await this.prisma.unmappedTicket.findUnique({ where: { id } });
    if (!row) {
      throw new NotFoundException('Chamado nao mapeado nao encontrado');
    }
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });
    if (!client) throw new NotFoundException('Cliente nao encontrado');

    const mapped = mapZohoTicket(row.raw as unknown as ZohoTicketPayload);
    const existing = await this.prisma.ticket.findUnique({
      where: { zohoTicketId: mapped.zohoTicketId },
      select: { id: true },
    });

    const ticket = await this.prisma.ticket.upsert({
      where: { zohoTicketId: mapped.zohoTicketId },
      create: { ...mapped, clientId: client.id, lastSyncedAt: new Date() },
      update: { ...mapped, clientId: client.id, lastSyncedAt: new Date() },
      select: { id: true, zohoTicketId: true, clientId: true },
    });

    await this.prisma.unmappedTicket.delete({ where: { id } });

    await this.audit.record({
      actorId: actor.id,
      entity: 'unmapped_tickets',
      entityId: id,
      action: 'UPDATE',
      before: { accountId: row.accountId },
      after: { ticketAction: existing ? 'updated' : 'created', ...ticket },
    });

    return ticket;
  }

  private async processTicket(payload: ZohoTicketPayload): Promise<ProcessResult> {
    const mapped = mapZohoTicket(payload);
    const accountId = text(payload.accountId);
    const accountName = text(payload.accountName);
    const subject = text(payload.subject);

    const client = accountId
      ? await this.prisma.client.findUnique({
          where: { zohoAccountId: accountId },
          select: { id: true },
        })
      : null;

    if (!client) {
      // Se o chamado ja foi vinculado manualmente (existe Ticket), nao o
      // devolve para a fila: apenas mantem o espelho atualizado (D-029).
      const alreadyMapped = await this.prisma.ticket.findUnique({
        where: { zohoTicketId: mapped.zohoTicketId },
        select: { id: true },
      });
      if (alreadyMapped) {
        await this.prisma.ticket.update({
          where: { id: alreadyMapped.id },
          data: { ...mapped, lastSyncedAt: new Date() },
        });
        return { kind: 'updated', modifiedAt: mapped.zohoModifiedAt };
      }

      await this.prisma.unmappedTicket.upsert({
        where: { zohoTicketId: mapped.zohoTicketId },
        create: {
          zohoTicketId: mapped.zohoTicketId,
          accountId,
          accountName,
          subject,
          raw: payload as unknown as Prisma.InputJsonValue,
        },
        update: {
          accountId,
          accountName,
          subject,
          raw: payload as unknown as Prisma.InputJsonValue,
          lastSeenAt: new Date(),
        },
      });
      return { kind: 'unmapped', modifiedAt: mapped.zohoModifiedAt };
    }

    const existing = await this.prisma.ticket.findUnique({
      where: { zohoTicketId: mapped.zohoTicketId },
      select: { id: true },
    });

    await this.prisma.ticket.upsert({
      where: { zohoTicketId: mapped.zohoTicketId },
      create: { ...mapped, clientId: client.id, lastSyncedAt: new Date() },
      update: { ...mapped, clientId: client.id, lastSyncedAt: new Date() },
    });

    return {
      kind: existing ? 'updated' : 'created',
      modifiedAt: mapped.zohoModifiedAt,
    };
  }

  private async loadState(): Promise<ZohoSyncState> {
    const row = await this.prisma.appSetting.findUnique({
      where: { key: SYNC_STATE_KEY },
    });
    if (!row || !row.value || typeof row.value !== 'object') return {};
    return row.value as unknown as ZohoSyncState;
  }

  private async saveState(state: ZohoSyncState): Promise<void> {
    await this.prisma.appSetting.upsert({
      where: { key: SYNC_STATE_KEY },
      create: {
        key: SYNC_STATE_KEY,
        value: state as unknown as Prisma.InputJsonValue,
      },
      update: { value: state as unknown as Prisma.InputJsonValue },
    });
  }
}
