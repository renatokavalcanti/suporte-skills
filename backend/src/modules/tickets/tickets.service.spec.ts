import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { TicketsService } from './tickets.service';

function makeService(prisma: unknown): TicketsService {
  return new TicketsService(prisma as PrismaService);
}

test('list: filtra por periodo (close_date) e pelos demais filtros', async () => {
  let args:
    | {
        where: Record<string, any>;
        orderBy: Record<string, string>;
        skip: number;
        take: number;
      }
    | undefined;
  const prisma = {
    ticket: {
      count: async () => 3,
      findMany: async (a: typeof args) => {
        args = a;
        return [];
      },
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };
  const service = makeService(prisma);

  const result = await service.list({
    clientId: 'c1',
    status: 'Closed',
    billable: true,
    from: '2026-10-01',
    to: '2026-10-31',
  } as QueryTicketsDto);

  assert.equal(args?.where.clientId, 'c1');
  assert.equal(args?.where.status, 'Closed');
  assert.equal(args?.where.isBillable, true);
  assert.equal(
    (args?.where.closeDate.gte as Date).toISOString(),
    '2026-10-01T00:00:00.000Z',
  );
  assert.equal(
    (args?.where.closeDate.lte as Date).toISOString(),
    '2026-10-31T23:59:59.999Z',
  );
  assert.deepEqual(args?.orderBy, { closeDate: 'desc' });
  assert.equal(result.meta.total, 3);
  assert.equal(result.meta.pageSize, 20);
});

test('list: apenas "from" define o limite inferior (sem limite superior)', async () => {
  let where: Record<string, any> | undefined;
  const prisma = {
    ticket: {
      count: async () => 0,
      findMany: async (a: { where: Record<string, any> }) => {
        where = a.where;
        return [];
      },
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };
  const service = makeService(prisma);

  await service.list({ from: '2026-10-01' } as QueryTicketsDto);

  assert.equal(
    (where?.closeDate.gte as Date).toISOString(),
    '2026-10-01T00:00:00.000Z',
  );
  assert.equal(where?.closeDate.lte, undefined);
});

test('list: busca textual usa OR em titulo e numero do chamado', async () => {
  let where: Record<string, any> | undefined;
  const prisma = {
    ticket: {
      count: async () => 0,
      findMany: async (a: { where: Record<string, any> }) => {
        where = a.where;
        return [];
      },
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };
  const service = makeService(prisma);

  await service.list({ search: 'rede' } as QueryTicketsDto);

  assert.ok(Array.isArray(where?.OR));
  assert.equal(where?.OR.length, 2);
});

test('getById: 404 quando o chamado nao existe', async () => {
  const prisma = { ticket: { findUnique: async () => null } };
  const service = makeService(prisma);

  await assert.rejects(() => service.getById('x'), NotFoundException);
});
