// Use the desktop's own engine and its public JSON-RPC protocol. No model calls.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

/** @returns {string} */
export function codexBinary() {
  const candidates = [
    process.env.PARTITION_CODEX_BIN,
    '/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex',
    '/Applications/Codex.app/Contents/Resources/codex',
    join(homedir(), '.codex/plugins/.plugin-appserver/codex-cli/bin/codex'),
  ];
  return candidates.find((p) => p && existsSync(p)) || 'codex';
}

/** @typedef {(method: string, params: any) => Promise<any>} Rpc */

/**
 * Short-lived control connection: configuration and hook metadata only.
 * @template T
 * @param {(rpc: Rpc) => Promise<T>} fn
 * @param {{ command?: string[], timeoutMs?: number, onNotification?: (method: string, params: any) => void }} [options] overrides/notifications for protocol tests
 * @returns {Promise<T>}
 */
export async function withAppServer(fn, { command = [codexBinary(), 'app-server', '--stdio'], timeoutMs = 10_000, onNotification } = {}) {
  const child = spawn(command[0], command.slice(1), { stdio: ['pipe', 'pipe', 'pipe'] });
  const lines = createInterface({ input: child.stdout });
  const pending = new Map();
  let nextId = 0;
  let stopped = false;

  /** @param {Error} error */
  function fail(error) {
    stopped = true;
    for (const p of pending.values()) { clearTimeout(p.timer); p.reject(error); }
    pending.clear();
  }
  child.on('error', (e) => fail(new Error(`Cannot start Codex app-server: ${e.message}`)));
  child.on('exit', () => fail(new Error('Codex app-server closed the connection.')));
  child.stdin.on('error', () => fail(new Error('Codex app-server input closed.')));
  // Logs can contain user configuration; never forward them to the UI.
  child.stderr.resume();
  lines.on('line', (line) => {
    let message;
    try { message = JSON.parse(line); } catch { return; }
    const p = pending.get(message.id);
    if (!p) {
      if (typeof message.method === 'string') onNotification?.(message.method, message.params);
      return;
    }
    pending.delete(message.id);
    clearTimeout(p.timer);
    if (message.error) p.reject(new Error(message.error.message || 'Codex RPC failed.'));
    else p.resolve(message.result);
  });

  /** @type {Rpc} */
  const rpc = (method, params) => new Promise((resolve, reject) => {
    if (stopped) { reject(new Error('Codex app-server is unavailable.')); return; }
    const id = ++nextId;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Codex app-server timed out: ${method}`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(JSON.stringify({ id, method, params }) + '\n');
  });
  try {
    await rpc('initialize', {
      clientInfo: { name: 'partition_desktop', title: 'Partition', version: '0.3.0' },
      capabilities: { experimentalApi: true },
    });
    child.stdin.write(JSON.stringify({ method: 'initialized', params: {} }) + '\n');
    return await fn(rpc);
  } finally {
    fail(new Error('Partition closed its control connection.'));
    lines.close();
    child.stdin.end();
    child.kill();
    const timer = setTimeout(() => { if (child.exitCode == null) child.kill('SIGKILL'); }, 1000);
    timer.unref();
    child.once('exit', () => clearTimeout(timer));
  }
}
