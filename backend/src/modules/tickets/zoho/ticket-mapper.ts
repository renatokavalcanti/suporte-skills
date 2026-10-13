import { ZohoTicketPayload, ZohoTimeEntryPayload } from './zoho-client.service';

/** Chamado normalizado para o modelo local `Ticket` (D-029/D-030). */
export interface MappedTicket {
  zohoTicketId: string;
  ticketNumber: string | null;
  title: string;
  status: string;
  statusType: string | null;
  priority: string | null;
  category: string | null;
  assigneeName: string | null;
  assigneeId: string | null;
  contactId: string | null;
  departmentId: string | null;
  accountId: string | null;
  accountName: string | null;
  technologyName: string | null;
  openDate: Date;
  closeDate: Date | null;
  timeSpentMinutes: number;
  slaCompliant: boolean | null;
  isBillable: boolean;
  zohoModifiedAt: Date | null;
}

/** Lancamento de tempo normalizado para o modelo local `TimeEntry` (D-030). */
export interface MappedTimeEntry {
  zohoTimeEntryId: string;
  ticketId: string;
  ownerId: string | null;
  ownerName: string | null;
  executedAt: Date;
  minutes: number;
  description: string | null;
  isBillable: boolean;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseMinutes(value: unknown): number {
  const n = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

function toNumber(value: unknown): number {
  const n = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function optionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text === '' ? null : text;
}

/** Valor de um campo personalizado, aceitando string ou objeto com `name`. */
function customFieldValue(value: unknown): string | null {
  if (typeof value === 'string') return optionalText(value);
  if (value && typeof value === 'object' && 'name' in value) {
    return optionalText((value as { name?: unknown }).name);
  }
  return null;
}

function readTechnology(
  payload: ZohoTicketPayload,
  field?: string | null,
): string | null {
  if (!field) return null;
  const key = field.trim();
  if (key === '') return null;
  const cf = payload.cf;
  if (cf && typeof cf === 'object' && key in cf) {
    return customFieldValue((cf as Record<string, unknown>)[key]);
  }
  return customFieldValue((payload as Record<string, unknown>)[key]);
}

/**
 * Converte o payload do Zoho Desk no formato do modelo local. Funcao pura
 * (testavel isoladamente); nao "adivinha" campos ausentes. `technologyField` e'
 * o nome de API do campo personalizado de Tecnologia (D-030).
 */
export function mapZohoTicket(
  payload: ZohoTicketPayload,
  technologyField?: string | null,
): MappedTicket {
  const assigneeName =
    optionalText(payload.assigneeName) ??
    optionalText(payload.assignee?.name) ??
    null;

  const openDate =
    parseDate(payload.createdTime) ??
    parseDate(payload.modifiedTime) ??
    new Date();

  return {
    zohoTicketId: String(payload.id),
    ticketNumber: optionalText(payload.ticketNumber),
    title: optionalText(payload.subject) ?? '(sem assunto)',
    status: optionalText(payload.status) ?? '(desconhecido)',
    statusType: optionalText(payload.statusType),
    priority: optionalText(payload.priority),
    category: optionalText(payload.category),
    assigneeName,
    assigneeId: optionalText(payload.assigneeId),
    contactId: optionalText(payload.contactId),
    departmentId: optionalText(payload.departmentId),
    accountId: optionalText(payload.accountId),
    accountName: optionalText(payload.accountName),
    technologyName: readTechnology(payload, technologyField),
    openDate,
    closeDate: parseDate(payload.closedTime),
    timeSpentMinutes: parseMinutes(payload.timeSpent),
    slaCompliant:
      payload.slaCompliant === undefined || payload.slaCompliant === null
        ? null
        : Boolean(payload.slaCompliant),
    isBillable:
      payload.isBillable === undefined ? true : Boolean(payload.isBillable),
    zohoModifiedAt: parseDate(payload.modifiedTime),
  };
}

/**
 * Converte um lancamento de tempo do Zoho no formato local (D-030). O tempo e'
 * convertido para **minutos inteiros** (horas*60 + minutos + segundos/60). O
 * `ticketId` e' o id local do chamado ja espelhado.
 */
export function mapZohoTimeEntry(
  entry: ZohoTimeEntryPayload,
  ticketId: string,
): MappedTimeEntry | null {
  if (entry.id === undefined || entry.id === null) return null;

  const minutes = Math.floor(
    (toNumber(entry.hoursSpent) * 3600 +
      toNumber(entry.minutesSpent) * 60 +
      toNumber(entry.secondsSpent)) /
      60,
  );

  const executedAt =
    parseDate(entry.executedTime) ?? parseDate(entry.createdTime) ?? new Date();

  return {
    zohoTimeEntryId: String(entry.id),
    ticketId,
    ownerId: optionalText(entry.ownerId) ?? optionalText(entry.owner?.id),
    ownerName: optionalText(entry.ownerName) ?? optionalText(entry.owner?.name),
    executedAt,
    minutes,
    description: optionalText(entry.description),
    isBillable: entry.isBillable === undefined ? true : Boolean(entry.isBillable),
  };
}
