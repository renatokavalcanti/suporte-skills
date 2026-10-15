import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../../shared/audit/audit.service';
import { EmailSettingsService } from './email-settings.service';

function build(): EmailSettingsService {
  const config = { get: () => undefined } as unknown as ConfigService;
  const prisma = {} as unknown as PrismaService;
  const audit = { record: async () => undefined } as unknown as AuditService;
  return new EmailSettingsService(prisma, config, audit);
}

test('resolveWithOverrides: testável sem habilitar (D-036)', () => {
  const service = build();
  const resolved = service.resolveWithOverrides({
    transport: 'SMTP',
    fromAddress: 'noreply@suporte.local',
    smtpHost: 'smtp.exemplo.com',
    smtpPort: 587,
    smtpUser: 'usuario',
    smtpPassword: 'segredo',
    enabled: false,
  });

  assert.equal(resolved.sendable, true);
  assert.equal(resolved.enabled, false);
  assert.equal(resolved.configured, false); // habilitação ainda desligada
  assert.equal(resolved.smtpPassword, 'segredo');
});

test('resolveWithOverrides: sem servidor não é testável (D-036)', () => {
  const service = build();
  const resolved = service.resolveWithOverrides({
    transport: 'SMTP',
    fromAddress: 'x@y.com',
  });

  assert.equal(resolved.sendable, false);
});

test('resolveWithOverrides: Graph exige tenant, client id e secret (D-036)', () => {
  const service = build();
  const semSecret = service.resolveWithOverrides({
    transport: 'GRAPH',
    fromAddress: 'x@y.com',
    graphTenantId: 't',
    graphClientId: 'c',
  });
  assert.equal(semSecret.sendable, false);

  const completo = service.resolveWithOverrides({
    transport: 'GRAPH',
    fromAddress: 'x@y.com',
    graphTenantId: 't',
    graphClientId: 'c',
    graphClientSecret: 's',
  });
  assert.equal(completo.sendable, true);
});
