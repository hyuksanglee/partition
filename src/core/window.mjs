// 한도 창(5시간·주간) 하나의 기록을 새 사용률 값으로 갱신한다. 순수 함수.
import { attribute } from './attribute.mjs';

/** @typedef {'fiveHour' | 'sevenDay'} WindowKey */
/** @type {WindowKey[]} */
export const WINDOW_KEYS = ['fiveHour', 'sevenDay'];

/**
 * @typedef {object} WindowState
 * @property {number} resetsAt 창이 리셋되는 시각(epoch 초)
 * @property {number} lastUsedPct 마지막으로 본 전체 사용률(0–100)
 * @property {Record<string, number>} byProject 프로젝트별 사용 %p
 * @property {number} unattributed 대기분 없이 오른 %p (웹·다른 기기 등)
 * @property {number} beforeTracking 추적 시작 전에 이미 쓴 %p
 * @property {Record<string, number>} pending 아직 배분 안 된 프로젝트별 가중 토큰
 * @property {Record<string, string>} notified 프로젝트별로 이미 알린 단계
 */

/**
 * @typedef {object} Reading
 * @property {number} usedPct
 * @property {number} resetsAt
 */

// resets_at는 출처마다 조금 다르다(status line은 초 단위, /usage는 분 단위).
// 리셋이면 5시간·주간 단위로 크게 움직이므로 10분 넘게 바뀌어야 리셋으로 본다.
const RESET_TOLERANCE_SEC = 600;

/**
 * @param {number} resetsAt
 * @param {number} usedPct
 * @returns {WindowState}
 */
export function startTracking(resetsAt, usedPct) {
  return { resetsAt, lastUsedPct: usedPct, byProject: {}, unattributed: 0, beforeTracking: usedPct, pending: {}, notified: {} };
}

/**
 * @param {WindowState} win
 * @param {Reading} reading
 */
export function isReset(win, reading) {
  return reading.resetsAt - win.resetsAt > RESET_TOLERANCE_SEC || reading.usedPct < win.lastUsedPct - 0.5;
}

/**
 * 창이 이미 지났는지. 지난 창 기록으로는 막지 않는다(fail-open).
 * @param {WindowState | undefined} win
 * @param {number} nowSec
 */
export function isExpired(win, nowSec) {
  return !win || win.resetsAt <= nowSec;
}

/**
 * @param {WindowState} win
 * @param {Record<string, number>} tokens 이번에 새로 쌓인 프로젝트별 가중 토큰
 */
export function addPending(win, tokens) {
  const pending = { ...win.pending };
  for (const [project, weight] of Object.entries(tokens)) {
    if (weight > 0) pending[project] = (pending[project] ?? 0) + weight;
  }
  return { ...win, pending };
}

/**
 * 새 사용률을 반영한다. 올랐으면 대기분 비중대로 배분하고 대기분을 비운다.
 * 리셋됐으면 0부터 다시 센다(대기분은 새 창 몫으로 남긴다).
 * @param {WindowState | undefined} win
 * @param {Reading} reading
 * @returns {WindowState}
 */
export function applyReading(win, reading) {
  if (!win) return startTracking(reading.resetsAt, reading.usedPct);
  if (isReset(win, reading)) {
    win = { ...startTracking(reading.resetsAt, 0), pending: win.pending, beforeTracking: 0 };
  }
  const delta = reading.usedPct - win.lastUsedPct;
  if (delta <= 0) return { ...win, resetsAt: reading.resetsAt };
  const { byProject, unattributed } = attribute(delta, win.pending);
  const merged = { ...win.byProject };
  for (const [project, pp] of Object.entries(byProject)) merged[project] = (merged[project] ?? 0) + pp;
  return {
    ...win,
    resetsAt: reading.resetsAt,
    lastUsedPct: reading.usedPct,
    byProject: merged,
    unattributed: win.unattributed + unattributed,
    pending: {},
  };
}
