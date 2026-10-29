// 프로젝트 판별: git 저장소 최상위, 아니면 그 폴더.
import { existsSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

/**
 * @param {string} cwd
 * @returns {string} 프로젝트 키(절대 경로)
 */
export function findProject(cwd) {
  const start = resolve(cwd);
  for (let dir = start; ; dir = dirname(dir)) {
    // .git은 폴더일 수도, worktree면 파일일 수도 있다.
    if (existsSync(resolve(dir, '.git'))) return dir;
    if (dirname(dir) === dir) return start;
  }
}

/** @param {string} project */
export function projectName(project) {
  return basename(project) || project;
}
