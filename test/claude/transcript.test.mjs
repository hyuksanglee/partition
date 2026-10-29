import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { useTempHome } from '../helpers.mjs';
import { readNewUsage, weighUsage } from '../../src/claude/transcript.mjs';

const root = useTempHome();
const weights = { input: 1, cacheWrite: 1.25, cacheRead: 0.1, output: 5 };
const now = Date.parse('2026-10-29T05:00:00Z');

/** @param {string} id @param {number} output @param {number} [ageMin] */
const line = (id, output, ageMin = 1) =>
  JSON.stringify({
    type: 'assistant',
    timestamp: new Date(now - ageMin * 60_000).toISOString(),
    message: { id, usage: { input_tokens: 10, cache_read_input_tokens: 100, output_tokens: output } },
  }) + '\n';

test('가중치: 입력 1, 캐시 읽기 0.1, 출력 5', () => {
  assert.equal(weighUsage({ input_tokens: 10, cache_read_input_tokens: 100, output_tokens: 2 }, weights), 10 + 10 + 10);
});

test('처음 보는 파일은 최근 10분만 센다', () => {
  const f = join(root, 'a.jsonl');
  writeFileSync(f, line('old', 2, 30) + line('new', 2, 1));
  const r = readNewUsage(f, undefined, weights, now);
  assert.equal(r.weight, 30);
});

test('같은 message id는 한 번만, 이어서 읽으면 새 줄만', () => {
  const f = join(root, 'b.jsonl');
  writeFileSync(f, line('m1', 2) + line('m1', 2));
  let r = readNewUsage(f, undefined, weights, now);
  assert.equal(r.weight, 30);
  appendFileSync(f, line('m1', 2) + line('m2', 4));
  r = readNewUsage(f, r.cursor, weights, now);
  assert.equal(r.weight, 10 + 10 + 20);
});

test('쓰는 중인 마지막 줄은 다음에 센다', () => {
  const f = join(root, 'c.jsonl');
  const full = line('m1', 2);
  writeFileSync(f, full.slice(0, 20));
  let r = readNewUsage(f, undefined, weights, now);
  assert.equal(r.weight, 0);
  assert.equal(r.cursor.offset, 0);
  writeFileSync(f, full);
  r = readNewUsage(f, r.cursor, weights, now);
  assert.equal(r.weight, 30);
});

test('파일이 없으면 0', () => {
  assert.equal(readNewUsage(join(root, 'none.jsonl'), undefined, weights, now).weight, 0);
});
