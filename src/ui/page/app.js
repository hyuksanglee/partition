// Partition 설정 창. 빌드 없이 그대로 쓰는 화면 스크립트.
const TOKEN = location.hash.slice(1);
const $ = (id) => document.getElementById(id);

const TEXT = {
  ko: {
    'tab.budget': '예산', 'tab.rules': '규칙', 'tab.connection': '연결',
    'window.fiveHour': '5시간', 'window.sevenDay': '주간',
    'bar.title': '한도 전체 100%p', 'bar.free': '미할당', 'bar.allocated': '할당 {n}%p',
    'budget.clear': '할당 해제', 'budget.range': '설정 가능 0–{max}%p', 'budget.none': '할당 없음',
    'current': '현재',
    'stats.used': '이 창에서 쓴 양', 'stats.budget': '예산', 'stats.total': '계정 전체 사용률',
    'stats.others': '다른 프로젝트', 'stats.unattributed': '미귀속 (웹·다른 기기 등)', 'stats.before': '기타 (Partition 적용 전)',
    'stats.reset': '리셋', 'stats.noData': '아직 사용률 값이 없어요',
    'stage.ok': '여유', 'stage.warn': '경고', 'stage.wrap': '마무리', 'stage.block': '차단', 'stage.none': '제한 없음',
    'note.attribution': '사용률이 오르면, 그 사이 각 프로젝트에서 쓴 토큰 비중대로 나눠 셉니다. 토큰 가중치는 API 가격 비율을 빌린 가정이라 실제와 다를 수 있어요.',
    'rules.warn': '경고 시점 (예산 대비)', 'rules.warn.hint': '이 비율에 닿으면 한 번 알려요.',
    'rules.margin': '마무리 지시 (예산까지 남은 양)', 'rules.margin.hint': '남은 양이 이 이하면 AI에게 하던 일을 마무리하라고 지시해요.',
    'rules.block': '예산 도달 시 차단', 'rules.block.hint': '끄면 경고와 마무리 지시만 해요. 응답 하나만큼 넘칠 수 있어요.',
    'rules.language': '언어', 'lang.auto': '시스템 설정',
    'rules.weights': '토큰 가중치', 'rules.weights.hint': '입력·캐시 생성·캐시 읽기·출력. ~/.partition/config.json에서 바꿀 수 있어요.',
    'conn.statusline': 'status line 연결', 'conn.on': '연결됨', 'conn.off': '연결 안 됨',
    'conn.last': '마지막 실행', 'conn.never': '아직 없음', 'conn.root': '플러그인 경로',
    'conn.setupTitle': 'settings.json에 이렇게 바꿔요', 'conn.uninstallTitle': '원래대로 되돌리면',
    'conn.apply': '연결하기', 'conn.undo': '원래대로',
    'saved': '저장했어요', 'error': '저장하지 못했어요', 'pp': '%p',
  },
  en: {
    'tab.budget': 'Budget', 'tab.rules': 'Rules', 'tab.connection': 'Connection',
    'window.fiveHour': '5-hour', 'window.sevenDay': 'Weekly',
    'bar.title': 'Whole limit 100pp', 'bar.free': 'Unallocated', 'bar.allocated': '{n}pp allocated',
    'budget.clear': 'Clear', 'budget.range': 'Allowed 0–{max}pp', 'budget.none': 'No budget',
    'current': 'current',
    'stats.used': 'Used in this window', 'stats.budget': 'Budget', 'stats.total': 'Account usage',
    'stats.others': 'Other projects', 'stats.unattributed': 'Unattributed (web, other devices…)', 'stats.before': 'Other (before Partition)',
    'stats.reset': 'Resets', 'stats.noData': 'No usage value yet',
    'stage.ok': 'OK', 'stage.warn': 'Warning', 'stage.wrap': 'Wrap up', 'stage.block': 'Blocked', 'stage.none': 'No limit',
    'note.attribution': 'When usage goes up, the increase is split by the tokens each project used in between. Token weights borrow API price ratios; that is an assumption and may differ from reality.',
    'rules.warn': 'Warn at (of budget)', 'rules.warn.hint': 'Shown once when the project reaches this share.',
    'rules.margin': 'Wrap up when left', 'rules.margin.hint': 'When this much or less is left, Claude is asked to wrap up.',
    'rules.block': 'Block at budget', 'rules.block.hint': 'Off: warn and wrap up only. It can overshoot by one response.',
    'rules.language': 'Language', 'lang.auto': 'System',
    'rules.weights': 'Token weights', 'rules.weights.hint': 'Input · cache write · cache read · output. Edit in ~/.partition/config.json.',
    'conn.statusline': 'Status line', 'conn.on': 'Connected', 'conn.off': 'Not connected',
    'conn.last': 'Last run', 'conn.never': 'Never', 'conn.root': 'Plugin path',
    'conn.setupTitle': 'This change goes into settings.json', 'conn.uninstallTitle': 'Restoring goes back to',
    'conn.apply': 'Connect', 'conn.undo': 'Restore',
    'saved': 'Saved', 'error': 'Could not save', 'pp': 'pp',
  },
};

