import { BalancePolicy, BillingStatus } from '@prisma/client';

/**
 * Regra de faturamento (B3, D-030). Funcoes puras (testaveis isoladamente):
 *
 *   adicionais = max(0, horas_consumidas - horas_franqueadas)
 *   status     = PADRAO se adicionais == 0, senao COM HORAS ADICIONAIS
 *   total      = valor_mensal + adicionais * valor_hora_adicional
 *
 * A franquia e' informada em **minutos inteiros**. Com politica `ACCUMULATE`, o
 * saldo de meses anteriores (`carriedMinutes`) e' somado a franquia; com
 * `EXPIRE` o saldo e' ignorado.
 */
export interface BillingInput {
  includedMinutes: number;
  monthlyValue: number;
  extraHourValue: number;
  balancePolicy: BalancePolicy;
  consumedMinutes: number;
  /** Saldo de competencias anteriores em minutos (ignorado se EXPIRE). */
  carriedMinutes?: number;
}

export interface BillingResult {
  includedMinutes: number;
  carriedMinutes: number;
  availableMinutes: number;
  consumedMinutes: number;
  extraMinutes: number;
  extraHours: number;
  status: BillingStatus;
  monthlyValue: number;
  extraAmount: number;
  totalValue: number;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeBilling(input: BillingInput): BillingResult {
  const includedMinutes = Math.max(0, Math.round(input.includedMinutes));
  const consumedMinutes = Math.max(0, Math.round(input.consumedMinutes));
  const carriedMinutes =
    input.balancePolicy === BalancePolicy.ACCUMULATE
      ? Math.round(input.carriedMinutes ?? 0)
      : 0;

  const availableMinutes = Math.max(0, includedMinutes + carriedMinutes);
  const extraMinutes = Math.max(0, consumedMinutes - availableMinutes);
  const extraHours = extraMinutes / 60;
  const extraAmount = round2(extraHours * input.extraHourValue);
  const monthlyValue = round2(input.monthlyValue);

  return {
    includedMinutes,
    carriedMinutes,
    availableMinutes,
    consumedMinutes,
    extraMinutes,
    extraHours,
    status:
      extraMinutes > 0
        ? BillingStatus.WITH_EXTRA_HOURS
        : BillingStatus.STANDARD,
    monthlyValue,
    extraAmount,
    totalValue: round2(monthlyValue + extraAmount),
  };
}

/**
 * Saldo acumulado (minutos) das competencias anteriores. Devolve a soma de
 * `franquia - consumido` por mes (pode ser negativo = "devedor"). Com `EXPIRE`
 * devolve sempre 0 (o saldo nao transborda para o mes seguinte).
 */
export function computeCarriedMinutes(
  policy: BalancePolicy,
  includedMinutes: number,
  priorConsumptions: number[],
): number {
  if (policy !== BalancePolicy.ACCUMULATE) return 0;
  const franchise = Math.max(0, Math.round(includedMinutes));
  let balance = 0;
  for (const consumed of priorConsumptions) {
    balance += franchise - Math.max(0, Math.round(consumed));
  }
  return Math.round(balance);
}
