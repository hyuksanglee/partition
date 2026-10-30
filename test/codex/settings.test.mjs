import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { useTempHome } from '../helpers.mjs';
import { paths, codexHooksPath } from '../../src/store/paths.mjs';
import { loadConfig, updateConfig } from '../../src/store/config.mjs';
import { loadInstall } from '../../src/store/state.mjs';
import { readJson, writeJsonAtomic } from '../../src/store/file.mjs';
import { planSetup, applySetup, planUninstall, applyUninstall, isConnected, EVENTS, hookCommand } from '../../src/codex/settings.mjs';

useTempHome();
process.env.PARTITION_PROVIDER = 'codex';

test('preview is read-only; setup is idempotent and preserves unrelated hooks', () => {
  const other = { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo other' }] };
  const before = { description: 'My hooks', hooks: { PreToolUse: [other] } };
  writeJsonAtomic(codexHooksPath(), before);
  const plan = planSetup();
  assert.deepEqual(readJson(codexHooksPath(), {}), before);
  assert.equal(plan.alreadyInstalled, false);
  assert.equal(plan.after.hooks.PreToolUse.length, 2);
  applySetup();
  assert.equal(isConnected(), true);
  assert.equal(planSetup().alreadyInstalled, true);
  const saved = readFileSync(codexHooksPath(), 'utf8');
  applySetup();
  assert.equal(readFileSync(codexHooksPath(), 'utf8'), saved);
  assert.deepEqual(/** @type {any} */ (readJson(codexHooksPath(), {})).hooks.PreToolUse[0], other);
  assert.equal(loadInstall().hookCommands?.[0], hookCommand());
  for (const event of EVENTS) assert.ok(plan.after.hooks[event]);
});

test('uninstall removes only its handlers, including shared groups edited after setup', () => {
  const data = /** @type {any} */ (readJson(codexHooksPath(), {}));
  data.hooks.Stop[0].hooks.push({ type: 'command', command: 'echo new-hook' });
  writeJsonAtomic(codexHooksPath(), data);
  const plan = planUninstall();
  assert.ok(plan.changes);
  assert.equal(isConnected(), true);
  applyUninstall();
  const after = /** @type {any} */ (readJson(codexHooksPath(), {}));
  assert.equal(after.description, 'My hooks');
  assert.equal(after.hooks.PreToolUse[0].hooks[0].command, 'echo other');
  assert.equal(after.hooks.Stop[0].hooks[0].command, 'echo new-hook');
  assert.equal(isConnected(), false);
  assert.equal(planUninstall().changes, false);
});

test('malformed settings are refused without overwriting', () => {
  mkdirSync(dirname(codexHooksPath()), { recursive: true });
  writeFileSync(codexHooksPath(), '{broken');
  assert.throws(() => applySetup());
  assert.equal(readFileSync(codexHooksPath(), 'utf8'), '{broken');
  writeFileSync(codexHooksPath(), '{"hooks":{"Stop":{}}}');
  assert.throws(() => applySetup(), /Invalid hook groups/);
  writeJsonAtomic(codexHooksPath(), {});
});

test('Codex configuration does not mutate the existing Claude pool', () => {
  updateConfig((c) => ({ ...c, budgets: { '/A': { fiveHour: 30 } } }));
  const codexPath = paths.config;
  process.env.PARTITION_PROVIDER = 'claude';
  assert.notEqual(paths.config, codexPath);
  assert.deepEqual(loadConfig().budgets, {});
  updateConfig((c) => ({ ...c, budgets: { '/B': { fiveHour: 50 } } }));
  process.env.PARTITION_PROVIDER = 'codex';
  assert.deepEqual(loadConfig().budgets, { '/A': { fiveHour: 30 } });
});
