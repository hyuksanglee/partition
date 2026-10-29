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
 * 예산을 정하지 않은 사용(Partition 적용 전·미귀속·예산 없는 프로젝트)의 %p.
 * 이미 쓴 양이라 어느 프로젝트에도 줄 수 없다.
 * @param {Budgets} budgets
 * @param {WindowKey} win
 * @param {import('./window.mjs').WindowState | undefined} winState 지난 창이면 undefined로 넘긴다
 * @param {string} [project] 이 프로젝트의 사용은 기타에서 뺀다(예산을 정하면 자기 몫이 되므로)
 */
export function otherUsage(budgets, win, winState, project) {
  if (!winState) return 0;
  const budgetedUsed = Object.entries(winState.byProject)
    .filter(([p]) => p === project || budgets[p]?.[win] != null)
    .reduce((a, [, v]) => a + v, 0);
  return Math.max(0, winState.lastUsedPct - budgetedUsed);
}

/**
 * 이 프로젝트에 줄 수 있는 범위: 0 ~ (100 − 다른 프로젝트 할당 − 기타 사용).
 * 이미 정해 둔 예산이 그보다 크면 그 값까지는 그대로 둘 수 있다.
 * @param {Budgets} budgets
 * @param {WindowKey} win
 * @param {string} project
 * @param {number} [otherUsedPp] otherUsage() 값
 */
export function allowedRange(budgets, win, project, otherUsedPp = 0) {
  const max = Math.max(0, 100 - totalAllocated(budgets, win, project) - otherUsedPp);
  return { min: 0, max: Math.max(max, budgets[project]?.[win] ?? 0) };
}

/**
 * @param {Budgets} budgets
 * @param {WindowKey} win
 * @param {string} project
 * @param {number} value
 * @param {number} [otherUsedPp]
 * @returns {string | null} 오류 코드, 문제 없으면 null
 */
export function validateBudget(budgets, win, project, value, otherUsedPp = 0) {
  if (!Number.isFinite(value) || value < 0 || value > 100) return 'out_of_range';
  if (value > allowedRange(budgets, win, project, otherUsedPp).max) return 'over_allocated';
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
