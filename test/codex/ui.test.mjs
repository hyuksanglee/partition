import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { useTempHome } from '../helpers.mjs';
import { snapshot } from '../../src/ui/server.mjs';
import { updateConfig, loadConfig } from '../../src/store/config.mjs';
import { updateState } from '../../src/store/state.mjs';
import { applySetup } from '../../src/codex/settings.mjs';
import { CLI_PATH } from '../../src/root.mjs';
import { nativeFixture } from '../ui/native-fixture.mjs';

const root = useTempHome();
const project = join(root, 'A');

test('Codex UI reflects separate budgets and distinguishes registration from execution', () => {
  updateConfig((c) => ({ ...c, budgets: { [project]: { fiveHour: 60 } } }));
  process.env.PARTITION_PROVIDER = 'codex';
  updateConfig((c) => ({ ...c, budgets: { [project]: { fiveHour: 30 } } }));
  let s = snapshot(project);
  assert.equal(s.provider, 'codex');
  assert.equal(s.projects[0].budgets.fiveHour, 30);
  assert.equal(s.connection.observed, false);
  assert.equal(s.connection.connected, false);
  assert.match(s.connection.setupPlan, /hooks.json/);
  assert.match(s.configPath, /codex\/config.json$/);
  applySetup();
  s = snapshot(project);
  assert.equal(s.connection.connected, true);
  assert.equal(s.connection.observed, false);
  updateState((state) => ({ ...state, lastCodexHookAt: Date.now(), codexHookSource: 'plugin' }));
  s = snapshot(project);
  assert.equal(s.connection.observed, true);
  assert.equal(s.connection.pluginManaged, true);
  assert.match(s.connection.uninstallPlan, /Disable or uninstall that plugin/);
  process.env.PARTITION_PROVIDER = 'claude';
  assert.equal(loadConfig().budgets[project].fiveHour, 60);
});

test('CLI selects provider before writes and refuses invalid/missing provider options', () => {
  const run = (/** @type {string[]} */ args) => spawnSync(process.execPath, [CLI_PATH, ...args], { env: { ...process.env, PARTITION_PROVIDER: 'claude' }, encoding: 'utf8' });
  assert.equal(run(['--provider', 'codex', 'budget', '20', '--project', project]).status, 0);
  process.env.PARTITION_PROVIDER = 'codex';
  assert.equal(loadConfig().budgets[project].fiveHour, 20);
  process.env.PARTITION_PROVIDER = 'claude';
  assert.equal(loadConfig().budgets[project].fiveHour, 60);
  assert.equal(run(['--provider', 'other', 'budget', '90']).status, 1);
  assert.equal(run(['budget', '90', '--provider']).status, 1);
});

test('native window startup failures are reported instead of returning a success URL', { skip: process.platform !== 'darwin' }, () => {
  const bin = nativeFixture(root, 'exit');
  const child = spawnSync(process.execPath, [CLI_PATH, '--provider', 'codex', 'ui', '--detach', '--json', '--project', project], {
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` }, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(child.status, 1);
  assert.equal(child.stdout, '');
  assert.match(child.stderr, /exited before returning its address/);
});

test('a window still identifying as osascript cannot report startup success', { skip: process.platform !== 'darwin' }, () => {
  const bin = nativeFixture(root, 'wrong-name');
  const child = spawnSync(process.execPath, [CLI_PATH, '--provider', 'codex', 'ui', '--detach', '--json', '--project', project], {
    env: { ...process.env, PARTITION_HOME: join(root, 'wrong-identity'), PATH: `${bin}:${process.env.PATH}` }, encoding: 'utf8', timeout: 10000,
  });
  assert.equal(child.status, 1);
  assert.equal(child.stdout, '');
});
