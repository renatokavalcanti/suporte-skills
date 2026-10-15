import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { HealthController } from './health.controller';

function build(environment: string | undefined, up = true): HealthController {
  const prisma = {
    $queryRaw: async () => {
      if (!up) throw new Error('banco indisponivel');
      return [];
    },
  } as unknown as PrismaService;
  const config = { get: () => environment } as unknown as ConfigService;
  return new HealthController(prisma, config);
}

test('health: inclui o ambiente configurado (D-038)', async () => {
  const result = await build('PRD').check();
  assert.equal(result.status, 'ok');
  assert.equal(result.environment, 'PRD');
});

test('health: ambiente cai em DEV quando ausente (D-038)', async () => {
  const result = await build(undefined).check();
  assert.equal(result.environment, 'DEV');
});

test('health: degradado quando o banco falha', async () => {
  const result = await build('HML', false).check();
  assert.equal(result.status, 'degraded');
  assert.equal(result.environment, 'HML');
});
