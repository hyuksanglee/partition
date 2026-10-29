import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { useTempHome } from '../helpers.mjs';
import { applySetup, applyUninstall, isConnected, planSetup } from '../../src/claude/settings.mjs';
import { claudeSettingsPath, paths } from '../../src/store/paths.mjs';
import { loadInstall } from '../../src/store/state.mjs';

useTempHome();
const original = { type: 'command', command: 'echo mine', padding: 1 };
const read = () => JSON.parse(readFileSync(claudeSettingsPath(), 'utf8'));

test('setup: 계획만 세우면 파일은 그대로', () => {
  mkdirSync(process.env.CLAUDE_CONFIG_DIR ?? '', { recursive: true });
  writeFileSync(claudeSettingsPath(), JSON.stringify({ theme: 'dark', statusLine: original }));
  const p = planSetup();
  assert.deepEqual(p.before, original);
  assert.equal(p.after.padding, 1);
  assert.deepEqual(read().statusLine, original);
});

test('setup 적용: 다른 설정은 유지, 원래 status line은 저장', () => {
  applySetup('/plugin/root');
  assert.equal(read().theme, 'dark');
  assert.ok(isConnected());
  assert.ok(existsSync(paths.launcher));
  assert.deepEqual(loadInstall().originalStatusLine, original);
  applySetup('/plugin/root'); // 두 번 해도 원래 값을 덮지 않는다
  assert.deepEqual(loadInstall().originalStatusLine, original);
});

test('uninstall: 원래대로', () => {
  applyUninstall();
  assert.deepEqual(read().statusLine, original);
  assert.equal(existsSync(paths.launcher), false);
  assert.equal(isConnected(), false);
});
