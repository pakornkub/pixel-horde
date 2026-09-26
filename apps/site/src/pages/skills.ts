import {
  AWAKENING, DEFAULT_RESOLVED, HERO_IDS, PASSIVE_IDS, SIGNATURE_IDS, SKILL_IDS, SKILL_LINES,
  signatureOf, skillMax, skillStats, type ComboId, type PassiveId, type SkillId, type SkillStats,
} from '@pixel-horde/sim';
import { ENEMY_SPR } from '../../../game/src/render/sprites';
import { el, enemy, hero, passiveIcon, skillIcon } from '../art';
import {
  ALL, COMBO_COL, COMBO_IDS, NEEDS, STATUS_COL, STATUS_IDS, TRIGGER, elementsOf, evoPassive, isHeavy, isSweep, kindOf,
  leavers, ownerOf, pairCombos, statusesOf, triggers, type ComboHow, type Kind,
} from '../data';
import { g, onLang, s } from '../lang';
import { shell } from '../shell';
import type { TextKey } from '../text';
import { G, T, pageHead } from '../ui';

shell('skills');
const C = DEFAULT_RESOLVED;
const main = document.getElementById('main')!;
main.append(pageHead('sk.h', 'sk.p', 5, [skillIcon('frost', 'lg'), skillIcon('meteor', 'lg'), skillIcon('chain', 'lg'), skillIcon('hole', 'lg'), enemy('islime', 3)]));
const wrap = el('div.wrap', { style: 'padding:36px 0 80px' });
main.append(wrap);

const sname = (id: SkillId, evo = false): HTMLElement => G(`${evo ? 'evo' : 'skill'}.${id}.name`);
const elChip = (e: string): HTMLElement => (e === 'arcane' ? T('el.arcane', undefined, 'span', 'chip el-arcane') : G(`element.${e}`, undefined, 'span', `chip el-${e}`));
const stChip = (st: string): HTMLElement => { const c = T(`st.${st}` as TextKey, undefined, 'span', 'chip st'); c.prepend(el('i.st-dot', { style: `--c:${STATUS_COL[st as keyof typeof STATUS_COL]};width:12px;height:12px;border-width:2px` })); return c; };
const comboLabel = (c: ComboId): HTMLElement => G(`combo.${c}`, undefined, 'b', `combo-name cb-${c}`);
const comboArgs = (c: ComboId): Record<string, number> => {
  const K = C.combos;
  return { shatter: { m: K.shatter }, firestorm: {}, overload: { m: K.overload }, superconduct: { s: K.superconduct }, toxicBurst: { m: K.toxicBurst }, grinder: { m: K.grinder }, catalyst: { m: K.catalyst } }[c];
};

// ── tabs ───────────────────────────────────────────────
const TABS: [string, TextKey][] = [['table', 'sk.tab.table'], ['lab', 'sk.tab.lab'], ['evo', 'sk.tab.evo'], ['lines', 'sk.tab.lines']];
const tabBar = el('div.tabs', { role: 'tablist' });
const panes: Record<string, HTMLElement> = {};
for (const [id, key] of TABS) {
  const b = el('button', { role: 'tab', id: 'tab-' + id, 'aria-controls': 'pane-' + id, type: 'button' }, T(key));
  b.addEventListener('click', () => { history.replaceState(null, '', '#' + id); openTab(id); });
  tabBar.append(b);
  panes[id] = el('div', { role: 'tabpanel', id: 'pane-' + id, 'aria-labelledby': 'tab-' + id });
}
wrap.append(tabBar, ...Object.values(panes));
function openTab(id: string): void {
  if (!panes[id]) id = 'table';
  for (const [k, p] of Object.entries(panes)) p.hidden = k !== id;
  tabBar.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.id === 'tab-' + id)));
}
addEventListener('hashchange', () => openTab(location.hash.slice(1)));

// ── skill table ────────────────────────────────────────
const STAT_LABEL: [keyof SkillStats, TextKey, string?][] = [
  ['dmg', 'sk.dmg'], ['cd', 'sk.cd', 'sec'], ['n', 'sk.count'], ['r', 'sk.radius'], ['jumps', 'sk.jumps'], ['pierce', 'sk.pierce'],
  ['dur', 'sk.dur', 'sec'], ['len', 'sk.len'], ['range', 'sk.range'], ['boom', 'sk.boom'], ['spd', 'sk.speed'],
];
const fmt = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(v < 10 ? 2 : 1).replace(/\.?0+$/, ''));

