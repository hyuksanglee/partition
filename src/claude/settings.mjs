// ~/.claude/settings.json의 statusLine을 Partition 실행기로 바꾸거나 원래대로 되돌린다.
// 플러그인은 status line을 직접 설정할 수 없어서 사용자 승인 후 이 파일을 고친다.
import { rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { claudeSettingsPath, paths } from '../store/paths.mjs';
import { readJson, writeJsonAtomic } from '../store/file.mjs';
import { loadInstall, updateInstall } from '../store/state.mjs';
import { launcherSource } from './launcher.mjs';

/** @typedef {{ type: string, command: string, padding?: number }} StatusLine */

/** @param {string} launcher */
export function partitionStatusLine(launcher) {
  return { type: 'command', command: `node "${launcher}"` };
}

/** @param {StatusLine | undefined} s */
export function isPartitionStatusLine(s) {
  return typeof s?.command === 'string' && s.command.includes(paths.launcher);
}

/**
 * 바꿀 내용을 계산만 한다(파일은 안 바꿈).
 * @returns {{ settingsPath: string, before: StatusLine | null, after: StatusLine, alreadyInstalled: boolean }}
 */
export function planSetup() {
  const settings = readJson(claudeSettingsPath(), /** @type {Record<string, any>} */ ({}));
  const before = settings.statusLine ?? null;
  const after = { ...partitionStatusLine(paths.launcher), ...(before?.padding != null ? { padding: before.padding } : {}) };
  return { settingsPath: claudeSettingsPath(), before, after, alreadyInstalled: isPartitionStatusLine(before) };
}

/**
 * @param {string} pluginRoot 지금 플러그인 경로
 */
export function applySetup(pluginRoot) {
  const plan = planSetup();
  mkdirSync(dirname(paths.launcher), { recursive: true });
  writeFileSync(paths.launcher, launcherSource(), { mode: 0o755 });
  updateInstall((i) => ({
    ...i,
    pluginRoot,
    installed: true,
    // 이미 설치돼 있으면 처음 저장한 원래 값을 덮어쓰지 않는다.
    originalStatusLine: plan.alreadyInstalled ? i.originalStatusLine ?? null : plan.before,
  }));
  if (!plan.alreadyInstalled) {
    const settings = readJson(claudeSettingsPath(), /** @type {Record<string, any>} */ ({}));
    writeJsonAtomic(claudeSettingsPath(), { ...settings, statusLine: plan.after });
  }
  return plan;
}

export function planUninstall() {
  const settings = readJson(claudeSettingsPath(), /** @type {Record<string, any>} */ ({}));
  const current = settings.statusLine ?? null;
  const restore = isPartitionStatusLine(current) ? loadInstall().originalStatusLine ?? null : current;
  return { settingsPath: claudeSettingsPath(), before: current, after: restore, changes: isPartitionStatusLine(current) };
}

export function applyUninstall() {
  const plan = planUninstall();
  if (plan.changes) {
    const settings = readJson(claudeSettingsPath(), /** @type {Record<string, any>} */ ({}));
    if (plan.after) settings.statusLine = plan.after;
    else delete settings.statusLine;
    writeJsonAtomic(claudeSettingsPath(), settings);
  }
  rmSync(paths.launcher, { force: true });
  updateInstall((i) => ({ ...i, installed: false, originalStatusLine: undefined }));
  return plan;
}

/** settings.json이 지금 Partition 실행기를 쓰는지 */
export function isConnected() {
  const settings = readJson(claudeSettingsPath(), /** @type {Record<string, any>} */ ({}));
  return isPartitionStatusLine(settings.statusLine);
}
