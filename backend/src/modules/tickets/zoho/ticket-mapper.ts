import { ZohoTicketPayload } from './zoho-client.service';

/** Chamado normalizado para o modelo local `Ticket` (D-029). */
export interface MappedTicket {
  zohoTicketId: string;
  ticketNumber: string | null;
  title: string;
  status: string;
  statusType: string | null;
  priority: string | null;
  category: string | null;
  assigneeName: string | null;
  openDate: Date;
  closeDate: Date | null;
  timeSpentMinutes: number;
  slaCompliant: boolean | null;
  isBillable: boolean;
  zohoModifiedAt: Date | null;
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

function optionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text === '' ? null : text;
}

/**
 * Converte o payload do Zoho Desk no formato do modelo local. Funcao pura
 * (testavel isoladamente); nao "adivinha" campos ausentes.
 */
export function mapZohoTicket(payload: ZohoTicketPayload): MappedTicket {
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
