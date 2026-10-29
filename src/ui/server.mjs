// 설정 창용 로컬 서버. 127.0.0.1 전용, 무작위 토큰, Host 검사.
// 창이 닫히거나 페이지 신호(heartbeat)가 끊기면 종료한다.
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { WINDOW_KEYS } from '../core/window.mjs';
import { allowedRange } from '../core/allocation.mjs';
import { loadConfig } from '../store/config.mjs';
import { loadInstall, loadState } from '../store/state.mjs';
import { projectName } from '../project.mjs';
import { resolveLang } from '../messages.mjs';
import { check } from '../commands/check.mjs';
import { setProjectBudget } from '../commands/budget.mjs';
import { setRules } from '../commands/rules.mjs';
import { setup, setupPlanText, uninstall, uninstallPlanText } from '../commands/setup.mjs';
import { isConnected } from '../claude/settings.mjs';
import { PLUGIN_ROOT } from '../root.mjs';

const PAGE_DIR = new URL('./page/', import.meta.url);
const FILES = /** @type {const} */ ({
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
});
const HEARTBEAT_TIMEOUT_MS = 30_000;

/**
 * 화면에 필요한 값 전부.
 * @param {string} project 창을 연 프로젝트
 */
export function snapshot(project) {
  const config = loadConfig();
  const state = loadState();
  const nowSec = Date.now() / 1000;
  const known = new Set([project, ...Object.keys(config.budgets)]);
  for (const key of WINDOW_KEYS) for (const p of Object.keys(state.windows[key]?.byProject ?? {})) known.add(p);
  const projects = [...known].map((p) => ({
    path: p,
    name: projectName(p),
    budgets: config.budgets[p] ?? {},
    ranges: Object.fromEntries(WINDOW_KEYS.map((k) => [k, allowedRange(config.budgets, k, p)])),
    check: check(p, config, state, nowSec),
  }));
  return {
    current: project,
    lang: resolveLang(config.language),
    language: config.language,
    rules: config.rules,
    weights: config.weights,
    projects,
    connection: {
      connected: isConnected(),
      lastStatusLineAt: state.lastStatusLineAt ?? null,
      pluginRoot: loadInstall().pluginRoot ?? PLUGIN_ROOT,
      setupPlan: setupPlanText(),
      uninstallPlan: uninstallPlanText(),
    },
  };
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<any>}
 */
async function readBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 64_000) throw new Error('too large');
  }
  return body ? JSON.parse(body) : {};
}

/**
 * @param {{ project: string, port?: number }} opts
 */
export function startServer({ project, port = 0 }) {
  const token = randomBytes(24).toString('hex');
  let lastBeat = Date.now();
  /** @type {() => void} */
  let resolveClosed = () => {};
  const closed = new Promise((/** @type {(v?: unknown) => void} */ r) => (resolveClosed = r));

  const server = createServer(async (req, res) => {
    /** @param {number} code @param {unknown} data */
    const send = (code, data) => {
      res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      res.end(JSON.stringify(data));
    };
    const addr = /** @type {import('node:net').AddressInfo} */ (server.address());
    // DNS rebinding 방지: Host가 정확히 우리 주소일 때만.
    if (req.headers.host !== `127.0.0.1:${addr.port}`) return send(403, { error: 'host' });
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${addr.port}`);

    if (req.method === 'GET' && url.pathname in FILES) {
      const [file, type] = FILES[/** @type {keyof typeof FILES} */ (url.pathname)];
      res.writeHead(200, {
        'content-type': type,
        'cache-control': 'no-store',
        'content-security-policy': "default-src 'self'; style-src 'self'; script-src 'self'",
      });
      return res.end(readFileSync(new URL(file, PAGE_DIR)));
    }
    if (!url.pathname.startsWith('/api/')) return send(404, { error: 'not found' });
    if (req.headers['x-partition-token'] !== token) return send(403, { error: 'token' });

    try {
      lastBeat = Date.now();
      const lang = resolveLang(loadConfig().language);
      if (req.method === 'GET' && url.pathname === '/api/state') return send(200, snapshot(project));
      if (req.method === 'POST' && url.pathname === '/api/heartbeat') return send(200, { ok: true });
      if (req.method === 'POST' && url.pathname === '/api/budget') {
        const b = await readBody(req);
        const r = setProjectBudget(String(b.project), b.window === 'sevenDay' ? 'sevenDay' : 'fiveHour', b.value == null ? null : Number(b.value), lang);
        return send(r.ok ? 200 : 400, { ...r, state: snapshot(project) });
      }
      if (req.method === 'POST' && url.pathname === '/api/rules') {
        const r = setRules(await readBody(req));
        return send(r.ok ? 200 : 400, { ...r, state: snapshot(project) });
      }
      if (req.method === 'POST' && url.pathname === '/api/setup') return send(200, { text: setup(), state: snapshot(project) });
      if (req.method === 'POST' && url.pathname === '/api/uninstall') return send(200, { text: uninstall(), state: snapshot(project) });
      if (req.method === 'POST' && url.pathname === '/api/close') {
        send(200, { ok: true });
        return close();
      }
      return send(404, { error: 'not found' });
    } catch (err) {
      return send(500, { error: err instanceof Error ? err.message : String(err) });
    }
  });

  const timer = setInterval(() => {
    if (Date.now() - lastBeat > HEARTBEAT_TIMEOUT_MS) close();
  }, 5000);
  timer.unref();

  function close() {
    clearInterval(timer);
    server.close(() => resolveClosed());
    server.closeAllConnections?.();
  }

  return new Promise((/** @type {(v: { url: string, token: string, close: () => void, closed: Promise<unknown> }) => void} */ resolve, reject) => {
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => {
      const { port: p } = /** @type {import('node:net').AddressInfo} */ (server.address());
      // 토큰은 #fragment로 넘겨 서버 로그·Referer에 남지 않게 한다.
      resolve({ url: `http://127.0.0.1:${p}/#${token}`, token, close, closed });
    });
  });
}
