// ~/.partition 아래 파일 경로. PARTITION_HOME으로 바꿀 수 있다(테스트용).
import { homedir } from 'node:os';
import { join } from 'node:path';

/** @returns {'claude' | 'codex'} */
export function provider() {
  const value = process.env.PARTITION_PROVIDER || 'claude';
  if (value !== 'claude' && value !== 'codex') throw new Error(`Unknown provider: ${value}`);
  return value;
}

export function partitionHome() {
  const base = process.env.PARTITION_HOME || join(homedir(), '.partition');
  return provider() === 'codex' ? join(base, 'codex') : base;
}

export const paths = {
  get home() { return partitionHome(); },
  /** 예산·규칙 (사용자가 정하는 것) */
  get config() { return join(partitionHome(), 'config.json'); },
  /** 사용 기록 (Partition이 쓰는 것) */
  get state() { return join(partitionHome(), 'state.json'); },
  /** 플러그인 경로, 원래 status line (설치 정보) */
  get install() { return join(partitionHome(), 'install.json'); },
  /** settings.json에 등록하는 status line 실행기 */
  get launcher() { return join(partitionHome(), 'statusline.mjs'); },
  get lock() { return join(partitionHome(), '.lock'); },
};

/** Claude Code 설정 폴더. CLAUDE_CONFIG_DIR가 있으면 그쪽. */
export function claudeDir() {
  return process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
}

export function claudeSettingsPath() {
  return join(claudeDir(), 'settings.json');
}

export function codexHooksPath() {
  return join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'hooks.json');
}
