// Merge only Partition's command handlers; leave unrelated hooks/settings intact.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { codexHooksPath } from '../store/paths.mjs';
import { loadInstall, updateInstall } from '../store/state.mjs';
import { withLock, writeJsonAtomic } from '../store/file.mjs';
import { PLUGIN_ROOT } from '../root.mjs';

export const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop'];
/** @param {string} s */
const quote = (s) => `'${s.replace(/'/g, `'\\''`)}'`;

export function hookCommand() {
  return `${quote(process.execPath)} ${quote(join(PLUGIN_ROOT, 'src/codex/hook.mjs'))}`;
}

/** @returns {Record<string, any>} */
function readHooks() {
  const path = codexHooksPath();
  if (!existsSync(path)) return {};
  // Refuse to replace malformed config (readJson's fallback would hide it).
  const data = JSON.parse(readFileSync(path, 'utf8'));
  if (!data || typeof data !== 'object' || Array.isArray(data)
    || (data.hooks != null && (typeof data.hooks !== 'object' || Array.isArray(data.hooks)))) {
    throw new Error(`Invalid hooks configuration: ${path}`);
  }
  for (const groups of Object.values(data.hooks ?? {})) {
    if (!Array.isArray(groups) || groups.some((g) => !g || !Array.isArray(g.hooks))) {
      throw new Error(`Invalid hook groups in ${path}`);
    }
  }
  return data;
}

/** @param {Record<string, any>} before @param {Set<string>} owned */
function withoutOwned(before, owned) {
  const hooks = { ...before.hooks };
  for (const [event, groups] of Object.entries(hooks)) {
    hooks[event] = groups.map((/** @type {any} */ group) => ({
      ...group, hooks: group.hooks.filter((/** @type {any} */ h) => !owned.has(h.command)),
    })).filter((/** @type {any} */ group) => group.hooks.length);
    if (!hooks[event].length) delete hooks[event];
  }
  return { ...before, hooks };
}

export function planSetup() {
  const before = readHooks();
  const command = hookCommand();
  const owned = new Set([command, ...(loadInstall().hookCommands ?? [])]);
  const after = withoutOwned(before, owned);
  for (const event of EVENTS) {
    after.hooks[event] = [...(after.hooks[event] ?? []), {
      hooks: [{ type: 'command', command, timeout: 10, statusMessage: 'Partition: checking Codex budget' }],
    }];
  }
  return { settingsPath: codexHooksPath(), before, after, alreadyInstalled: JSON.stringify(before) === JSON.stringify(after), command };
}

export function applySetup() {
  return withLock(`${codexHooksPath()}.partition.lock`, () => {
    const plan = planSetup();
    if (!plan.alreadyInstalled) writeJsonAtomic(plan.settingsPath, plan.after);
    updateInstall((i) => ({ ...i, installed: true, pluginRoot: PLUGIN_ROOT, hookCommands: [plan.command] }));
    return plan;
  });
}

export function planUninstall() {
  const before = readHooks();
  const owned = new Set([hookCommand(), ...(loadInstall().hookCommands ?? [])]);
  const after = withoutOwned(before, owned);
  const changes = Object.values(before.hooks ?? {}).some((groups) => groups.some(
    (/** @type {any} */ g) => g.hooks.some((/** @type {any} */ h) => owned.has(h.command)),
  ));
  return { settingsPath: codexHooksPath(), before, after, changes };
}

export function applyUninstall() {
  return withLock(`${codexHooksPath()}.partition.lock`, () => {
    const plan = planUninstall();
    if (plan.changes) writeJsonAtomic(plan.settingsPath, plan.after);
    updateInstall((i) => ({ ...i, installed: false, hookCommands: [] }));
    return plan;
  });
}

/** Registration does not prove trust or runtime execution. */
export function isConnected() {
  try {
    const config = readHooks();
    const owned = new Set([hookCommand(), ...(loadInstall().hookCommands ?? [])]);
    return EVENTS.every((event) => (config.hooks?.[event] ?? []).some(
      (/** @type {any} */ g) => (!g.matcher || g.matcher === '*') && g.hooks.some((/** @type {any} */ h) => owned.has(h.command) && h.async !== true),
    ));
  } catch { return false; }
}
