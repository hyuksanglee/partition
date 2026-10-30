// Codex desktop hook entry. Select the separate account pool before any I/O.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { loadConfig } from '../store/config.mjs';
import { loadState, updateState } from '../store/state.mjs';
import { findProject, projectName } from '../project.mjs';
import { fmtPp, fmtTime, resolveLang, t } from '../messages.mjs';
import { CLI_PATH } from '../root.mjs';
import { check } from '../commands/check.mjs';
import { status } from '../commands/status.mjs';
import { budgetCommand } from '../commands/budget.mjs';
import { settingsWindow } from '../commands/ui.mjs';
import { record } from './usage.mjs';

/**
 * @typedef {object} HookInput
 * @property {string} hook_event_name
 * @property {string} [session_id]
 * @property {string} [cwd]
 * @property {string} [prompt]
 * @property {string | null} [transcript_path]
 * @property {string} [tool_name]
 * @property {Record<string, unknown>} [tool_input]
 */

/** @param {string} prompt */
export function parseCommand(prompt) {
  const normalized = prompt.replace(/^\s*\$partition:/, '/partition:').replace(/^\s*\$partition(?:\s+|$)/, '/partition:');
  if (normalized === '/partition:') return { name: 'ui', args: [] };
  const m = /^\s*\/partition:(ui|status|budget|setup)(?:\s+([\s\S]*))?$/.exec(normalized);
  return m ? { name: m[1], args: (m[2] ?? '').trim().split(/\s+/).filter(Boolean) } : null;
}

/** @param {string} event @param {string} text */
const context = (event, text) => ({ hookSpecificOutput: { hookEventName: event, additionalContext: text } });

/** @param {HookInput} input */
export function isOwnTool(input) {
  const ti = input.tool_input;
  // Only the standalone Partition CLI can recover from a blocked budget.
  // A substring match would also exempt unrelated commands chained after it.
  if (!['Bash', 'exec_command'].includes(input.tool_name ?? '')) return false;
  const command = ti?.command ?? ti?.cmd;
  if (typeof command !== 'string') return false;
  const escaped = CLI_PATH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^\\s*(?:node|"[^"\\n]*/node"|'[^'\\n]*/node'|/[^\\s;|&]+/node)\\s+["']?${escaped}["']?\\s+(?:--provider\\s+codex\\s+)?(?:status|budget|ui|setup|uninstall|rules|help)(?:\\s+[^;&|\x60$<>\\n\\r]*)?\\s*$`).test(command);
}

/** @param {HookInput} input @param {number} [nowSec] @returns {object | null} */
export function handle(input, nowSec = Date.now() / 1000) {
  process.env.PARTITION_PROVIDER = 'codex';
  const project = findProject(input.cwd || process.cwd());
  const event = input.hook_event_name;
  updateState((s) => ({ ...s, lastCodexEvent: { event, sessionId: input.session_id ?? null, at: nowSec * 1000 } }));
  const config = loadConfig();
  const lang = resolveLang(config.language);
  let readable = false;
  if (input.transcript_path) readable = record(input.transcript_path, project, nowSec * 1000).readable;

  if (event === 'Stop') return {}; // Stop requires JSON and must never continue the turn.
  if (event === 'SessionStart') {
    return context(event, [
      'Partition tracks Codex subscription usage separately from Claude.',
      `Manage budgets with: node "${CLI_PATH}" --provider codex ui --detach`,
      'The user can also enter /partition:ui, /partition:status, or /partition:budget <pp>.',
      'If a Partition hook has already run a command, show its result without running it again.',
    ].join('\n'));
  }

  if (event === 'UserPromptSubmit') {
    const cmd = parseCommand(input.prompt ?? '');
    if (cmd) {
      if (cmd.name === 'ui') {
        let opened;
        try { opened = settingsWindow(project); }
        catch {
          return context(event, `Partition could not open its settings window. Tell the user that opening failed. Diagnose with: node "${CLI_PATH}" --provider codex ui --detach --project "${project}". For a browser fallback, use ui --serve. Do not retry automatically.`);
        }
        return context(event, [
          'Partition already ran /partition:ui. Do not run the CLI again or open an app browser panel.',
          `Settings URL: ${opened.url}`,
          opened.mode === 'window'
            ? 'The separate Partition settings window confirmed it is ready. Tell the user in their language that the settings window opened.'
            : 'The settings URL was opened in the default browser. Tell the user that the browser was used on this system.',
        ].join('\n'));
      }
      if (cmd.name === 'setup') return context(event, `Partition hooks are running. No status line is needed for Codex. Open settings with: node "${CLI_PATH}" --provider codex ui --detach`);
      const text = cmd.name === 'status'
          ? status(project, { config, state: loadState(), lang, nowSec }).text
          : budgetCommand(project, cmd.args, lang).text;
      return context(event, `Partition already ran /partition:${cmd.name}. Do not run it again or use tools. Show only this result in a code block:\n\n${text}`);
    }
    // Let an explicitly invoked management skill run its CLI even at budget.
    if (/^\s*(?:\$partition(?::(?:ui|status|budget|setup|partition))?(?:\s|$)|\[\$partition(?::(?:ui|status|budget|setup|partition))?\]\()/.test(input.prompt ?? '')) return null;
  }

  if (!['UserPromptSubmit', 'PreToolUse', 'PostToolUse'].includes(event) || !readable) return null;
  if (event === 'PreToolUse' && isOwnTool(input)) return null;
  const result = check(project, config, loadState(), nowSec);
  const w = result.worst;
  if (!w || w.budget == null) return null;
  const vars = {
    project: projectName(project), window: t(lang, `window.${w.window}`),
    used: fmtPp(w.used), budget: w.budget, left: fmtPp(Math.max(0, w.budget - w.used)), reset: fmtTime(w.resetsAt),
  };
  if (result.stage === 'block') {
    const reason = t(lang, 'block', vars);
    if (event === 'UserPromptSubmit') return { decision: 'block', reason };
    if (event === 'PreToolUse') return { hookSpecificOutput: { hookEventName: event, permissionDecision: 'deny', permissionDecisionReason: reason } };
    // The tool already ran; ask the model to summarize without rejecting its result.
    return context(event, `${reason}\n${t(lang, 'wrap', vars)}`);
  }
  if (result.stage === 'wrap') return context(event, t(lang, 'wrap', vars));
  let first = false;
  updateState((s) => {
    const win = s.windows[w.window];
    if (!win || win.notified[project]) return s;
    first = true;
    return { ...s, windows: { ...s.windows, [w.window]: { ...win, notified: { ...win.notified, [project]: 'warn' } } } };
  });
  return first ? { systemMessage: t(lang, 'warn', vars), ...context(event, t(lang, 'warn', vars)) } : null;
}

export function main() {
  try {
    const input = JSON.parse(readFileSync(0, 'utf8'));
    const out = handle(input);
    if (out) process.stdout.write(JSON.stringify(out));
  } catch {
    // No malformed output, process failure, or hook recursion on errors.
    process.stdout.write('{}');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