let snap = null;
let win = 'fiveHour';
let selected = null;
let draft = null; // 슬라이더를 움직이는 동안의 값

const tr = (key, vars = {}) => (TEXT[snap?.lang ?? 'en'][key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
const pp = (n) => String(Math.round(n * 10) / 10);
const ppu = (n) => pp(n) + tr('pp');
const fmtTime = (sec) => new Date(sec * 1000).toLocaleString(snap?.lang === 'ko' ? 'ko-KR' : 'en-US', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

async function api(path, body) {
  const res = await fetch(`/api/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'x-partition-token': TOKEN, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.text || data.error || 'error'), { data });
  return data;
}

let toastTimer;
function toast(text) {
  const el = $('toast');
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 1800);
}

function el(tag, props = {}, children = []) {
  const node = Object.assign(document.createElement(tag), props);
  for (const c of children) node.append(c);
  return node;
}

function stats(target, rows) {
  target.replaceChildren(...rows.flatMap(([k, v]) => [el('dt', { textContent: k }), el('dd', { textContent: v })]));
}

// ---- 예산 탭 ----

function project() {
  return snap.projects.find((p) => p.path === selected) ?? snap.projects[0];
}

function renderBar() {
  const sel = project();
  const colors = new Map(snap.projects.map((p, i) => [p.path, `var(--seg-${(i % 6) + 1})`]));
  const others = snap.projects.filter((p) => p.path !== sel.path && p.budgets[win] != null);
  const othersTotal = others.reduce((a, p) => a + p.budgets[win], 0);
  const mine = draft ?? sel.budgets[win] ?? 0;
  const free = Math.max(0, 100 - othersTotal - mine);

  // 할당한 범위는 연하게, 그중 쓴 만큼은 진하게 채운다.
  const used = (p) => p.check.windows[win].used;
  const seg = (label, value, color, usedPp, cls = '') => {
    const fill = el('div', { className: 'fill', style: `width:${value > 0 ? Math.min(100, (usedPp / value) * 100) : 0}%;background:${color}` });
    const text = el('span', { textContent: value >= 8 ? label : '' });
    return el('div', { className: `seg ${cls}`, title: label, style: `width:${value}%;--c:${color}` }, [fill, text]);
  };
  const segs = others.map((p) => seg(`${p.name} ${pp(used(p))}/${pp(p.budgets[win])}`, p.budgets[win], colors.get(p.path), used(p)));
  if (mine > 0) segs.push(seg(`${sel.name} ${pp(used(sel))}/${pp(mine)}`, mine, colors.get(sel.path), used(sel), 'selected'));
  if (free > 0) segs.push(el('div', { className: 'seg free', title: tr('bar.free'), style: `width:${free}%` }, [el('span', { textContent: free >= 8 ? `${tr('bar.free')} ${pp(free)}` : '' })]));
  $('alloc-bar').replaceChildren(...segs);
  $('bar-total').textContent = tr('bar.allocated', { n: pp(othersTotal + mine) });

  const mark = $('range-mark');
  mark.style.left = `${othersTotal}%`;
  mark.style.width = `${100 - othersTotal}%`;

  const legend = [...others, ...(mine > 0 ? [sel] : [])].map((p) =>
    el('span', { textContent: `${p.name} ${pp(used(p))}/${ppu(p === sel ? mine : p.budgets[win])}`, style: `--c:${colors.get(p.path)}` }),
  );
  legend.push(el('span', { textContent: `${tr('bar.free')} ${ppu(free)}`, style: '--c:var(--track)' }));
  $('legend').replaceChildren(...legend);
}

function renderBudget() {
  const sel = project();
  selected = sel.path;
  $('project-select').replaceChildren(
    ...snap.projects.map((p) =>
      el('option', { value: p.path, textContent: p.path === snap.current ? `${p.name} (${tr('current')})` : p.name, selected: p.path === sel.path, title: p.path }),
    ),
  );
  for (const b of document.querySelectorAll('#window-switch button')) b.setAttribute('aria-pressed', String(b.dataset.window === win));

  const range = sel.ranges[win];
  const value = sel.budgets[win];
  const slider = $('budget-slider');
  slider.max = String(range.max);
  slider.value = String(value ?? 0);
  $('budget-number').max = String(range.max);
  $('budget-number').value = value == null ? '' : String(value);
  $('budget-number').placeholder = '—';
  $('range-text').textContent = value == null ? `${tr('budget.none')} · ${tr('budget.range', { max: pp(range.max) })}` : tr('budget.range', { max: pp(range.max) });
  $('budget-clear').hidden = value == null;
  $('project-name').textContent = sel.name;
  $('project-name').title = sel.path;

  const c = sel.check.windows[win];
  const stage = value == null ? 'none' : c.hasData ? c.stage : 'ok';
  $('stage-badge').className = `badge ${stage}`;
  $('stage-badge').textContent = tr(`stage.${stage}`);

  stats(
    $('usage-stats'),
    c.hasData
      ? [
          [tr('stats.used'), ppu(c.used)],
          [tr('stats.budget'), value == null ? '—' : ppu(value)],
          [tr('stats.total'), `${pp(c.totalPct)}%`],
          [tr('stats.others'), ppu(c.othersPp)],
          [tr('stats.unattributed'), ppu(c.unattributed)],
          [tr('stats.before'), ppu(c.beforeTracking)],
          [tr('stats.reset'), fmtTime(c.resetsAt)],
        ]
      : [[tr('stats.noData'), '']],
  );
  renderBar();
}

async function saveBudget(value) {
  draft = null;
  try {
    const r = await api('budget', { project: selected, window: win, value });
    snap = r.state;
    toast(tr('saved'));
  } catch (err) {
    toast(err.message || tr('error'));
  }
  render();
}

// ---- 규칙 탭 ----

function renderRules() {
  $('rule-warn').value = String(Math.round(snap.rules.warnAt * 100));
  $('rule-margin').value = String(snap.rules.wrapMarginPp);
  $('rule-block').checked = snap.rules.block;
  $('rule-language').value = snap.language;
  const w = snap.weights;
  $('weights').textContent = `input ${w.input} · cacheWrite ${w.cacheWrite} · cacheRead ${w.cacheRead} · output ${w.output}`;
}

async function saveRules(patch) {
  try {
    const r = await api('rules', patch);
    snap = r.state;
    toast(tr('saved'));
  } catch {
    toast(tr('error'));
  }
  render();
}

// ---- 연결 탭 ----

function renderConnection() {
  const c = snap.connection;
  $('conn-badge').className = `badge ${c.connected ? 'on' : ''}`;
  $('conn-badge').textContent = tr(c.connected ? 'conn.on' : 'conn.off');
  stats($('conn-stats'), [
    [tr('conn.last'), c.lastStatusLineAt ? fmtTime(c.lastStatusLineAt / 1000) : tr('conn.never')],
    [tr('conn.root'), c.pluginRoot],
  ]);
  $('plan-title').textContent = tr(c.connected ? 'conn.uninstallTitle' : 'conn.setupTitle');
  $('plan').textContent = c.connected ? c.uninstallPlan : c.setupPlan;
  $('plan-apply').textContent = tr(c.connected ? 'conn.undo' : 'conn.apply');
}

// ---- 공통 ----

function render() {
  document.documentElement.lang = snap.lang;
  for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = tr(node.dataset.i18n);
  for (const node of document.querySelectorAll('.unit.pp')) node.textContent = tr('pp');
  renderBudget();
  renderRules();
  renderConnection();
}

function bind() {
  for (const tab of document.querySelectorAll('nav button')) {
    tab.addEventListener('click', () => {
      for (const t of document.querySelectorAll('nav button')) t.setAttribute('aria-selected', String(t === tab));
      for (const p of document.querySelectorAll('[role=tabpanel]')) p.hidden = p.id !== `tab-${tab.dataset.tab}`;
    });
  }
  for (const b of document.querySelectorAll('#window-switch button')) {
    b.addEventListener('click', () => {
      win = b.dataset.window;
      render();
    });
  }
  $('project-select').addEventListener('change', (e) => {
    selected = e.target.value;
    render();
  });
  // 움직이는 동안 막대에 바로 반영, 손 떼면 저장.
  $('budget-slider').addEventListener('input', (e) => {
    draft = Number(e.target.value);
    $('budget-number').value = String(draft);
    renderBar();
  });
  $('budget-slider').addEventListener('change', (e) => saveBudget(Number(e.target.value)));
  $('budget-number').addEventListener('change', (e) => {
    const v = e.target.value.trim();
    saveBudget(v === '' ? null : Number(v));
  });
  $('budget-clear').addEventListener('click', () => saveBudget(null));

  $('rule-warn').addEventListener('change', (e) => saveRules({ warnAt: Number(e.target.value) / 100 }));
  $('rule-margin').addEventListener('change', (e) => saveRules({ wrapMarginPp: Number(e.target.value) }));
  $('rule-block').addEventListener('change', (e) => saveRules({ block: e.target.checked }));
  $('rule-language').addEventListener('change', (e) => saveRules({ language: e.target.value }));

  $('plan-apply').addEventListener('click', async () => {
    $('plan-apply').disabled = true;
    try {
      const r = await api(snap.connection.connected ? 'uninstall' : 'setup', {});
      snap = r.state;
      toast(r.text);
    } catch {
      toast(tr('error'));
    }
    $('plan-apply').disabled = false;
    render();
  });
}

async function refresh() {
  if (draft != null) return;
  try {
    snap = await api('state');
    render();
  } catch {}
}

(async () => {
  bind();
  snap = await api('state');
  selected = snap.current;
  render();
  // heartbeat 겸 새 사용량 반영
  setInterval(refresh, 10_000);
})();