let filterKind: 'all' | Kind = 'all', filterEl = 'all', query = '', openId: SkillId | null = null;
const grid = el('div.sk-grid');
const empty = T('sk.none', undefined, 'p', 'muted');
const search = el('input', { type: 'search', 'data-t-ph': 'sk.f.search', placeholder: s('sk.f.search') });
search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); renderGrid(); });
const seg = <V extends string>(opts: [V, HTMLElement][], get: () => V, set: (v: V) => void): HTMLElement => {
  const box = el('div.seg');
  for (const [v, label] of opts) {
    const b = el('button', { type: 'button', 'aria-pressed': String(get() === v) }, label);
    b.addEventListener('click', () => { set(v); box.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); renderGrid(); });
    box.append(b);
  }
  return box;
};
const kindSeg = seg<'all' | Kind>([['all', T('sk.f.all')], ['general', T('sk.f.general')], ['signature', T('sk.f.signature')], ['line', T('sk.f.line')]], () => filterKind, (v) => { filterKind = v; });
const elSeg = seg<string>([['all', T('sk.f.all')], ...(['fire', 'ice', 'lightning', 'poison', 'dark', 'arcane'] as const).map((e): [string, HTMLElement] => [e, elChip(e)]), ['none', T('el.none')]], () => filterEl, (v) => { filterEl = v; });

