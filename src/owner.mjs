// 이 프로세스를 띄운 Claude Code(claude) 프로세스를 찾는다. 설정 창을 그 수명에 맞추려고 쓴다.
import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';

/**
 * @param {number} pid
 * @returns {{ ppid: number, comm: string } | null}
 */
function parentOf(pid) {
  try {
    const out = execFileSync('ps', ['-o', 'ppid=,comm=', '-p', String(pid)], { encoding: 'utf8', timeout: 1000 }).trim();
    const m = /^(\d+)\s+(.+)$/.exec(out);
    return m ? { ppid: Number(m[1]), comm: m[2] } : null;
  } catch {
    return null;
  }
}

/**
 * 부모를 따라 올라가며 실행 파일 이름이 claude인 첫 프로세스를 찾는다.
 * 데스크톱 앱(Claude.app) 자체가 아니라 세션의 claude 프로세스를 고른다. 못 찾으면 null.
 * @param {number} [start]
 * @returns {number | null}
 */
export function findClaudePid(start = process.ppid) {
  if (process.platform === 'win32') return null;
  let pid = start;
  for (let depth = 0; depth < 12 && pid > 1; depth++) {
    const info = parentOf(pid);
    if (!info) return null;
    if (basename(info.comm) === 'claude') return pid;
    pid = info.ppid;
  }
  return null;
}

/** @param {number} pid */
export function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM: 살아 있지만 신호를 보낼 권한이 없음
    return /** @type {NodeJS.ErrnoException} */ (err).code === 'EPERM';
  }
}
