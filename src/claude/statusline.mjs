// status line 진입점. AI 응답이 올 때마다 Claude Code가 실행한다(토큰 안 씀).
// 1) 사용률과 새 토큰을 기록하고 2) 한 줄을 출력한다. 원래 status line이 있으면 같이 보여준다.
// 어떤 오류가 나도 status line은 깨지지 않게 한다.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { WINDOW_KEYS, addPending, applyReading, isExpired } from '../core/window.mjs';
import { loadConfig } from '../store/config.mjs';
import { loadInstall, loadState, updateState } from '../store/state.mjs';
import { findProject, projectName } from '../project.mjs';
import { fmtPp, resolveLang, t } from '../messages.mjs';
import { readNewUsage } from './transcript.mjs';

/** @typedef {import('../core/window.mjs').WindowKey} WindowKey */
/** @typedef {import('../core/window.mjs').Reading} Reading */
/** @typedef {import('../store/state.mjs').State} State */

/**
 * @typedef {object} StatusLineInput 필요한 필드만. 출처: code.claude.com/docs/en/statusline
 * @property {string} [cwd]
 * @property {{ project_dir?: string }} [workspace]
 * @property {string} [transcript_path]
 * @property {Record<string, { used_percentage?: number, resets_at?: number } | undefined>} [rate_limits]
 */

const INPUT_KEY = /** @type {const} */ ({ fiveHour: 'five_hour', sevenDay: 'seven_day' });
const CURSOR_TTL_MS = 8 * 24 * 3600 * 1000;

/**
 * @param {StatusLineInput['rate_limits']} rateLimits
 * @returns {Partial<Record<WindowKey, Reading>>}
 */
export function readingsFrom(rateLimits) {
  /** @type {Partial<Record<WindowKey, Reading>>} */
  const out = {};
  for (const key of WINDOW_KEYS) {
    const r = rateLimits?.[INPUT_KEY[key]];
    if (typeof r?.used_percentage === 'number' && typeof r.resets_at === 'number') {
      out[key] = { usedPct: r.used_percentage, resetsAt: r.resets_at };
    }
  }
  return out;
}

/**
 * @param {StatusLineInput} input
 * @returns {string}
 */
export function projectOf(input) {
  return findProject(input.workspace?.project_dir || input.cwd || process.cwd());
}

/**
 * 사용률과 새 토큰을 state에 기록한다.
 * @param {StatusLineInput} input
 * @param {number} [nowMs]
 * @returns {State}
 */
export function record(input, nowMs = Date.now()) {
  const config = loadConfig();
  const project = projectOf(input);
  const readings = readingsFrom(input.rate_limits);
  const hasReadings = Object.keys(readings).length > 0;

  return updateState((s) => {
    if (!hasReadings) return { ...s, lastStatusLineAt: nowMs };

    const transcripts = Object.fromEntries(
      Object.entries(s.transcripts).filter(([, c]) => nowMs - c.touchedAt < CURSOR_TTL_MS),
    );
    let weight = 0;
    if (input.transcript_path) {
      const r = readNewUsage(input.transcript_path, transcripts[input.transcript_path], config.weights, nowMs);
      weight = r.weight;
      transcripts[input.transcript_path] = r.cursor;
    }

    const windows = { ...s.windows };
    for (const key of WINDOW_KEYS) {
      const reading = readings[key];
      const win = windows[key];
      if (!reading) {
        if (win && weight > 0) windows[key] = addPending(win, { [project]: weight });
        continue;
      }
      // 처음 보는 창: 지금까지의 사용은 이미 사용률에 들어 있으니 토큰을 더하지 않는다.
      windows[key] = win ? applyReading(addPending(win, { [project]: weight }), reading) : applyReading(undefined, reading);
    }
    return { ...s, windows, transcripts, lastStatusLineAt: nowMs };
  });
}

/**
 * 예: [A 12/30%p · 5h 41%]
 * @param {string} project
 * @param {State} state
 * @param {import('../store/config.mjs').Config} config
 * @param {number} nowSec
 */
export function renderSegment(project, state, config, nowSec) {
  const name = projectName(project);
  const five = state.windows.fiveHour;
  if (isExpired(five, nowSec)) return `[${name} · ${t(resolveLang(config.language), 'statusline.waiting')}]`;
  const budget = config.budgets[project] ?? {};
  const parts = [];
  if (budget.fiveHour != null) parts.push(`${fmtPp(five?.byProject[project] ?? 0)}/${budget.fiveHour}%p`);
  parts.push(`5h ${fmtPp(five?.lastUsedPct ?? 0)}%`);
  const week = state.windows.sevenDay;
  if (budget.sevenDay != null && !isExpired(week, nowSec)) {
    parts.push(`7d ${fmtPp(week?.byProject[project] ?? 0)}/${budget.sevenDay}%p`);
  }
  return `[${name} ${parts.join(' · ')}]`;
}

/**
 * setup 전에 쓰던 status line을 같은 입력으로 실행한다.
 * @param {string} raw
 */
function runOriginal(raw) {
  const original = loadInstall().originalStatusLine;
  if (!original?.command) return '';
  const r = spawnSync('/bin/sh', ['-c', original.command], { input: raw, encoding: 'utf8', timeout: 3000 });
  return (r.stdout ?? '').replace(/\n+$/, '');
}

export function main() {
  let raw = '';
  try {
    raw = readFileSync(0, 'utf8');
  } catch {}
  /** @type {StatusLineInput} */
  let input = {};
  try {
    input = JSON.parse(raw);
  } catch {}

  let segment = '';
  try {
    const state = record(input);
    segment = renderSegment(projectOf(input), state, loadConfig(), Date.now() / 1000);
  } catch {
    // 잠금 시간 초과 등: 이번 응답은 기록하지 않고 마지막 값으로 보여준다.
    try {
      segment = renderSegment(projectOf(input), loadState(), loadConfig(), Date.now() / 1000);
    } catch {}
  }

  let original = '';
  try {
    original = runOriginal(raw);
  } catch {}
  const out = !original ? segment : original.includes('\n') ? `${original}\n${segment}` : `${original}  ${segment}`;
  process.stdout.write(out + '\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
