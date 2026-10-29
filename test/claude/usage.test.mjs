import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { useTempHome } from '../helpers.mjs';
import { parseResetTime, parseUsage } from '../../src/claude/usage.mjs';
import { recordUsageAfterResponse, USAGE_MIN_INTERVAL_MS } from '../../src/claude/hook.mjs';
import { loadState, updateState } from '../../src/store/state.mjs';

const root = useTempHome();
const now = Date.parse('2026-10-29T06:00:00Z'); // 서울 15:00

// 2026-10-29 Claude Code 2.1.312 `claude -p "/usage"` 실제 출력의 앞부분
const SAMPLE = `You are currently using your subscription to power your Claude Code usage

Current session: 31% used · resets Oct 29 at 7:29pm (Asia/Seoul)
Current week (all models): 19% used · resets Oct 31 at 3:59pm (Asia/Seoul)

What's contributing to your usage?
`;

test('실제 출력에서 5시간·주간 사용률과 리셋 시각을 읽는다', () => {
  assert.deepEqual(parseUsage(SAMPLE, now), {
    five_hour: { used_percentage: 31, resets_at: Date.parse('2026-10-29T10:29:00Z') / 1000 },
    seven_day: { used_percentage: 19, resets_at: Date.parse('2026-10-31T06:59:00Z') / 1000 },
  });
});

test('형식이 다르면 전부 버린다', () => {
  assert.equal(parseUsage('Current session: 31% used', now), null);
  assert.equal(parseUsage(SAMPLE.replace('Current week (all models)', 'Weekly'), now), null);
  assert.equal(parseUsage(SAMPLE.replace('(Asia/Seoul)', '(Not/AZone)'), now), null);
  assert.equal(parseUsage('', now), null);
});

test('리셋 시각: 시간대·날짜 없음·연도 넘김', () => {
  assert.equal(parseResetTime('Oct 29 at 7:29pm (America/New_York)', now), Date.parse('2026-10-29T23:29:00Z') / 1000);
  assert.equal(parseResetTime('9pm (UTC)', now), Date.parse('2026-10-29T21:00:00Z') / 1000);
  assert.equal(parseResetTime('5am (UTC)', now), Date.parse('2026-10-30T05:00:00Z') / 1000, '이미 지났으면 다음 날');
  assert.equal(parseResetTime('Jan 2 at 12am (UTC)', Date.parse('2026-12-31T00:00:00Z')), Date.parse('2027-01-02T00:00:00Z') / 1000);
  assert.equal(parseResetTime('soon', now), null);
});

test('Stop hook: /usage 값과 새 토큰을 기록하고, 1분 안에는 다시 받지 않는다', () => {
  const proj = join(root, 'A');
  mkdirSync(join(proj, '.git'), { recursive: true });
  const transcript = join(root, 't.jsonl');
  writeFileSync(transcript, '');
  let calls = 0;
  const fetch = () => {
    calls++;
    return parseUsage(SAMPLE, now);
  };
  assert.equal(recordUsageAfterResponse({ hook_event_name: 'Stop', cwd: proj, transcript_path: transcript }, now, fetch), true);
  const s = loadState();
  assert.equal(s.windows.fiveHour?.lastUsedPct, 31);
  assert.equal(s.lastUsageFetchAt, now);
  assert.equal(s.lastStatusLineAt, undefined, 'status line 연결 여부와 섞지 않는다');

  assert.equal(recordUsageAfterResponse({ hook_event_name: 'Stop', cwd: proj }, now + 1000, fetch), false);
  assert.equal(calls, 1);
  assert.equal(recordUsageAfterResponse({ hook_event_name: 'Stop', cwd: proj }, now + USAGE_MIN_INTERVAL_MS, fetch), true);
  assert.equal(calls, 2);
});

test('Stop hook: status line이 방금 돌았으면 건너뛰고, 못 받으면 아무것도 안 바꾼다', () => {
  updateState((s) => ({ ...s, lastStatusLineAt: now + 200_000 }));
  assert.equal(recordUsageAfterResponse({ hook_event_name: 'Stop' }, now + 210_000, () => { throw new Error('불리면 안 됨'); }), false);
  const before = loadState().windows;
  assert.equal(recordUsageAfterResponse({ hook_event_name: 'Stop' }, now + 400_000, () => null), false);
  assert.deepEqual(loadState().windows, before);
});
