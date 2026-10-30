import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { useTempHome } from '../helpers.mjs';
import { handle, isOwnTool, parseCommand } from '../../src/codex/hook.mjs';
import { loadState, updateState } from '../../src/store/state.mjs';
import { updateConfig } from '../../src/store/config.mjs';
import { startTracking } from '../../src/core/window.mjs';
import { CLI_PATH, PLUGIN_ROOT } from '../../src/root.mjs';
import { start, NOW } from './helpers.mjs';

const root = useTempHome();
process.env.PARTITION_PROVIDER = 'codex';
const project = join(root, 'A');
mkdirSync(join(project, '.git'), { recursive: true });
const file = join(root, 'rollout.jsonl');
start(file);
const now = NOW / 1000;
handle({ hook_event_name: 'SessionStart', cwd: project, transcript_path: file }, now);
updateConfig((c) => ({ ...c, language: 'en', budgets: { [project]: { fiveHour: 30 } } }));

/** @param {number} used */
function setUsed(used) {
  updateState((s) => ({ ...s, windows: { fiveHour: { ...startTracking(now + 3600, 50), byProject: { [project]: used } } } }));
}
/** @param {string} event @param {Record<string, any>} [extra] */
const run = (event, extra = {}) => /** @type {any} */ (handle({ hook_event_name: event, cwd: project, transcript_path: file, ...extra }, now));

test('warn once and wrap during an active turn', () => {
  setUsed(10); assert.equal(run('UserPromptSubmit', { prompt: 'hello' }), null);
  setUsed(24);
  assert.match(run('PreToolUse', { tool_name: 'Bash' }).systemMessage, /24 of its 30pp/);
  assert.equal(run('PreToolUse', { tool_name: 'Bash' }), null);
  setUsed(27);
  assert.match(run('PostToolUse').hookSpecificOutput.additionalContext, /Wrap up/);
});

test('blocks prompts, shell, patch, MCP, and other local tools using Codex protocol', () => {
  setUsed(30);
  assert.equal(run('UserPromptSubmit', { prompt: 'new work' }).decision, 'block');
  for (const tool_name of ['Bash', 'apply_patch', 'mcp__fs__read', 'exec_command']) {
    const out = run('PreToolUse', { tool_name, tool_input: { command: 'ls' } });
    assert.equal(out.hookSpecificOutput.permissionDecision, 'deny');
    assert.equal(out.continue, undefined);
  }
  assert.equal(run('PostToolUse').decision, undefined, 'cannot undo an already completed tool');
  assert.deepEqual(run('Stop'), {}, 'never creates a Stop continuation loop');
});

test('own commands remain available without allowing command chaining', () => {
  setUsed(99);
  assert.equal(run('UserPromptSubmit', { prompt: '/partition:status' }).decision, undefined);
  assert.equal(run('UserPromptSubmit', { prompt: '/partition:budget 40' }).decision, undefined);
  assert.deepEqual(parseCommand('$partition budget 40 --week'), { name: 'budget', args: ['40', '--week'] });
  assert.deepEqual(parseCommand('$partition'), { name: 'ui', args: [] });
  assert.deepEqual(parseCommand('$partition:ui'), { name: 'ui', args: [] });
  assert.equal(run('UserPromptSubmit', { prompt: '$partition:partition show my budget' }), null);
  assert.equal(run('UserPromptSubmit', { prompt: '$partition show my budget' }), null);
  const command = `node "${CLI_PATH}" --provider codex budget 50`;
  assert.equal(run('PreToolUse', { tool_name: 'Bash', tool_input: { command } }), null);
  for (const suffix of ['; echo escaped', ' && echo escaped', '\necho escaped', ' $(echo escaped)', ' | cat']) {
    assert.equal(isOwnTool({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: command + suffix } }), false);
  }
  assert.equal(isOwnTool({ hook_event_name: 'PreToolUse', tool_name: 'apply_patch', tool_input: { command } }), false);
});

test('missing transcript, expired window, and block-off fail open', () => {
  setUsed(99);
  assert.equal(handle({ hook_event_name: 'PreToolUse', cwd: project, transcript_path: join(root, 'missing') }, now), null);
  assert.equal(handle({ hook_event_name: 'UserPromptSubmit', cwd: project, transcript_path: file }, now + 7200), null);
  updateConfig((c) => ({ ...c, rules: { ...c.rules, block: false } }));
  const out = run('PreToolUse');
  assert.equal(out?.hookSpecificOutput.permissionDecision, undefined);
  assert.ok(loadState().lastCodexHookAt);
});

test('hook executable emits valid JSON on Stop and malformed input; never fails closed', () => {
  for (const input of ['not json', '{"hook_event_name":"Stop"}']) {
    const child = spawnSync(process.execPath, [join(PLUGIN_ROOT, 'src/codex/hook.mjs')], {
      input, encoding: 'utf8', env: process.env,
    });
    assert.equal(child.status, 0);
    assert.deepEqual(JSON.parse(child.stdout), {});
  }
  writeFileSync(file, '');
});
