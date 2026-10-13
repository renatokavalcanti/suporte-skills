import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapZohoTimeEntry, mapZohoTicket } from './ticket-mapper';

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

test('mapZohoTicket: preenche conta, contato e tecnologia (D-030)', () => {
  const mapped = mapZohoTicket(
    {
      id: 'Z-77',
      subject: 'X',
      accountId: 'acc-1',
      accountName: 'Cliente X',
      contactId: 'c-1',
      departmentId: 'd-1',
      assigneeId: 'a-1',
      cf: { Tecnologia: 'VMware' },
    },
    'Tecnologia',
  );

  assert.equal(mapped.accountId, 'acc-1');
  assert.equal(mapped.accountName, 'Cliente X');
  assert.equal(mapped.contactId, 'c-1');
  assert.equal(mapped.departmentId, 'd-1');
  assert.equal(mapped.assigneeId, 'a-1');
  assert.equal(mapped.technologyName, 'VMware');
});

test('mapZohoTimeEntry: converte horas/min/seg em minutos inteiros', () => {
  const entry = mapZohoTimeEntry(
    {
      id: 'T-1',
      ownerId: 'u1',
      ownerName: 'Ana',
      executedTime: '2026-10-05T12:00:00Z',
      hoursSpent: 1,
      minutesSpent: 30,
      secondsSpent: 45,
      description: 'Ajuste de rede',
      isBillable: false,
    },
    'ticket-db-1',
  );

  assert.ok(entry);
  assert.equal(entry!.zohoTimeEntryId, 'T-1');
  assert.equal(entry!.ticketId, 'ticket-db-1');
  assert.equal(entry!.minutes, 90); // 1h30 (45s truncados) -> 90 min
  assert.equal(entry!.ownerId, 'u1');
  assert.equal(entry!.ownerName, 'Ana');
  assert.equal(entry!.isBillable, false);
  assert.equal(entry!.executedAt.toISOString(), '2026-10-05T12:00:00.000Z');
});

test('mapZohoTimeEntry: aceita horas/min/seg como texto (payload real, D-032)', () => {
  const entry = mapZohoTimeEntry(
    {
      id: 'T-626-2',
      ownerId: 'a1',
      executedTime: '2026-07-14T14:00:00Z',
      hoursSpent: '1',
      minutesSpent: '30',
      secondsSpent: '0',
      isBillable: false,
    },
    'ticket-626',
  );

  assert.ok(entry);
  assert.equal(entry!.minutes, 90); // "1"h + "30"min -> 90 min
  assert.equal(entry!.ownerName, null);
  assert.equal(entry!.isBillable, false);
});

test('mapZohoTimeEntry: null quando falta o id', () => {
  assert.equal(
    mapZohoTimeEntry({ id: undefined as unknown as string }, 't1'),
    null,
  );
});
