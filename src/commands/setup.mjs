// setup/uninstall: settings.json 변경 내용을 먼저 보여주고(--plan), 승인 후 적용(--apply).
import { applySetup, applyUninstall, planSetup, planUninstall } from '../claude/settings.mjs';
import { CLI_PATH, PLUGIN_ROOT } from '../root.mjs';
import * as codex from '../codex/settings.mjs';
import { provider } from '../store/paths.mjs';
import { isConnected as claudeConnected } from '../claude/settings.mjs';

export function isConnected() {
  return provider() === 'codex' ? codex.isConnected() : claudeConnected();
}

/** @param {unknown} v */
const show = (v) => (v == null ? '(none)' : JSON.stringify(v));

export function setupPlanText() {
  if (provider() === 'codex') {
    const p = codex.planSetup();
    return [
      `File: ${p.settingsPath}`,
      `Before:\n${JSON.stringify(p.before, null, 2)}`,
      `After:\n${JSON.stringify(p.after, null, 2)}`,
      'Only Partition hooks are added; other hooks are preserved.',
      'After applying: review and trust these hooks in Codex (/hooks in the CLI), then start a new desktop chat.',
      'Registration alone does not mean the hooks are trusted or running.',
      `Undo: node "${CLI_PATH}" --provider codex uninstall --apply`,
    ].join('\n');
  }
  const p = planSetup();
  if (p.alreadyInstalled) return `Partition status line is already set in ${p.settingsPath}. Nothing to change.`;
  return [
    `File: ${p.settingsPath}`,
    `statusLine before: ${show(p.before)}`,
    `statusLine after:  ${show(p.after)}`,
    p.before ? 'Your current status line keeps running; Partition shows its part next to it.' : '',
    `Undo any time: node "${CLI_PATH}" uninstall --apply`,
  ].filter(Boolean).join('\n');
}

export function setup() {
  if (provider() === 'codex') {
    const p = codex.applySetup();
    return `Partition Codex hooks registered in ${p.settingsPath}. Review and trust them in Codex (/hooks in the CLI), then start a new desktop chat.`;
  }
  const p = applySetup(PLUGIN_ROOT);
  return p.alreadyInstalled ? 'Already connected.' : `Connected. Updated ${p.settingsPath}. Usage is counted from the next response.`;
}

export function uninstallPlanText() {
  if (provider() === 'codex') {
    const p = codex.planUninstall();
    return `File: ${p.settingsPath}\nOnly Partition hooks will be removed.\nAfter:\n${JSON.stringify(p.after, null, 2)}`;
  }
  const p = planUninstall();
  if (!p.changes) return `Partition is not set as the status line in ${p.settingsPath}. Only ~/.partition/statusline.mjs will be removed.`;
  return [`File: ${p.settingsPath}`, `statusLine before: ${show(p.before)}`, `statusLine after:  ${show(p.after)}`].join('\n');
}

export function uninstall() {
  if (provider() === 'codex') {
    const p = codex.applyUninstall();
    return p.changes ? `Removed Partition Codex hooks from ${p.settingsPath}. Other hooks are preserved.` : 'No Partition Codex hooks to remove.';
  }
  const p = applyUninstall();
  return p.changes ? `Restored the status line in ${p.settingsPath}.` : 'Nothing to restore in settings.json.';
}
