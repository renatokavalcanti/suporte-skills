import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../../shared/audit/audit.service';
import { zonedMonthRange } from '../../shared/common/business-time';
import { AuthenticatedUser } from '../../shared/common/authenticated-user.interface';
import { PrismaService } from '../../database/prisma.service';
import { CreateMeasurementDto } from './dto/create-measurement.dto';
import { MeasurementsService } from './measurements.service';

const actor: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@suporte.local',
  name: 'Admin',
  role: 'ADMIN' as AuthenticatedUser['role'],
  mustChangePassword: false,
};

const TZ = 'America/Sao_Paulo';
const config = { get: () => TZ } as unknown as ConfigService;

interface TicketRow {
  id: string;
  zohoTicketId: string;
  ticketNumber: string | null;
  title: string;
  status: string;
  closeDate: Date;
  timeSpentMinutes: number;
  slaCompliant: boolean | null;
  isBillable: boolean;
}

function baseMeasurement(status = 'DRAFT') {
  return {
    id: 'm1',
    clientId: 'c1',
    year: 2026,
    month: 10,
    status,
    ticketCount: 2,
    timeSpentMinutes: 90,
    slaEvaluatedCount: 2,
    slaCompliantCount: 1,
    closedById: null,
    closedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    client: { id: 'c1', name: 'Cliente', document: null },
    items: [],
  };
}

function harness(overrides: {
  client?: { id: string } | null;
  existing?: { id: string; status: string } | null;
  tickets?: TicketRow[];
  audits?: unknown[];
}) {
  const audits: unknown[] = overrides.audits ?? [];
  const calls: {
    ticketFindMany?: any;
    itemCreateMany?: any;
    measurementUpsert?: any;
    measurementUpdate?: any;
  } = {};

  const prisma: any = {
    client: {
      findUnique: async () =>
        overrides.client === undefined ? { id: 'c1' } : overrides.client,
    },
    ticket: {
      findMany: async (a: any) => {
        calls.ticketFindMany = a;
        return overrides.tickets ?? [];
      },
    },
    monthlyMeasurement: {
      findUnique: async () =>
        overrides.existing === undefined
          ? baseMeasurement()
          : overrides.existing,
      update: async (a: any) => {
        calls.measurementUpdate = a;
        return baseMeasurement();
      },
      upsert: async (a: any) => {
        calls.measurementUpsert = a;
        return { id: 'm1' };
      },
      count: async () => 0,
      findMany: async () => [],
    },
    monthlyMeasurementItem: {
      deleteMany: async () => ({ count: 0 }),
      createMany: async (a: any) => {
        calls.itemCreateMany = a;
        return { count: (a.data ?? []).length };
      },
    },
    $transaction: async (arg: any) =>
      typeof arg === 'function' ? arg(prisma) : Promise.all(arg),
  };

  const audit = {
    record: async (entry: unknown) => {
      audits.push(entry);
    },
  } as unknown as AuditService;

  return {
    service: new MeasurementsService(prisma as PrismaService, config, audit),
    calls,
    audits,
  };
}

const dto: CreateMeasurementDto = { clientId: 'c1', year: 2026, month: 10 };

test('generateDraft: filtra por close_date no fuso e calcula os totais', async () => {
  const tickets: TicketRow[] = [
    { id: 't1', zohoTicketId: 'Z1', ticketNumber: '1', title: 'a', status: 'Closed', closeDate: new Date(), timeSpentMinutes: 60, slaCompliant: true, isBillable: true },
    { id: 't2', zohoTicketId: 'Z2', ticketNumber: '2', title: 'b', status: 'Closed', closeDate: new Date(), timeSpentMinutes: 30, slaCompliant: false, isBillable: true },
  ];
  const { service, calls, audits } = harness({ tickets });

  const result = await service.generateDraft(dto, actor);

  const { start, end } = zonedMonthRange(2026, 10, TZ);
  assert.equal(calls.ticketFindMany.where.clientId, 'c1');
  assert.equal(calls.ticketFindMany.where.isBillable, true);
  assert.equal((calls.ticketFindMany.where.closeDate.gte as Date).toISOString(), start.toISOString());
  assert.equal((calls.ticketFindMany.where.closeDate.lt as Date).toISOString(), end.toISOString());

  assert.equal(calls.measurementUpsert.create.ticketCount, 2);
  assert.equal(calls.measurementUpsert.create.timeSpentMinutes, 90);
  assert.equal(calls.measurementUpsert.create.slaEvaluatedCount, 2);
  assert.equal(calls.measurementUpsert.create.slaCompliantCount, 1);
  assert.equal(calls.itemCreateMany.data.length, 2);
  assert.equal(calls.itemCreateMany.data[0].ticketId, 't1');
  assert.equal(result.slaPercentage, 50);
  assert.equal(audits.length, 1);
});

test('generateDraft: 409 quando a medição já está fechada', async () => {
  const { service } = harness({ existing: { id: 'm1', status: 'CLOSED' } });
  await assert.rejects(() => service.generateDraft(dto, actor), ConflictException);
});

test('generateDraft: 404 quando o cliente não existe', async () => {
  const { service } = harness({ client: null });
  await assert.rejects(() => service.generateDraft(dto, actor), NotFoundException);
});

test('close: 409 quando a medição já está fechada', async () => {
  const { service } = harness({ existing: { id: 'm1', status: 'CLOSED' } });
  await assert.rejects(() => service.close('m1', actor), ConflictException);
});

test('reopen: 400 quando a medição não está fechada', async () => {
  const { service } = harness({ existing: { id: 'm1', status: 'DRAFT' } });
  await assert.rejects(
    () => service.reopen('m1', 'ajuste de faturamento', actor),
    BadRequestException,
  );
});

test('reopen: registra a justificativa na auditoria', async () => {
  const audits: unknown[] = [];
  const { service } = harness({
    existing: { id: 'm1', status: 'CLOSED' },
    audits,
  });
  await service.reopen('m1', 'correção de cliente', actor);
  assert.equal(audits.length, 1);
  const entry = audits[0] as { after: { justification: string } };
  assert.equal(entry.after.justification, 'correção de cliente');
});
