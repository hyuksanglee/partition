import { allowedRange, otherUsage, setBudget, validateBudget } from '../core/allocation.mjs';
import { isExpired } from '../core/window.mjs';
import { loadState } from '../store/state.mjs';
import { updateConfig } from '../store/config.mjs';
import { projectName } from '../project.mjs';
import { t } from '../messages.mjs';

/** @typedef {import('../core/window.mjs').WindowKey} WindowKey */

/**
 * "30", "30 --week", "off --week" 같은 인자를 읽는다.
 * @param {string[]} args
 * @returns {{ window: WindowKey, value: number | null } | null}
 */
export function parseBudgetArgs(args) {
  const window = args.includes('--week') ? 'sevenDay' : 'fiveHour';
  const rest = args.filter((a) => a !== '--week');
  if (rest.length !== 1) return null;
  if (rest[0] === 'off') return { window, value: null };
  const value = Number(rest[0].replace(/%p?$/, ''));
  return Number.isFinite(value) ? { window, value } : null;
}

/**
 * @param {string} project
 * @param {WindowKey} window
 * @param {number | null} value null이면 해제
 * @param {import('../messages.mjs').Lang} lang
 * @returns {{ ok: boolean, text: string, data: { max: number, value: number | null } }}
 */
export function setProjectBudget(project, window, value, lang) {
  const name = projectName(project);
  const label = t(lang, `window.${window}`);
  /** @type {string | null} */
  let error = null;
  let max = 0;
  updateConfig((c) => {
    const win = loadState().windows[window];
    const other = otherUsage(c.budgets, window, isExpired(win, Date.now() / 1000) ? undefined : win, project);
    max = allowedRange(c.budgets, window, project, other).max;
    if (value != null) error = validateBudget(c.budgets, window, project, value, other);
    return error ? c : { ...c, budgets: setBudget(c.budgets, window, project, value) };
  });
  if (error) return { ok: false, text: t(lang, /** @type {any} */ (`error.${error}`), { max }), data: { max, value } };
  if (value == null) return { ok: true, text: t(lang, 'budget.cleared', { project: name, window: label }), data: { max, value } };
  return { ok: true, text: t(lang, 'budget.set', { project: name, window: label, value, max }), data: { max, value } };
}

/**
 * @param {string} project
 * @param {string[]} args
 * @param {import('../messages.mjs').Lang} lang
 */
export function budgetCommand(project, args, lang) {
  const parsed = parseBudgetArgs(args);
  if (!parsed) return { ok: false, text: t(lang, 'budget.usage') };
  return setProjectBudget(project, parsed.window, parsed.value, lang);
}

