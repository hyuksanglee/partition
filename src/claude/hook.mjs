// hook 진입점: SessionStart · UserPromptSubmit · PreToolUse.
// 오류가 나면 아무것도 출력하지 않고 통과시킨다(fail-open).
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { loadConfig } from '../store/config.mjs';
import { loadState, updateInstall, updateState } from '../store/state.mjs';
import { findProject, projectName } from '../project.mjs';
import { fmtPp, fmtTime, resolveLang, t } from '../messages.mjs';
import { CLI_PATH, PLUGIN_ROOT } from '../root.mjs';
import { check } from '../commands/check.mjs';
import { status } from '../commands/status.mjs';
import { budgetCommand } from '../commands/budget.mjs';
import { openUiDetached } from '../commands/ui.mjs';
import { isConnected } from './settings.mjs';

/**
 * @typedef {object} HookInput
 * @property {string} hook_event_name
 * @property {string} [cwd]
 * @property {string} [prompt]
 * @property {string} [tool_name]
 * @property {Record<string, unknown>} [tool_input]
 */

/** hook이 가로채서 토큰 0으로 처리하는 명령. setup은 승인이 필요해서 skill로 간다. */
const INTERCEPTED = new Set(['ui', 'status', 'budget']);

/**
 * @param {string} prompt
 * @returns {{ name: string, args: string[] } | null}
 */
export function parseCommand(prompt) {
  const m = /^\s*\/partition:([\w-]+)(?:\s+([\s\S]*))?$/.exec(prompt);
  if (!m) return null;
  return { name: m[1], args: (m[2] ?? '').trim().split(/\s+/).filter(Boolean) };
}

/**
 * @param {string} name
 * @param {string[]} args
 * @param {string} project
 * @param {import('../messages.mjs').Lang} lang
 */
function runCommand(name, args, project, lang) {
  if (name === 'ui') {
    openUiDetached(project);
    return t(lang, 'ui.opening');
  }
  if (name === 'status') {
    return status(project, { config: loadConfig(), state: loadState(), lang, nowSec: Date.now() / 1000 }).text;
  }
  return budgetCommand(project, args, lang).text;
}

/**
 * @param {HookInput} input
 * @param {number} nowSec
 * @returns {object | null} hook 출력 JSON. null이면 출력 없이 통과
 */
export function handle(input, nowSec = Date.now() / 1000) {
  const project = findProject(input.cwd || process.cwd());
  const config = loadConfig();
  const lang = resolveLang(config.language);

  if (input.hook_event_name === 'SessionStart') {
    updateInstall((i) => ({ ...i, pluginRoot: PLUGIN_ROOT }));
    return isConnected() ? null : { systemMessage: t(lang, 'setup.needed') };
  }

  if (input.hook_event_name === 'UserPromptSubmit') {
    const cmd = parseCommand(input.prompt ?? '');
    if (cmd && INTERCEPTED.has(cmd.name)) {
      return { decision: 'block', reason: runCommand(cmd.name, cmd.args, project, lang) };
    }
    // Partition 자신의 명령(setup 등)은 절대 막지 않는다.
    if (cmd) return null;

    const result = check(project, config, loadState(), nowSec);
    const w = result.worst;
    if (!w || w.budget == null) return null;
    const vars = {
      project: projectName(project),
      window: t(lang, `window.${w.window}`),
      used: fmtPp(w.used),
      budget: w.budget,
      left: fmtPp(Math.max(0, w.budget - w.used)),
      reset: fmtTime(w.resetsAt),
    };
    if (result.stage === 'block') return { decision: 'block', reason: t(lang, 'block', vars) };
    if (result.stage === 'wrap') {
      return { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: t(lang, 'wrap', vars) } };
    }
    // warn: 창마다 한 번만 알린다.
    let first = false;
    updateState((s) => {
      const win = s.windows[w.window];
      if (!win || win.notified[project]) return s;
      first = true;
      return { ...s, windows: { ...s.windows, [w.window]: { ...win, notified: { ...win.notified, [project]: 'warn' } } } };
    });
    return first ? { systemMessage: t(lang, 'warn', vars) } : null;
  }

  if (input.hook_event_name === 'PreToolUse') {
    if (check(project, config, loadState(), nowSec).stage !== 'block') return null;
    if (isOwnTool(input)) return null;
    return {
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: t(lang, 'block.tool') },
    };
  }
  return null;
}

/**
 * Partition 자신의 skill·CLI 실행은 차단 중에도 허용한다.
 * @param {HookInput} input
 */
export function isOwnTool(input) {
  const ti = input.tool_input ?? {};
  if (input.tool_name === 'Skill' && typeof ti.skill === 'string') return ti.skill.startsWith('partition:');
  if (input.tool_name === 'Bash' && typeof ti.command === 'string') return ti.command.includes(CLI_PATH);
  return false;
}

export function main() {
  try {
    const input = JSON.parse(readFileSync(0, 'utf8'));
    const out = handle(input);
    if (out) process.stdout.write(JSON.stringify(out));
  } catch {
    // fail-open
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
