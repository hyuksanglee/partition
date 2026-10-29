import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyReading, addPending, isExpired } from '../../src/core/window.mjs';

test('처음 보면 지금까지 쓴 양을 추적 전 사용으로 둔다', () => {
  const w = applyReading(undefined, { usedPct: 12, resetsAt: 1000 });
  assert.equal(w.beforeTracking, 12);
  assert.equal(w.lastUsedPct, 12);
  assert.deepEqual(w.byProject, {});
});

test('오른 만큼 대기분 비중대로 배분하고 대기분을 비운다', () => {
  let w = applyReading(undefined, { usedPct: 10, resetsAt: 1000 });
  w = addPending(w, { a: 30, b: 10 });
  w = applyReading(w, { usedPct: 14, resetsAt: 1000 });
  assert.deepEqual(w.byProject, { a: 3, b: 1 });
  assert.deepEqual(w.pending, {});
  assert.equal(w.lastUsedPct, 14);
});

test('사용률이 그대로면 대기분을 남긴다', () => {
  let w = applyReading(undefined, { usedPct: 10, resetsAt: 1000 });
  w = addPending(w, { a: 30 });
  w = applyReading(w, { usedPct: 10, resetsAt: 1000 });
  assert.deepEqual(w.pending, { a: 30 });
});

test('대기분 없이 오르면 미귀속', () => {
  let w = applyReading(undefined, { usedPct: 10, resetsAt: 1000 });
  w = applyReading(w, { usedPct: 12, resetsAt: 1000 });
  assert.equal(w.unattributed, 2);
});

test('리셋되면 0부터 다시 세고 대기분은 새 창 몫이 된다', () => {
  let w = applyReading(undefined, { usedPct: 80, resetsAt: 1000 });
  w = addPending(w, { a: 50 });
  w = applyReading(w, { usedPct: 3, resetsAt: 1000 + 5 * 3600 });
  assert.deepEqual(w.byProject, { a: 3 });
  assert.equal(w.beforeTracking, 0);
  assert.equal(w.resetsAt, 1000 + 5 * 3600);
});

test('resets_at가 조금 흔들리는 건 리셋이 아니다', () => {
  let w = applyReading(undefined, { usedPct: 10, resetsAt: 1000 });
  w = applyReading(w, { usedPct: 11, resetsAt: 1030 });
  assert.equal(w.unattributed, 1);
  assert.equal(w.beforeTracking, 10);
});

test('리셋 시각이 지난 창은 만료', () => {
  const w = applyReading(undefined, { usedPct: 10, resetsAt: 1000 });
  assert.equal(isExpired(w, 999), false);
  assert.equal(isExpired(w, 1000), true);
  assert.equal(isExpired(undefined, 0), true);
});
