import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../../shared/audit/audit.service';
import { PrismaService } from '../../database/prisma.service';
import { MeasurementsService } from './measurements.service';

const config = {
  get: () => 'America/Sao_Paulo',
} as unknown as ConfigService;
const audit = { record: async () => undefined } as unknown as AuditService;

function measurement(status: 'DRAFT' | 'CLOSED' = 'CLOSED') {
  return {
    id: 'm1',
    clientId: 'c1',
    year: 2026,
    month: 10,
    status,
    ticketCount: 1,
    timeSpentMinutes: 60,
    slaEvaluatedCount: 1,
    slaCompliantCount: 1,
    closedById: 'admin-1',
    closedAt: new Date('2026-11-01T12:00:00Z'),
    createdAt: new Date('2026-11-01T12:00:00Z'),
    updatedAt: new Date('2026-11-01T12:00:00Z'),
    client: { id: 'c1', name: 'Cliente Ávido', document: '11.111.111/0001-11' },
    closedBy: { name: 'Admin' },
    items: [
      {
        id: 'i1',
        zohoTicketId: 'Z-100',
        ticketNumber: 'SK-100',
        title: 'Chamado de teste',
        status: 'Closed',
        closeDate: new Date('2026-10-05T12:00:00Z'),
        timeSpentMinutes: 60,
        slaCompliant: true,
        isBillable: true,
        createdAt: new Date('2026-11-01T12:00:00Z'),
      },
    ],
  };
}

function makeService(data: unknown): MeasurementsService {
  const prisma = {
    monthlyMeasurement: { findUnique: async () => data },
  } as unknown as PrismaService;
  return new MeasurementsService(prisma, config, audit);
}

test('exportCsv: gera CSV com BOM e a linha do chamado', async () => {
  const service = makeService(measurement());
  const { filename, body } = await service.exportCsv('m1');

  assert.equal(filename, 'medicao-cliente-avido-2026-10.csv');
  assert.ok(body.startsWith('\uFEFF'));
  assert.ok(body.includes('Chamado'));
  assert.ok(body.includes('SK-100'));
  assert.ok(body.includes('Cliente Ávido'));
});

test('exportPdf: gera um PDF com cabeçalho e código de verificação', async () => {
  const service = makeService(measurement());
  const { filename, body } = await service.exportPdf('m1');

  assert.equal(filename, 'medicao-cliente-avido-2026-10.pdf');
  const text = body.toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.ok(text.includes('Código de verificação'));
  assert.ok(text.includes('Cliente Ávido'));
});

test('exportCsv: 400 quando a medição não está fechada', async () => {
  const service = makeService(measurement('DRAFT'));
  await assert.rejects(() => service.exportCsv('m1'), BadRequestException);
});
