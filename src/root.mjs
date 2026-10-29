// 이 플러그인 폴더의 절대 경로. ${CLAUDE_PLUGIN_ROOT}와 같다(업데이트 때마다 바뀔 수 있어 저장해 두고 쓰지 않는다).
import { fileURLToPath } from 'node:url';

export const PLUGIN_ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
export const CLI_PATH = `${PLUGIN_ROOT}/src/cli.mjs`;
