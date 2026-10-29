import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { useTempHome } from '../helpers.mjs';
import { record, renderSegment } from '../../src/claude/statusline.mjs';
import { loadConfig, updateConfig } from '../../src/store/config.mjs';

const root = useTempHome();
const projA = join(root, 'A');
const projB = join(root, 'B');
mkdirSync(join(projA, '.git'), { recursive: true });
mkdirSync(join(projB, '.git'), { recursive: true });
const now = Date.parse('2026-10-29T05:00:00Z');
const resets = now / 1000 + 3600;

/** @param {string} id @param {number} output */
const line = (id, output) =>
  JSON.stringify({ type: 'assistant', timestamp: new Date(now).toISOString(), message: { id, usage: { output_tokens: output } } }) + '\n';
/** @param {string} cwd @param {string} transcript @param {number} pct */
const input = (cwd, transcript, pct) => ({
  cwd,
  transcript_path: transcript,
  rate_limits: { five_hour: { used_percentage: pct, resets_at: resets }, seven_day: { used_percentage: pct / 10, resets_at: resets + 86400 } },
});

test('두 프로젝트의 토큰 비중대로 오른 사용률을 나눈다', () => {
  const ta = join(root, 'a.jsonl');
  const tb = join(root, 'b.jsonl');
  writeFileSync(ta, '');
  writeFileSync(tb, '');
  record(input(projA, ta, 10), now); // 추적 시작
  record(input(projB, tb, 10), now);

  appendFileSync(ta, line('a1', 300));
  record(input(projA, ta, 10), now); // 아직 안 오름 → 대기
  appendFileSync(tb, line('b1', 100));
  const s = record(input(projB, tb, 14), now); // 4%p 오름 → A 3, B 1

  assert.equal(s.windows.fiveHour?.beforeTracking, 10);
  assert.ok(Math.abs((s.windows.fiveHour?.byProject[projA] ?? 0) - 3) < 1e-9);
  assert.ok(Math.abs((s.windows.fiveHour?.byProject[projB] ?? 0) - 1) < 1e-9);
});

test('rate_limits가 없으면 사용량을 건드리지 않는다', () => {
  const s = record({ cwd: projA }, now);
  assert.ok(s.lastStatusLineAt === now);
  assert.ok(s.windows.fiveHour);
});

test('표시: [A 3/30%p · 5h 14%]', () => {
  updateConfig((c) => ({ ...c, budgets: { [projA]: { fiveHour: 30 } } }));
  const s = record({ cwd: projA }, now);
  assert.equal(renderSegment(projA, s, loadConfig(), now / 1000), '[A 3/30%p · 5h 14%]');
  assert.equal(renderSegment(projB, s, loadConfig(), now / 1000), '[B 5h 14%]');
});

test('창이 지났으면 대기 표시', () => {
  const s = record({ cwd: projA }, now);
  assert.match(renderSegment(projA, s, loadConfig(), resets + 1), /^\[A · /);
});
