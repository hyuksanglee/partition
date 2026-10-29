// 사용자에게 보이는 문구(ko/en). 언어는 config.language, 'auto'면 LANG/LC_ALL로 정한다.

const ko = {
  'window.fiveHour': '5시간',
  'window.sevenDay': '주간',
  'statusline.waiting': '사용률 대기',
  'warn': 'Partition: {project}이(가) {window} 예산 {budget}%p 중 {used}%p를 썼어요.',
  'wrap': 'Partition: {project}의 {window} 예산이 {left}%p 남았어요. 지금 하던 작업을 마무리하고, 남은 일을 짧게 정리해 주세요. 새 작업은 시작하지 마세요.',
  'block': 'Partition: {project}의 {window} 예산({budget}%p)을 다 썼어요. {reset}에 리셋돼요. 예산을 바꾸려면 /partition:budget 또는 /partition:ui',
  'block.tool': 'Partition: 이 프로젝트의 예산을 다 써서 도구 실행을 막았어요.',
  'setup.needed': 'Partition: status line이 연결되지 않아 사용량을 셀 수 없어요. /partition:setup 으로 연결하세요.',
  'status.title': 'Partition · {project}',
  'status.window': '{window}: 이 프로젝트 {used}%p / 예산 {budget} · 전체 {total}% · 리셋 {reset}',
  'status.noData': '{window}: 아직 사용률 값이 없어요 (status line이 한 번 돌아야 해요)',
  'status.noBudget': '없음',
  'status.others': '  다른 프로젝트 {used}%p · 미귀속 {unattributed}%p · 추적 전 {before}%p',
  'status.notConnected': 'status line 미연결 → /partition:setup',
  'budget.set': '{project}의 {window} 예산을 {value}%p로 정했어요. (설정 가능 0–{max})',
  'budget.cleared': '{project}의 {window} 예산을 해제했어요.',
  'budget.usage': '사용법: /partition:budget <0–100 | off> [--week]',
  'error.out_of_range': '0–100 사이로 정해 주세요.',
  'error.over_allocated': '다른 프로젝트에 이미 할당돼 있어 최대 {max}%p까지 정할 수 있어요.',
  'ui.opening': 'Partition 설정 창을 여는 중이에요.',
  'unknown': '알 수 없는 명령이에요: {name}. 쓸 수 있는 것: ui, status, budget, setup',
};

/** @type {Record<keyof typeof ko, string>} */
const en = {
  'window.fiveHour': '5-hour',
  'window.sevenDay': 'weekly',
  'statusline.waiting': 'waiting for usage',
  'warn': 'Partition: {project} has used {used} of its {budget}pp {window} budget.',
  'wrap': 'Partition: {project} has {left}pp left in its {window} budget. Wrap up the current task and briefly summarize what remains. Do not start new work.',
  'block': 'Partition: {project} used its {window} budget ({budget}pp). It resets at {reset}. To change it: /partition:budget or /partition:ui',
  'block.tool': 'Partition: this project used its budget, so tool use is blocked.',
  'setup.needed': 'Partition: the status line is not connected, so usage cannot be counted. Run /partition:setup.',
  'status.title': 'Partition · {project}',
  'status.window': '{window}: this project {used}pp / budget {budget} · total {total}% · resets {reset}',
  'status.noData': '{window}: no usage value yet (the status line has to run once)',
  'status.noBudget': 'none',
  'status.others': '  other projects {used}pp · unattributed {unattributed}pp · before tracking {before}pp',
  'status.notConnected': 'status line not connected → /partition:setup',
  'budget.set': 'Set the {window} budget for {project} to {value}pp. (allowed 0–{max})',
  'budget.cleared': 'Cleared the {window} budget for {project}.',
  'budget.usage': 'Usage: /partition:budget <0–100 | off> [--week]',
  'error.out_of_range': 'Use a value from 0 to 100.',
  'error.over_allocated': 'Other projects already hold the rest, so the most you can set is {max}pp.',
  'ui.opening': 'Opening the Partition settings window.',
  'unknown': 'Unknown command: {name}. Available: ui, status, budget, setup',
};

/** @typedef {keyof typeof ko} MessageKey */
/** @typedef {'ko' | 'en'} Lang */

/**
 * @param {'auto' | Lang} [setting]
 * @returns {Lang}
 */
export function resolveLang(setting = 'auto') {
  if (setting === 'ko' || setting === 'en') return setting;
  const env = process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || '';
  return env.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

/**
 * @param {Lang} lang
 * @param {MessageKey} key
 * @param {Record<string, string | number>} [vars]
 */
export function t(lang, key, vars = {}) {
  const text = (lang === 'ko' ? ko : en)[key];
  return text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/** %p 값을 보기 좋게: 소수 1자리, 끝의 .0은 뺀다. */
export function fmtPp(/** @type {number} */ n) {
  return String(Math.round(n * 10) / 10);
}

/** @param {number} epochSec */
export function fmtTime(epochSec) {
  const d = new Date(epochSec * 1000);
  const pad = (/** @type {number} */ n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
