// 사용자에게 보이는 문구(ko/en). 언어는 config.language, 'auto'면 LANG/LC_ALL,
// 그게 없으면(데스크톱 앱이 띄운 hook은 LANG이 비어 있다) macOS 언어 설정으로 정한다.
import { execFileSync } from 'node:child_process';

const ko = {
  'window.fiveHour': '5시간',
  'window.sevenDay': '주간',
  'statusline.waiting': '사용률 대기',
  'warn': 'Partition: {project}이(가) {window} 예산 {budget}%p 중 {used}%p를 썼어요.',
  'wrap': 'Partition: {project}의 {window} 예산이 {left}%p 남았어요. 지금 하던 작업을 마무리하고, 남은 일을 짧게 정리해 주세요. 새 작업은 시작하지 마세요.',
  'block': 'Partition: {project}의 {window} 예산({budget}%p)을 다 썼어요. {reset}에 리셋돼요. 예산을 바꾸려면 /partition:budget 또는 /partition:ui',
  'block.tool': 'Partition: 이 프로젝트의 예산을 다 써서 도구 실행을 막았어요.',
  'setup.needed': 'Partition: 터미널에서는 status line을 연결해야 사용량이 바로 반영돼요: /partition:setup (데스크톱 앱 Code 탭은 응답이 끝날 때 따로 받아서 필요 없어요)',
  'status.title': 'Partition · {project}',
  'status.header': '{window} · 리셋 {reset}',
  'status.noData': '{window}: 아직 사용률 값이 없어요 (응답이 한 번 끝나야 해요)',
  'status.project': '이 프로젝트',
  'status.account': '계정 전체',
  'status.noBudget': '{used}%p · 예산 없음',
  'status.before': '기타',
  'status.unattributed': '미귀속',
  'status.unit': '%p',
  'stage.warn': '⚠ 경고',
  'stage.wrap': '⏳ 마무리',
  'stage.block': '⛔ 차단',
  'status.notConnected': 'status line 미연결: 터미널에서는 /partition:setup 권장 (Code 탭은 필요 없음)',
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
  'setup.needed': 'Partition: in the terminal, connect the status line so usage updates right away: /partition:setup (not needed in the desktop app Code tab, which fetches usage after each response)',
  'status.title': 'Partition · {project}',
  'status.header': '{window} · resets {reset}',
  'status.noData': '{window}: no usage value yet (a response has to finish once)',
  'status.project': 'This project',
  'status.account': 'Account',
  'status.noBudget': '{used}pp · no budget',
  'status.before': 'other',
  'status.unattributed': 'unattributed',
  'status.unit': 'pp',
  'stage.warn': '⚠ warning',
  'stage.wrap': '⏳ wrap up',
  'stage.block': '⛔ blocked',
  'status.notConnected': 'status line not connected: /partition:setup recommended in the terminal (not needed in the Code tab)',
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
  const env = process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || systemLanguage();
  return env.toLowerCase().startsWith('ko') ? 'ko' : 'en';
}

/** @type {string | undefined} */
let cachedSystemLanguage;

/** macOS의 첫 번째 선호 언어(예: "ko-KR"). 다른 OS나 실패하면 빈 문자열. 약 10ms라 프로세스당 한 번만. */
function systemLanguage() {
  if (cachedSystemLanguage !== undefined) return cachedSystemLanguage;
  cachedSystemLanguage = '';
  if (process.platform === 'darwin') {
    try {
      const out = execFileSync('defaults', ['read', '-g', 'AppleLanguages'], { encoding: 'utf8', timeout: 1000 });
      cachedSystemLanguage = /"?([A-Za-z-]+)"?/.exec(out.replace(/[()\s]/g, ''))?.[1] ?? '';
    } catch {}
  }
  return cachedSystemLanguage;
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
