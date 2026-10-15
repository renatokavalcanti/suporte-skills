import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AuditService } from '../../shared/audit/audit.service';
import { AuthenticatedUser } from '../../shared/common/authenticated-user.interface';
import { PrismaService } from '../../database/prisma.service';
import { ZohoClientService, ZohoTicketPayload } from './zoho/zoho-client.service';
import { ZohoCredentialsService } from './zoho/zoho-credentials.service';
import { ZohoSettingsService } from './zoho/zoho-settings.service';
import { ZohoSyncService } from './zoho-sync.service';

const actor: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@suporte.local',
  name: 'Admin',
  role: 'ADMIN' as AuthenticatedUser['role'],
  mustChangePassword: false,
};

const noopAudit = { record: async () => undefined } as unknown as AuditService;

interface UnmappedRow {
  id: string;
  accountId?: string | null;
  accountName?: string | null;
  raw?: unknown;
}

interface Calls {
  ticketUpsert: any[];
  ticketUpdate: any[];
  ticketDelete: any[];
  unmappedUpsert: any[];
  unmappedDeleteMany: any[];
  unmappedDelete: any[];
  timeEntryUpsert: any[];
  appSettingUpsert: any[];
}

interface HarnessOptions {
  linkRows?: UnmappedRow[];
  clientById?: (id: string) => { id: string } | null;
  ticketExists?: (zohoTicketId: string) => boolean;
  accountName?: (accountId: string) => string | null;
  tickets?: Array<{ id: string; zohoTicketId: string }>;
  timeEntries?: unknown[];
  agentName?: (agentId: string) => string | null;
  /** Ticket devolvido por `findUnique({ where: { id } })` (D-035). */
  ticketById?: (id: string) => unknown;
  /** Pagina devolvida por `listTickets` (default: o `batch` fixo). */
  listTickets?: (params: { limit: number; from: number }) => ZohoTicketPayload[];
  /** Estado inicial salvo em `app_settings.zoho_sync` (para o cursor, D-034). */
  initialState?: Record<string, unknown>;
}

