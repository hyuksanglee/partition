import { spawn } from 'node:child_process';
import { CLI_PATH } from '../root.mjs';

/**
 * 설정 창을 별도 프로세스로 띄우고 바로 돌아온다(hook·skill에서 쓰기 위해).
 * @param {string} project
 */
export function openUiDetached(project) {
  const child = spawn(process.execPath, [CLI_PATH, 'ui', '--project', project], { detached: true, stdio: 'ignore' });
  child.unref();
}

/**
 * 이 프로세스에서 서버와 창을 띄우고 창이 닫힐 때까지 기다린다.
 * @param {string} project
 */
export async function openUi(project) {
  const { startServer } = await import('../ui/server.mjs');
  const { openWindow } = await import('../ui/window.mjs');
  const server = await startServer({ project });
  const win = openWindow(server.url);
  win?.on('exit', () => server.close());
  await server.closed;
}
