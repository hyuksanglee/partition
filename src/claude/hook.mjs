// hook 진입점: SessionStart · UserPromptSubmit · PreToolUse · Stop.
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
import { record } from './statusline.mjs';
import { FETCHING_ENV, fetchUsage } from './usage.mjs';

/**
 * @typedef {object} HookInput
 * @property {string} hook_event_name
 * @property {string} [cwd]
 * @property {string} [prompt]
 * @property {string} [tool_name]
 * @property {Record<string, unknown>} [tool_input]
 * @property {string} [transcript_path]
 */

/** status line이나 /usage로 이만큼 안에 값을 받았으면 Stop hook은 다시 받지 않는다. */
export const USAGE_MIN_INTERVAL_MS = 60_000;

/**
 * hook이 먼저 실행하는 명령. 결과는 Claude에게 넘겨 그대로 보여주게 한다.
 * (block하면 토큰 0이지만 Claude Code가 "차단했습니다" 문구를 붙여서, 짧은 응답 하나를 쓰는 쪽을 골랐다.)
 * setup은 승인이 필요해서 skill로 간다.
 */
const HANDLED = new Set(['ui', 'status', 'budget']);

/**
 * @param {string} name
 * @param {string} result
 */
export function commandContext(name, result) {
  return [
    `Partition already ran /partition:${name} for the user. Do not run it again and do not use any tools.`,
    'Reply with only the result below, unchanged, inside a code block:',
    '',
    result,
  ].join('\n');
}

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
 * @param {{ fetchUsage?: typeof fetchUsage }} [deps] 테스트용
 * @returns {object | null} hook 출력 JSON. null이면 출력 없이 통과
 */
export function handle(input, nowSec = Date.now() / 1000, deps = {}) {
  if (input.hook_event_name === 'Stop') {
    recordUsageAfterResponse(input, nowSec * 1000, deps.fetchUsage ?? fetchUsage);
    return null;
  }

  const project = findProject(input.cwd || process.cwd());
  const config = loadConfig();
  const lang = resolveLang(config.language);

  if (input.hook_event_name === 'SessionStart') {
    updateInstall((i) => ({ ...i, pluginRoot: PLUGIN_ROOT }));
    return isConnected() ? null : { systemMessage: t(lang, 'setup.needed') };
  }

  if (input.hook_event_name === 'UserPromptSubmit') {
    const cmd = parseCommand(input.prompt ?? '');
    if (cmd && HANDLED.has(cmd.name)) {
      const result = runCommand(cmd.name, cmd.args, project, lang);
      return { hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: commandContext(cmd.name, result) } };
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
 * 응답이 끝난 뒤(Stop, 백그라운드) /usage로 사용률을 받아 기록한다.
 * status line을 실행하지 않는 데스크톱 앱 Code 탭을 위한 경로. 터미널에서는 status line이 이미 했으면 건너뛴다.
 * @param {HookInput} input
 * @param {number} nowMs
 * @param {typeof fetchUsage} fetch
 * @returns {boolean} 기록했는지
 */
export function recordUsageAfterResponse(input, nowMs, fetch) {
  // 다른 Stop hook이 받는 중이면 겹치지 않게, 받기 전에 시각부터 찍는다.
  let skip = false;
  updateState((s) => {
    const last = Math.max(s.lastStatusLineAt ?? 0, s.lastUsageFetchAt ?? 0);
    skip = nowMs - last < USAGE_MIN_INTERVAL_MS;
    return skip ? s : { ...s, lastUsageFetchAt: nowMs };
  });
  if (skip) return false;
  const rateLimits = fetch(nowMs);
  if (!rateLimits) return false;
  record({ cwd: input.cwd, transcript_path: input.transcript_path, rate_limits: rateLimits }, nowMs, 'usage');
  return true;
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
  // /usage를 받으려고 띄운 claude 안에서 다시 불린 hook이면 아무것도 하지 않는다.
  if (process.env[FETCHING_ENV]) return;
  try {
    const input = JSON.parse(readFileSync(0, 'utf8'));
    const out = handle(input);
    if (out) process.stdout.write(JSON.stringify(out));
  } catch {
    // fail-open
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
