import { WINDOW_KEYS } from '../core/window.mjs';
import { projectName } from '../project.mjs';
import { fmtPp, fmtTime, t } from '../messages.mjs';
import { isConnected } from './setup.mjs';
import { provider } from '../store/paths.mjs';
import { check } from './check.mjs';

const BAR_WIDTH = 24;

/**
 * 고정폭 글꼴에서 한글·전각 문자는 두 칸을 차지한다.
 * @param {string} s
 */
export function displayWidth(s) {
  let w = 0;
  for (const ch of s) w += /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(ch) ? 2 : 1;
  return w;
}

/** @param {string} s @param {number} width */
const pad = (s, width) => s + ' '.repeat(Math.max(0, width - displayWidth(s)));

/**
 * @param {number} ratio 0–1 (넘으면 꽉 찬 막대)
 * @returns {string}
 */
export function bar(ratio) {
  const filled = Math.round(Math.min(1, Math.max(0, ratio)) * BAR_WIDTH);
  return '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled);
}

/**
 * 폴더 이름으로 보여주되, 이름이 겹치면 상위 폴더까지 붙인다(예: work/app, home/app).
 * @param {string[]} projects
 * @returns {Map<string, string>}
 */
export function displayNames(projects) {
  const base = projects.map((p) => projectName(p));
  return new Map(
    projects.map((p, i) => {
      if (base.filter((b) => b === base[i]).length < 2) return [p, base[i]];
      const parts = p.split(/[\\/]/).filter(Boolean);
      return [p, parts.slice(-2).join('/')];
    }),
  );
}

/**
 * @param {string} project
 * @param {{ config: import('../store/config.mjs').Config, state: import('../store/state.mjs').State, lang: import('../messages.mjs').Lang, nowSec: number }} ctx
 */
export function status(project, { config, state, lang, nowSec }) {
  const result = check(project, config, state, nowSec);
  const connected = isConnected();
  const labels = [t(lang, 'status.project'), t(lang, 'status.account')];
  const labelWidth = Math.max(...labels.map(displayWidth)) + 2;
  const unit = t(lang, 'status.unit');
  const lines = [t(lang, 'status.title', { project: projectName(project) }) + (provider() === 'codex' ? ' · Codex' : '')];

  for (const key of WINDOW_KEYS) {
    const w = result.windows[key];
    const window = t(lang, `window.${key}`);
    lines.push('');
    if (!w.hasData) {
      lines.push(t(lang, 'status.noData', { window }));
      continue;
    }
    lines.push(t(lang, 'status.header', { window, reset: fmtTime(w.resetsAt) }));
    const mark = w.budget != null && w.stage !== 'ok' ? `  ${t(lang, `stage.${w.stage}`)}` : '';
    lines.push(
      w.budget == null
        ? `  ${pad(labels[0], labelWidth)}${t(lang, 'status.noBudget', { used: fmtPp(w.used) })}`
        : `  ${pad(labels[0], labelWidth)}${bar(w.budget > 0 ? w.used / w.budget : 1)}  ${fmtPp(w.used)} / ${w.budget}${unit}${mark}`,
    );
    lines.push(`  ${pad(labels[1], labelWidth)}${bar(w.totalPct / 100)}  ${fmtPp(w.totalPct)}%`);
    // 계정 사용률의 내역. 한 줄로 쓰면 좁은 창에서 줄이 넘어가 정렬이 깨져서 항목마다 한 줄씩.
    // 프로젝트는 이름으로, 지금 프로젝트를 먼저, 나머지는 많이 쓴 순. 미귀속, 맨 끝에 기타(Partition 적용 전 사용).
    // 0인 프로젝트·미귀속·기타는 숨긴다(지금 프로젝트는 항상 보인다).
    const byProject = state.windows[key]?.byProject ?? {};
    const others = Object.entries(byProject)
      .filter(([p, v]) => p !== project && v > 0)
      .sort((a, b) => b[1] - a[1]);
    const names = displayNames([project, ...others.map(([p]) => p)]);
    const rows = [
      [names.get(project), w.used],
      ...others.map(([p, v]) => [names.get(p), v]),
      ...(w.unattributed > 0 ? [[t(lang, 'status.unattributed'), w.unattributed]] : []),
      ...(w.beforeTracking > 0 ? [[t(lang, 'status.before'), w.beforeTracking]] : []),
    ];
    const nameWidth = Math.max(...rows.map(([name]) => displayWidth(String(name)))) + 2;
    const numWidth = Math.max(...rows.map(([, v]) => fmtPp(Number(v)).length));
    rows.forEach(([name, v], i) => {
      const branch = i === rows.length - 1 ? '└' : '├';
      lines.push(`  ${' '.repeat(labelWidth)}${branch} ${pad(String(name), nameWidth)}${fmtPp(Number(v)).padStart(numWidth)}${unit}`);
    });
  }
  if (provider() === 'codex') lines.push('', t(lang, 'codex.connection'));
  else if (!connected) lines.push('', t(lang, 'status.notConnected'));
  return { text: lines.join('\n'), data: { project, provider: provider(), connected, lastHookAt: state.lastCodexHookAt ?? null, ...result } };
}
