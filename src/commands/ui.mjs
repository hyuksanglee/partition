import { spawn, spawnSync } from 'node:child_process';
import { CLI_PATH } from '../root.mjs';

/**
 * 설정 창을 별도 프로세스로 띄우고 바로 돌아온다(hook·skill에서 쓰기 위해).
 * @param {string} project
 */
export function openUiDetached(project) {
  const child = spawn(process.execPath, [CLI_PATH, 'ui', '--project', project], { detached: true, stdio: 'ignore' });
  child.unref();
}

/** @typedef {{url: string, mode: 'window' | 'browser'}} UiLaunch */

/** Start the settings window and wait for its readiness acknowledgement.
 * @param {string} project
 * @returns {Promise<UiLaunch>}
 */
export function startUiDetached(project) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_PATH, '--provider', 'codex', 'ui', '--report-ready', '--project', project], {
      detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let settled = false;
    const timer = setTimeout(() => finish(new Error('Partition settings window did not start in time.')), 7000);
    /** @param {Error | null} error @param {UiLaunch} [result] */
    function finish(error, result) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.stdout.destroy();
      child.stderr.destroy();
      if (error) { child.kill(); reject(error); }
      else { child.unref(); resolve(/** @type {UiLaunch} */ (result)); }
    }
    child.on('error', (e) => finish(e));
    child.on('exit', () => finish(new Error('Partition settings server exited before returning its address.')));
    child.stderr.resume();
    child.stdout.on('data', (chunk) => {
      output += chunk;
      if (output.length > 4096) { finish(new Error('Invalid settings server response.')); return; }
      const end = output.indexOf('\n');
      if (end < 0) return;
      try {
        const result = JSON.parse(output.slice(0, end));
        const url = new URL(result.url);
        if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !url.hash || !url.port) throw new Error('Invalid local settings URL.');
        if (!['window', 'browser'].includes(result.mode)) throw new Error('Invalid settings window response.');
        finish(null, { url: url.href, mode: result.mode });
      } catch (err) { finish(err instanceof Error ? err : new Error(String(err))); }
    });
  });
}

/** Synchronous adapter for Codex command hooks. @param {string} project */
export function settingsWindow(project) {
  const child = spawnSync(process.execPath, [CLI_PATH, '--provider', 'codex', 'ui', '--detach', '--json', '--project', project], {
    encoding: 'utf8', timeout: 8500, maxBuffer: 8192,
  });
  if (child.status !== 0) throw new Error('Partition could not open its settings window. Run the UI command again to retry.');
  const result = JSON.parse(child.stdout);
  if (typeof result.url !== 'string' || !['window', 'browser'].includes(result.mode)) throw new Error('Partition settings window did not confirm startup.');
  return /** @type {UiLaunch} */ (result);
}

/**
 * 이 프로세스에서 서버와 창을 띄우고 창이 닫힐 때까지 기다린다.
 * @param {string} project
 * @param {{onReady?: (result: UiLaunch) => void}} [options]
 */
export async function openUi(project, { onReady } = {}) {
  const { startServer } = await import('../ui/server.mjs');
  const { openWindow } = await import('../ui/window.mjs');
  const server = await startServer({ project });
  /** @type {Awaited<ReturnType<typeof openWindow>> | undefined} */
  let win;
  const stop = () => { win?.child?.kill(); server.close(); };
  process.once('SIGTERM', stop);
  try {
    const url = server.url;
    win = await openWindow(url);
    server.setWindowManaged(win.child !== null);
    win.child?.on('exit', () => server.close());
    onReady?.({ url, mode: win.mode });
    await server.closed;
  } finally {
    process.removeListener('SIGTERM', stop);
    stop();
  }
}

/** Serve the same settings page for an in-app browser panel, without a native window.
 * @param {string} project
 */
export async function serveUi(project) {
  const { startServer } = await import('../ui/server.mjs');
  const server = await startServer({ project });
  console.log(server.url);
  await server.closed;
}
