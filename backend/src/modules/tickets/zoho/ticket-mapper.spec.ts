import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapZohoTicket } from './ticket-mapper';

test('mapZohoTicket: mapeia um payload completo', () => {
  const mapped = mapZohoTicket({
    id: 12345,
    ticketNumber: 'SK-1',
    subject: 'Falha de rede',
    status: 'Aguardando cliente',
    statusType: 'Open',
    priority: 'High',
    category: 'Rede',
    assignee: { name: 'Joao' },
    createdTime: '2026-10-01T10:00:00Z',
    closedTime: '2026-10-05T18:30:00Z',
    modifiedTime: '2026-10-05T18:30:00Z',
    timeSpent: 45,
    isBillable: true,
    slaCompliant: false,
  });

  assert.equal(mapped.zohoTicketId, '12345');
  assert.equal(mapped.ticketNumber, 'SK-1');
  assert.equal(mapped.title, 'Falha de rede');
  assert.equal(mapped.status, 'Aguardando cliente');
  assert.equal(mapped.statusType, 'Open');
  assert.equal(mapped.assigneeName, 'Joao');
  assert.equal(mapped.timeSpentMinutes, 45);
  assert.equal(mapped.isBillable, true);
  assert.equal(mapped.slaCompliant, false);
  assert.equal(mapped.openDate.toISOString(), '2026-10-01T10:00:00.000Z');
  assert.equal(mapped.closeDate?.toISOString(), '2026-10-05T18:30:00.000Z');
});

test('mapZohoTicket: aplica defaults sem "adivinhar"', () => {
  const mapped = mapZohoTicket({ id: 'Z-9', modifiedTime: '2026-10-02T00:00:00Z' });

  assert.equal(mapped.zohoTicketId, 'Z-9');
  assert.equal(mapped.title, '(sem assunto)');
  assert.equal(mapped.status, '(desconhecido)');
  assert.equal(mapped.ticketNumber, null);
  assert.equal(mapped.closeDate, null);
  assert.equal(mapped.timeSpentMinutes, 0);
  assert.equal(mapped.isBillable, true); // ausente => faturável por padrão
  assert.equal(mapped.slaCompliant, null); // ausente => sem SLA calculado
  // Sem createdTime, usa modifiedTime como fallback da abertura.
  assert.equal(mapped.openDate.toISOString(), '2026-10-02T00:00:00.000Z');
});

test('mapZohoTicket: slaCompliant null quando o Zoho não calcula', () => {
  const mapped = mapZohoTicket({ id: 'Z-10', slaCompliant: null });
  assert.equal(mapped.slaCompliant, null);
});
