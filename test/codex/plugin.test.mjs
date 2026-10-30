import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { useTempHome } from '../helpers.mjs';
import { codexBinary, withAppServer } from '../../src/codex/app-server.mjs';
import { reviewDesktop, approveDesktop } from '../../src/codex/desktop.mjs';
import { PLUGIN_ROOT } from '../../src/root.mjs';
import { nativeFixture } from '../ui/native-fixture.mjs';

const root = useTempHome();
process.env.PARTITION_PROVIDER = 'codex';
const binary = codexBinary();

test('two-command plugin install loads skills/hooks and waits for its settings window readiness',
  { skip: !existsSync(binary), timeout: 30_000 }, async () => {
    mkdirSync(/** @type {string} */ (process.env.CODEX_HOME), { recursive: true });
    /** @param {string[]} args */
    const cli = (args) => {
      const result = spawnSync(binary, args, { encoding: 'utf8', env: process.env, timeout: 15000 });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout;
    };
    cli(['plugin', 'marketplace', 'add', PLUGIN_ROOT]);
    const installed = JSON.parse(cli(['plugin', 'add', 'partition@partition', '--json']));
    assert.equal(installed.pluginId, 'partition@partition');
    assert.equal(installed.version, JSON.parse(readFileSync(new URL('../../.codex-plugin/plugin.json', import.meta.url), 'utf8')).version);
    const review = await reviewDesktop(root);
    assert.equal(review.source, 'plugin');
    assert.equal(review.complete, true);
    assert.equal(review.ready, false);
    assert.equal((await approveDesktop(root, { accepted: true, reviewToken: review.reviewToken })).ready, true);
    await withAppServer(async (rpc) => {
      const result = await rpc('skills/list', { cwds: [root], forceReload: true });
      assert.ok(result.data.some((/** @type {any} */ d) => d.skills.some((/** @type {any} */ s) => s.name === 'partition:partition' && s.path.startsWith(installed.installedPath))));
      assert.ok(result.data.some((/** @type {any} */ d) => d.skills.some((/** @type {any} */ s) => s.name === 'partition:ui' && s.path.startsWith(installed.installedPath))));
    });
    // Test the native acknowledgement without displaying windows during tests.
    // Actual macOS window visibility is checked separately during manual validation.
    if (process.platform !== 'darwin') return;
    const bin = nativeFixture(root);
    // Invoke the copied hook exactly as a plugin would; no model generation.
    const hook = spawnSync(process.execPath, [join(installed.installedPath, 'src/codex/hook.mjs')], {
      input: JSON.stringify({ hook_event_name: 'UserPromptSubmit', cwd: root, prompt: '/partition:ui' }),
      env: { ...process.env, PLUGIN_ROOT: installed.installedPath, PATH: `${bin}:${process.env.PATH}` }, encoding: 'utf8', timeout: 10000,
    });
    assert.equal(hook.status, 0, hook.stderr);
    const context = JSON.parse(hook.stdout).hookSpecificOutput.additionalContext;
    const address = /Settings URL: (http:\/\/127\.0\.0\.1:\d+\/\S+)/.exec(context)?.[1];
    assert.ok(address, context);
    assert.match(context, /separate Partition settings window confirmed it is ready/);
    assert.match(context, /Do not run the CLI again or open an app browser panel/);
    const url = new URL(address);
    assert.equal(url.search, '', 'the launcher must not force the connection tab');
    const headers = { 'x-partition-token': url.hash.slice(1) };
    try {
      const page = await fetch(url.origin);
      assert.equal(page.status, 200);
      const response = await fetch(`${url.origin}/api/state`, { headers });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).provider, 'codex');
      assert.equal((await fetch(`${url.origin}/api/state`)).status, 403);
    } finally {
      await fetch(`${url.origin}/api/close`, { method: 'POST', headers });
    }
  });
