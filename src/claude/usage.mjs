// status line을 실행하지 않는 곳(데스크톱 앱 Code 탭)을 위한 사용률 얻기.
// `claude -p "/usage"`는 AI를 부르지 않고(토큰 0) 5시간·주간 사용률을 문장으로 출력한다.
// 공식 기계용 형식이 아니므로, 형식이 조금이라도 다르면 값을 버리고 막지 않는다(fail-open).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';

/** hook 안에서 띄운 claude가 다시 Partition hook을 부르지 않게 하는 표시 */
export const FETCHING_ENV = 'PARTITION_FETCHING';
const TIMEOUT_MS = 10_000;

/** @typedef {{ used_percentage: number, resets_at: number }} LimitValue */
/** @typedef {{ five_hour: LimitValue, seven_day: LimitValue }} RateLimits */

/** PATH에 없을 때도 찾는다(데스크톱 앱 hook의 PATH는 확인 못 함). */
export function findClaude(env = process.env) {
  const dirs = (env.PATH ?? '').split(delimiter).filter(Boolean);
  dirs.push(join(homedir(), '.local/bin'), '/opt/homebrew/bin', '/usr/local/bin');
  for (const dir of dirs) {
    const bin = join(dir, 'claude');
    if (existsSync(bin)) return bin;
  }
  return null;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * 시간대 tz의 벽시계 시각을 epoch(ms)로 바꾼다.
 * @param {number} y @param {number} mo 0–11 @param {number} d @param {number} h @param {number} mi
 * @param {string | undefined} tz IANA 이름. 없으면 이 컴퓨터 시간대
 */
export function zonedToEpochMs(y, mo, d, h, mi, tz) {
  if (!tz) return new Date(y, mo, d, h, mi).getTime();
  const guess = Date.UTC(y, mo, d, h, mi);
  // guess를 tz로 보면 몇 시인지 → 차이만큼 보정
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric',
    }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]),
  );
  const seen = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute));
  return guess - (seen - guess);
}

/**
 * "Oct 29 at 7:29pm (Asia/Seoul)" 또는 "7:29pm (Asia/Seoul)" → epoch 초.
 * 연도가 없으므로 지금 이후 가장 가까운 시각으로 정한다.
 * @param {string} text
 * @param {number} nowMs
 * @returns {number | null}
 */
export function parseResetTime(text, nowMs) {
  const m = /^(?:([A-Za-z]{3})[a-z]*\.? (\d{1,2})(?:,? (\d{4}))? at )?(\d{1,2})(?::(\d{2}))? ?(am|pm)(?: \(([^)]+)\))?$/i.exec(text.trim());
  if (!m) return null;
  const [, mon, day, year, hh, mm = '0', ampm, tz] = m;
  if (tz) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
    } catch {
      return null;
    }
  }
  let hour = Number(hh) % 12;
  if (ampm.toLowerCase() === 'pm') hour += 12;
  const minute = Number(mm);
  const now = new Date(nowMs);
  if (mon) {
    const mo = MONTHS.indexOf(mon.toLowerCase());
    if (mo < 0) return null;
    const y = year ? Number(year) : now.getFullYear();
    let t = zonedToEpochMs(y, mo, Number(day), hour, minute, tz);
    if (!year && t < nowMs - 24 * 3600 * 1000) t = zonedToEpochMs(y + 1, mo, Number(day), hour, minute, tz);
    return Math.round(t / 1000);
  }
  let t = zonedToEpochMs(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, tz);
  if (t < nowMs) t += 24 * 3600 * 1000;
  return Math.round(t / 1000);
}

/**
 * /usage 출력에서 5시간·주간 사용률을 읽는다. 둘 중 하나라도 못 읽으면 null.
 * @param {string} text
 * @param {number} [nowMs]
 * @returns {RateLimits | null}
 */
export function parseUsage(text, nowMs = Date.now()) {
  /** @param {RegExp} re */
  const read = (re) => {
    const m = re.exec(text);
    if (!m) return null;
    const used = Number(m[1]);
    const resets = parseResetTime(m[2], nowMs);
    if (!Number.isFinite(used) || used < 0 || used > 100 || resets == null) return null;
    return { used_percentage: used, resets_at: resets };
  };
  const five = read(/^Current session: (\d+(?:\.\d+)?)% used · resets (.+)$/m);
  const week = read(/^Current week \(all models\): (\d+(?:\.\d+)?)% used · resets (.+)$/m);
  return five && week ? { five_hour: five, seven_day: week } : null;
}

/**
 * `claude -p "/usage"`를 실행해 사용률을 얻는다. 실패하면 null.
 * @returns {RateLimits | null}
 */
export function fetchUsage(nowMs = Date.now()) {
  const bin = findClaude();
  if (!bin) return null;
  const r = spawnSync(bin, ['-p', '/usage'], {
    cwd: tmpdir(),
    env: { ...process.env, [FETCHING_ENV]: '1' },
    encoding: 'utf8',
    timeout: TIMEOUT_MS,
  });
  if (r.status !== 0 || !r.stdout) return null;
  return parseUsage(r.stdout, nowMs);
}
