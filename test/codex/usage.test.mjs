import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { useTempHome } from '../helpers.mjs';
import { loadState } from '../../src/store/state.mjs';
import { record } from '../../src/codex/usage.mjs';
import { start, append, NOW } from './helpers.mjs';

const root = useTempHome();
process.env.PARTITION_PROVIDER = 'codex';

test('concurrent sessions split growth, deduplicate, and ignore stale account readings', () => {
  const a = join(root, 'a.jsonl');
  const b = join(root, 'b.jsonl');
  start(a); start(b);
  record(a, '/A', NOW); record(b, '/B', NOW);
  append(a, 200, 10, NOW + 1000);
  append(b, 400, 14, NOW + 2000);
  let state = record(b, '/B', NOW + 2000).state;
  assert.equal(state.windows.fiveHour?.byProject['/A'], 1);
  assert.equal(state.windows.fiveHour?.byProject['/B'], 3);
  assert.equal(state.windows.fiveHour?.beforeTracking, 10);
  state = record(a, '/A', NOW + 2000).state;
  assert.equal(state.windows.fiveHour?.byProject['/A'], 1);
  append(a, 300, 9, NOW + 500); // older parallel response, not an account reset
  state = record(a, '/A', NOW + 3000).state;
  assert.equal(state.windows.fiveHour?.lastUsedPct, 14);
  assert.equal(state.windows.fiveHour?.byProject['/A'], 1);
});

test('provider pools cannot mix state', () => {
  assert.ok(loadState().windows.fiveHour);
  process.env.PARTITION_PROVIDER = 'claude';
  assert.deepEqual(loadState().windows, {});
  process.env.PARTITION_PROVIDER = 'codex';
  assert.ok(loadState().windows.fiveHour);
});
