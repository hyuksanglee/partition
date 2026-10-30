import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { findClaudePid, isAlive } from '../src/owner.mjs';

test('살아 있는 프로세스와 끝난 프로세스를 구분한다', () => {
  assert.equal(isAlive(process.pid), true);
  const done = spawnSync(process.execPath, ['-e', '0']);
  assert.equal(isAlive(/** @type {number} */ (done.pid)), false);
});

test('claude 조상이 없으면 null(던지지 않는다)', () => {
  const pid = findClaudePid(process.pid);
  assert.ok(pid === null || Number.isInteger(pid));
});