function harness(
  batch: ZohoTicketPayload[],
  clientFor: (accountId: string) => { id: string } | null,
  options: HarnessOptions = {},
): { service: ZohoSyncService; calls: Calls } {
  const calls: Calls = {
    ticketUpsert: [],
    ticketUpdate: [],
    ticketDelete: [],
    unmappedUpsert: [],
    unmappedDeleteMany: [],
    unmappedDelete: [],
    timeEntryUpsert: [],
    appSettingUpsert: [],
  };
  const prisma = {
    appSetting: {
      findUnique: async (a: any) =>
        a.where.key === 'zoho_sync' && options.initialState
          ? { key: 'zoho_sync', value: options.initialState }
          : null,
      upsert: async (a: any) => {
        calls.appSettingUpsert.push(a);
        return a;
      },
    },
    client: {
      findUnique: async (a: any) => {
        if (a.where.zohoAccountId !== undefined) {
          return clientFor(a.where.zohoAccountId);
        }
        if (a.where.id !== undefined) {
          return (options.clientById ?? ((id: string) => ({ id })))(a.where.id);
        }
        return null;
      },
    },
    ticket: {
      findUnique: async (a: any) => {
        if (a.where.id !== undefined) {
          return (options.ticketById ?? (() => null))(a.where.id);
        }
        return options.ticketExists?.(a.where.zohoTicketId) ? { id: 't1' } : null;
      },
      findMany: async () => options.tickets ?? [],
      upsert: async (a: any) => {
        calls.ticketUpsert.push(a);
        return {
          id: 't1',
          zohoTicketId: a.where.zohoTicketId,
          clientId: a.create?.clientId ?? a.update?.clientId ?? 'c1',
        };
      },
      update: async (a: any) => {
        calls.ticketUpdate.push(a);
        return {
          id: a.where.id,
          zohoTicketId: 'Z-1',
          clientId: a.data?.clientId ?? 'c1',
        };
      },
      delete: async (a: any) => {
        calls.ticketDelete.push(a);
        return { id: a.where.id };
      },
    },
    timeEntry: {
      upsert: async (a: any) => {
        calls.timeEntryUpsert.push(a);
        return {};
      },
      deleteMany: async () => ({ count: 0 }),
    },
    unmappedTicket: {
      upsert: async (a: any) => {
        calls.unmappedUpsert.push(a);
        return a;
      },
      findUnique: async (a: any) =>
        options.linkRows?.find((r) => r.id === a.where.id) ?? null,
      findMany: async (a: any) => {
        const rows = options.linkRows ?? [];
        if (a?.where?.accountId !== undefined) {
          return rows.filter((r) => r.accountId === a.where.accountId);
        }
        if (a?.where?.id?.in) {
          return rows.filter((r) => a.where.id.in.includes(r.id));
        }
        return rows;
      },
      deleteMany: async (a: any) => {
        calls.unmappedDeleteMany.push(a);
        return { count: 1 };
      },
      delete: async (a: any) => {
        calls.unmappedDelete.push(a);
        return {};
      },
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  } as unknown as PrismaService;

  const zoho = {
    listTickets: async (params: { limit: number; from: number }) =>
      options.listTickets ? options.listTickets(params) : batch,
    listTimeEntries: async () => options.timeEntries ?? [],
    getAccountName: async (accountId: string) =>
      options.accountName?.(accountId) ?? null,
    getAgentName: async (agentId: string) => options.agentName?.(agentId) ?? null,
  } as unknown as ZohoClientService;
  const credentials = {
    isConfigured: () => true,
    isSyncEnabled: () => true,
    maxTicketsPerRun: () => 100,
  } as unknown as ZohoCredentialsService;
  const settings = {
    getResolved: () => ({ technologyField: null }),
  } as unknown as ZohoSettingsService;

  return {
    service: new ZohoSyncService(prisma, noopAudit, credentials, zoho, settings),
    calls,
  };
}

test('syncAll: cria o chamado mapeado e enfileira o não mapeado', async () => {
  const batch: ZohoTicketPayload[] = [
    { id: 'Z-1', subject: 'Rede', status: 'Open', accountId: 'acc-1', modifiedTime: '2026-10-02T10:00:00Z' },
    { id: 'Z-2', subject: 'Impressora', status: 'Open', accountId: 'acc-9', modifiedTime: '2026-10-03T10:00:00Z' },
  ];
  const { service, calls } = harness(batch, (accountId) =>
    accountId === 'acc-1' ? { id: 'client-1' } : null,
  );

  const summary = await service.syncAll('admin-1');

  assert.equal(summary.fetched, 2);
  assert.equal(summary.created, 1);
  assert.equal(summary.unmapped, 1);
  assert.equal(summary.updated, 0);
  assert.equal(summary.status, 'OK');
  assert.equal(calls.ticketUpsert[0].create.zohoTicketId, 'Z-1');
  assert.equal(calls.ticketUpsert[0].create.clientId, 'client-1');
  assert.equal(calls.unmappedUpsert[0].create.zohoTicketId, 'Z-2');
  // Lote menor que a pagina => fim do conjunto: o cursor volta ao inicio (D-034).
  const saved = calls.appSettingUpsert[0].create.value as {
    cursorFrom: number;
    cursorComplete: boolean;
  };
  assert.equal(saved.cursorComplete, true);
  assert.equal(saved.cursorFrom, 0);
});

test('syncAll: avança o cursor quando o lote enche a página (D-034)', async () => {
  const page: ZohoTicketPayload[] = Array.from({ length: 100 }, (_, i) => ({
    id: `Z-${i}`,
    subject: 'x',
    status: 'Open',
    accountId: 'acc-9',
  }));
  const froms: number[] = [];
  const { service, calls } = harness([], () => null, {
    initialState: { cursorFrom: 3 },
    listTickets: ({ from }) => {
      froms.push(from);
      return page;
    },
  });

  const summary = await service.syncAll('admin-1');

  assert.equal(summary.fetched, 100); // limitado por maxTicketsPerRun (100 no mock)
  assert.equal(froms[0], 3); // retoma do cursor salvo
  const saved = calls.appSettingUpsert[0].create.value as {
    cursorFrom: number;
    cursorComplete: boolean;
  };
  assert.equal(saved.cursorComplete, false);
  assert.equal(saved.cursorFrom, 103); // 3 + 100: continua na próxima execução
});

test('syncAll: limpa a fila quando o chamado já foi vinculado (D-031)', async () => {
  const batch: ZohoTicketPayload[] = [
    { id: 'Z-1', subject: 'Rede', status: 'Open', accountId: 'acc-1', modifiedTime: '2026-10-02T10:00:00Z' },
  ];
  const { service, calls } = harness(batch, () => ({ id: 'client-1' }));

  await service.syncAll('admin-1');

  assert.equal(calls.unmappedDeleteMany.length, 1);
  assert.equal(calls.unmappedDeleteMany[0].where.zohoTicketId, 'Z-1');
});

test('syncAll: resolve o nome da conta para a fila (D-031)', async () => {
  const batch: ZohoTicketPayload[] = [
    { id: 'Z-9', subject: 'VPN', status: 'Open', accountId: 'acc-9', modifiedTime: '2026-10-03T10:00:00Z' },
  ];
  const { service, calls } = harness(batch, () => null, {
    accountName: (accountId) => (accountId === 'acc-9' ? 'ACME Ltda' : null),
  });

  await service.syncAll('admin-1');

  assert.equal(calls.unmappedUpsert[0].create.accountName, 'ACME Ltda');
});

test('syncAll: 503 quando o Zoho não está configurado', async () => {
  const service = new ZohoSyncService(
    {} as unknown as PrismaService,
    noopAudit,
    { isConfigured: () => false } as unknown as ZohoCredentialsService,
    {} as unknown as ZohoClientService,
    {} as unknown as ZohoSettingsService,
  );

  await assert.rejects(() => service.syncAll(null), ServiceUnavailableException);
});

test('linkUnmapped: 404 quando o chamado não está na fila', async () => {
  const { service } = harness([], () => null);
  await assert.rejects(
    () => service.linkUnmapped('inexistente', 'client-1', actor),
    NotFoundException,
  );
});

test('linkUnmappedBulk: vincula todos os chamados de uma conta (D-031)', async () => {
  const { service, calls } = harness([], () => null, {
    linkRows: [
      { id: 'u1', accountId: 'acc-1', raw: { id: 'Z-1' } },
      { id: 'u2', accountId: 'acc-1', raw: { id: 'Z-2' } },
      { id: 'u3', accountId: 'acc-1', raw: { id: 'Z-3' } },
    ],
    ticketExists: () => false,
  });

  const result = await service.linkUnmappedBulk(
    { clientId: 'client-1', accountId: 'acc-1' },
    actor,
  );

  assert.deepEqual(result, {
    requested: 3,
    linked: 3,
    created: 3,
    updated: 0,
    notFound: 0,
  });
  assert.equal(calls.unmappedDelete.length, 3);
});

test('linkUnmappedBulk: vincula por seleção e conta os não encontrados (D-031)', async () => {
  const { service } = harness([], () => null, {
    linkRows: [{ id: 'u1', accountId: 'acc-1', raw: { id: 'Z-1' } }],
    ticketExists: () => false,
  });

  const result = await service.linkUnmappedBulk(
    { clientId: 'client-1', ids: ['u1', 'u2'] },
    actor,
  );

  assert.equal(result.requested, 2);
  assert.equal(result.linked, 1);
  assert.equal(result.notFound, 1);
});

test('linkUnmappedBulk: 400 sem ids nem accountId (D-031)', async () => {
  const { service } = harness([], () => null);
  await assert.rejects(
    () => service.linkUnmappedBulk({ clientId: 'client-1' }, actor),
    BadRequestException,
  );
});

test('listUnmappedGroups: agrupa por conta e ordena por volume (D-031)', async () => {
  const { service } = harness([], () => null, {
    linkRows: [
      { id: 'u1', accountId: 'acc-1', accountName: 'ACME' },
      { id: 'u2', accountId: 'acc-1', accountName: 'ACME' },
      { id: 'u3', accountId: 'acc-2', accountName: 'Beta' },
    ],
  });

  const groups = await service.listUnmappedGroups();

  assert.deepEqual(groups, [
    { accountId: 'acc-1', accountName: 'ACME', count: 2 },
    { accountId: 'acc-2', accountName: 'Beta', count: 1 },
  ]);
});

test('linkRow: busca os lançamentos ao vincular pela fila (D-032)', async () => {
  const { service, calls } = harness([], () => null, {
    linkRows: [{ id: 'u1', accountId: 'acc-1', raw: { id: 'Z-1' } }],
    ticketExists: () => false,
    timeEntries: [
      { id: 'te1', hoursSpent: '2', minutesSpent: '0', secondsSpent: '0' },
    ],
  });

  await service.linkUnmappedBulk({ clientId: 'client-1', accountId: 'acc-1' }, actor);

  assert.equal(calls.timeEntryUpsert.length, 1);
  assert.equal(calls.ticketUpdate.at(-1)?.data.timeSpentMinutes, 120);
});

test('refreshTimeEntries: reimporta e soma os minutos (D-032)', async () => {
  const { service, calls } = harness([], () => null, {
    tickets: [{ id: 't1', zohoTicketId: 'Z-626' }],
    timeEntries: [
      { id: 'te1', ownerId: 'a1', executedTime: '2026-06-30T13:00:00Z', hoursSpent: '1', minutesSpent: '0', secondsSpent: '0', description: 'FW' },
      { id: 'te2', ownerId: 'a1', executedTime: '2026-07-14T14:00:00Z', hoursSpent: '1', minutesSpent: '30', secondsSpent: '0' },
    ],
    agentName: (id) => (id === 'a1' ? 'José Roberto' : null),
  });

  const result = await service.refreshTimeEntries(actor);

  assert.deepEqual(result, { tickets: 1, entries: 2, errors: 0 });
  assert.equal(calls.timeEntryUpsert.length, 2);
  assert.equal(calls.timeEntryUpsert[0].create.ownerName, 'José Roberto');
  assert.equal(calls.ticketUpdate.at(-1)?.data.timeSpentMinutes, 150);
});

test('refreshTimeEntries: 503 quando o Zoho não está configurado (D-032)', async () => {
  const service = new ZohoSyncService(
    {} as unknown as PrismaService,
    noopAudit,
    { isConfigured: () => false } as unknown as ZohoCredentialsService,
    {} as unknown as ZohoClientService,
    {} as unknown as ZohoSettingsService,
  );

  await assert.rejects(() => service.refreshTimeEntries(actor), ServiceUnavailableException);
});

test('reassignTicket: troca o cliente e limpa a fila (D-035)', async () => {
  const { service, calls } = harness([], () => null, {
    ticketById: (id) =>
      id === 't1' ? { id: 't1', zohoTicketId: 'Z-1', clientId: 'old-client' } : null,
  });

  const result = await service.reassignTicket('t1', 'new-client', actor);

  assert.equal(result.clientId, 'new-client');
  assert.equal(calls.ticketUpdate[0].data.clientId, 'new-client');
  assert.equal(calls.unmappedDeleteMany.length, 1);
  assert.equal(calls.unmappedDeleteMany[0].where.zohoTicketId, 'Z-1');
});

test('reassignTicket: 404 quando o chamado não existe (D-035)', async () => {
  const { service } = harness([], () => null, { ticketById: () => null });
  await assert.rejects(
    () => service.reassignTicket('nope', 'new-client', actor),
    NotFoundException,
  );
});

test('unlinkTicket: devolve o chamado à fila e remove o espelho (D-035)', async () => {
  const { service, calls } = harness([], () => null, {
    ticketById: (id) =>
      id === 't1'
        ? {
            id: 't1',
            zohoTicketId: 'Z-626',
            clientId: 'c1',
            ticketNumber: '626',
            title: 'VPN',
            status: 'Closed',
            statusType: 'Closed',
            priority: null,
            category: null,
            assigneeName: 'Ana',
            assigneeId: null,
            contactId: null,
            departmentId: null,
            accountId: 'acc-1',
            accountName: 'ACME',
            technologyName: null,
            openDate: new Date('2026-01-01T00:00:00Z'),
            closeDate: null,
            timeSpentMinutes: 30,
            slaCompliant: null,
            isBillable: true,
          }
        : null,
  });

  const result = await service.unlinkTicket('t1', actor);

  assert.equal(result.zohoTicketId, 'Z-626');
  assert.equal(calls.unmappedUpsert[0].create.zohoTicketId, 'Z-626');
  assert.equal(calls.unmappedUpsert[0].create.raw.id, 'Z-626');
  assert.equal(calls.ticketDelete.length, 1);
});

test('refreshTicketTimeEntries: 503 sem o Zoho configurado (D-035)', async () => {
  const service = new ZohoSyncService(
    {} as unknown as PrismaService,
    noopAudit,
    { isConfigured: () => false } as unknown as ZohoCredentialsService,
    {} as unknown as ZohoClientService,
    {} as unknown as ZohoSettingsService,
  );

  await assert.rejects(
    () => service.refreshTicketTimeEntries('t1', actor),
    ServiceUnavailableException,
  );
});
