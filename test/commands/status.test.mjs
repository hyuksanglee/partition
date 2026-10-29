import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { useTempHome } from '../helpers.mjs';
import { bar, displayNames, displayWidth, status } from '../../src/commands/status.mjs';
import { defaultConfig } from '../../src/store/config.mjs';
import { startTracking } from '../../src/core/window.mjs';

const root = useTempHome();
const proj = join(root, 'A');
const nowSec = 1_000_000;
const config = { ...defaultConfig(), budgets: { [proj]: { fiveHour: 60 } } };
const state = {
  version: /** @type {1} */ (1),
  transcripts: {},
  windows: {
    fiveHour: { ...startTracking(nowSec + 3600, 45), beforeTracking: 37, byProject: { [proj]: 50 } },
    sevenDay: { ...startTracking(nowSec + 86400, 21), byProject: { [proj]: 1 } },
  },
};

test('막대: 비율만큼 채우고 넘치면 꽉 찬다', () => {
  assert.equal(bar(0), '░'.repeat(24));
  assert.equal(bar(0.5), '█'.repeat(12) + '░'.repeat(12));
  assert.equal(bar(2), '█'.repeat(24));
});

test('한글은 두 칸으로 센다', () => {
  assert.equal(displayWidth('계정 전체'), 9);
  assert.equal(displayWidth('Account'), 7);
});

test('한국어: 막대·단계·내역, 라벨 정렬', () => {
  const text = status(proj, { config, state, lang: 'ko', nowSec }).text;
  assert.match(text, /5시간 · 리셋/);
  assert.match(text, /이 프로젝트 {2}█{20}░{4} {2}50 \/ 60%p {2}⚠ 경고/);
  assert.match(text, /계정 전체 {4}█{11}░{13} {2}45%/);
  assert.match(text, /├ A {5}50%p\n {15}└ 기타 {2}37%p\n/);
  assert.doesNotMatch(text, /미귀속/, '0이면 숨긴다');
});

test('다른 프로젝트는 이름으로, 미귀속은 0보다 크면 보인다', () => {
  const busy = { ...state, windows: { ...state.windows, fiveHour: { ...state.windows.fiveHour, byProject: { [proj]: 5, '/w/small': 1, '/w/api': 3, '/w/zero': 0 }, unattributed: 1.5 } } };
  const text = status(proj, { config, state: busy, lang: 'ko', nowSec }).text;
  assert.match(text, /├ A {9}5%p\n {15}├ api {7}3%p\n {15}├ small {5}1%p\n {15}├ 미귀속 {2}1\.5%p\n {15}└ 기타 {5}37%p/, '지금 프로젝트 먼저, 나머지는 많이 쓴 순, 기타는 맨 끝');
  assert.doesNotMatch(text, /zero/);
  assert.match(text, /이 프로젝트 {2}1%p · 예산 없음/);
});

test('영어', () => {
  const text = status(proj, { config, state, lang: 'en', nowSec }).text;
  assert.match(text, /5-hour · resets/);
  assert.match(text, /This project {2}█+░* {2}50 \/ 60pp {2}⚠ warning/);
  assert.match(text, /1pp · no budget/);
});

test('값이 없으면 안내만', () => {
  const text = status(proj, { config, state: { ...state, windows: {} }, lang: 'ko', nowSec }).text;
  assert.match(text, /5시간: 아직 사용률 값이 없어요/);
});

test('이름이 겹치면 상위 폴더까지 붙인다', () => {
  const names = displayNames(['/home/me/app', '/work/app', '/work/api']);
  assert.deepEqual([...names.values()], ['me/app', 'work/app', 'api']);
});
