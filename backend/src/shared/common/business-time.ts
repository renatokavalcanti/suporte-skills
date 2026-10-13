/**
 * Limites de um mes no fuso de negocio, expressos em UTC. O intervalo cobre
 * [start, end): `start` = primeiro instante do mes e `end` = primeiro instante
 * do mes seguinte, ambos no fuso informado (ex.: America/Sao_Paulo). Usado pela
 * Medicao Mensal (D-029) para decidir se um `close_date` cai no mes.
 *
 * Implementado com Intl (sem dependencia externa), no mesmo espirito do
 * CertificationStatusService/ReportsService. Preciso para fusos sem horario de
 * verao (caso de America/Sao_Paulo).
 */
export function zonedMonthRange(
  year: number,
  month: number,
  timeZone: string,
): { start: Date; end: Date } {
  const next =
    month === 12
      ? { year: year + 1, month: 1 }
      : { year, month: month + 1 };

  return {
    start: zonedMidnightToUtc(year, month, timeZone),
    end: zonedMidnightToUtc(next.year, next.month, timeZone),
  };
}

/**
 * Limites [start, end) de um intervalo de dias (datas `YYYY-MM-DD`, inclusivas
 * nas duas pontas), no fuso informado. `start` = 00:00 do primeiro dia e `end` =
 * 00:00 do dia seguinte ao ultimo. Usado pelos Relatorios de Chamados (D-030).
 */
export function zonedDayRange(
  fromDate: string,
  toDate: string,
  timeZone: string,
): { start: Date; end: Date } {
  return {
    start: zonedDateStartUtc(fromDate, timeZone),
    end: zonedDateStartUtc(addDays(toDate, 1), timeZone),
  };
}

/** Instante UTC do inicio (00:00) de um dia `YYYY-MM-DD` no fuso informado. */
export function zonedDateStartUtc(dateStr: string, timeZone: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return zonedMidnightToUtc(year, month, timeZone, day);
}

function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(year, month - 1, day));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function zonedMidnightToUtc(
  year: number,
  month: number,
  timeZone: string,
  day = 1,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const offset = timeZoneOffsetMs(new Date(utcGuess), timeZone);
  return new Date(utcGuess - offset);
}

/** Diferenca (fuso - UTC) em ms para o instante informado. */
function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);

  const get = (type: string): number =>
    Number(parts.find((part) => part.type === type)?.value ?? '0');

  let hour = get('hour');
  if (hour === 24) hour = 0;

  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    hour,
    get('minute'),
    get('second'),
  );
  return asUtc - date.getTime();
}
