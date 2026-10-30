// Desktop setup uses official hooks/list + config/batchWrite. Trust is granted
// only for the exact displayed definitions after an explicit user review.
import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { codexHooksPath } from '../store/paths.mjs';
import { loadInstall } from '../store/state.mjs';
import { EVENTS, hookCommand } from './settings.mjs';
import { withAppServer } from './app-server.mjs';

/** @typedef {import('./app-server.mjs').Rpc} Rpc */
/** @typedef {{ key: string, currentHash: string, command: string, eventName: string, enabled: boolean, trustStatus: string, sourcePath: string }} ReviewedHook */

/** Codex canonicalizes paths, including macOS /var -> /private/var. @param {string} path */
function canonical(path) {
  try { return realpathSync(path); } catch { return resolve(path); }
}

/** @param {ReviewedHook[]} hooks */
function fingerprint(hooks) {
  return createHash('sha256').update(JSON.stringify(hooks.map((h) => ({
    key: h.key, currentHash: h.currentHash, command: h.command, eventName: h.eventName, sourcePath: h.sourcePath, enabled: h.enabled,
  })).sort((a, b) => a.key.localeCompare(b.key)))).digest('hex');
}

/** @param {string} project @param {Rpc} rpc */
export async function reviewWithRpc(project, rpc) {
  const listed = await rpc('hooks/list', { cwds: [project] });
  const entry = listed.data?.find((/** @type {any} */ d) => d.cwd === project);
  if (!entry) throw new Error('Codex did not return hook metadata for this project.');
  if (entry.errors?.length) throw new Error('Codex reported hook configuration errors. Fix them before approval.');
  const commands = new Set([hookCommand(), ...(loadInstall().hookCommands ?? [])]);
  const pluginHooks = (entry.hooks ?? []).filter((/** @type {any} */ h) => {
    if (h.source !== 'plugin' || h.pluginId !== 'partition@partition' || h.handlerType !== 'command' || h.isManaged) return false;
    const root = dirname(dirname(h.sourcePath));
    return canonical(h.sourcePath) === canonical(join(root, 'hooks/codex.json'))
      && h.command === `node "${join(root, 'src/codex/hook.mjs')}"`;
  });
  /** @type {ReviewedHook[]} */
  const hooks = (pluginHooks.length ? pluginHooks : (entry.hooks ?? []).filter((/** @type {any} */ h) =>
    h.source === 'user' && canonical(h.sourcePath) === canonical(codexHooksPath()) && commands.has(h.command)
    && h.handlerType === 'command' && !h.isManaged,
  )).map((/** @type {any} */ h) => ({
    key: h.key, currentHash: h.currentHash, command: h.command, eventName: h.eventName,
    enabled: h.enabled, trustStatus: h.trustStatus, sourcePath: h.sourcePath,
  }));
  const required = EVENTS.map((s) => s[0].toLowerCase() + s.slice(1));
  const complete = hooks.length === required.length && required.every((event) => hooks.filter((h) => h.eventName === event).length === 1);
  const config = await rpc('config/read', { includeLayers: false, cwd: project });
  const hooksEnabled = config.config?.features?.hooks !== false;
  return {
    hooks, complete, hooksEnabled,
    source: pluginHooks.length ? 'plugin' : 'user',
    ready: hooksEnabled && complete && hooks.every((h) => h.enabled && h.trustStatus === 'trusted'),
    reviewToken: fingerprint(hooks),
    warnings: /** @type {string[]} */ (entry.warnings ?? []),
  };
}

/** @param {string} project */
export function reviewDesktop(project) {
  return withAppServer((rpc) => reviewWithRpc(project, rpc));
}

/**
 * The accepted flag and fingerprint come from the explicit review UI, never
 * from a model-generated default or automatic setup. Re-read before writing.
 * @param {string} project
 * @param {{ accepted?: boolean, reviewToken?: string }} approval
 * @param {Rpc} rpc
 */
export async function approveWithRpc(project, approval, rpc) {
  if (approval.accepted !== true || !approval.reviewToken) throw new Error('Review and accept the displayed Partition hooks first.');
  const review = await reviewWithRpc(project, rpc);
  if (!review.hooksEnabled) throw new Error('Lifecycle hooks are disabled in Codex settings. Partition will not change that global policy.');
  if (!review.complete || review.reviewToken !== approval.reviewToken) throw new Error('Hook definitions changed. Refresh and review them again.');
  if (review.ready) return review;
  const configPath = canonical(join(dirname(codexHooksPath()), 'config.toml'));
  const config = await rpc('config/read', { includeLayers: true, cwd: project });
  const user = config.layers?.find((/** @type {any} */ l) => l.name?.type === 'user' && l.name?.file === configPath && !l.name?.profile);
  if (!user?.version) throw new Error('Codex did not return a user config version; approval was not saved.');
  const state = { ...(user.config?.hooks?.state ?? {}) };
  for (const h of review.hooks) state[h.key] = { ...state[h.key], enabled: true, trusted_hash: h.currentHash };
  const result = await rpc('config/batchWrite', {
    edits: [{ keyPath: 'hooks.state', value: state, mergeStrategy: 'replace' }],
    filePath: configPath, expectedVersion: user.version, reloadUserConfig: true,
  });
  if (result.status !== 'ok') throw new Error('A managed setting overrides hook approval. Partition cannot change that policy.');
  const after = await reviewWithRpc(project, rpc);
  if (!after.ready) throw new Error('Approval was saved but Codex still reports inactive hooks. Reopen the app and check again.');
  return after;
}

/** @param {string} project @param {{ accepted?: boolean, reviewToken?: string }} approval */
export function approveDesktop(project, approval) {
  return withAppServer((rpc) => approveWithRpc(project, approval, rpc));
}
