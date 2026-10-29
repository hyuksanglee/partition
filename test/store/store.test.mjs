import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, utimesSync, existsSync } from 'node:fs';
import { useTempHome } from '../helpers.mjs';
import { paths } from '../../src/store/paths.mjs';
import { withLock, LockTimeout, readJson } from '../../src/store/file.mjs';
import { loadConfig, updateConfig } from '../../src/store/config.mjs';
import { loadState, updateState } from '../../src/store/state.mjs';

useTempHome();

test('config: 파일이 없으면 기본값', () => {
  const c = loadConfig();
  assert.deepEqual(c.rules, { warnAt: 0.8, wrapMarginPp: 3, block: true });
  assert.deepEqual(c.budgets, {});
});

test('config: 일부만 있어도 나머지는 기본값으로 채운다', () => {
  updateConfig((c) => ({ ...c, rules: { ...c.rules, block: false } }));
  const c = loadConfig();
  assert.equal(c.rules.block, false);
  assert.equal(c.rules.warnAt, 0.8);
  assert.equal(c.weights.output, 5);
});

test('state: 쓰고 다시 읽는다', () => {
  updateState((s) => ({ ...s, lastStatusLineAt: 123 }));
  assert.equal(loadState().lastStatusLineAt, 123);
  assert.ok(readFileSync(paths.state, 'utf8').endsWith('\n'));
});

test('깨진 파일은 기본값으로 읽는다', () => {
  writeFileSync(paths.state, '{not json');
  assert.deepEqual(loadState().windows, {});
  assert.equal(readJson(paths.state, 'x'), 'x');
});

test('잠금: 이미 잡혀 있으면 기다리다 시간 초과', () => {
  mkdirSync(paths.home, { recursive: true });
  writeFileSync(paths.lock, '');
  assert.throws(() => withLock(paths.lock, () => 1, { timeoutMs: 100 }), LockTimeout);
});

test('잠금: 오래된 잠금은 치우고 진행', () => {
  writeFileSync(paths.lock, '');
  const old = (Date.now() - 60_000) / 1000;
  utimesSync(paths.lock, old, old);
  assert.equal(withLock(paths.lock, () => 42, { timeoutMs: 500 }), 42);
  assert.equal(existsSync(paths.lock), false);
});
