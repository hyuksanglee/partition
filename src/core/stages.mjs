// 사용량과 예산으로 단계를 정한다. 순수 함수.

/** @typedef {'ok' | 'warn' | 'wrap' | 'block'} Stage */

/**
 * @typedef {object} Rules
 * @property {number} warnAt 예산 대비 비율(0–1). 이 비율에서 경고
 * @property {number} wrapMarginPp 예산까지 남은 %p가 이 이하면 마무리 지시
 * @property {boolean} block 예산 도달 시 차단할지. false면 마무리 지시만 계속
 */

/** @type {Stage[]} */
const ORDER = ['ok', 'warn', 'wrap', 'block'];

/**
 * @param {number} usedPp 이 창에서 프로젝트가 쓴 %p
 * @param {number | undefined} budgetPp 할당 %p. 없으면 제한 없음
 * @param {Rules} rules
 * @returns {Stage}
 */
export function stageFor(usedPp, budgetPp, rules) {
  if (budgetPp == null) return 'ok';
  if (usedPp >= budgetPp) return rules.block ? 'block' : 'wrap';
  if (usedPp >= budgetPp - rules.wrapMarginPp) return 'wrap';
  if (usedPp >= budgetPp * rules.warnAt) return 'warn';
  return 'ok';
}

/**
 * @param {Stage[]} stages
 * @returns {Stage}
 */
export function worstStage(stages) {
  return stages.reduce((a, b) => (ORDER.indexOf(b) > ORDER.indexOf(a) ? b : a), /** @type {Stage} */ ('ok'));
}
