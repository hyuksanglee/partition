// 프로젝트가 지금 어느 단계인지 판정한다. hook·status·GUI가 같이 쓴다.
import { stageFor, worstStage } from '../core/stages.mjs';
import { WINDOW_KEYS, isExpired } from '../core/window.mjs';

/** @typedef {import('../core/window.mjs').WindowKey} WindowKey */
/** @typedef {import('../core/stages.mjs').Stage} Stage */

/**
 * @typedef {object} WindowCheck
 * @property {WindowKey} window
 * @property {boolean} hasData 사용률 값이 있고 창이 아직 안 지났는지
 * @property {number} used 이 프로젝트가 쓴 %p
 * @property {number | undefined} budget
 * @property {number} totalPct 계정 전체 사용률
 * @property {number} othersPp 다른 프로젝트들이 쓴 %p
 * @property {number} unattributed
 * @property {number} beforeTracking
 * @property {number} resetsAt
 * @property {Stage} stage
 */

/**
 * @param {string} project
 * @param {import('../store/config.mjs').Config} config
 * @param {import('../store/state.mjs').State} state
 * @param {number} nowSec
 * @returns {{ stage: Stage, worst: WindowCheck | null, windows: Record<WindowKey, WindowCheck> }}
 */
export function check(project, config, state, nowSec) {
  const windows = /** @type {Record<WindowKey, WindowCheck>} */ ({});
  for (const key of WINDOW_KEYS) {
    const win = state.windows[key];
    const budget = config.budgets[project]?.[key];
    const hasData = !isExpired(win, nowSec);
    const used = hasData ? win?.byProject[project] ?? 0 : 0;
    const othersPp = hasData
      ? Object.entries(win?.byProject ?? {}).reduce((a, [p, v]) => (p === project ? a : a + v), 0)
      : 0;
    windows[key] = {
      window: key,
      hasData,
      used,
      budget,
      totalPct: hasData ? win?.lastUsedPct ?? 0 : 0,
      othersPp,
      unattributed: hasData ? win?.unattributed ?? 0 : 0,
      beforeTracking: hasData ? win?.beforeTracking ?? 0 : 0,
      resetsAt: win?.resetsAt ?? 0,
      // 값이 없거나 창이 지났으면 막지 않는다(fail-open).
      stage: hasData ? stageFor(used, budget, config.rules) : 'ok',
    };
  }
  const stage = worstStage(WINDOW_KEYS.map((k) => windows[k].stage));
  const worst = stage === 'ok' ? null : WINDOW_KEYS.map((k) => windows[k]).find((w) => w.stage === stage) ?? null;
  return { stage, worst, windows };
}
