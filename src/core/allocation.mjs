// 프로젝트별 할당(%p) 계산과 검증. 순수 함수.

/** @typedef {import('./window.mjs').WindowKey} WindowKey */
/** @typedef {Partial<Record<WindowKey, number>>} ProjectBudget */
/** @typedef {Record<string, ProjectBudget>} Budgets */

/**
 * @param {Budgets} budgets
 * @param {WindowKey} win
 * @param {string} [except] 이 프로젝트는 빼고 합친다
 */
export function totalAllocated(budgets, win, except) {
  let sum = 0;
  for (const [project, b] of Object.entries(budgets)) {
    if (project !== except && b[win] != null) sum += /** @type {number} */ (b[win]);
  }
  return sum;
}

/**
 * 이 프로젝트에 줄 수 있는 범위: 0 ~ (100 − 다른 프로젝트 할당).
 * @param {Budgets} budgets
 * @param {WindowKey} win
 * @param {string} project
 */
export function allowedRange(budgets, win, project) {
  return { min: 0, max: Math.max(0, 100 - totalAllocated(budgets, win, project)) };
}

/**
 * @param {Budgets} budgets
 * @param {WindowKey} win
 * @param {string} project
 * @param {number} value
 * @returns {string | null} 오류 코드, 문제 없으면 null
 */
export function validateBudget(budgets, win, project, value) {
  if (!Number.isFinite(value) || value < 0 || value > 100) return 'out_of_range';
  if (value > allowedRange(budgets, win, project).max) return 'over_allocated';
  return null;
}

/**
 * @param {Budgets} budgets
 * @param {WindowKey} win
 * @param {string} project
 * @param {number | null} value null이면 할당 해제
 * @returns {Budgets}
 */
export function setBudget(budgets, win, project, value) {
  const next = { ...budgets, [project]: { ...budgets[project] } };
  if (value == null) delete next[project][win];
  else next[project][win] = value;
  if (Object.keys(next[project]).length === 0) delete next[project];
  return next;
}
