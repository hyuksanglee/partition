import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { useTempHome } from '../helpers.mjs';
import { handle, parseCommand, isOwnTool } from '../../src/claude/hook.mjs';
import { updateConfig } from '../../src/store/config.mjs';
import { updateState } from '../../src/store/state.mjs';
import { startTracking } from '../../src/core/window.mjs';
import { CLI_PATH } from '../../src/root.mjs';

const root = useTempHome();
const proj = join(root, 'A');
mkdirSync(join(proj, '.git'), { recursive: true });
const nowSec = 1_000_000;

/** @param {number} used */
function setUsed(used) {
  updateState((s) => ({
    ...s,
    windows: { fiveHour: { ...startTracking(nowSec + 3600, 50), byProject: { [proj]: used } } },
  }));
}
const prompt = (/** @type {string} */ p) => handle({ hook_event_name: 'UserPromptSubmit', cwd: proj, prompt: p }, nowSec);

updateConfig((c) => ({ ...c, language: 'en', budgets: { [proj]: { fiveHour: 30 } } }));

test('명령 해석', () => {
  assert.deepEqual(parseCommand('/partition:budget 30 --week'), { name: 'budget', args: ['30', '--week'] });
  assert.deepEqual(parseCommand('  /partition:status'), { name: 'status', args: [] });
  assert.equal(parseCommand('hello /partition:status'), null);
});

test('예산 안이면 통과', () => {
  setUsed(10);
  assert.equal(prompt('hi'), null);
});

test('80%에서 한 번만 경고', () => {
  setUsed(24);
  assert.match(/** @type {any} */ (prompt('hi')).systemMessage, /24 of its 30pp/);
  assert.equal(prompt('hi'), null);
});

test('3%p 앞에서 마무리 지시', () => {
  setUsed(27.5);
  const out = /** @type {any} */ (prompt('hi'));
  assert.match(out.hookSpecificOutput.additionalContext, /2.5pp left/);
});

test('예산 도달 시 요청·도구 차단, Partition 명령은 통과', () => {
  setUsed(30);
  assert.equal(/** @type {any} */ (prompt('hi')).decision, 'block');
  const tool = /** @type {any} */ (handle({ hook_event_name: 'PreToolUse', cwd: proj, tool_name: 'Bash', tool_input: { command: 'ls' } }, nowSec));
  assert.equal(tool.hookSpecificOutput.permissionDecision, 'deny');
  assert.equal(prompt('/partition:setup'), null);
  assert.equal(isOwnTool({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `node "${CLI_PATH}" setup --plan` } }), true);
  assert.equal(handle({ hook_event_name: 'PreToolUse', cwd: proj, tool_name: 'Skill', tool_input: { skill: 'partition:setup' } }, nowSec), null);
});

test('창이 지났으면 막지 않는다', () => {
  setUsed(99);
  assert.equal(handle({ hook_event_name: 'UserPromptSubmit', cwd: proj, prompt: 'hi' }, nowSec + 7200), null);
});

test('/partition:budget은 hook이 처리하고 block(토큰 0)', () => {
  const out = /** @type {any} */ (prompt('/partition:budget 40'));
  assert.equal(out.decision, 'block');
  assert.match(out.reason, /to 40pp/);
  assert.match(/** @type {any} */ (prompt('/partition:budget 200')).reason, /0 to 100/);
});
