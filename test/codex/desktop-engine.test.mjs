import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { useTempHome } from '../helpers.mjs';
import { codexHooksPath } from '../../src/store/paths.mjs';
import { applySetup } from '../../src/codex/settings.mjs';
import { reviewDesktop, approveDesktop } from '../../src/codex/desktop.mjs';
import { codexBinary, withAppServer } from '../../src/codex/app-server.mjs';
import { loadState } from '../../src/store/state.mjs';
import { updateState } from '../../src/store/state.mjs';
import { updateConfig } from '../../src/store/config.mjs';
import { startTracking } from '../../src/core/window.mjs';

const root = useTempHome();
process.env.PARTITION_PROVIDER = 'codex';
const binary = codexBinary();

test('desktop engine approves fixture hooks and blocks a prompt before model generation',
  { skip: !existsSync(binary), timeout: 20_000 }, async () => {
    const configPath = join(dirname(codexHooksPath()), 'config.toml');
    mkdirSync(dirname(configPath), { recursive: true });
    writeFileSync(configPath, 'model_verbosity = "low"\n[hooks.state.unrelated]\nenabled = false\ntrusted_hash = "preserve-this"\n');
    applySetup();
    const before = await reviewDesktop(root);
    assert.equal(before.complete, true);
    assert.equal(before.ready, false);
    const after = await approveDesktop(root, { accepted: true, reviewToken: before.reviewToken });
    assert.equal(after.ready, true);
    assert.ok(after.hooks.every((/** @type {{ trustStatus: string }} */ h) => h.trustStatus === 'trusted'));
    assert.match(readFileSync(configPath, 'utf8'), /preserve-this/);
    assert.match(readFileSync(configPath, 'utf8'), /model_verbosity = "low"/);
    // Disposable test-only session in a temporary CODEX_HOME. Exhaust its budget
    // so UserPromptSubmit must reject the prompt before any model generation.
    const project = realpathSync(root);
    updateConfig((c) => ({ ...c, language: 'en', budgets: { [project]: { fiveHour: 30 } } }));
    updateState((s) => ({ ...s, windows: { fiveHour: { ...startTracking(Date.now() / 1000 + 3600, 50), byProject: { [project]: 30 } } } }));
    const runs = /** @type {any[]} */ ([]);
    await withAppServer(async (rpc) => {
      const thread = await rpc('thread/start', { cwd: project, approvalPolicy: 'never', sandbox: 'read-only' });
      try {
        await rpc('turn/start', { threadId: thread.thread.id, input: [{ type: 'text', text: 'Partition test: this prompt must be blocked before a model request.' }] });
      } catch (err) {
        assert.match(String(err), /budget|hook|blocked/i);
      }
      const deadline = Date.now() + 3000;
      while (!runs.some((r) => r.eventName === 'userPromptSubmit' && r.status === 'blocked') && Date.now() < deadline) await new Promise((r) => setTimeout(r, 30));
      const blocked = runs.find((r) => r.eventName === 'userPromptSubmit' && r.status === 'blocked');
      assert.ok(blocked, `Expected a blocked prompt hook; saw ${JSON.stringify(runs)}`);
      assert.match(JSON.stringify(blocked.entries), /budget/i);
      assert.equal(loadState().lastCodexEvent?.event, 'UserPromptSubmit');
      assert.ok(loadState().lastCodexEvent?.sessionId);
    }, { onNotification: (method, params) => { if (method === 'hook/completed') runs.push(params.run); } });
  });
