import { updateConfig } from '../store/config.mjs';

/**
 * @typedef {object} RulesPatch
 * @property {number} [warnAt] 0–1
 * @property {number} [wrapMarginPp] 0–100
 * @property {boolean} [block]
 * @property {'auto' | 'ko' | 'en'} [language]
 */

/**
 * @param {RulesPatch} patch
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function setRules(patch) {
  if (patch.warnAt != null && !(patch.warnAt >= 0 && patch.warnAt <= 1)) return { ok: false, error: 'warnAt' };
  if (patch.wrapMarginPp != null && !(patch.wrapMarginPp >= 0 && patch.wrapMarginPp <= 100)) return { ok: false, error: 'wrapMarginPp' };
  if (patch.block != null && typeof patch.block !== 'boolean') return { ok: false, error: 'block' };
  if (patch.language != null && !['auto', 'ko', 'en'].includes(patch.language)) return { ok: false, error: 'language' };
  const { language, ...rules } = patch;
  updateConfig((c) => ({ ...c, rules: { ...c.rules, ...rules }, ...(language ? { language } : {}) }));
  return { ok: true };
}
