// setup/uninstall: settings.json 변경 내용을 먼저 보여주고(--plan), 승인 후 적용(--apply).
import { applySetup, applyUninstall, planSetup, planUninstall } from '../claude/settings.mjs';
import { CLI_PATH, PLUGIN_ROOT } from '../root.mjs';

/** @param {unknown} v */
const show = (v) => (v == null ? '(none)' : JSON.stringify(v));

export function setupPlanText() {
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
  const p = applySetup(PLUGIN_ROOT);
  return p.alreadyInstalled ? 'Already connected.' : `Connected. Updated ${p.settingsPath}. Usage is counted from the next response.`;
}

export function uninstallPlanText() {
  const p = planUninstall();
  if (!p.changes) return `Partition is not set as the status line in ${p.settingsPath}. Only ~/.partition/statusline.mjs will be removed.`;
  return [`File: ${p.settingsPath}`, `statusLine before: ${show(p.before)}`, `statusLine after:  ${show(p.after)}`].join('\n');
}

export function uninstall() {
  const p = applyUninstall();
  return p.changes ? `Restored the status line in ${p.settingsPath}.` : 'Nothing to restore in settings.json.';
}
