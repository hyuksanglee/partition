// 세션 기록 파일(transcript_path, JSONL)에서 지난번 이후 새로 쌓인 토큰을 센다.
// 같은 응답이 여러 줄로 기록되므로 message.id로 중복을 뺀다.
import { closeSync, fstatSync, openSync, readSync } from 'node:fs';

/** @typedef {import('../store/config.mjs').Weights} Weights */
/** @typedef {import('../store/state.mjs').TranscriptCursor} TranscriptCursor */

/** 처음 보는 기록 파일은 이만큼 최근 것만 센다. 그 전 사용은 이미 사용률에 들어 있다. */
export const FIRST_SEEN_WINDOW_MS = 10 * 60 * 1000;
const MAX_SEEN_IDS = 500;

/**
 * @param {Record<string, unknown> | undefined} usage
 * @param {Weights} w
 */
export function weighUsage(usage, w) {
  if (!usage) return 0;
  const n = (/** @type {string} */ k) => (typeof usage[k] === 'number' ? /** @type {number} */ (usage[k]) : 0);
  return (
    n('input_tokens') * w.input +
    n('cache_creation_input_tokens') * w.cacheWrite +
    n('cache_read_input_tokens') * w.cacheRead +
    n('output_tokens') * w.output
  );
}

/**
 * @param {string} file
 * @param {number} offset
 * @returns {{ text: string, size: number } | null}
 */
function readFrom(file, offset) {
  let fd;
  try {
    fd = openSync(file, 'r');
  } catch {
    return null;
  }
  try {
    const size = fstatSync(fd).size;
    if (size <= offset) return { text: '', size };
    const buf = Buffer.alloc(size - offset);
    readSync(fd, buf, 0, buf.length, offset);
    return { text: buf.toString('utf8'), size };
  } finally {
    closeSync(fd);
  }
}

/**
 * @param {string} file
 * @param {TranscriptCursor | undefined} cursor
 * @param {Weights} weights
 * @param {number} nowMs
 * @returns {{ weight: number, cursor: TranscriptCursor }}
 */
export function readNewUsage(file, cursor, weights, nowMs) {
  const firstSeen = !cursor;
  let offset = cursor?.offset ?? 0;
  let seen = { ...(cursor?.seen ?? {}) };
  let read = readFrom(file, offset);
  // 파일이 줄었으면(새로 쓰임) 처음부터 다시 읽는다.
  if (read && read.size < offset) {
    offset = 0;
    read = readFrom(file, 0);
  }
  if (!read) return { weight: 0, cursor: { offset, seen, touchedAt: nowMs } };

  // 마지막 줄은 아직 쓰는 중일 수 있으니 줄바꿈까지만 처리한다.
  const end = read.text.lastIndexOf('\n');
  const complete = end < 0 ? '' : read.text.slice(0, end + 1);
  let weight = 0;
  for (const line of complete.split('\n')) {
    if (!line.includes('"usage"')) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const msg = entry?.message;
    if (entry?.type !== 'assistant' || !msg?.usage) continue;
    if (firstSeen && !(Date.parse(entry.timestamp) >= nowMs - FIRST_SEEN_WINDOW_MS)) continue;
    const w = weighUsage(msg.usage, weights);
    const id = typeof msg.id === 'string' ? msg.id : null;
    if (id) {
      // 같은 id가 다시 나오면 늘어난 만큼만 더한다(스트리밍 중 갱신 대비).
      const prev = seen[id] ?? 0;
      if (w > prev) weight += w - prev;
      seen[id] = Math.max(prev, w);
    } else {
      weight += w;
    }
  }

  const ids = Object.keys(seen);
  if (ids.length > MAX_SEEN_IDS) seen = Object.fromEntries(ids.slice(-MAX_SEEN_IDS).map((k) => [k, seen[k]]));
  const consumed = Buffer.byteLength(complete, 'utf8');
  return { weight, cursor: { offset: offset + consumed, seen, touchedAt: nowMs } };
}
