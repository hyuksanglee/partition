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

test('기타 사용은 줄 수 있는 범위에서 뺀다', async () => {
  const { otherUsage } = await import('../../src/core/allocation.mjs');
  const { startTracking } = await import('../../src/core/window.mjs');
  // 계정 46%: a(예산) 12, b(예산) 18, c(예산 없음) 4, 나머지 12는 적용 전·미귀속
  const win = { ...startTracking(9e9, 46), byProject: { a: 12, b: 18, c: 4 } };
  const budgets2 = { a: { fiveHour: 40 }, b: { fiveHour: 30 } };
  assert.equal(otherUsage(budgets2, 'fiveHour', win), 16);
  assert.equal(otherUsage(budgets2, 'fiveHour', win, 'c'), 12, 'c에 예산을 주면 c의 사용은 c 몫');
  assert.equal(otherUsage(budgets2, 'fiveHour', undefined), 0, '지난 창은 0');
  assert.deepEqual(allowedRange(budgets2, 'fiveHour', 'b', 16), { min: 0, max: 44 }, '100 − a 40 − 기타 16');
  assert.deepEqual(allowedRange(budgets2, 'fiveHour', 'c', 12), { min: 0, max: 18 }, '100 − 70 − 12');
  assert.equal(validateBudget(budgets2, 'fiveHour', 'c', 19, 12), 'over_allocated');
});

test('이미 정한 예산은 기타 사용이 늘어도 그대로 둘 수 있다', () => {
  const b = { a: { fiveHour: 60 }, b: { fiveHour: 30 } };
  assert.deepEqual(allowedRange(b, 'fiveHour', 'a', 20), { min: 0, max: 60 });
  assert.equal(validateBudget(b, 'fiveHour', 'a', 60, 20), null);
  assert.equal(validateBudget(b, 'fiveHour', 'a', 61, 20), 'over_allocated');
});
