// 설정 창 띄우기: macOS 기본 WebKit 창(JXA) → Chrome 앱 모드 → 기본 브라우저.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { MAC_APP_ID, prepareMacApp } from './mac-app.mjs';

const WIDTH = 640;
const HEIGHT = 600;
const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

/**
 * @param {string} url
 * @returns {Promise<{child: import('node:child_process').ChildProcess | null, mode: 'window' | 'browser'}>}
 */
export async function openWindow(url) {
  if (process.platform === 'darwin' && !process.env.PARTITION_NO_NATIVE_WINDOW) {
    const app = prepareMacApp();
    const child = spawn(app.executable, [url, 'Partition', String(WIDTH), String(HEIGHT), app.iconPath], { stdio: ['ignore', 'ignore', 'pipe'] });
    await new Promise((resolve, reject) => {
      let output = '';
      let settled = false;
      const timer = setTimeout(() => fail('Partition settings window did not become ready in time.'), 5000);
      /** @param {string} message */
      function fail(message) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child.kill();
        reject(new Error(message));
      }
      child.once('error', () => fail('Partition could not launch its native settings window.'));
      child.once('exit', () => fail('Partition settings window exited before it became ready.'));
      child.stderr.on('data', (chunk) => {
        output = (output + chunk).slice(-4096);
        const ready = /PARTITION_WINDOW_READY (.+)\n/.exec(output);
        if (!ready) return;
        if (settled) return;
        try {
          const identity = JSON.parse(ready[1]);
          if (identity.name !== 'Partition' || identity.bundleId !== MAC_APP_ID || identity.icon !== true) {
            fail('Partition settings app did not confirm its Dock identity.'); return;
          }
        } catch { fail('Partition settings app returned invalid readiness data.'); return; }
        settled = true;
        clearTimeout(timer);
        resolve(undefined);
      });
    });
    return { child, mode: 'window' };
  }
  const chrome = CHROME_PATHS.find((p) => existsSync(p));
  if (chrome) {
    // 별도 프로필이라야 창이 닫힐 때 프로세스도 끝난다.
    const profile = `${process.env.TMPDIR || '/tmp'}/partition-chrome-profile`;
    const child = spawn(chrome, [`--app=${url}`, `--window-size=${WIDTH},${HEIGHT}`, `--user-data-dir=${profile}`, '--no-first-run'], { stdio: 'ignore' });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); });
    return { child, mode: 'window' };
  }
  // 기본 브라우저: 탭이 닫힌 건 알 수 없으니 서버는 heartbeat로 끝난다.
  const result = spawnSync(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { stdio: 'ignore' });
  if (result.status !== 0) throw new Error('Partition could not open the settings URL.');
  return { child: null, mode: 'browser' };
}
