export const MONTHS_PT = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export function monthLabel(month: number): string {
  return MONTHS_PT[month - 1] ?? String(month);
}

export function periodLabel(year: number, month: number): string {
  return `${monthLabel(month)}/${year}`;
}
