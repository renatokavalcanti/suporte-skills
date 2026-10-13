import {
  BadRequestException,
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
import { mapZohoTimeEntry, mapZohoTicket } from './zoho/ticket-mapper';
import {
  ZohoClientService,
  ZohoTimeEntryPayload,
  ZohoTicketPayload,
} from './zoho/zoho-client.service';
import { ZohoCredentialsService } from './zoho/zoho-credentials.service';
import { ZohoSettingsService } from './zoho/zoho-settings.service';

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

export interface ZohoSyncLogEntry {
  at: string;
  status: 'OK' | 'ERROR';
  fetched: number;
  created: number;
  updated: number;
  unmapped: number;
  errors: number;
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
  /** Ultimas execucoes (mais recente primeiro), visiveis em Configuracoes. */
  history?: ZohoSyncLogEntry[];
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

/** Agrupamento da fila de nao mapeados por conta do Zoho (D-031). */
export interface UnmappedGroup {
  accountId: string | null;
  accountName: string | null;
  count: number;
}

/** Resultado do vinculo em lote (D-031). */
export interface BulkLinkResult {
  requested: number;
  linked: number;
  created: number;
  updated: number;
  notFound: number;
}

interface LinkRowResult {
  id: string;
  zohoTicketId: string;
  clientId: string;
  created: boolean;
}

/** Resumo da reimportacao (backfill) dos lancamentos de tempo (D-032). */
export interface RefreshTimeEntriesResult {
  tickets: number;
  entries: number;
  errors: number;
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
  /** Cache de nome de agente (ownerId -> nome) por execucao (D-032). */
  private readonly agentNameCache = new Map<string, string | null>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly credentials: ZohoCredentialsService,
    private readonly client: ZohoClientService,
    private readonly settings: ZohoSettingsService,
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

  async logging(): Promise<ZohoSyncLogEntry[]> {
    return (await this.loadState()).history ?? [];
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
    const accountNames = new Map<string, string | null>();
    this.agentNameCache.clear();
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
            const result = await this.processTicket(payload, accountNames);
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

    const logEntry: ZohoSyncLogEntry = {
      at: summary.finishedAt,
      status: summary.status,
      fetched: summary.fetched,
      created: summary.created,
      updated: summary.updated,
      unmapped: summary.unmapped,
      errors: summary.errors.length,
    };
    const history = [logEntry, ...(previous.history ?? [])].slice(0, 20);

    await this.saveState({
      lastRunAt: summary.finishedAt,
      status: summary.status,
      fetched: summary.fetched,
      created: summary.created,
      updated: summary.updated,
      unmapped: summary.unmapped,
      errors: summary.errors.length,
      lastModifiedAt: newWatermark,
      history,
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

  /** Agrupa a fila por conta do Zoho (para vinculo em lote — D-031). */
  async listUnmappedGroups(): Promise<UnmappedGroup[]> {
    const rows = await this.prisma.unmappedTicket.findMany({
      select: { accountId: true, accountName: true },
    });
    const groups = new Map<string, UnmappedGroup>();
    for (const row of rows) {
      const key = row.accountId ?? '';
      const current = groups.get(key);
      if (current) {
        current.count += 1;
        if (!current.accountName && row.accountName) {
          current.accountName = row.accountName;
        }
      } else {
        groups.set(key, {
          accountId: row.accountId,
          accountName: row.accountName,
          count: 1,
        });
      }
    }
    return [...groups.values()].sort((a, b) => b.count - a.count);
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
    await this.assertClient(clientId);

    const linked = await this.linkRow(row, clientId);

    await this.audit.record({
      actorId: actor.id,
      entity: 'unmapped_tickets',
      entityId: id,
      action: 'UPDATE',
      before: { accountId: row.accountId },
      after: {
        ticketAction: linked.created ? 'created' : 'updated',
        id: linked.id,
        zohoTicketId: linked.zohoTicketId,
        clientId: linked.clientId,
      },
    });

    return {
      id: linked.id,
      zohoTicketId: linked.zohoTicketId,
      clientId: linked.clientId,
    };
  }

  /**
   * Vincula em lote os chamados da fila a um cliente (D-031): todos de uma conta
   * (`accountId`) ou as linhas selecionadas (`ids`). Reaproveita o mesmo
   * `linkRow` do vinculo individual (idempotente por `zohoTicketId`).
   */
  async linkUnmappedBulk(
    input: { clientId: string; ids?: string[]; accountId?: string },
    actor: AuthenticatedUser,
  ): Promise<BulkLinkResult> {
    await this.assertClient(input.clientId);

    const accountId = text(input.accountId);
    const ids = (input.ids ?? []).filter(
      (id) => typeof id === 'string' && id.trim() !== '',
    );
    if (!accountId && ids.length === 0) {
      throw new BadRequestException(
        'Informe `ids` ou `accountId` para vincular em lote',
      );
    }

    const rows = accountId
      ? await this.prisma.unmappedTicket.findMany({ where: { accountId } })
      : await this.prisma.unmappedTicket.findMany({
          where: { id: { in: ids } },
        });

    const result: BulkLinkResult = {
      requested: accountId ? rows.length : ids.length,
      linked: 0,
      created: 0,
      updated: 0,
      notFound: 0,
    };
    if (!accountId) result.notFound = ids.length - rows.length;

    for (const row of rows) {
      const linked = await this.linkRow(row, input.clientId);
      result.linked += 1;
      if (linked.created) result.created += 1;
      else result.updated += 1;
    }

    await this.audit.record({
      actorId: actor.id,
      entity: 'unmapped_tickets',
      entityId: accountId ? `account:${accountId}` : `ids:${ids.length}`,
      action: 'UPDATE',
      after: { action: 'bulk_link', clientId: input.clientId, ...result },
    });

    return result;
  }

  private async assertClient(clientId: string): Promise<void> {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });
    if (!client) throw new NotFoundException('Cliente nao encontrado');
  }

  /** Mapeia a linha da fila, cria/atualiza o Ticket e remove da fila. */
  private async linkRow(
    row: { id: string; raw: unknown },
    clientId: string,
  ): Promise<LinkRowResult> {
    const mapped = mapZohoTicket(
      row.raw as unknown as ZohoTicketPayload,
      this.technologyField(),
    );
    const existing = await this.prisma.ticket.findUnique({
      where: { zohoTicketId: mapped.zohoTicketId },
      select: { id: true },
    });

    const ticket = await this.prisma.ticket.upsert({
      where: { zohoTicketId: mapped.zohoTicketId },
      create: { ...mapped, clientId, lastSyncedAt: new Date() },
      update: { ...mapped, clientId, lastSyncedAt: new Date() },
      select: { id: true, zohoTicketId: true, clientId: true },
    });

    await this.prisma.unmappedTicket.delete({ where: { id: row.id } });

    // Espelha os lancamentos de tempo do chamado recem-vinculado (D-032): o
    // caminho da fila nao passa pelo sync, entao precisa buscar aqui.
    await this.afterTicketWrite(ticket.id, mapped.zohoTicketId);

    return { ...ticket, created: !existing };
  }

  /**
   * Reimporta os lancamentos de tempo de **todos** os chamados ja espelhados
   * (D-032). Serve de *backfill* apos a correcao do endpoint (`/timeEntry`) e
   * para chamados vinculados pela fila. Limite por execucao =
   * `ZOHO_MAX_TICKETS_PER_RUN`.
   */
  async refreshTimeEntries(
    actor: AuthenticatedUser,
  ): Promise<RefreshTimeEntriesResult> {
    if (!this.credentials.isConfigured()) {
      throw new ServiceUnavailableException('Sincronizacao com o Zoho desativada');
    }

    const tickets = await this.prisma.ticket.findMany({
      orderBy: { lastSyncedAt: 'desc' },
      take: this.credentials.maxTicketsPerRun(),
      select: { id: true, zohoTicketId: true },
    });

    this.agentNameCache.clear();
    const result: RefreshTimeEntriesResult = { tickets: 0, entries: 0, errors: 0 };

    for (const ticket of tickets) {
      const imported = await this.afterTicketWrite(ticket.id, ticket.zohoTicketId);
      if (imported === null) result.errors += 1;
      else {
        result.tickets += 1;
        result.entries += imported;
      }
    }

    await this.audit.record({
      actorId: actor.id,
      entity: 'tickets',
      entityId: 'time_entries',
      action: 'UPDATE',
      after: { action: 'refresh_time_entries', ...result },
    });

    return result;
  }

  private async processTicket(
    payload: ZohoTicketPayload,
    accountNames: Map<string, string | null>,
  ): Promise<ProcessResult> {
    const mapped = mapZohoTicket(payload, this.technologyField());
    const accountId = text(payload.accountId);
    let accountName = text(payload.accountName);
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
        // Limpa eventual linha obsoleta da fila (D-031).
        await this.prisma.unmappedTicket.deleteMany({
          where: { zohoTicketId: mapped.zohoTicketId },
        });
        await this.afterTicketWrite(alreadyMapped.id, mapped.zohoTicketId);
        return { kind: 'updated', modifiedAt: mapped.zohoModifiedAt };
      }

      // A listagem do Zoho nao traz o nome da conta; resolve sob demanda uma
      // vez por conta (D-031) para a fila nao exibir apenas o id.
      if (!accountName && accountId) {
        accountName = await this.resolveAccountName(accountId, accountNames);
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

    const ticket = await this.prisma.ticket.upsert({
      where: { zohoTicketId: mapped.zohoTicketId },
      create: { ...mapped, clientId: client.id, lastSyncedAt: new Date() },
      update: { ...mapped, clientId: client.id, lastSyncedAt: new Date() },
      select: { id: true },
    });

    // O cliente passou a existir: remove a linha da fila de nao mapeados e
    // mantem o espelho (D-031).
    await this.prisma.unmappedTicket.deleteMany({
      where: { zohoTicketId: mapped.zohoTicketId },
    });

    await this.afterTicketWrite(ticket.id, mapped.zohoTicketId);

    return {
      kind: existing ? 'updated' : 'created',
      modifiedAt: mapped.zohoModifiedAt,
    };
  }

  private technologyField(): string | null {
    return this.settings.getResolved().technologyField;
  }

  /** Resolve (e memoriza por execucao) o nome da conta no Zoho. */
  private async resolveAccountName(
    accountId: string,
    cache: Map<string, string | null>,
  ): Promise<string | null> {
    if (cache.has(accountId)) return cache.get(accountId) ?? null;
    const name = await this.client.getAccountName(accountId);
    cache.set(accountId, name);
    return name;
  }

  /**
   * Espelha os lancamentos de tempo do chamado e recalcula `timeSpentMinutes`
   * como a **soma** dos lancamentos (D-030/D-032). Devolve a quantidade de
   * lancamentos importados, ou `null` quando a busca falha (mantem o tempo atual
   * — nao zera nem derruba a sincronizacao do chamado).
   */
  private async afterTicketWrite(
    ticketId: string,
    zohoTicketId: string,
  ): Promise<number | null> {
    let entries: ZohoTimeEntryPayload[];
    try {
      entries = await this.client.listTimeEntries(zohoTicketId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Falha ao buscar lancamentos do chamado ${zohoTicketId}: ${message}`,
      );
      return null;
    }

    const seen: string[] = [];
    let total = 0;

    for (const raw of entries) {
      const entry = mapZohoTimeEntry(raw, ticketId);
      if (!entry) continue;
      if (!entry.ownerName && entry.ownerId) {
        entry.ownerName = await this.resolveAgentName(entry.ownerId);
      }
      seen.push(entry.zohoTimeEntryId);
      total += entry.minutes;
      await this.prisma.timeEntry.upsert({
        where: { zohoTimeEntryId: entry.zohoTimeEntryId },
        create: entry,
        update: {
          ticketId: entry.ticketId,
          ownerId: entry.ownerId,
          ownerName: entry.ownerName,
          executedAt: entry.executedAt,
          minutes: entry.minutes,
          description: entry.description,
          isBillable: entry.isBillable,
        },
      });
    }

    await this.prisma.timeEntry.deleteMany({
      where: { ticketId, zohoTimeEntryId: { notIn: seen } },
    });

    await this.prisma.ticket.update({
      where: { id: ticketId },
      data: { timeSpentMinutes: total },
    });

    return seen.length;
  }

  /** Resolve (e memoriza por execucao) o nome do agente no Zoho (D-032). */
  private async resolveAgentName(agentId: string): Promise<string | null> {
    if (this.agentNameCache.has(agentId)) {
      return this.agentNameCache.get(agentId) ?? null;
    }
    const name = await this.client.getAgentName(agentId);
    this.agentNameCache.set(agentId, name);
    return name;
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
