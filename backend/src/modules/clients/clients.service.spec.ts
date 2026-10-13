import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { AuditService } from '../../shared/audit/audit.service';
import { AuthenticatedUser } from '../../shared/common/authenticated-user.interface';
import { PrismaService } from '../../database/prisma.service';
import { CreateClientDto } from './dto/create-client.dto';
import { QueryClientsDto } from './dto/query-clients.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { ClientsService } from './clients.service';

const actor: AuthenticatedUser = {
  id: 'user-1',
  email: 'admin@suporte.local',
  name: 'Admin',
  role: 'ADMIN' as AuthenticatedUser['role'],
  mustChangePassword: false,
};

interface AuditCall {
  entity: string;
  entityId: string;
  action: string;
  before?: unknown;
  after?: unknown;
}

function makeService(prisma: unknown, audits: AuditCall[]): ClientsService {
  const audit = {
    record: async (entry: AuditCall): Promise<void> => {
      audits.push(entry);
    },
  } as unknown as AuditService;
  return new ClientsService(prisma as PrismaService, audit);
}

test('create: normaliza campos e registra auditoria', async () => {
  const audits: AuditCall[] = [];
  let received: { data: Record<string, unknown> } | undefined;
  const prisma = {
    client: {
      create: async (args: { data: Record<string, unknown> }) => {
        received = args;
        return {
          id: 'c1',
          name: 'ACME',
          document: null,
          zohoAccountId: null,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
          _count: { tickets: 0 },
        };
      },
    },
  };
  const service = makeService(prisma, audits);

  const result = await service.create(
    { name: '  ACME  ', document: '   ' } as CreateClientDto,
    actor,
  );

  assert.equal(received?.data.name, 'ACME');
  assert.equal(received?.data.document, null);
  assert.equal(received?.data.active, true);
  assert.equal(result.id, 'c1');
  assert.equal(audits.length, 1);
  assert.equal(audits[0].entity, 'clients');
  assert.equal(audits[0].action, 'CREATE');
});

test('update: 404 quando o cliente nao existe', async () => {
  const prisma = { client: { findUnique: async () => null } };
  const service = makeService(prisma, []);

  await assert.rejects(
    () => service.update('x', { name: 'Novo' } as UpdateClientDto, actor),
    NotFoundException,
  );
});

test('setActive: alterna o status e audita o antes/depois', async () => {
  const audits: AuditCall[] = [];
  const prisma = {
    client: {
      findUnique: async () => ({ id: 'c1', active: true }),
      update: async (args: { data: { active: boolean } }) => ({
        id: 'c1',
        active: args.data.active,
        _count: { tickets: 0 },
      }),
    },
  };
  const service = makeService(prisma, audits);

  await service.setActive('c1', false, actor);

  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, 'UPDATE');
  assert.deepEqual(audits[0].before, { active: true });
  assert.deepEqual(audits[0].after, { active: false });
});

test('getById: 404 quando o cliente nao existe', async () => {
  const prisma = { client: { findUnique: async () => null } };
  const service = makeService(prisma, []);

  await assert.rejects(() => service.getById('x'), NotFoundException);
});

test('list: aplica o filtro active e monta a paginacao', async () => {
  let where: Record<string, unknown> | undefined;
  const prisma = {
    client: {
      count: async () => 42,
      findMany: async (args: { where: Record<string, unknown> }) => {
        where = args.where;
        return [];
      },
    },
    $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
  };
  const service = makeService(prisma, []);

  const result = await service.list({
    page: 2,
    pageSize: 10,
    active: true,
  } as QueryClientsDto);

  assert.equal(where?.active, true);
  assert.equal(result.meta.total, 42);
  assert.equal(result.meta.page, 2);
  assert.equal(result.meta.totalPages, 5);
});
