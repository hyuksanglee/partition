import { WINDOW_KEYS } from '../core/window.mjs';
import { projectName } from '../project.mjs';
import { fmtPp, fmtTime, t } from '../messages.mjs';
import { isConnected } from '../claude/settings.mjs';
import { check } from './check.mjs';

/**
 * @param {string} project
 * @param {{ config: import('../store/config.mjs').Config, state: import('../store/state.mjs').State, lang: import('../messages.mjs').Lang, nowSec: number }} ctx
 */
export function status(project, { config, state, lang, nowSec }) {
  const result = check(project, config, state, nowSec);
  const connected = isConnected();
  const lines = [t(lang, 'status.title', { project: projectName(project) })];
  for (const key of WINDOW_KEYS) {
    const w = result.windows[key];
    const window = t(lang, `window.${key}`);
    if (!w.hasData) {
      lines.push(t(lang, 'status.noData', { window }));
      continue;
    }
    lines.push(
      t(lang, 'status.window', {
        window,
        used: fmtPp(w.used),
        budget: w.budget == null ? t(lang, 'status.noBudget') : `${w.budget}${lang === 'ko' ? '%p' : 'pp'}`,
        total: fmtPp(w.totalPct),
        reset: fmtTime(w.resetsAt),
      }),
    );
    lines.push(
      t(lang, 'status.others', { used: fmtPp(w.othersPp), unattributed: fmtPp(w.unattributed), before: fmtPp(w.beforeTracking) }),
    );
  }
  if (!connected) lines.push(t(lang, 'status.notConnected'));
  return { text: lines.join('\n'), data: { project, connected, ...result } };
}
