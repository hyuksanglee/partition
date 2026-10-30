import { WINDOW_KEYS, addPending, applyReading } from '../core/window.mjs';
import { loadConfig } from '../store/config.mjs';
import { updateState } from '../store/state.mjs';
import { readNewUsage } from './transcript.mjs';

const CURSOR_TTL_MS = 8 * 24 * 3600 * 1000;

/**
 * Read all previously observed sessions before applying account readings, so
 * simultaneous projects contribute their pending weights before a usage rise.
 * Must run with the Codex provider selected; updateState holds the state lock.
 * @param {string} file
 * @param {string} project
 * @param {number} [nowMs]
 */
export function record(file, project, nowMs = Date.now()) {
  const config = loadConfig();
  let readable = false;
  const state = updateState((s) => {
    const transcripts = { ...s.transcripts };
    const files = new Set([file, ...Object.keys(transcripts)]);
    const events = /** @type {(import('./transcript.mjs').UsageEvent & { project: string })[]} */ ([]);
    for (const path of files) {
      const prev = transcripts[path];
      if (path !== file && (!prev?.project || nowMs - prev.touchedAt > CURSOR_TTL_MS)) {
        delete transcripts[path];
        continue;
      }
      const owner = path === file ? project : prev.project;
      if (!owner) continue;
      const r = readNewUsage(path, prev, config.weights, nowMs);
      if (path === file) readable = r.readable;
      if (!r.readable) continue;
      const touchedAt = path !== file && prev && prev.offset === r.cursor.offset ? prev.touchedAt : nowMs;
      transcripts[path] = { ...r.cursor, project: owner, touchedAt };
      events.push(...r.events.map((e) => ({ ...e, project: owner })));
    }
    const windows = { ...s.windows };
    const readingAt = { ...s.readingAt };
    for (const e of events.sort((a, b) => a.at - b.at)) {
      for (const key of WINDOW_KEYS) {
        // Older parallel transcripts must never move the account backwards or
        // reset a live window. Their already-spent tokens aren't future pending.
        if (e.at < (readingAt[key] ?? 0)) continue;
        const reading = e.readings[key];
        let win = windows[key];
        if (win && e.weight > 0) win = addPending(win, { [e.project]: e.weight });
        if (reading && reading.resetsAt > nowMs / 1000) {
          win = applyReading(win, reading);
          readingAt[key] = e.at;
        }
        if (win) windows[key] = win;
      }
    }
    return {
      ...s, windows, transcripts, readingAt,
      ...(readable ? { lastCodexHookAt: nowMs, codexHookSource: /** @type {'plugin' | 'standalone'} */ (process.env.PLUGIN_ROOT ? 'plugin' : 'standalone') } : {}),
    };
  });
  return { state, readable };
}
