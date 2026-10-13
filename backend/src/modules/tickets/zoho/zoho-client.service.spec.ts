import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ZohoClientService } from './zoho-client.service';
import { ZohoCredentialsService } from './zoho-credentials.service';

interface FakeResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

function jsonResponse(body: unknown, status = 200): FakeResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const credentials = {
  get: () => ({
    clientId: 'cid',
    clientSecret: 'secret',
    refreshToken: 'refresh',
    orgId: 'org',
    apiBaseUrl: 'https://api.example/api/v1',
    accountsBaseUrl: 'https://accounts.example',
    fetchTimeoutMs: 5000,
  }),
} as unknown as ZohoCredentialsService;

test('listTickets: obtém o token e devolve os chamados; reaproveita o token', async () => {
  const original = global.fetch;
  const urls: string[] = [];
  try {
    global.fetch = (async (url: string) => {
      urls.push(String(url));
      if (String(url).includes('/oauth/v2/token')) {
        return jsonResponse({ access_token: 'tok-123', expires_in: 3600 });
      }
      return jsonResponse({ data: [{ id: 'Z-1' }, { id: 'Z-2' }] });
    }) as unknown as typeof fetch;

    const client = new ZohoClientService(credentials);
    const first = await client.listTickets({ limit: 100, from: 0 });
    const second = await client.listTickets({ limit: 100, from: 100 });

    assert.equal(first.length, 2);
    assert.equal(first[0].id, 'Z-1');
    assert.equal(second.length, 2);
    const tokenCalls = urls.filter((u) => u.includes('/oauth/v2/token'));
    assert.equal(tokenCalls.length, 1); // token em cache na 2a chamada
    const ticketUrls = urls.filter((u) => u.includes('/tickets?'));
    assert.equal(ticketUrls.length, 2);
    // Sem `modifiedSince`, nao vai o parametro de filtro modifiedTime (so' o sortBy).
    assert.ok(!ticketUrls[0].includes('modifiedTime='));
  } finally {
    global.fetch = original;
  }
});

test('listTickets: propaga erro em resposta HTTP não-ok', async () => {
  const original = global.fetch;
  try {
    global.fetch = (async (url: string) => {
      if (String(url).includes('/oauth/v2/token')) {
        return jsonResponse({ access_token: 'tok', expires_in: 3600 });
      }
      return jsonResponse({ error: 'unauthorized' }, 401);
    }) as unknown as typeof fetch;

    const client = new ZohoClientService(credentials);
    await assert.rejects(() => client.listTickets({ limit: 10, from: 0 }), /HTTP 401/);
  } finally {
    global.fetch = original;
  }
});

test('listTickets: erro quando o token não é devolvido', async () => {
  const original = global.fetch;
  try {
    global.fetch = (async () =>
      jsonResponse({ error: 'invalid_client' })) as unknown as typeof fetch;

    const client = new ZohoClientService(credentials);
    await assert.rejects(
      () => client.listTickets({ limit: 10, from: 0 }),
      /Falha ao obter token do Zoho/,
    );
  } finally {
    global.fetch = original;
  }
});
