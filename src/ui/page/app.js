// Partition 설정 창. 빌드 없이 그대로 쓰는 화면 스크립트.
import { initialTab, budgetSaveImpact } from './policy.mjs';
const TOKEN = location.hash.slice(1);
const $ = (id) => document.getElementById(id);

const TEXT = {
  ko: {
    'tab.budget': '예산', 'tab.rules': '규칙', 'tab.connection': '연결',
    'window.fiveHour': '5시간', 'window.sevenDay': '주간',
    'bar.title': '한도 전체 100%p', 'bar.free': '미할당', 'bar.other': '회색: 기타 사용', 'bar.allocated': '할당 {n}%p',
    'budget.clear': '할당 해제', 'budget.save': '저장', 'budget.cancel': '취소', 'budget.unsaved': '저장하지 않은 변경', 'budget.range': '설정 가능 0–{max}%p (0 = 제한 없음)', 'budget.none': '할당 없음',
    'budget.over': '이미 사용량이 새 예산을 초과했습니다.', 'budget.reached': '이미 사용량이 새 예산에 도달했습니다.',
    'budget.blocksNext': '저장하면 다음 요청과 도구 실행부터 차단됩니다.', 'budget.warningOnly': '차단이 꺼져 있어 경고와 마무리 지시만 적용됩니다.', 'budget.saveBlocked': '차단 적용하고 저장',
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
    'bar.title': 'Whole limit 100pp', 'bar.free': 'Unallocated', 'bar.other': 'gray: other usage', 'bar.allocated': '{n}pp allocated',
    'budget.clear': 'Clear', 'budget.save': 'Save', 'budget.cancel': 'Cancel', 'budget.unsaved': 'Unsaved change', 'budget.range': 'Allowed 0–{max}pp (0 = no limit)', 'budget.none': 'No budget',
    'budget.over': 'Usage already exceeds the new budget.', 'budget.reached': 'Usage has already reached the new budget.',
    'budget.blocksNext': 'Saving blocks subsequent prompts and tool calls.', 'budget.warningOnly': 'Blocking is off; only warnings and wrap-up instructions apply.', 'budget.saveBlocked': 'Save and apply block',
    'current': 'current',
    'stats.used': 'Used in this window', 'stats.budget': 'Budget', 'stats.total': 'Account usage',
    'stats.others': 'Other projects', 'stats.unattributed': 'Unattributed (web, other devices…)', 'stats.before': 'Other (before Partition)',
    'stats.reset': 'Resets', 'stats.noData': 'No usage value yet',
    'stage.ok': 'OK', 'stage.warn': 'Warning', 'stage.wrap': 'Wrap up', 'stage.block': 'Blocked', 'stage.none': 'No limit',
    'note.attribution': 'When usage goes up, the increase is split by the tokens each project used in between. Token weights borrow API price ratios; that is an assumption and may differ from reality.',
    'rules.warn': 'Warn at (of budget)', 'rules.warn.hint': 'Shown once when the project reaches this share.',
    'rules.margin': 'Wrap up when left', 'rules.margin.hint': 'When this much or less is left, the model is asked to wrap up.',
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
let desktopReview = null;
let desktopError = '';
let desktopBusy = false;
let savingBudget = false;
let tabTouched = false;

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
  const used = (p) => p.check.windows[win].used;
  // 고른 프로젝트는 예산이 없거나 넘게 썼어도 자기 사용량만큼은 자기 칸으로 그린다.
  // (예산이 없을 때 기타로 그리면, 줄 수 있는 범위 계산과 회색 칸이 어긋난다.)
  const selWidth = Math.max(mine, used(sel));
  const free = Math.max(0, 100 - othersTotal - selWidth);

  // 할당한 범위는 연하게, 그중 쓴 만큼은 진하게 채운다.
  // 프로젝트 칸을 누르면 그 프로젝트를 고른다(위 선택 상자와 같다).
  const seg = (label, value, color, usedPp, path, cls = '') => {
    const fill = el('div', { className: 'fill', style: `width:${value > 0 ? Math.min(100, (usedPp / value) * 100) : 0}%;background:${color}` });
    const text = el('span', { textContent: value >= 8 ? label : '' });
    const node = el('div', { className: `seg pick ${cls}`, title: label, style: `width:${value}%;--c:${color}` }, [fill, text]);
    node.addEventListener('click', () => selectProject(path));
    return node;
  };
  const segs = others.map((p) => seg(`${p.name} ${pp(used(p))}/${pp(p.budgets[win])}`, p.budgets[win], colors.get(p.path), used(p), p.path));
  const selLabel = mine > 0 ? `${sel.name} ${pp(used(sel))}/${pp(mine)}` : `${sel.name} ${pp(used(sel))}`;
  if (selWidth > 0) segs.push(seg(selLabel, selWidth, colors.get(sel.path), used(sel), sel.path, 'selected'));
  // 예산이 없는 사용(기타: 적용 전·미귀속·예산 없는 다른 프로젝트)은 미할당 칸 안에 회색으로 채운다.
  const totalPct = sel.check.windows[win].totalPct;
  const budgetedUsed = [...others, sel].reduce((a, p) => a + used(p), 0);
  const otherUsed = Math.max(0, totalPct - budgetedUsed);
  if (free > 0) {
    const label = `${tr('bar.free')} ${pp(otherUsed)}/${pp(free)}`;
    const fill = el('div', { className: 'fill', style: `width:${Math.min(100, (otherUsed / free) * 100)}%` });
    segs.push(el('div', { className: 'seg free', title: label, style: `width:${free}%` }, [fill, el('span', { textContent: free >= 8 ? label : '' })]));
  }
  $('alloc-bar').replaceChildren(...segs);
  $('bar-total').textContent = tr('bar.allocated', { n: pp(othersTotal + mine) });

  const mark = $('range-mark');
  // 줄 수 있는 범위: 다른 프로젝트 할당 뒤부터, 기타 사용(오른쪽 회색) 앞까지
  mark.style.left = `${othersTotal}%`;
  mark.style.width = `${Math.min(100 - othersTotal, sel.ranges[win].max)}%`;

  const legend = others.map((p) => {
    const item = el('span', { className: 'pick', textContent: `${p.name} ${pp(used(p))}/${ppu(p.budgets[win])}`, style: `--c:${colors.get(p.path)}` });
    item.addEventListener('click', () => selectProject(p.path));
    return item;
  });
  if (selWidth > 0) {
    const text = mine > 0 ? `${sel.name} ${pp(used(sel))}/${ppu(mine)}` : `${sel.name} ${ppu(used(sel))} (${tr('budget.none')})`;
    legend.push(el('span', { textContent: text, style: `--c:${colors.get(sel.path)}` }));
  }
  legend.push(el('span', { textContent: `${tr('bar.free')} ${pp(otherUsed)}/${ppu(free)} (${tr('bar.other')})`, style: '--c:var(--other)' }));
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
  const shown = draft ?? value;
  const slider = $('budget-slider');
  slider.max = String(range.max);
  slider.value = String(shown ?? 0);
  $('budget-number').max = String(range.max);
  $('budget-number').value = shown == null ? '' : String(shown);
  renderSaveRow();
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

/** 막대 칸·범례·선택 상자에서 프로젝트를 고른다. 저장하지 않은 값은 버린다. */
function selectProject(path) {
  if (path === selected) return;
  selected = path;
  draft = null;
  render();
}

/** 저장하지 않은 값이 있을 때만 저장·취소 버튼을 보인다. */
function isDirty() {
  return draft != null && draft !== (project().budgets[win] ?? 0);
}
/** 창 아래 고정 바: 예산 탭에서만 보이고, 바꾼 값이 없으면 버튼은 꺼 둔다. */
function renderSaveRow() {
  const dirty = isDirty();
  const impact = dirty ? saveImpact(draft) : null;
  const warning = $('budget-warning');
  warning.hidden = !impact;
  warning.textContent = impact
    ? `${tr(project().check.windows[win].used > draft ? 'budget.over' : 'budget.reached')} ${tr(impact === 'block' ? 'budget.blocksNext' : 'budget.warningOnly')}`
    : '';
  $('save-status').textContent = dirty ? tr('budget.unsaved') : '';
  $('budget-save').textContent = tr(impact === 'block' ? 'budget.saveBlocked' : 'budget.save');
  $('budget-save').disabled = !dirty || savingBudget;
  $('budget-cancel').disabled = !dirty || savingBudget;
  for (const node of document.querySelectorAll('#window-switch button, #project-select, #budget-slider, #budget-number, #budget-clear')) node.disabled = savingBudget;
}

function saveImpact(value) {
  const p = project();
  const c = p.check.windows[win];
  return budgetSaveImpact({ value, used: c.used, hasData: c.hasData, block: snap.rules.block, max: p.ranges[win].max });
}

async function saveBudget(value) {
  if (savingBudget) return;
  const shownImpact = saveImpact(value);
  savingBudget = true;
  renderSaveRow();
  try {
    // A draft can outlive a usage/reset update. Show any new consequence before saving.
    snap = await api('state');
    const latestImpact = saveImpact(value);
    if (latestImpact && latestImpact !== shownImpact) return;
    const r = await api('budget', { project: selected, window: win, value });
    snap = r.state;
    draft = null;
    toast(tr('saved'));
  } catch (err) {
    toast(err.message || tr('error'));
  } finally {
    savingBudget = false;
    render();
  }
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
  const codex = snap.provider === 'codex';
  $('conn-badge').className = `badge ${c.connected ? 'on' : ''}`;
  $('conn-badge').textContent = codex
    ? (snap.lang === 'ko' ? (desktopReview?.ready ? (c.observed ? '훅 실행 확인됨' : '승인됨 · 실행 대기') : c.connected ? '등록됨 · 신뢰 상태 확인 필요' : '훅 등록 필요')
      : (desktopReview?.ready ? (c.observed ? 'Hook execution observed' : 'Trusted · awaiting execution') : c.connected ? 'Registered · check trust status' : 'Hooks not registered'))
    : tr(c.connected ? 'conn.on' : 'conn.off');
  stats($('conn-stats'), [
    [tr('conn.last'), c.lastStatusLineAt ? fmtTime(c.lastStatusLineAt / 1000) : tr('conn.never')],
    [tr('conn.root'), c.pluginRoot],
  ]);
  $('plan-title').textContent = codex && !c.connected
    ? (snap.lang === 'ko' ? 'Codex hooks.json에 추가할 내용' : 'Changes to Codex hooks.json')
    : tr(c.connected ? 'conn.uninstallTitle' : 'conn.setupTitle');
  $('plan').textContent = c.connected ? c.uninstallPlan : c.setupPlan;
  $('plan-apply').textContent = tr(c.connected ? 'conn.undo' : 'conn.apply');
  $('plan-apply').hidden = !!c.pluginManaged;
  renderDesktopConnection();
}

function renderDesktopConnection() {
  const show = snap.provider === 'codex';
  $('desktop-connection').hidden = !show;
  if (!show) return;
  const ko = snap.lang === 'ko';
  $('desktop-title').textContent = ko ? 'GPT 앱 연결' : 'Connect the GPT desktop app';
  $('desktop-check').textContent = ko ? '상태 확인' : 'Check status';
  $('desktop-check').disabled = desktopBusy;
  $('desktop-help').textContent = ko
    ? '아래 실행 명령과 이벤트를 검토하고 승인하면, GPT 앱의 로컬 Codex 대화에서 예산을 적용합니다. 터미널 명령 입력은 필요하지 않습니다.'
    : 'Review the exact commands and events below to enable budgets in local Codex chats in the GPT desktop app. No terminal commands are required.';
  const r = desktopReview;
  $('desktop-status').textContent = desktopError || (desktopBusy ? (ko ? '확인하는 중…' : 'Checking…')
    : !r ? (ko ? '연결 상태를 확인해 주세요.' : 'Check the connection status.')
      : !r.hooksEnabled ? (ko ? 'Codex 설정에서 훅이 비활성화되어 있습니다.' : 'Lifecycle hooks are disabled in Codex settings.')
      : r.ready ? (ko ? '신뢰 승인 완료 · 새 로컬 대화에서 실행을 확인해 주세요.' : 'Trusted · verify execution in a new local chat.')
        : !r.complete ? (ko ? '훅 등록이 필요합니다. 아래 연결 내용을 확인해 주세요.' : 'Register the hooks using the setup plan below.')
          : (ko ? '훅은 등록되었고, 신뢰 승인을 기다리고 있습니다.' : 'Hooks are registered and waiting for trust approval.'));
  $('desktop-review').textContent = r ? r.hooks.map((h) => `${h.eventName} · ${h.trustStatus}${h.enabled ? '' : ' · disabled'}\n${h.command}\n${h.sourcePath}\n${h.currentHash}`).join('\n\n') : '';
  const needsConsent = !!r?.complete && r.hooksEnabled && !r.ready;
  $('desktop-consent-row').hidden = !needsConsent;
  $('desktop-approve').hidden = !needsConsent;
  $('desktop-consent-text').textContent = ko
    ? '위 훅을 검토했습니다. 로컬 세션의 사용량을 읽고, 설정한 프로젝트 예산에 따라 새 요청과 도구 실행을 제한하는 것을 허용합니다.'
    : 'I reviewed these hooks and allow them to read local session usage and limit new prompts and tool calls according to my project budgets.';
  $('desktop-approve').textContent = ko ? '검토한 훅 승인하고 연결' : 'Trust reviewed hooks and connect';
  $('desktop-approve').disabled = desktopBusy || !$('desktop-consent').checked;
}

async function checkDesktopConnection() {
  desktopBusy = true;
  desktopError = '';
  $('desktop-consent').checked = false;
  renderDesktopConnection();
  try { desktopReview = await api('codex/review'); }
  catch (err) { desktopError = err.message; }
  desktopBusy = false;
  renderDesktopConnection();
}

// ---- 공통 ----

function render() {
  document.documentElement.lang = snap.lang;
  document.title = snap.provider === 'codex' ? 'Partition · Codex' : 'Partition';
  $('brand').textContent = document.title;
  for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = tr(node.dataset.i18n);
  const hint = document.querySelector('[data-i18n="rules.weights.hint"]');
  hint.textContent = (snap.lang === 'ko' ? '입력·캐시 생성·캐시 읽기·출력. 설정 파일: ' : 'Input · cache write · cache read · output. Config: ') + snap.configPath;
  if (snap.provider === 'codex') document.querySelector('[data-i18n="conn.statusline"]').textContent = snap.lang === 'ko' ? 'Codex 훅' : 'Codex hooks';
  for (const node of document.querySelectorAll('.unit.pp')) node.textContent = tr('pp');
  renderBudget();
  renderRules();
  renderConnection();
}

function activateTab(name) {
  for (const tab of document.querySelectorAll('nav button')) tab.setAttribute('aria-selected', String(tab.dataset.tab === name));
  for (const panel of document.querySelectorAll('[role=tabpanel]')) panel.hidden = panel.id !== `tab-${name}`;
  $('save-bar').hidden = name !== 'budget';
}

function bind() {
  $('desktop-check').addEventListener('click', checkDesktopConnection);
  $('desktop-consent').addEventListener('change', renderDesktopConnection);
  $('desktop-approve').addEventListener('click', async () => {
    if (!$('desktop-consent').checked || !desktopReview || desktopBusy) return;
    desktopBusy = true;
    desktopError = '';
    renderDesktopConnection();
    try {
      const r = await api('codex/approve', { accepted: true, reviewToken: desktopReview.reviewToken });
      desktopReview = r.review;
      snap = r.state;
      $('desktop-consent').checked = false;
    } catch (err) { desktopError = err.message; }
    desktopBusy = false;
    render();
  });
  for (const tab of document.querySelectorAll('nav button')) {
    tab.addEventListener('click', () => {
      tabTouched = true;
      activateTab(tab.dataset.tab);
    });
  }
  // 창이나 프로젝트를 바꾸면 저장하지 않은 값은 버린다.
  for (const b of document.querySelectorAll('#window-switch button')) {
    b.addEventListener('click', () => {
      win = b.dataset.window;
      draft = null;
      render();
    });
  }
  $('project-select').addEventListener('change', (e) => selectProject(e.target.value));
  // 움직이는 동안 막대에 바로 반영하고, 저장은 [저장] 버튼을 눌러야 한다.
  const edit = (v) => {
    draft = v;
    renderBar();
    renderSaveRow();
  };
  $('budget-slider').addEventListener('input', (e) => {
    $('budget-number').value = e.target.value;
    edit(Number(e.target.value));
  });
  $('budget-number').addEventListener('input', (e) => {
    const v = e.target.value.trim();
    const n = v === '' ? 0 : Number(v);
    if (!Number.isFinite(n)) return;
    $('budget-slider').value = String(n);
    edit(n);
  });
  $('budget-clear').addEventListener('click', () => {
    $('budget-slider').value = '0';
    $('budget-number').value = '';
    edit(0);
  });
  $('budget-save').addEventListener('click', () => saveBudget(draft));
  $('budget-cancel').addEventListener('click', () => {
    draft = null;
    render();
  });

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

// 편집 중에는 갱신을 건너뛰어도 페이지 생존 신호는 계속 보낸다.
// 초기 데이터 읽기가 실패해도 이 타이머는 등록되어 있어야 한다.
setInterval(() => { api('heartbeat', {}).catch(() => {}); }, 10_000);

(async () => {
  bind();
  snap = await api('state');
  selected = snap.current;
  render();
  const requested = new URLSearchParams(location.search).get('tab');
  activateTab(initialTab({ connected: snap.connection.connected, requested }));
  if (snap.provider === 'codex') {
    await checkDesktopConnection();
    // A slow trust check must not override a tab the user already selected.
    if (!tabTouched) activateTab(initialTab({ connected: snap.connection.connected, ready: desktopReview?.ready, requested }));
  }
  // 저장하지 않은 초안은 유지하며 새 사용량만 반영한다.
  setInterval(refresh, 10_000);
})();
