import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useTempHome } from '../helpers.mjs';
import { codexHooksPath } from '../../src/store/paths.mjs';
import { EVENTS, hookCommand } from '../../src/codex/settings.mjs';
import { reviewWithRpc, approveWithRpc } from '../../src/codex/desktop.mjs';

useTempHome();
process.env.PARTITION_PROVIDER = 'codex';

function fixture() {
  const hooks = EVENTS.map((event, i) => ({
    key: `own-${i}`, currentHash: `sha256:definition-${i}`, command: hookCommand(),
    eventName: event[0].toLowerCase() + event.slice(1), enabled: true, trustStatus: 'untrusted',
    sourcePath: codexHooksPath(), source: 'user', handlerType: 'command', isManaged: false,
  }));
  const state = /** @type {Record<string, any>} */ ({ unrelated: { enabled: false, trusted_hash: 'keep-this' } });
  const writes = /** @type {any[]} */ ([]);
  let featureEnabled = true;
  /** @type {import('../../src/codex/app-server.mjs').Rpc} */
  const rpc = async (method, params) => {
    if (method === 'hooks/list') return { data: [{ cwd: '/project', hooks: [...hooks, { ...hooks[0], key: 'unrelated', command: 'echo unrelated' }], errors: [], warnings: [] }] };
    if (method === 'config/read') return {
      config: { features: { hooks: featureEnabled } },
      layers: [{ name: { type: 'user', file: codexHooksPath().replace(/hooks\.json$/, 'config.toml') }, version: 'version-to-check', config: { hooks: { state } } }],
    };
    if (method === 'config/batchWrite') {
      writes.push(params);
      Object.assign(state, params.edits[0].value);
      for (const h of hooks) if (state[h.key]?.trusted_hash === h.currentHash) h.trustStatus = 'trusted';
      return { status: 'ok' };
    }
    throw new Error(`Unexpected method: ${method}`);
  };
  return { hooks, state, writes, rpc, disable: () => { featureEnabled = false; } };
}

test('desktop review is read-only and excludes unrelated commands', async () => {
  const f = fixture();
  const r = await reviewWithRpc('/project', f.rpc);
  assert.equal(r.complete, true);
  assert.equal(r.ready, false);
  assert.equal(r.hooks.length, 5);
  assert.equal(f.writes.length, 0);
});

test('approval requires explicit consent and an unchanged reviewed definition', async () => {
  const f = fixture();
  const review = await reviewWithRpc('/project', f.rpc);
  await assert.rejects(approveWithRpc('/project', { reviewToken: review.reviewToken }, f.rpc), /Review and accept/);
  await assert.rejects(approveWithRpc('/project', { accepted: true, reviewToken: 'stale' }, f.rpc), /changed/);
  f.hooks[0].currentHash = 'new definition';
  await assert.rejects(approveWithRpc('/project', { accepted: true, reviewToken: review.reviewToken }, f.rpc), /changed/);
  assert.equal(f.writes.length, 0);
});

test('consented approval writes only owned hook state with version protection', async () => {
  const f = fixture();
  const review = await reviewWithRpc('/project', f.rpc);
  const after = await approveWithRpc('/project', { accepted: true, reviewToken: review.reviewToken }, f.rpc);
  assert.equal(after.ready, true);
  assert.equal(f.writes.length, 1);
  assert.equal(f.writes[0].edits[0].keyPath, 'hooks.state');
  assert.equal(f.writes[0].expectedVersion, 'version-to-check');
  assert.equal(f.writes[0].reloadUserConfig, true);
  assert.deepEqual(f.state.unrelated, { enabled: false, trusted_hash: 'keep-this' });
});

test('missing/duplicate hooks, changed enabled state, and global disable cannot be approved', async () => {
  const f = fixture();
  let r = await reviewWithRpc('/project', f.rpc);
  f.hooks[0].enabled = false;
  await assert.rejects(approveWithRpc('/project', { accepted: true, reviewToken: r.reviewToken }, f.rpc), /changed/);
  r = await reviewWithRpc('/project', f.rpc);
  f.disable();
  await assert.rejects(approveWithRpc('/project', { accepted: true, reviewToken: r.reviewToken }, f.rpc), /disabled/);
  f.hooks.pop();
  r = await reviewWithRpc('/project', f.rpc);
  assert.equal(r.complete, false);
  assert.equal(f.writes.length, 0);
});
