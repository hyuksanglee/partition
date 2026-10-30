import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { useTempHome } from '../helpers.mjs';
import { budgetCommand, setProjectBudget } from '../../src/commands/budget.mjs';
import { loadConfig, updateConfig } from '../../src/store/config.mjs';
import { loadState, updateState } from '../../src/store/state.mjs';
import { startTracking, WINDOW_KEYS } from '../../src/core/window.mjs';
import { check } from '../../src/commands/check.mjs';

useTempHome();
const proj = '/work/app';
beforeEach(() => {
  updateConfig((c) => ({ ...c, budgets: {}, rules: { ...c.rules, block: true } }));
  updateState((s) => ({ ...s, windows: {} }));
});

test('0은 그 창의 예산을 해제한다(제한 없음)', () => {
  setProjectBudget(proj, 'fiveHour', 40, 'ko');
  setProjectBudget(proj, 'sevenDay', 20, 'ko');
  const r = setProjectBudget(proj, 'sevenDay', 0, 'ko');
  assert.equal(r.ok, true);
  assert.match(r.text, /해제했어요/);
  assert.deepEqual(loadConfig().budgets[proj], { fiveHour: 40 }, '5시간은 그대로');
});

test('both budgets can be lowered below attributed project usage and block without changing usage', () => {
  const now = Date.now() / 1000;
  updateConfig((c) => ({ ...c, budgets: {}, rules: { ...c.rules, block: true } }));
  for (const window of WINDOW_KEYS) {
    updateState((s) => ({ ...s, windows: { ...s.windows, [window]: { ...startTracking(now + 3600, 65), lastUsedPct: 85, byProject: { [proj]: 20 } } } }));
    assert.equal(setProjectBudget(proj, window, 30, 'ko').ok, true);
    assert.equal(setProjectBudget(proj, window, 15, 'ko').ok, true);
    const result = check(proj, loadConfig(), loadState(), now).windows[window];
    assert.equal(result.budget, 15);
    assert.equal(result.used, 20);
    assert.equal(result.beforeTracking, 65);
    assert.equal(result.stage, 'block');
  }
});

test('account usage before tracking never exhausts a project budget; expired records fail open', () => {
  const now = Date.now() / 1000;
  updateConfig((c) => ({ ...c, budgets: {} }));
  updateState((s) => ({ ...s, windows: { fiveHour: { ...startTracking(now + 3600, 65), lastUsedPct: 70, byProject: { [proj]: 5 } } } }));
  assert.equal(setProjectBudget(proj, 'fiveHour', 15, 'ko').ok, true);
  assert.equal(check(proj, loadConfig(), loadState(), now).windows.fiveHour.stage, 'ok');
  assert.equal(setProjectBudget(proj, 'fiveHour', 3, 'ko').ok, true);
  assert.equal(check(proj, loadConfig(), loadState(), now).windows.fiveHour.stage, 'block');
  assert.equal(check(proj, loadConfig(), loadState(), now + 3601).windows.fiveHour.stage, 'ok');
  assert.equal(setProjectBudget(proj, 'fiveHour', 0, 'ko').ok, true);
  assert.equal(loadConfig().budgets[proj], undefined);
});

test('/partition:budget 0 --week, off도 같다', () => {
  setProjectBudget(proj, 'fiveHour', 40, 'en');
  setProjectBudget(proj, 'sevenDay', 20, 'en');
  budgetCommand(proj, ['0', '--week'], 'en');
  assert.equal(loadConfig().budgets[proj].sevenDay, undefined);
  budgetCommand(proj, ['off'], 'en');
  assert.equal(loadConfig().budgets[proj], undefined);
});
