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
  // 뒤에서 아직 쓰는 프로세스가 있으면 지우다 실패할 수 있다. 임시 폴더라 정리 실패는 테스트 실패로 보지 않는다.
  after(() => {
    try {
      rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch {}
  });
  return root;
}
