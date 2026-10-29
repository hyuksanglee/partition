// state.json: 창별 사용 기록과 기록 파일 읽은 위치 (Partition이 쓰는 것)
// install.json: 플러그인 경로와 setup 전 원래 status line
import { paths } from './paths.mjs';
import { readJson, withLock, writeJsonAtomic } from './file.mjs';

/** @typedef {import('../core/window.mjs').WindowState} WindowState */

/**
 * @typedef {object} TranscriptCursor
 * @property {number} offset 여기까지 읽었다(바이트)
 * @property {Record<string, number>} seen 최근 message id → 이미 센 가중 토큰
 * @property {number} touchedAt 마지막으로 읽은 시각(ms). 오래된 커서는 지운다
 */

/**
 * @typedef {object} State
 * @property {1} version
 * @property {Partial<Record<import('../core/window.mjs').WindowKey, WindowState>>} windows
 * @property {Record<string, TranscriptCursor>} transcripts
 * @property {number} [lastStatusLineAt] status line이 마지막으로 돈 시각(ms). 연결 확인용
 * @property {number} [lastUsageFetchAt] Stop hook이 /usage로 사용률을 마지막으로 받은 시각(ms)
 */

/**
 * @typedef {object} Install
 * @property {string} [pluginRoot] SessionStart가 기록하는 현재 플러그인 경로
 * @property {{ type: string, command: string, padding?: number } | null} [originalStatusLine] setup 전 값. null이면 원래 없었음
 * @property {boolean} [installed] setup으로 settings.json을 바꿨는지
 */

/** @returns {State} */
export function emptyState() {
  return { version: 1, windows: {}, transcripts: {} };
}

/** @returns {State} */
export function loadState() {
  return { ...emptyState(), ...readJson(paths.state, {}) };
}

/**
 * @param {(s: State) => State} fn
 * @returns {State}
 */
export function updateState(fn) {
  return withLock(paths.lock, () => {
    const next = fn(loadState());
    writeJsonAtomic(paths.state, next);
    return next;
  });
}

/** @returns {Install} */
export function loadInstall() {
  return readJson(paths.install, {});
}

/**
 * @param {(i: Install) => Install} fn
 * @returns {Install}
 */
export function updateInstall(fn) {
  return withLock(paths.lock, () => {
    const next = fn(loadInstall());
    writeJsonAtomic(paths.install, next);
    return next;
  });
}
