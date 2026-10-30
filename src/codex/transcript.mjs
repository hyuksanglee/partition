// Codex JSONL is an unstable local interface. Read only complete lines and
// cumulative token counters; repeated rate-limit notifications must not recount.
import { closeSync, fstatSync, openSync, readSync } from 'node:fs';

/** @typedef {import('../core/window.mjs').WindowKey} WindowKey */
/** @typedef {import('../core/window.mjs').Reading} Reading */
/** @typedef {import('../store/state.mjs').TranscriptCursor} Cursor */
/** @typedef {{ at: number, weight: number, readings: Partial<Record<WindowKey, Reading>> }} UsageEvent */

const MAX_READ_BYTES = 4 * 1024 * 1024;
const COUNTERS = ['input_tokens', 'cached_input_tokens', 'cache_write_input_tokens', 'output_tokens'];

/** @param {any} limits @returns {Partial<Record<WindowKey, Reading>>} */
export function readingsFrom(limits) {
  const result = /** @type {Partial<Record<WindowKey, Reading>>} */ ({});
  if (!limits || (limits.limit_id != null && limits.limit_id !== 'codex')) return result;
  for (const slot of ['primary', 'secondary']) {
    const r = limits[slot];
    const key = r?.window_minutes === 300 ? 'fiveHour' : r?.window_minutes === 10080 ? 'sevenDay' : null;
    if (key && Number.isFinite(r.used_percent) && r.used_percent >= 0 && r.used_percent <= 100
      && Number.isFinite(r.resets_at) && r.resets_at > 0) {
      result[key] = { usedPct: r.used_percent, resetsAt: r.resets_at };
    }
  }
  return result;
}

/** @param {Record<string, number>} totals @param {import('../store/config.mjs').Weights} w */
function weighted(totals, w) {
  const cached = Math.min(totals.input_tokens, totals.cached_input_tokens);
  const written = Math.min(totals.input_tokens - cached, totals.cache_write_input_tokens);
  // Codex input_tokens includes cache reads/writes; output includes reasoning.
  return (totals.input_tokens - cached - written) * w.input
    + cached * w.cacheRead + written * w.cacheWrite + totals.output_tokens * w.output;
}

/**
 * First observation establishes a baseline at the end of the file. Historic
 * tokens are already reflected in account usage and must not become pending.
 * @param {string} file
 * @param {Cursor | undefined} cursor
 * @param {import('../store/config.mjs').Weights} weights
 * @param {number} nowMs
 * @returns {{ events: UsageEvent[], cursor: Cursor, readable: boolean }}
 */
export function readNewUsage(file, cursor, weights, nowMs) {
  let offset = cursor?.offset ?? 0;
  let totals = cursor?.totals;
  let baseline = !cursor;
  const events = /** @type {UsageEvent[]} */ ([]);
  let fd;
  try { fd = openSync(file, 'r'); } catch {
    return { events, cursor: cursor ?? { offset: 0, seen: {}, touchedAt: nowMs }, readable: false };
  }
  try {
    const size = fstatSync(fd).size;
    if (size < offset) { offset = 0; totals = undefined; baseline = true; }
    let skipFirstLine = false;
    if (size - offset > MAX_READ_BYTES) {
      offset = size - MAX_READ_BYTES;
      totals = undefined;
      baseline = true;
      skipFirstLine = true;
    }
    const buf = Buffer.alloc(size - offset);
    const length = readSync(fd, buf, 0, buf.length, offset);
    const end = buf.lastIndexOf(10, length - 1);
    const complete = end < 0 || length === 0 ? '' : buf.subarray(0, end + 1).toString('utf8');
    let last = /** @type {UsageEvent | undefined} */ (undefined);
    const lines = complete.split('\n');
    if (skipFirstLine) lines.shift();
    for (const line of lines) {
      if (!line.includes('"token_count"')) continue;
      let entry;
      try { entry = JSON.parse(line); } catch { continue; }
      if (entry?.type !== 'event_msg' || entry.payload?.type !== 'token_count') continue;
      const at = Date.parse(entry.timestamp);
      if (!Number.isFinite(at) || at > nowMs + 60_000) continue;
      const raw = entry.payload.info?.total_token_usage;
      let weight = 0;
      if (raw && Number.isFinite(raw.input_tokens) && Number.isFinite(raw.output_tokens)
        && COUNTERS.every((key) => raw[key] == null || (Number.isFinite(raw[key]) && raw[key] >= 0))) {
        const next = Object.fromEntries(COUNTERS.map((key) => [key, raw[key] ?? 0]));
        // A counter reset starts a new baseline (resumed/forked/replaced file).
        const reset = totals && COUNTERS.some((key) => next[key] < (totals?.[key] ?? 0));
        if (!baseline && !reset) {
          const delta = Object.fromEntries(COUNTERS.map((key) => [key, next[key] - (totals?.[key] ?? 0)]));
          weight = weighted(delta, weights);
        }
        totals = next;
      }
      const bucket = entry.payload.rate_limits?.limit_id;
      const event = { at, weight: bucket != null && bucket !== 'codex' ? 0 : weight, readings: readingsFrom(entry.payload.rate_limits) };
      if (baseline) last = event;
      else events.push(event);
    }
    if (last) events.push({ ...last, weight: 0 });
    return {
      events,
      cursor: { offset: offset + Buffer.byteLength(complete), seen: {}, touchedAt: nowMs, ...(totals ? { totals } : {}) },
      readable: true,
    };
  } finally { closeSync(fd); }
}
