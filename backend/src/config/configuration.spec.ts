import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toEnvironment } from './configuration';

test('toEnvironment: normaliza PRD/HML/DEV (D-038)', () => {
  assert.equal(toEnvironment('PRD'), 'PRD');
  assert.equal(toEnvironment('prd'), 'PRD');
  assert.equal(toEnvironment(' hml '), 'HML');
  assert.equal(toEnvironment('Dev'), 'DEV');
});

test('toEnvironment: valor ausente ou desconhecido cai em DEV (D-038)', () => {
  assert.equal(toEnvironment(undefined), 'DEV');
  assert.equal(toEnvironment(''), 'DEV');
  assert.equal(toEnvironment('staging'), 'DEV');
});
