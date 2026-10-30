import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initialTab, budgetSaveImpact } from '../../src/ui/page/policy.mjs';

test('ready connections open budgets; missing registration or trust opens connection', () => {
  assert.equal(initialTab({ connected: true, ready: true }), 'budget');
  assert.equal(initialTab({ connected: true }), 'budget');
  assert.equal(initialTab({ connected: true, ready: false }), 'connection');
  assert.equal(initialTab({ connected: false }), 'connection');
  assert.equal(initialTab({ connected: true, requested: 'invalid' }), 'budget');
  assert.equal(initialTab({ connected: true, ready: true, requested: 'connection' }), 'connection');
  assert.equal(initialTab({ connected: false, requested: 'rules' }), 'rules');
});

test('a live project at or above its new budget shows the correct saving consequence', () => {
  const state = { value: 15, used: 20, hasData: true, block: true, max: 35 };
  assert.equal(budgetSaveImpact(state), 'block');
  assert.equal(budgetSaveImpact({ ...state, value: 20 }), 'block');
  assert.equal(budgetSaveImpact({ ...state, block: false }), 'warn');
  assert.equal(budgetSaveImpact({ ...state, value: 25 }), null);
});

test('clearing a budget, expired usage, and invalid amounts do not promise a new block', () => {
  const state = { value: 15, used: 20, hasData: true, block: true, max: 35 };
  for (const value of [null, 0, -1, NaN, Infinity, 36]) assert.equal(budgetSaveImpact({ ...state, value }), null);
  assert.equal(budgetSaveImpact({ ...state, hasData: false }), null);
  assert.equal(budgetSaveImpact({ ...state, used: 5 }), null, 'pre-tracking/account usage is not this project usage');
});
