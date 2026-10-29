// config.json: 예산·규칙·가중치 (사용자가 정하는 것)
import { paths } from './paths.mjs';
import { readJson, withLock, writeJsonAtomic } from './file.mjs';

/**
 * @typedef {object} Weights 토큰 종류별 가중치. API 가격 비율을 기본값으로 둔 가정이다.
 * @property {number} input
 * @property {number} cacheWrite
 * @property {number} cacheRead
 * @property {number} output
 */

/**
 * @typedef {object} Config
 * @property {1} version
 * @property {import('../core/allocation.mjs').Budgets} budgets 프로젝트 경로 → 창별 %p
 * @property {import('../core/stages.mjs').Rules} rules
 * @property {Weights} weights
 * @property {'auto' | 'ko' | 'en'} language
 */

/** @returns {Config} */
export function defaultConfig() {
  return {
    version: 1,
    budgets: {},
    rules: { warnAt: 0.8, wrapMarginPp: 3, block: true },
    weights: { input: 1, cacheWrite: 1.25, cacheRead: 0.1, output: 5 },
    language: 'auto',
  };
}

/** @returns {Config} */
export function loadConfig() {
  const d = defaultConfig();
  const c = readJson(paths.config, /** @type {Partial<Config>} */ ({}));
  return {
    ...d,
    ...c,
    version: 1,
    budgets: c.budgets ?? d.budgets,
    rules: { ...d.rules, ...c.rules },
    weights: { ...d.weights, ...c.weights },
  };
}

/**
 * @param {(c: Config) => Config} fn
 * @returns {Config}
 */
export function updateConfig(fn) {
  return withLock(paths.lock, () => {
    const next = fn(loadConfig());
    writeJsonAtomic(paths.config, next);
    return next;
  });
}
