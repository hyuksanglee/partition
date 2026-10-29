import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attribute } from '../../src/core/attribute.mjs';

test('대기분 토큰 비중대로 나눈다', () => {
  const r = attribute(4, { a: 300, b: 100 });
  assert.deepEqual(r, { byProject: { a: 3, b: 1 }, unattributed: 0 });
});

test('대기분이 없으면 미귀속', () => {
  assert.deepEqual(attribute(2, {}), { byProject: {}, unattributed: 2 });
});

test('오르지 않았으면 아무것도 안 나눈다', () => {
  assert.deepEqual(attribute(0, { a: 1 }), { byProject: {}, unattributed: 0 });
  assert.deepEqual(attribute(-1, { a: 1 }), { byProject: {}, unattributed: 0 });
});
