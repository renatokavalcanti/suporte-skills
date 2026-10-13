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
  unmappedUpsert: any[];
  unmappedDeleteMany: any[];
  unmappedDelete: any[];
  appSettingUpsert: any[];
}

interface HarnessOptions {
  linkRows?: UnmappedRow[];
  clientById?: (id: string) => { id: string } | null;
  ticketExists?: (zohoTicketId: string) => boolean;
  accountName?: (accountId: string) => string | null;
}

function harness(
  batch: ZohoTicketPayload[],
  clientFor: (accountId: string) => { id: string } | null,
  options: HarnessOptions = {},
): { service: ZohoSyncService; calls: Calls } {
  const calls: Calls = {
    ticketUpsert: [],
    unmappedUpsert: [],
    unmappedDeleteMany: [],
    unmappedDelete: [],
    appSettingUpsert: [],
  };
  const prisma = {
    appSetting: {
      findUnique: async () => null,
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
      findUnique: async (a: any) =>
        options.ticketExists?.(a.where.zohoTicketId) ? { id: 't1' } : null,
      upsert: async (a: any) => {
        calls.ticketUpsert.push(a);
        return {
          id: 't1',
          zohoTicketId: a.where.zohoTicketId,
          clientId: a.create?.clientId ?? a.update?.clientId ?? 'c1',
        };
      },
      update: async () => ({ id: 't1' }),
    },
    timeEntry: {
      upsert: async () => ({}),
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
    listTickets: async () => batch,
    listTimeEntries: async () => [],
    getAccountName: async (accountId: string) =>
      options.accountName?.(accountId) ?? null,
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
  assert.equal(
    calls.appSettingUpsert[0].create.value.lastModifiedAt,
    '2026-10-03T10:00:00.000Z',
  );
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
