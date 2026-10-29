import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stageFor, worstStage } from '../../src/core/stages.mjs';

const rules = { warnAt: 0.8, wrapMarginPp: 3, block: true };

test('예산이 없으면 항상 ok', () => {
  assert.equal(stageFor(99, undefined, rules), 'ok');
});

test('경고 → 마무리 → 차단 순서', () => {
  assert.equal(stageFor(23.9, 30, rules), 'ok');
  assert.equal(stageFor(24, 30, rules), 'warn');
  assert.equal(stageFor(27, 30, rules), 'wrap');
  assert.equal(stageFor(30, 30, rules), 'block');
});

test('차단을 끄면 예산을 넘어도 마무리 지시만', () => {
  assert.equal(stageFor(35, 30, { ...rules, block: false }), 'wrap');
});

test('예산 0이면 바로 차단', () => {
  assert.equal(stageFor(0, 0, rules), 'block');
});

test('가장 심한 단계를 고른다', () => {
  assert.equal(worstStage(['ok', 'wrap', 'warn']), 'wrap');
  assert.equal(worstStage([]), 'ok');
});