function card(id: SkillId): HTMLElement {
  const chips: HTMLElement[] = [];
  const k = kindOf(id);
  if (k === 'signature') chips.push(T('sk.f.signature', undefined, 'span', 'chip sig'));
  if (k === 'line') chips.push(T('sk.f.line', undefined, 'span', 'chip line'));
  for (const e of elementsOf(id)) chips.push(elChip(e));
  for (const st of statusesOf(id)) chips.push(stChip(st));
  if (isHeavy(id)) chips.push(T('sk.tag.heavy', undefined, 'span', 'chip'));
  if (isSweep(id)) chips.push(T('sk.tag.sweep', undefined, 'span', 'chip'));
  const b = el('button.panel.sk-card', { type: 'button', 'aria-expanded': String(openId === id), 'data-id': id },
    skillIcon(id), el('div', null, el('div.nm', null, sname(id)), G(`skill.${id}.desc`, undefined, 'div', 'ds'), el('div.chips', null, ...chips)));
  b.addEventListener('click', () => { openId = openId === id ? null : id; renderGrid(); if (openId) grid.querySelector('.sk-detail')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
  return b;
}

function detail(id: SkillId, startEvo = false): HTMLElement {
  const max = skillMax(C, id), pas = evoPassive(id);
  let lv = startEvo ? max : Math.min(max, 1), evo = startEvo && !!pas;
  const title = el('h3');
  const lvNum = el('span.lvnum');
  const range = el('input', { type: 'range', min: '1', max: String(max), value: String(lv), 'aria-label': s('sk.lv') });
  const evoBox = el('input', { type: 'checkbox' });
  evoBox.checked = evo;
  const stats = el('div.stats-grid');
  const draw = (): void => {
    title.replaceChildren(sname(id, evo));
    lvNum.textContent = `LV ${lv}${lv === max ? ' MAX' : ''}`;
    const now = skillStats(C, id, lv, evo), prev = lv > 1 ? skillStats(C, id, lv - 1, evo) : now;
    stats.replaceChildren(...STAT_LABEL.filter(([k]) => typeof now[k] === 'number' && (now[k] as number) !== 0).map(([k, key, unit]) => {
      const v = now[k] as number, up = v !== prev[k];
      return el('div.stat', null, T(key), el(`b${up ? '.up' : ''}`, null, fmt(v) + (unit ? s('sk.sec') : '')));
    }));
    const flags = (['freeze', 'twin', 'absorb', 'stun', 'smart'] as const).filter((f) => now[f]);
    if (flags.length) stats.append(el('div.stat', null, el('span', null, 'EVO'), el('b.up', null, flags.join(' '))));
  };
  range.addEventListener('input', () => { lv = Number(range.value); if (lv < max && evo) { evo = false; evoBox.checked = false; } draw(); });
  evoBox.addEventListener('change', () => { evo = evoBox.checked; if (evo) { lv = max; range.value = String(max); } draw(); });
  onLang(draw);
  draw();

  const rows: HTMLElement[] = [];
  rows.push(el('div', null, T('sk.max', { n: max }, 'b')));
  if (pas) rows.push(el('div', null, T('sk.evoWith', undefined, 'b'), passiveIcon(pas, 'sm'), G(`passive.${pas}.name`), el('span', null, '→'), el('span.skname', null, G(`evo.${id}.name`)), G(`evo.${id}.desc`, undefined, 'span', 'muted')));
  else rows.push(el('div', null, T('sk.evoWith', undefined, 'b'), T('sk.noEvo', undefined, 'span', 'muted')));
  for (const o of ownerOf(id)) {
    const key: TextKey = o.how === 'sig' ? 'sk.sigOf' : o.how === 'link' ? 'sk.lineOf' : 'sk.awOf';
    rows.push(el('div', null, T(key, undefined, 'b'), hero(o.hero, 2), G(`hero.${o.hero}.name`, undefined, 'span', 'skname')));
  }
  const pairs = ALL.map((o) => [o, pairCombos(id, o)] as const).filter(([, c]) => c.length);
  if (pairs.length) rows.push(el('div', null, T('sk.pairs', undefined, 'b'), ...pairs.map(([o, cs]) => {
    const a = el('a', { href: '#lab', title: cs.map((c) => g(`combo.${c.combo}`)).join(' ') }, skillIcon(o, 'sm'));
    a.addEventListener('click', () => { setLab(id, o); });
    return a;
  })));

  return el('div.panel.sk-detail', null,
    el('div.top-row', null, skillIcon(id, 'lg'), el('div', null, title, G(`skill.${id}.desc`, undefined, 'p', 'muted'))),
    el('div.lvctl', null, T('sk.lv', undefined, 'b'), range, lvNum, pas ? el('label', null, evoBox, T('sk.evoOn')) : null),
    stats, el('div.info-rows', null, ...rows));
}

function renderGrid(): void {
  const list = ALL.filter((id) => {
    if (filterKind !== 'all' && kindOf(id) !== filterKind) return false;
    const els = elementsOf(id);
    if (filterEl === 'none' ? els.length > 0 : filterEl !== 'all' && !els.includes(filterEl)) return false;
    if (query && !(`${g(`skill.${id}.name`)} ${g(`skill.${id}.desc`)} ${id}`.toLowerCase().includes(query))) return false;
    return true;
  });
  const kids: HTMLElement[] = [];
  for (const id of list) { kids.push(card(id)); if (id === openId) kids.push(detail(id, openEvo)); }
  openEvo = false;
  grid.replaceChildren(...kids);
  empty.hidden = list.length > 0;
}
let openEvo = false;
renderGrid();
onLang(renderGrid);

const pasGrid = el('div.pas-grid', null, ...PASSIVE_IDS.map((p: PassiveId) => {
  const evos = ALL.filter((id) => evoPassive(id) === p);
  return el('div.panel.pas', null, passiveIcon(p), el('div', null, G(`passive.${p}.name`, undefined, 'div', 'nm'), G(`passive.${p}.desc`, undefined, 'div', 'ds'),
    el('div', { style: 'display:flex;gap:4px;align-items:center;margin-top:6px;flex-wrap:wrap' }, T('sk.pasEvo', undefined, 'b', 'muted'), ...evos.map((id) => skillIcon(id, 'sm')))));
}));
panes.table.append(el('div.filters', null, kindSeg, search), el('div.filters', null, T('sk.f.el', undefined, 'b'), elSeg),
  el('p.muted', { style: 'font-size:14px' }, T('sk.tag.heavyD'), ' · ', T('sk.tag.sweepD')), grid, empty, el('h2.subh', null, T('sk.passives')), pasGrid);

// ── combo lab ──────────────────────────────────────────
const LAB_SKILLS = ALL.filter((id) => ALL.some((o) => pairCombos(id, o).length));
let labA: SkillId = 'frost', labB: SkillId = 'meteor';
const out = el('div.lab-out');
function picker(label: TextKey, get: () => SkillId, set: (v: SkillId) => void): { box: HTMLElement; sync: () => void } {
  const chosen = el('div.chosen');
  const list = el('div.pick-list');
  const sync = (): void => {
    list.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === get())));
    chosen.replaceChildren(skillIcon(get()), sname(get()));
  };
  for (const id of LAB_SKILLS) {
    const b = el('button', { type: 'button', 'data-id': id, title: g(`skill.${id}.name`) }, skillIcon(id));
    b.addEventListener('click', () => { set(id); sync(); renderLab(); });
    onLang(() => { b.title = g(`skill.${id}.name`); });
    list.append(b);
  }
  const box = el('div.panel.pick', null, T(label, undefined, 'p'), list, chosen);
  sync();
  return { box, sync };
}
const pickA = picker('lab.a', () => labA, (v) => { labA = v; });
const pickB = picker('lab.b', () => labB, (v) => { labB = v; });
const syncPickers = (): void => { pickA.sync(); pickB.sync(); };

