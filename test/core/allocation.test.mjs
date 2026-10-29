import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedRange, validateBudget, setBudget, totalAllocated } from '../../src/core/allocation.mjs';

const budgets = { a: { fiveHour: 30 }, b: { fiveHour: 50, sevenDay: 20 } };

test('설정 가능 범위 = 100 − 다른 프로젝트 할당', () => {
  assert.deepEqual(allowedRange(budgets, 'fiveHour', 'a'), { min: 0, max: 50 });
  assert.deepEqual(allowedRange(budgets, 'fiveHour', 'new'), { min: 0, max: 20 });
  assert.equal(totalAllocated(budgets, 'sevenDay'), 20);
});

test('범위를 넘으면 오류', () => {
  assert.equal(validateBudget(budgets, 'fiveHour', 'a', 50), null);
  assert.equal(validateBudget(budgets, 'fiveHour', 'a', 51), 'over_allocated');
  assert.equal(validateBudget(budgets, 'fiveHour', 'a', -1), 'out_of_range');
  assert.equal(validateBudget(budgets, 'fiveHour', 'a', NaN), 'out_of_range');
});

test('할당 해제하면 빈 프로젝트는 지운다', () => {
  const next = setBudget(budgets, 'fiveHour', 'a', null);
  assert.equal('a' in next, false);
  assert.deepEqual(budgets.a, { fiveHour: 30 }, '원본은 그대로');
});
