import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { useTempHome } from '../helpers.mjs';
import { defaultConfig } from '../../src/store/config.mjs';
import { readNewUsage, readingsFrom } from '../../src/codex/transcript.mjs';
import { entry, limits, NOW } from './helpers.mjs';

const root = useTempHome();
const weights = defaultConfig().weights;

test('window duration maps windows; unrelated buckets and invalid readings are ignored', () => {
  assert.ok(readingsFrom(limits(12)).fiveHour);
  assert.ok(readingsFrom(limits(12, 10080)).sevenDay);
  assert.deepEqual(readingsFrom(limits(12, 60)), {});
  assert.deepEqual(readingsFrom({ ...limits(12), limit_id: 'review' }), {});
  assert.deepEqual(readingsFrom(limits(101)), {});
  assert.deepEqual(readingsFrom(null), {});
});

test('baseline, cache inclusion, reasoning inclusion, and repeated notifications', () => {
  const file = join(root, 'tokens.jsonl');
  writeFileSync(file, entry(NOW, 100, 10, 80));
  const first = readNewUsage(file, undefined, weights, NOW);
  assert.equal(first.events[0].weight, 0);
  appendFileSync(file, entry(NOW + 1000, 200, 11, 160).repeat(2));
  const second = readNewUsage(file, first.cursor, weights, NOW + 1000);
  // 100 extra input = 20 uncached + 80 cached; 10 output, including reasoning.
  assert.equal(second.events.reduce((a, e) => a + e.weight, 0), 20 + 80 * 0.1 + 10 * 5);
  assert.equal(readNewUsage(file, second.cursor, weights, NOW + 1000).events.length, 0);
});

test('partial JSONL waits for newline and missing files fail open', () => {
  const file = join(root, 'partial.jsonl');
  writeFileSync(file, '');
  let r = readNewUsage(file, undefined, weights, NOW);
  const line = entry(NOW + 1000, 100, 12);
  appendFileSync(file, line.slice(0, -1));
  r = readNewUsage(file, r.cursor, weights, NOW + 1000);
  assert.equal(r.cursor.offset, 0);
  assert.equal(r.events.length, 0);
  appendFileSync(file, '\n');
  r = readNewUsage(file, r.cursor, weights, NOW + 1000);
  assert.equal(r.events.length, 1);
  assert.equal(r.events[0].weight, 150);
  assert.equal(readNewUsage(join(root, 'missing'), undefined, weights, NOW).readable, false);
});

test('truncation and cumulative counter reset establish new baselines', () => {
  const file = join(root, 'reset.jsonl');
  writeFileSync(file, entry(NOW, 999999, 10));
  let r = readNewUsage(file, undefined, weights, NOW);
  writeFileSync(file, entry(NOW + 1000, 10, 11));
  r = readNewUsage(file, r.cursor, weights, NOW + 1000);
  assert.equal(r.events[0].weight, 0);
  appendFileSync(file, entry(NOW + 2000, 5, 12));
  r = readNewUsage(file, r.cursor, weights, NOW + 2000);
  assert.equal(r.events[0].weight, 0);
});

test('malformed and future usage cannot poison state', () => {
  const file = join(root, 'invalid.jsonl');
  writeFileSync(file, '{"token_count":oops}\n' + entry(NOW + 120000, 100, 10));
  assert.equal(readNewUsage(file, undefined, weights, NOW).events.length, 0);
});

test('empty usage info does not reset counters; unrelated buckets add no pending weight', () => {
  const file = join(root, 'buckets.jsonl');
  writeFileSync(file, entry(NOW, 100, 10));
  let r = readNewUsage(file, undefined, weights, NOW);
  const broken = JSON.parse(entry(NOW + 1000, 200, 11));
  broken.payload.info.total_token_usage = {};
  appendFileSync(file, JSON.stringify(broken) + '\n' + entry(NOW + 2000, 200, 11));
  r = readNewUsage(file, r.cursor, weights, NOW + 2000);
  assert.equal(r.events.reduce((a, e) => a + e.weight, 0), 150);
  const other = JSON.parse(entry(NOW + 3000, 300, 12));
  other.payload.rate_limits.limit_id = 'review';
  appendFileSync(file, JSON.stringify(other) + '\n');
  r = readNewUsage(file, r.cursor, weights, NOW + 3000);
  assert.equal(r.events[0].weight, 0);
  assert.deepEqual(r.events[0].readings, {});
});