function tagWord(c: ComboId): string {
  const t = TRIGGER[c];
  return t === 'heavy' ? s('sk.tag.heavy') : t === 'sweep' ? s('sk.tag.sweep') : t === 'arcane' ? s('el.arcane') : g(`element.${t}`);
}
function how(h: ComboHow): HTMLElement {
  const p = el('p', null);
  p.innerHTML = s('lab.how', { a: g(`skill.${h.from}.name`), b: g(`skill.${h.to}.name`), status: h.combo === 'catalyst' ? s(`st.${h.status}` as TextKey) : s(`st.${NEEDS[h.combo]}` as TextKey), tag: tagWord(h.combo), combo: g(`combo.${h.combo}`) });
  return p;
}
function renderLab(): void {
  const res = pairCombos(labA, labB);
  stopAnims();
  out.replaceChildren(res.length
    ? el('div.result', null, ...res.map((h) => el('div.panel.combo-hit', null, comboCanvas(h.combo), el('div', null, comboLabel(h.combo), how(h), el('p.muted', null, s(`cb.${h.combo}` as TextKey, comboArgs(h.combo)))))))
    : el('div.panel', null, T('lab.none', undefined, 'p')));
}
function setLab(a: SkillId, b: SkillId): void { labA = a; labB = b; syncPickers(); renderLab(); openTab('lab'); history.replaceState(null, '', '#lab'); scrollTo({ top: 0 }); }
onLang(renderLab);

// A tiny looping picture of a Combo: the Status tint, the hit, the blast.
let animIds: number[] = [];
const stopAnims = (): void => { animIds.forEach(cancelAnimationFrame); animIds = []; };
function comboCanvas(c: ComboId): HTMLCanvasElement {
  const cv = el('canvas', { width: '96', height: '64', 'aria-hidden': 'true' });
  cv.style.cssText = 'width:192px;height:128px;image-rendering:pixelated';
  const x = cv.getContext('2d')!;
  const st = NEEDS[c] === 'any' ? 'burning' : NEEDS[c];
  const mob = ENEMY_SPR.slime, col = COMBO_COL[c], stc = STATUS_COL[st as keyof typeof STATUS_COL];
  const t0 = performance.now();
  const frame = (now: number): void => {
    const t = ((now - t0) / 1000) % 2.4;
    x.fillStyle = '#2a2450'; x.fillRect(0, 0, 96, 64);
    const spots = [[30, 40], [48, 44], [66, 40], [40, 28], [58, 28]];
    spots.forEach(([sx, sy], i) => {
      const img = t > 0.5 && (i === 1 || t > 1.2) ? (st === 'frozen' ? mob[0].i : mob[0].n) : mob[0].n;
      x.drawImage(t > 1.2 && t < 1.3 ? mob[0].w : img, sx - 8, sy - 8);
      if (t > 0.5 && i === 1) { x.fillStyle = stc; x.globalAlpha = 0.5; x.fillRect(sx - 7, sy - 9, 14, 2); x.globalAlpha = 1; }
    });
    if (t > 0.9 && t < 1.2) { const k = (t - 0.9) / 0.3; x.fillStyle = col; x.fillRect(48 - 2, 4 + k * 32, 4, 6); }
    if (t > 1.2) { const k = Math.min(1, (t - 1.2) / 0.5); x.strokeStyle = col; x.lineWidth = 3; x.globalAlpha = 1 - k * 0.7; x.beginPath(); x.arc(48, 40, 6 + k * 26, 0, Math.PI * 2); x.stroke(); x.globalAlpha = 1; }
    animIds.push(requestAnimationFrame(frame));
  };
  animIds.push(requestAnimationFrame(frame));
  return cv;
}

