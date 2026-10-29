import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useTempHome } from '../helpers.mjs';
import { budgetCommand, setProjectBudget } from '../../src/commands/budget.mjs';
import { loadConfig } from '../../src/store/config.mjs';

useTempHome();
const proj = '/work/app';

test('0은 그 창의 예산을 해제한다(제한 없음)', () => {
  setProjectBudget(proj, 'fiveHour', 40, 'ko');
  setProjectBudget(proj, 'sevenDay', 20, 'ko');
  const r = setProjectBudget(proj, 'sevenDay', 0, 'ko');
  assert.equal(r.ok, true);
  assert.match(r.text, /해제했어요/);
  assert.deepEqual(loadConfig().budgets[proj], { fiveHour: 40 }, '5시간은 그대로');
});

test('/partition:budget 0 --week, off도 같다', () => {
  setProjectBudget(proj, 'sevenDay', 20, 'en');
  budgetCommand(proj, ['0', '--week'], 'en');
  assert.equal(loadConfig().budgets[proj].sevenDay, undefined);
  budgetCommand(proj, ['off'], 'en');
  assert.equal(loadConfig().budgets[proj], undefined);
});
