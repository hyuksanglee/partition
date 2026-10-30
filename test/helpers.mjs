import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after } from 'node:test';

/** 테스트마다 빈 ~/.partition, ~/.claude를 쓴다. */
export function useTempHome() {
  const root = mkdtempSync(join(tmpdir(), 'partition-test-'));
  process.env.PARTITION_HOME = join(root, 'partition');
  process.env.CLAUDE_CONFIG_DIR = join(root, 'claude');
  process.env.CODEX_HOME = join(root, 'codex');
  delete process.env.PARTITION_PROVIDER;
  after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
