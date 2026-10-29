import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { useTempHome } from '../helpers.mjs';

useTempHome();
const HOOK = fileURLToPath(new URL('../../src/claude/hook.mjs', import.meta.url));

test('/usage를 받으려고 띄운 claude 안에서는 hook이 아무것도 하지 않는다', () => {
  const input = JSON.stringify({ hook_event_name: 'UserPromptSubmit', cwd: '/', prompt: '/partition:status' });
  const normal = spawnSync(process.execPath, [HOOK], { input, encoding: 'utf8', env: process.env });
  assert.match(normal.stdout, /already ran/);
  const nested = spawnSync(process.execPath, [HOOK], { input, encoding: 'utf8', env: { ...process.env, PARTITION_FETCHING: '1' } });
  assert.equal(nested.stdout, '');
});
