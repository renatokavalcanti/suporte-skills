import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BalancePolicy, BillingStatus } from '@prisma/client';
import { computeBilling, computeCarriedMinutes } from './billing';

const BASE = {
  includedMinutes: 1200, // 20h de franquia
  monthlyValue: 1000,
  extraHourValue: 200,
  balancePolicy: BalancePolicy.EXPIRE,
};

test('B3: abaixo da franquia -> PADRAO (so o valor mensal)', () => {
  const r = computeBilling({ ...BASE, consumedMinutes: 600 });
  assert.equal(r.extraMinutes, 0);
  assert.equal(r.status, BillingStatus.STANDARD);
  assert.equal(r.extraAmount, 0);
  assert.equal(r.totalValue, 1000);
});

test('B3: exatamente na franquia -> PADRAO', () => {
  const r = computeBilling({ ...BASE, consumedMinutes: 1200 });
  assert.equal(r.extraMinutes, 0);
  assert.equal(r.status, BillingStatus.STANDARD);
  assert.equal(r.totalValue, 1000);
});

test('B3: acima da franquia -> COM HORAS ADICIONAIS', () => {
  const r = computeBilling({ ...BASE, consumedMinutes: 1800 }); // +10h
  assert.equal(r.extraMinutes, 600);
  assert.equal(r.extraHours, 10);
  assert.equal(r.status, BillingStatus.WITH_EXTRA_HOURS);
  assert.equal(r.extraAmount, 2000); // 10h * 200
  assert.equal(r.totalValue, 3000); // 1000 + 2000
});

test('B3: sem horas -> PADRAO', () => {
  const r = computeBilling({ ...BASE, consumedMinutes: 0 });
  assert.equal(r.extraMinutes, 0);
  assert.equal(r.status, BillingStatus.STANDARD);
  assert.equal(r.totalValue, 1000);
});

test('B3: ACCUMULATE usa o saldo dos meses anteriores', () => {
  // Saldo +600 min (mes anterior ficou abaixo da franquia).
  const r = computeBilling({
    ...BASE,
    balancePolicy: BalancePolicy.ACCUMULATE,
    consumedMinutes: 1500,
    carriedMinutes: 600,
  });
  assert.equal(r.availableMinutes, 1800);
  assert.equal(r.extraMinutes, 0); // 1500 <= 1800
  assert.equal(r.status, BillingStatus.STANDARD);
  assert.equal(r.totalValue, 1000);
});

test('B3: EXPIRE ignora o saldo anterior', () => {
  const r = computeBilling({
    ...BASE,
    balancePolicy: BalancePolicy.EXPIRE,
    consumedMinutes: 1500,
    carriedMinutes: 600,
  });
  assert.equal(r.carriedMinutes, 0);
  assert.equal(r.availableMinutes, 1200);
  assert.equal(r.extraMinutes, 300); // +5h
  assert.equal(r.extraAmount, 1000);
  assert.equal(r.status, BillingStatus.WITH_EXTRA_HOURS);
  assert.equal(r.totalValue, 2000);
});

test('B3: saldo devedor (negativo) reduz a franquia disponivel', () => {
  const r = computeBilling({
    ...BASE,
    balancePolicy: BalancePolicy.ACCUMULATE,
    consumedMinutes: 1200,
    carriedMinutes: -300,
  });
  assert.equal(r.availableMinutes, 900);
  assert.equal(r.extraMinutes, 300);
  assert.equal(r.totalValue, 2000);
});

test('computeCarriedMinutes: soma franquia - consumido por mes (ACCUMULATE)', () => {
  assert.equal(
    computeCarriedMinutes(BalancePolicy.ACCUMULATE, 1200, [600, 900]),
    900, // (1200-600) + (1200-900)
  );
  assert.equal(
    computeCarriedMinutes(BalancePolicy.ACCUMULATE, 1200, [1500]),
    -300, // mes estourou a franquia
  );
});

test('computeCarriedMinutes: EXPIRE sempre 0', () => {
  assert.equal(
    computeCarriedMinutes(BalancePolicy.EXPIRE, 1200, [600, 900]),
    0,
  );
});
