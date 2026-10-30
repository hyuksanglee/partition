import { appendFileSync, writeFileSync } from 'node:fs';

export const NOW = 1_790_000_000_000;

/** @param {number} pct @param {number} [minutes] */
export function limits(pct, minutes = 300) {
  return { limit_id: 'codex', primary: { used_percent: pct, window_minutes: minutes, resets_at: NOW / 1000 + 3600 } };
}

/** @param {number} at @param {number} input @param {number} pct @param {number} [cached] */
export function entry(at, input, pct, cached = 0) {
  return JSON.stringify({
    type: 'event_msg', timestamp: new Date(at).toISOString(),
    payload: {
      type: 'token_count',
      info: { total_token_usage: { input_tokens: input, cached_input_tokens: cached, output_tokens: input / 10, reasoning_output_tokens: input / 20 } },
      rate_limits: limits(pct),
    },
  }) + '\n';
}

/** @param {string} file @param {number} input @param {number} pct @param {number} [at] */
export function start(file, input = 100, pct = 10, at = NOW) { writeFileSync(file, entry(at, input, pct)); }
/** @param {string} file @param {number} input @param {number} pct @param {number} [at] */
export function append(file, input, pct, at = NOW + 1000) { appendFileSync(file, entry(at, input, pct)); }
