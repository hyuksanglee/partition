// JSON 파일 읽기, 원자적 쓰기, 잠금.
// status line과 hook이 동시에 돌 수 있어서 쓰기는 항상 잠금 안에서 한다.
import { closeSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * @template T
 * @param {string} file
 * @param {T} fallback 파일이 없거나 깨졌을 때
 * @returns {T}
 */
export function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/**
 * 임시 파일에 쓰고 rename해서, 읽는 쪽이 반쯤 쓴 파일을 보지 않게 한다.
 * @param {string} file
 * @param {unknown} data
 */
export function writeJsonAtomic(file, data) {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', { mode: 0o600 });
  renameSync(tmp, file);
}

export class LockTimeout extends Error {}

const STALE_MS = 10_000;

/** @param {number} ms */
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/**
 * @template T
 * @param {string} lockFile
 * @param {() => T} fn
 * @param {{ timeoutMs?: number }} [opts]
 * @returns {T}
 */
export function withLock(lockFile, fn, { timeoutMs = 2000 } = {}) {
  mkdirSync(dirname(lockFile), { recursive: true });
  const deadline = Date.now() + timeoutMs;
  let fd;
  for (;;) {
    try {
      fd = openSync(lockFile, 'wx');
      break;
    } catch (err) {
      if (/** @type {NodeJS.ErrnoException} */ (err).code !== 'EEXIST') throw err;
      // 죽은 프로세스가 남긴 잠금은 치운다.
      try {
        if (Date.now() - statSync(lockFile).mtimeMs > STALE_MS) rmSync(lockFile, { force: true });
      } catch {}
      if (Date.now() > deadline) throw new LockTimeout(lockFile);
      sleep(20);
    }
  }
  try {
    return fn();
  } finally {
    closeSync(fd);
    rmSync(lockFile, { force: true });
  }
}
