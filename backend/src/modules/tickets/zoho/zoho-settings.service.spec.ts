import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encryptSecret } from '../../../shared/crypto/secret-crypto';
import { ZohoSettingsService } from './zoho-settings.service';

interface ConfigStub {
  values: Record<string, unknown>;
  get: (key: string) => unknown;
}

function makeConfig(overrides: Record<string, unknown> = {}): ConfigStub {
  const values: Record<string, unknown> = {
    settings: { encryptionKey: 'test-encryption-secret' },
    auth: { accessSecret: 'jwt-secret' },
    publicUrl: 'http://localhost:4000',
    zoho: {
      syncEnabled: false,
      syncIntervalMinutes: 360,
      fetchTimeoutMs: 15000,
      maxTicketsPerRun: 200,
      apiBaseUrlOverride: '',
      accountsBaseUrlOverride: '',
      clientId: '',
      clientSecret: '',
      refreshToken: '',
      orgId: '',
    },
    ...overrides,
  };
  return { values, get: (key: string) => values[key] };
}

function makePrisma(stored: unknown) {
  const upserts: unknown[] = [];
  return {
    upserts,
    appSetting: {
      findUnique: async () => (stored ? { key: 'zoho', value: stored } : null),
      upsert: async (args: { create: { value: unknown } }) => {
        upserts.push(args.create.value);
        return args.create;
      },
    },
  };
}

const audit = { record: async () => undefined } as never;

test('getResolved: cai no ambiente quando nao ha nada salvo', async () => {
  const config = makeConfig({
    zoho: {
      syncEnabled: false,
      syncIntervalMinutes: 360,
      fetchTimeoutMs: 15000,
      maxTicketsPerRun: 200,
      apiBaseUrlOverride: '',
      accountsBaseUrlOverride: '',
      clientId: 'env-id',
      clientSecret: 'env-secret',
      refreshToken: 'env-refresh',
      orgId: 'env-org',
    },
  });
  const prisma = makePrisma(null);
  const service = new ZohoSettingsService(
    prisma as never,
    config as never,
    audit,
  );
  await service.ensureLoaded();

  const resolved = service.getResolved();
  assert.equal(resolved.configured, true);
  assert.equal(resolved.secretSource, 'env');
  assert.equal(resolved.clientId, 'env-id');
  // data center padrao 'com' -> dominios derivados.
  assert.equal(resolved.apiBaseUrl, 'https://desk.zoho.com/api/v1');
  assert.equal(resolved.accountsBaseUrl, 'https://accounts.zoho.com');
  assert.equal(resolved.syncEnabled, false);
  assert.equal(resolved.syncFrequency, 'MANUAL');
});

test('getResolved: banco sobrepoe o ambiente e decifra os segredos', async () => {
  const stored = {
    dataCenter: 'eu',
    clientId: 'ui-id',
    orgId: 'ui-org',
    clientSecretEnc: encryptSecret('ui-secret', 'test-encryption-secret'),
    refreshTokenEnc: encryptSecret('ui-refresh', 'test-encryption-secret'),
    syncFrequency: 'DAILY',
  };
  const prisma = makePrisma(stored);
  const service = new ZohoSettingsService(
    prisma as never,
    makeConfig() as never,
    audit,
  );
  await service.ensureLoaded();

  const resolved = service.getResolved();
  assert.equal(resolved.configured, true);
  assert.equal(resolved.secretSource, 'settings');
  assert.equal(resolved.clientId, 'ui-id');
  assert.equal(resolved.clientSecret, 'ui-secret');
  assert.equal(resolved.refreshToken, 'ui-refresh');
  // data center 'eu' -> dominios europeus.
  assert.equal(resolved.apiBaseUrl, 'https://desk.zoho.eu/api/v1');
  assert.equal(resolved.accountsBaseUrl, 'https://accounts.zoho.eu');
  assert.equal(resolved.syncEnabled, true);
  assert.equal(resolved.syncIntervalMinutes, 1440);

  const view = service.getView();
  assert.equal(view.clientSecretSet, true);
  assert.equal(view.refreshTokenSet, true);
  // A visao NUNCA devolve os segredos.
  assert.ok(!JSON.stringify(view).includes('ui-secret'));
  assert.ok(!JSON.stringify(view).includes('ui-refresh'));
  assert.equal(
    view.redirectUri,
    'http://localhost:4000/api/v1/settings/zoho/callback',
  );
});

test('update: grava o segredo cifrado e a visao o oculta', async () => {
  const prisma = makePrisma(null);
  const service = new ZohoSettingsService(
    prisma as never,
    makeConfig() as never,
    audit,
  );
  await service.ensureLoaded();

  const view = await service.update(
    {
      dataCenter: 'au',
      clientId: 'cid',
      clientSecret: 'topsecret',
      refreshToken: 'refreshtok',
      orgId: 'org',
      syncFrequency: 'SIX_HOURS',
    },
    { id: 'admin-1' } as never,
  );

  assert.equal(prisma.upserts.length, 1);
  const saved = prisma.upserts[0] as Record<string, unknown>;
  assert.ok(typeof saved.clientSecretEnc === 'string');
  assert.ok(typeof saved.refreshTokenEnc === 'string');
  // Nada em texto puro no registro salvo.
  assert.ok(!JSON.stringify(saved).includes('topsecret'));
  assert.ok(!JSON.stringify(saved).includes('refreshtok'));

  assert.equal(view.configured, true);
  assert.equal(view.clientSecretSet, true);
  assert.equal(view.syncIntervalMinutes, 360);
  // data center 'au' -> dominio proprio (desk.zoho.com.au).
  assert.equal(view.apiBaseUrl, 'https://desk.zoho.com.au/api/v1');
});
