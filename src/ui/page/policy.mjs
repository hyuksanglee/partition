/** @param {{connected: boolean, ready?: boolean, requested?: string | null}} state */
export function initialTab({ connected, ready, requested }) {
  if (requested && ['budget', 'rules', 'connection'].includes(requested)) return requested;
  return connected && ready !== false ? 'budget' : 'connection';
}

/** Only this project's live attributed usage can exhaust its budget.
 * @param {{value: number | null, used: number, hasData: boolean, block: boolean, max: number}} state
 * @returns {'block' | 'warn' | null}
 */
export function budgetSaveImpact({ value, used, hasData, block, max }) {
  if (value == null || !Number.isFinite(value) || value <= 0 || value > max || !hasData || used < value) return null;
  return block ? 'block' : 'warn';
}