// Matrix of every pair among general + signature skills.
const MX: SkillId[] = [...SKILL_IDS, ...SIGNATURE_IDS];
function matrix(): HTMLElement {
  const table = el('table.matrix', null, el('thead', null, el('tr', null, el('th'), ...MX.map((id) => el('th', { title: g(`skill.${id}.name`) }, skillIcon(id, 'sm'))))));
  const body = el('tbody');
  for (const a of MX) {
    const tr = el('tr', null, el('th', { title: g(`skill.${a}.name`) }, skillIcon(a, 'sm')));
    for (const b of MX) {
      if (a === b) { tr.append(el('td.self')); continue; }
      const cs = pairCombos(a, b);
      const td = el(`td${cs.length ? '.has' : ''}`);
      if (cs.length) {
        td.style.setProperty('--cc', COMBO_COL[cs[0].combo]);
        const btn = el('button', { type: 'button', title: `${g(`skill.${a}.name`)} + ${g(`skill.${b}.name`)}: ${cs.map((h) => g(`combo.${h.combo}`)).join(' ')}` }, cs.length > 1 ? String(cs.length) : '');
        btn.addEventListener('click', () => setLab(a, b));
        td.append(btn);
      }
      tr.append(td);
    }
    body.append(tr);
  }
  table.append(body);
  return el('div.matrix-wrap', null, table);
}
const legend = el('div.legend', null, ...COMBO_IDS.map((c) => { const sp = el('span', null, el('i'), G(`combo.${c}`)); sp.style.setProperty('--cc', COMBO_COL[c]); return sp; }));
const matrixBox = el('div');
const drawMatrix = (): void => { matrixBox.replaceChildren(matrix()); };
drawMatrix();
onLang(drawMatrix);

const S = C.status;
const statusArgs: Record<string, Record<string, number>> = { frozen: { s: S.frozen, n: S.frostStacks }, gathered: { s: S.gatherLinger }, burning: { s: S.burning }, shocked: { s: S.shocked }, poisoned: { s: S.poisoned } };
const statusCards = el('div.status-grid', null, ...STATUS_IDS.map((st) => el('div.panel.st-card', null,
  el('h3', null, el('i.st-dot', { style: `--c:${STATUS_COL[st]}` }), T(`st.${st}` as TextKey)), T(`st.${st}.d` as TextKey, statusArgs[st], 'p'),
  el('div', { style: 'display:flex;gap:4px;flex-wrap:wrap;align-items:center' }, T('lab.madeBy', undefined, 'b', 'muted'), ...leavers(st).map((id) => skillIcon(id, 'sm'))))));
const comboCards = el('div.combo-grid', null, ...COMBO_IDS.map((c) => el('div.panel.cb-card', null,
  el('h3', null, comboLabel(c)),
  el('div.recipe', null, NEEDS[c] === 'any' ? T('lab.anyStatus', undefined, 'span', 'chip st') : stChip(NEEDS[c]), '+', TRIGGER[c] === 'heavy' ? T('sk.tag.heavy', undefined, 'span', 'chip') : TRIGGER[c] === 'sweep' ? T('sk.tag.sweep', undefined, 'span', 'chip') : elChip(TRIGGER[c])),
  T(`cb.${c}` as TextKey, comboArgs(c), 'p', 'muted'),
  el('div', { style: 'display:flex;gap:4px;flex-wrap:wrap' }, ...triggers(c).map((id) => skillIcon(id, 'sm'))))));
