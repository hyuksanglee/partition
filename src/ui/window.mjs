// 설정 창 띄우기: macOS 기본 WebKit 창(JXA) → Chrome 앱 모드 → 기본 브라우저.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const WIDTH = 640;
const HEIGHT = 600;
const MAC_WINDOW = fileURLToPath(new URL('./mac-window.js', import.meta.url));
const CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

/**
 * @param {string} url
 * @returns {import('node:child_process').ChildProcess | null} 창 프로세스. 끝나면 창이 닫힌 것. 브라우저 탭이면 null
 */
export function openWindow(url) {
  if (process.platform === 'darwin' && !process.env.PARTITION_NO_NATIVE_WINDOW) {
    return spawn('osascript', ['-l', 'JavaScript', MAC_WINDOW, url, 'Partition', String(WIDTH), String(HEIGHT)], { stdio: 'ignore' });
  }
  const chrome = CHROME_PATHS.find((p) => existsSync(p));
  if (chrome) {
    // 별도 프로필이라야 창이 닫힐 때 프로세스도 끝난다.
    const profile = `${process.env.TMPDIR || '/tmp'}/partition-chrome-profile`;
    return spawn(chrome, [`--app=${url}`, `--window-size=${WIDTH},${HEIGHT}`, `--user-data-dir=${profile}`, '--no-first-run'], { stdio: 'ignore' });
  }
  // 기본 브라우저: 탭이 닫힌 건 알 수 없으니 서버는 heartbeat로 끝난다.
  spawnSync(process.platform === 'darwin' ? 'open' : 'xdg-open', [url], { stdio: 'ignore' });
  return null;
}
