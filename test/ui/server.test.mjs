import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { useTempHome } from '../helpers.mjs';
import { startServer } from '../../src/ui/server.mjs';

const root = useTempHome();
const proj = join(root, 'A');
mkdirSync(join(proj, '.git'), { recursive: true });

/** @param {number} port @param {string} path @param {{ method?: string, headers?: Record<string, string>, body?: unknown }} [o] */
function call(port, path, o = {}) {
  return new Promise((resolve, reject) => {
    const body = o.body === undefined ? undefined : JSON.stringify(o.body);
    const req = request({ host: '127.0.0.1', port, path, method: o.method ?? 'GET', headers: { host: `127.0.0.1:${port}`, ...o.headers } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.end(body);
  });
}

test('토큰·Host 검사, 예산 저장', async () => {
  const s = await startServer({ project: proj });
  const port = Number(new URL(s.url).port);
  const auth = { 'x-partition-token': s.token };
  try {
    assert.equal(/** @type {any} */ (await call(port, '/')).status, 200);
    assert.equal(/** @type {any} */ (await call(port, '/api/state')).status, 403, '토큰 없음');
    assert.equal(/** @type {any} */ (await call(port, '/api/state', { headers: { ...auth, host: 'evil.test' } })).status, 403, 'Host 다름');

    const st = /** @type {any} */ (await call(port, '/api/state', { headers: auth }));
    assert.equal(st.status, 200);
    assert.equal(JSON.parse(st.data).current, proj);

    const ok = /** @type {any} */ (await call(port, '/api/budget', { method: 'POST', headers: auth, body: { project: proj, window: 'fiveHour', value: 30 } }));
    assert.equal(ok.status, 200);
    assert.equal(JSON.parse(ok.data).state.projects[0].budgets.fiveHour, 30);

    const bad = /** @type {any} */ (await call(port, '/api/budget', { method: 'POST', headers: auth, body: { project: 'other', window: 'fiveHour', value: 80 } }));
    assert.equal(bad.status, 400, '다른 프로젝트 30 + 80 > 100');
  } finally {
    s.close();
    await s.closed;
  }
});