const rnd = el('button.btn.sm', { type: 'button' }, T('lab.random'));
rnd.addEventListener('click', () => {
  const pairs: [SkillId, SkillId][] = [];
  for (const a of LAB_SKILLS) for (const b of LAB_SKILLS) if (a < b && pairCombos(a, b).length) pairs.push([a, b]);
  const [a, b] = pairs[Math.floor(Math.random() * pairs.length)];
  labA = a; labB = b; syncPickers(); renderLab();
});
panes.lab.append(el('h2', null, T('lab.h')), T('lab.p', undefined, 'p', 'lead'),
  el('div.lab', null, pickA.box, el('div.plus', null, '+'), pickB.box), el('p', { style: 'margin-top:14px' }, rnd), out,
  el('h2.subh', null, T('lab.combos')), T('lab.cd', { s: C.combos.cooldown }, 'p', 'muted'), comboCards,
  el('h2.subh', null, T('lab.statuses')), statusCards,
  el('h2.subh', null, T('lab.matrix')), T('lab.matrixP', undefined, 'p', 'muted'), legend, matrixBox);
renderLab();

// ── evolutions ─────────────────────────────────────────
{
  const EVO = ALL.filter((id) => evoPassive(id));
  const rows = EVO.map((id) => {
    const p = evoPassive(id)!;
    const tr = el('tr', { tabindex: '0' },
      el('td', null, el('div.cell', null, skillIcon(id), sname(id))), el('td.op', null, '+'),
      el('td', null, el('div.cell', null, passiveIcon(p), G(`passive.${p}.name`))), el('td.op', null, '='),
      el('td.res', null, el('div.cell', null, el('span.ico', { style: '--c:#ffd23f' }, '★'), el('div', null, G(`evo.${id}.name`), G(`evo.${id}.desc`, undefined, 'small', 'ds')))));
    const go = (): void => { filterKind = 'all'; filterEl = 'all'; query = ''; search.value = ''; openId = id; openEvo = true; renderGrid(); openTab('table'); history.replaceState(null, '', '#table'); grid.querySelector('.sk-detail')?.scrollIntoView({ block: 'center' }); };
    tr.addEventListener('click', go);
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    return tr;
  });
  const byPas = el('div.by-pas', null, ...PASSIVE_IDS.map((p) => el('div.panel', null, passiveIcon(p), G(`passive.${p}.name`, undefined, 'b'), el('span', null, '→'), ...EVO.filter((id) => evoPassive(id) === p).map((id) => el('span.skname', null, skillIcon(id, 'sm'), G(`evo.${id}.name`))))));
  panes.evo.append(el('h2', null, T('evo.h')), T('evo.p', undefined, 'p', 'lead'),
    el('table.evo-table', null, el('thead', null, el('tr', null, el('th', null, T('evo.skill')), el('th'), el('th', null, T('evo.passive')), el('th'), el('th', null, T('evo.result')))), el('tbody', null, ...rows)),
    el('h3.subh', null, T('evo.byPassive')), byPas);
}

// ── hero lines ─────────────────────────────────────────
{
  const box = (label: TextKey, ...kids: Node[]): HTMLElement => el('div.box', null, T(label, undefined, 'b'), el('div.row', null, ...kids));
  panes.lines.append(el('h2', null, T('lines.h')), T('lines.p', undefined, 'p', 'lead'), el('div.grid', null, ...HERO_IDS.map((h) => {
    const sig = signatureOf(h), A = AWAKENING[h];
    return el('div.panel.line-card', null,
      el('div.who', null, hero(h, 5), G(`hero.${h}.name`, undefined, 'b', 'pixh'), G(`hero.${h}.role`, undefined, 'span', 'muted')),
      el('div.flow', null,
        box('lines.sig', el('span.skname', null, skillIcon(sig), sname(sig)), el('span', null, '→'), el('span.skname', null, passiveIcon(evoPassive(sig)!, 'sm'), G(`evo.${sig}.name`))),
        el('span.arr', null, '+'),
        box('lines.links', ...SKILL_LINES[h].map((id) => el('span.skname', null, skillIcon(id, 'sm'), sname(id)))),
        el('span.arr', null, '→'),
        box('lines.form', G(`form.${A.form}`, undefined, 'span', 'chip line')),
        el('span.arr', null, '→'),
        box('lines.new', ...A.line.map((id) => el('span.skname', null, skillIcon(id, 'sm'), sname(id))))));
  })));
}

openTab(location.hash.slice(1) || 'table');
