import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
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

interface Calls {
  ticketUpsert: any[];
  unmappedUpsert: any[];
  appSettingUpsert: any[];
}

function harness(
  batch: ZohoTicketPayload[],
  clientFor: (accountId: string) => { id: string } | null,
): { service: ZohoSyncService; calls: Calls } {
  const calls: Calls = { ticketUpsert: [], unmappedUpsert: [], appSettingUpsert: [] };
  const prisma = {
    appSetting: {
      findUnique: async () => null,
      upsert: async (a: any) => {
        calls.appSettingUpsert.push(a);
        return a;
      },
    },
    client: { findUnique: async (a: any) => clientFor(a.where.zohoAccountId) },
    ticket: {
      findUnique: async () => null,
      upsert: async (a: any) => {
        calls.ticketUpsert.push(a);
        return { id: 't1' };
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
      findUnique: async () => null,
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  } as unknown as PrismaService;

  const zoho = {
    listTickets: async () => batch,
    listTimeEntries: async () => [],
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
