import {
  AWAKENING, HERO_IDS, REALMS, ROUTE_REALMS, SHOP_IDS, SKILL_LINES, WEAPONS, WEAPON_IDS, WHEEL,
  adviceFor, signatureOf, xpNeed, type HeroId, type RealmId, type SkillId,
} from '@pixel-horde/sim';
import { isRanked, offeredPresets } from '@pixel-horde/config';
import { ENEMY_SPR } from '../../../game/src/render/sprites';
import { VIEWS, viewZoom } from '../../../game/src/settings';
import { el, enemy, hero, passiveIcon, pickup, pix, shopIcon, skillIcon, weaponIcon } from '../art';
import { siteConfig } from '../backend';
import { g, onLang, s } from '../lang';
import { reveals, shell, toHash } from '../shell';
import type { TextKey } from '../text';
import { G, T, groundBg, pageHead } from '../ui';

shell('guide');
// Numbers follow the Balance Config the game uses right now (built-in defaults when offline).
const C = await siteConfig();
const main = document.getElementById('main')!;

const SECS: [string, TextKey][] = [
  ['controls', 'g.controls.h'], ['goal', 'g.goal.h'], ['stage', 'g.stage.h'], ['exp', 'g.exp.h'], ['slots', 'g.slots.h'],
  ['evolve', 'g.evo.h'], ['combos', 'g.combo.h'], ['ultimate', 'g.ult.h'], ['chest', 'g.chest.h'], ['kings', 'g.kings.h'],
  ['events', 'g.events.h'], ['skill-points', 'g.sp.h'], ['awakening', 'g.awaken.h'], ['gold', 'g.gold.h'], ['coop', 'g.coop.h'], ['settings', 'g.set.h'], ['tips', 'g.tips.h'],
];

const toc = el('nav.toc', { 'aria-labelledby': 'tocH' }, T('guide.toc', undefined, 'p'), el('ol', null, ...SECS.map(([id, key]) => el('li', null, el('a', { href: '#' + id }, T(key))))));
const article = el('div.gbody');
main.append(
  pageHead('guide.h', 'guide.p', 0, [hero('knight', 4, 'r'), hero('mage', 4, 'r'), enemy('slime', 3), enemy('bat', 3), enemy('mush', 3)]),
  el('div.guide.wrap', null, toc, article),
);
toc.querySelector('p')!.id = 'tocH';

let n = 0;
function sec(id: string, h: TextKey, ...kids: (Node | null)[]): void {
  n++;
  article.append(el('section.gsec', { id }, el('h2', null, el('span.num', null, String(n)), T(h)), ...kids));
}
const tryTag = (): HTMLElement => T('guide.try', undefined, 'span', 'try');
const note = (key: TextKey, cls = '', args?: Record<string, string | number>): HTMLElement => { const d = T(key, args, 'div', 'note ' + cls); return d; };
type Part = [TextKey, Record<string, string | number>?] | false;
/** Sentences joined into one element; parts that are `false` (a rule switched off in the Balance Config) are left out. */
const parts = (tag: 'div' | 'p', cls: string, ...ps: Part[]): HTMLElement => {
  const e = el(tag);
  if (cls) e.className = cls;
  ps.filter((p): p is [TextKey, Record<string, string | number>?] => !!p).forEach(([k, a], i) => { if (i) e.append(' '); e.append(T(k, a)); });
  return e;
};
const pct = (x: number): number => Math.round(x * 100);
/** English plural ending for a count (Thai text ignores it). */
const pl = (n: number): string => (n === 1 ? '' : 's');
/** The Ultimate's name for a Weapon, on the Weapon's own colour (like the in-game ULT button). */
const ultChip = (id: keyof typeof WEAPONS): HTMLElement => { const c = G(`weapon.${id}.ult`, undefined, 'span', 'chip'); c.style.cssText = `background:${WEAPONS[id].col};color:var(--ink)`; return c; };
const skname = (id: SkillId, evo = false): HTMLElement => el('span.skname', null, skillIcon(id, 'sm'), G(`${evo ? 'evo' : 'skill'}.${id}.name`));

// ── 1. controls ─────────────────────────────────────────
{
  const keyRow = (keys: Node, label: TextKey): HTMLElement => el('div.row', null, keys, T(label));
  const wasd = el('div.wasd', null, ...['W', 'A', 'S', 'D'].map((k) => el('span.key', { 'data-k': k.toLowerCase() }, k)));
  const arrows = el('div.wasd', null, ...['↑', '←', '↓', '→'].map((k, i) => el('span.key', { 'data-k': ['arrowup', 'arrowleft', 'arrowdown', 'arrowright'][i] }, k)));
  const board = el('div.panel.keyboard', null,
    keyRow(el('div', { style: 'display:flex;gap:14px' }, wasd, arrows), 'g.k.move'),
    keyRow(el('span.key.wide', { 'data-k': ' ' }, 'SPACE'), 'g.k.ult'),
    keyRow(el('div.keycaps', null, el('span.key', { 'data-k': 'p' }, 'P'), el('span.key', { 'data-k': 'm' }, 'M')), 'g.k.pause'),
    T('g.k.phone', undefined, 'p', 'muted'));
  // mute label sits next to M: split P / M labels
  board.children[2].replaceChildren(el('span.key', { 'data-k': 'p' }, 'P'), T('g.k.pause'), el('span.key', { 'data-k': 'm' }, 'M'), T('g.k.mute'));

  const field = groundBg(el('div.field', { tabindex: '0', 'aria-label': 'demo' }), 0, 12, 6, 2);
  const dirs = { down: hero('mage', 3, 'down'), up: hero('mage', 3, 'up'), r: hero('mage', 3, 'r'), l: hero('mage', 3, 'l') } as const;
  const me = el('div.me', null, ...Object.values(dirs));
  const setDir = (d: keyof typeof dirs): void => { for (const [k, c] of Object.entries(dirs)) c.style.display = k === d ? 'block' : 'none'; };
  setDir('down');
  const hint = T('g.k.demo', undefined, 'div', 'hint');
  field.append(me, hint);
  const mobs = [enemy('slime', 3), enemy('bat', 3)];
  mobs.forEach((m) => { m.style.position = 'absolute'; field.append(m); });
  const held = new Set<string>();
  let px = 120, py = 90, target: [number, number] | null = null;
  const onKey = (e: KeyboardEvent, down: boolean): void => {
    const k = e.key.toLowerCase();
    board.querySelectorAll<HTMLElement>(`[data-k="${CSS.escape(k)}"]`).forEach((c) => c.classList.toggle('on', down));
    if (!['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) return;
    const r = field.getBoundingClientRect();
    if (r.bottom < 0 || r.top > innerHeight) return;
    if (down) { held.add(k); e.preventDefault(); } else held.delete(k);
  };
  addEventListener('keydown', (e) => onKey(e, true));
  addEventListener('keyup', (e) => onKey(e, false));
  const drag = (e: PointerEvent): void => { if (e.buttons || e.type === 'pointerdown') { const r = field.getBoundingClientRect(); target = [e.clientX - r.left - 24, e.clientY - r.top - 30]; } };
  field.addEventListener('pointerdown', (e) => { field.setPointerCapture(e.pointerId); drag(e); });
  field.addEventListener('pointermove', drag);
  field.addEventListener('pointerup', () => { target = null; });
  let last = performance.now(), tt = 0;
  const loop = (now: number): void => {
    const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; tt += dt;
    let dx = 0, dy = 0;
    if (held.has('a') || held.has('arrowleft')) dx--;
    if (held.has('d') || held.has('arrowright')) dx++;
    if (held.has('w') || held.has('arrowup')) dy--;
    if (held.has('s') || held.has('arrowdown')) dy++;
    if (target) { const ax = target[0] - px, ay = target[1] - py, d = Math.hypot(ax, ay); if (d > 4) { dx = ax / d; dy = ay / d; } }
    const len = Math.hypot(dx, dy) || 1;
    const W = field.clientWidth - 48, H = field.clientHeight - 48;
    px = Math.max(0, Math.min(W, px + (dx / len) * 150 * dt));
    py = Math.max(0, Math.min(H, py + (dy / len) * 150 * dt));
    if (dx || dy) { setDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : dy > 0 ? 'down' : 'up'); hint.style.opacity = '0'; }
    me.style.transform = `translate(${px}px,${py}px)`;
    mobs.forEach((m, i) => { const a = tt * 0.7 + i * Math.PI; m.style.transform = `translate(${px + Math.cos(a) * 70}px,${py + Math.sin(a) * 40}px)`; });
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  sec('controls', 'g.controls.h', T('g.controls.p', undefined, 'p'), el('div.ctrl.demo', null, board, field));
}

// ── 2. goal: the route map ──────────────────────────────
{
  const info = el('div.panel.realm-info');
  const showRealm = (r: RealmId, btn?: HTMLElement): void => {
    route.querySelectorAll('.realm').forEach((b) => b.classList.toggle('sel', b === btn));
    const R = REALMS[r], w = Object.values(WEAPONS).find((x) => x.realm === r);
    const who = groundBg(el('div.who', null, ...R.pool.map((m) => enemy(m, 2)), enemy(R.king, 3)), R.theme, 8, 6, 2);
    const traits = R.traits.length ? R.traits.map((t) => G(`trait.${t}`, undefined, 'span', 'chip st')) : [T('w.noTraits', undefined, 'span', 'chip st')];
    const resist = R.element ? G(`element.${R.element}`, undefined, 'span', `chip el-${R.element}`) : T('w.noResist', undefined, 'span', 'chip st');
    const adv = adviceFor(R);
    info.replaceChildren(who, el('div', null,
      el('h3', null, G(`realm.${r}.name`)),
      el('dl.kv', null,
        el('dt', null, T('w.king')), el('dd', null, G(`realm.${r}.king`)),
        el('dt', null, T('w.traits')), el('dd', null, ...traits),
        el('dt', null, T('w.resist', { p: Math.round((1 - C.realms.resist) * 100) })), el('dd', null, resist),
        adv.length ? el('dt', null, T('w.advice')) : null, adv.length ? el('dd', null, ...adv.map((id) => skname(id as SkillId))) : null,
        w ? el('dt', null, T('w.weapon')) : null, w ? el('dd', null, weaponIcon(w.id, 3), G(`weapon.${w.id}.name`)) : null)));
  };
  const realmBtn = (r: RealmId, fixed = false): HTMLElement => {
    const b = groundBg(el(`button.realm${fixed ? '.fixed' : ''}`, { type: 'button', title: g(`realm.${r}.short`) }, enemy(REALMS[r].king, fixed ? 2 : 1)), REALMS[r].theme, 6, 5, 1);
    b.addEventListener('click', () => showRealm(r, b));
    onLang(() => { b.title = g(`realm.${r}.short`); });
    return b;
  };
  const pool = [...ROUTE_REALMS];
  const route = el('div.route');
  const first = realmBtn('greenvale', true);
  route.append(el('div.node', null, el('span.ch', null, 'CH 1'), first), el('span.arrow', null, '▶'));
  const last = C.stage.chapters;
  for (let ch = 2; ch < last; ch++) {
    const a = pool[(ch * 2) % pool.length], b = pool[(ch * 2 + 1) % pool.length];
    route.append(el('div.node', null, el('span.ch', null, `CH ${ch}`), el('div.pair', null, realmBtn(a), T('g.goal.pick', undefined, 'span', 'or'), realmBtn(b))), el('span.arrow', null, '▶'));
  }
  route.append(el('div.node', null, el('span.ch', null, `CH ${last}`), realmBtn('crater', true)), el('span.arrow', null, '▶'),
    el('div.node', null, el('span.ch', null, 'BOSS'), groundBg(el('div.realm.fixed', { style: 'width:84px;height:84px;border:3px solid var(--ink);border-radius:4px;display:grid;place-items:center' }, enemy('umbra', 2)), 4, 6, 5, 3)));
  showRealm('greenvale', first);
  sec('goal', 'g.goal.h', T('g.goal.p', { n: last }, 'p'),
    el('p', null, tryTag(), T('g.goal.click')), el('div.panel', { style: 'padding:12px' }, route), el('div.demo', null, info),
    note('g.goal.note'), note('g.goal.end', 'good'), note('g.goal.lost', 'warn'));
}

// ── 3. a Stage: timeline ────────────────────────────────
{
  const P = C.stage, SP = C.spawn, boss = pct(P.bossAt);
  const sel = el('select', { 'aria-label': 'Chapter' }, ...Array.from({ length: P.chapters }, (_, i) => el('option', { value: String(i + 1) }, `CH ${i + 1}`)));
  const len = el('b');
  const bar = el('div.tbar', { style: `background:linear-gradient(90deg,#5fae4b 0 ${boss}%,#ff8a3d ${boss}% 100%)` }, el('div.ot'), el('span.mark', { style: `left:${boss}%` }, `👑 ${boss}%`), el('span.mark', { style: 'left:100%' }, '⏱'), el('div.cursor'));
  const range = el('input', { type: 'range', min: '0', max: '130', value: '10', 'aria-label': 'time' });
  const pic = el('div.pic');
  const say = el('div');
  const stageLen = (ch: number): number => Math.min(P.durMax, P.durBase + P.durPerStage * (ch - 1));
  // The swarm: a full ring, or (spawn.pincer) two arcs on normal Stages; wave fronts only when spawn.frontShare is on.
  const swarm: Part[] = [[SP.pincer ? 'g.stage.t1p' : 'g.stage.t1', { s: SP.swarmEvery, b: SP.swarmEveryBloodMoon }], SP.frontShare > 0 && ['g.stage.front', { s: SP.frontEvery }]];
  const phases: [number, Part[], () => Node][] = [
    [Math.round(boss * 0.45), [['g.stage.t0']], () => el('div', { style: 'display:flex;gap:4px;align-items:end' }, hero('mage', 3), pickup('gem', 3))],
    [boss, swarm, () => el('div', { style: 'display:flex;gap:2px;align-items:end' }, enemy('bat', 2), hero('mage', 2), enemy('slime', 2), enemy('mush', 2))],
    [Math.round(boss + (100 - boss) * 0.45), [['g.stage.t2', { p: boss }]], () => enemy('boss', 3)],
    [100, [['g.stage.t3', { p: pct(C.kings.phaseAt), s: C.kings.ultWarn }]], () => el('div', { style: 'position:relative' }, enemy('boss', 3), el('span', { style: 'position:absolute;top:-6px;right:-10px;font:400 16px var(--pix);color:#ff2a3a' }, '!'))],
    [115, [['g.stage.t4', { s: P.overtime }]], () => el('div', { style: 'display:flex;gap:2px;align-items:end;filter:saturate(1.6) hue-rotate(-20deg)' }, enemy('boss', 3), enemy('slime', 2), enemy('slime', 2))],
    [131, [['g.stage.t5'], P.escapeRepicks > 0 && ['g.stage.t5r', { n: P.escapeRepicks }]], () => el('div', { style: 'opacity:.55;transform:translateX(24px)' }, enemy('boss', 3))],
  ];
  let shown = -1;
  const update = (): void => {
    const ch = Number(sel.value), L = stageLen(ch), v = Number(range.value);
    len.dataset.args = JSON.stringify({ s: L });
    len.dataset.t = 'g.stage.len';
    len.innerHTML = s('g.stage.len', { s: L });
    bar.querySelector<HTMLElement>('.cursor')!.style.left = `${Math.min(v, 130) / 100 * 100}%`;
    const i = phases.findIndex(([end]) => v < end);
    if (i !== shown) {
      shown = i;
      const [, text, art] = phases[i];
      pic.replaceChildren(art());
      say.replaceChildren(parts('p', '', ...text));
    }
  };
  sel.addEventListener('change', update);
  range.addEventListener('input', update);
  groundBg(pic, 0, 6, 5, 4);
  update();
  const box = el('div.panel', null,
    el('div.tl-row', null, T('g.stage.ch', undefined, 'b'), sel, len),
    el('div.timeline', { style: 'margin-top:44px' }, bar, range),
    el('div.tl-say', null, pic, say));
  sec('stage', 'g.stage.h', el('p', null, tryTag(), T('g.stage.p')), box,
    note('g.stage.win', 'good', { c: C.economy.kingChest, cs: pl(C.economy.kingChest), sp: C.economy.kingSkillPoints, ps: pl(C.economy.kingSkillPoints), hp: pct(P.clearHeal) }));
}

// ── 4. EXP and level up ─────────────────────────────────
{
  const drops = el('div.drops', null,
    el('div', null, pickup('gem', 3), T('g.drop.gem')), el('div', null, pickup('coin', 3), T('g.drop.coin')), el('div', null, pickup('heart', 3), T('g.drop.heart')),
    el('div', null, pickup('shield', 3), T('g.drop.shield')), el('div', null, pickup('chest', 3), T('g.drop.chest')));
  const msg = el('p', { 'aria-live': 'polite', style: 'min-height:1.6em;font-weight:700;color:var(--ink)' });
  const opts: [HTMLElement, string][] = [];
  const opt = (icon: HTMLElement, nameKey: string, descKey: string, tag: TextKey, kind: TextKey): HTMLElement => {
    const b = el('button.opt', { type: 'button' }, icon, el('span', null,
      el('span.nm', null, G(nameKey), T(tag, undefined, 'span', 'tag')), el('span.ds', null, G(descKey)), el('span.ds', null, T(kind))));
    b.addEventListener('click', () => {
      for (const [o] of opts) o.classList.toggle('chosen', o === b);
      msg.dataset.t = 'g.exp.picked';
      msg.dataset.args = JSON.stringify({ name: g(nameKey) });
      msg.innerHTML = s('g.exp.picked', { name: g(nameKey) });
    });
    opts.push([b, nameKey]);
    return b;
  };
  onLang(() => { if (msg.dataset.args) { const k = opts.find(([o]) => o.classList.contains('chosen'))?.[1]; if (k) msg.innerHTML = s('g.exp.picked', { name: g(k) }); } });
  const box = el('div.panel.lvbox', null, el('h3', null, 'LEVEL UP!  LV 5'),
    opt(skillIcon('frost'), 'skill.frost.name', 'skill.frost.desc', 'g.exp.new', 'g.exp.newp'),
    opt(skillIcon('bolt'), 'skill.bolt.name', 'skill.bolt.desc', 'g.exp.up', 'g.exp.upp'),
    opt(passiveIcon('swift'), 'passive.swift.name', 'passive.swift.desc', 'g.exp.pas', 'g.exp.pasp'),
    msg);
  box.querySelectorAll('.opt .tag')[1].textContent = 'LV 3';
  const bars = el('div.xpchart', { role: 'img', 'aria-label': 'EXP curve' });
  let mx = 0;
  const vals = Array.from({ length: 30 }, (_, i) => { const v = xpNeed(C, i + 1); mx = Math.max(mx, v); return v; });
  vals.forEach((v, i) => bars.append(el('div.bar', { style: `height:${(v / mx) * 100}%`, tabindex: '0' }, el('span', null, `LV${i + 1}: ${v}`))));
  sec('exp', 'g.exp.h', T('g.exp.p', { n: C.levelup.offers }, 'p'),
    el('h3.subh', null, T('g.exp.drops')), drops,
    el('div.grid.g2.demo', { style: 'align-items:start' },
      el('div', null, el('p', null, tryTag(), T('g.exp.try')), box),
      el('div', null, el('h3', null, T('g.exp.curve')), bars, el('div.axis', null, el('span', null, 'LV1'), el('span', null, 'LV15'), el('span', null, 'LV30')))),
    note('g.exp.cards'));
}

// ── 5. slots ────────────────────────────────────────────
{
  const slot = (inner: Node | null, lock = false): HTMLElement => el(`div.slot${inner ? '' : '.empty'}`, null, inner, lock ? T('g.slots.lock', undefined, 'span', 'lock') : null);
  const b = C.bench, aw = C.awaken.slots;
  /** A slot that opens later (a Chapter or Awakening). */
  const later = (label: Node): HTMLElement => el('div.slot.empty', { style: 'opacity:.5' }, el('span.lock', { style: 'background:var(--night3)' }, label));
  const fill = <X>(items: X[], n: number): (X | null)[] => Array.from({ length: n }, (_, i) => items[i] ?? null);
  const atk = fill([skillIcon('sigil'), skillIcon('bolt'), skillIcon('frost')], C.maxAttackSlots).map((x, i) => slot(x, i === 0));
  const pas = fill([passiveIcon('haste'), passiveIcon('might')], C.passiveSlots).map((x) => slot(x));
  const bench = fill([skillIcon('toxic')], b.start).map((x) => slot(x));
  sec('slots', 'g.slots.h', parts('p', '', ['g.slots.p', { a: C.maxAttackSlots, p: C.passiveSlots }], aw > 0 && ['g.slots.awp', { n: aw, ss: pl(aw) }]),
    el('div.slots.demo', null,
      el('div.slotgrp', null, T('g.slots.atk', undefined, 'p'), el('div.slotrow', null, ...atk, ...Array.from({ length: aw }, () => later(T('g.slots.aw'))))),
      el('div.slotgrp', null, T('g.slots.pas', undefined, 'p'), el('div.slotrow', null, ...pas)),
      el('div.slotgrp', null, T('g.slots.bench', undefined, 'p'), el('div.slotrow', null, ...bench, later(document.createTextNode(`CH${b.growAt1}+`)), later(document.createTextNode(`CH${b.growAt2}+`))))),
    parts('div', 'note', ['g.slots.benchp'], !!b.discard && ['g.slots.benchDel'], [b.passives ? 'g.slots.benchPas' : 'g.slots.benchNoPas'],
      ['g.slots.benchGrow', { n: b.start, ss: pl(b.start), a: b.growAt1, b: b.growAt2 }]));
}

// ── 6. evolution ────────────────────────────────────────
{
  const part = (icon: HTMLElement, label: Node): HTMLElement => el('div.part', null, icon, label);
  sec('evolve', 'g.evo.h', T('g.evo.p', undefined, 'p'),
    el('div.panel.demo', null, el('div.formula', null,
      part(skillIcon('bolt', 'lg'), el('span', null, G('skill.bolt.name'), el('br'), el('small', null, 'LV MAX'))), el('span', null, '+'),
      part(passiveIcon('haste', 'lg'), G('passive.haste.name')), el('span', null, '='),
      part(el('span.ico.lg', { style: '--c:#ff5cf4;box-shadow:0 0 0 4px var(--gold)' }, 'B'), el('span', null, G('evo.bolt.name'), el('br'), el('small', null, 'EVOLVE!'))))),
    el('p', null, el('a', { href: './skills.html#evo' }, T('g.evo.more'))));
}

// ── 7. combos ───────────────────────────────────────────
{
  sec('combos', 'g.combo.h', T('g.combo.p', undefined, 'p'),
    el('div.panel.demo', null, el('div.formula', null,
      el('div.part', null, skillIcon('frost', 'lg'), G('skill.frost.name')), el('span', null, '→'),
      el('div.part', null, el('span', { style: 'position:relative;display:inline-block' }, pix(ENEMY_SPR.slime[0].i, 4)), G('status.frozen')), el('span', null, '+'),
      el('div.part', null, skillIcon('meteor', 'lg'), G('skill.meteor.name')), el('span', null, '='),
      el('div.part', null, el('b', { style: 'font:400 13px var(--pix);color:var(--ink);background:#bfe6ff;padding:10px;border:3px solid var(--ink);border-radius:4px' }, 'SHATTER!'))),
    T('g.combo.ex', { x: C.combos.shatter }, 'p', 'muted')),
    el('p', null, el('a', { href: './skills.html#lab' }, T('g.combo.more'))));
}

// ── 8. ultimate & weapons ───────────────────────────────
{
  const fill = el('div', { style: 'height:100%;width:0;background:var(--gold);transition:width .1s linear' });
  const gauge = el('div.ult-gauge', { style: 'height:22px;border:4px solid var(--ink);border-radius:4px;background:var(--night3);overflow:hidden;max-width:420px;margin:10px 0' }, fill);
  let t = 0;
  setInterval(() => { t = (t + 2) % 110; fill.style.width = Math.min(100, t) + '%'; fill.style.background = t >= 100 ? '#fff35c' : 'var(--gold)'; }, 100);
  const weps = el('div.grid.g4', { style: 'gap:10px' }, ...WEAPON_IDS.map((id) => el('div.panel', { style: 'display:flex;gap:10px;align-items:center;padding:10px' },
    weaponIcon(id, 5), el('div', null, G(`weapon.${id}.name`, undefined, 'b'), el('br'), ultChip(id), el('br'), G(`weapon.${id}.desc`, undefined, 'span', 'muted')))));
  // kills add at most `killCap` × the time rate, so the fastest fill is fill / (1 + killCap)
  const U = C.ult;
  sec('ultimate', 'g.ult.h', T('g.ult.p', { s: U.fill, m: Math.round(U.fill / (1 + U.killCap)) }, 'p'), el('div', { style: 'display:flex;gap:14px;align-items:center;flex-wrap:wrap' }, gauge, el('span.key.wide', null, 'SPACE')),
    T('g.ult.w', { p: pct(C.weapons.drop) }, 'p'),
    el('div.demo', null, el('div', { style: 'display:flex;gap:10px;align-items:end;margin-bottom:14px' }, ...HERO_IDS.map((h) => hero(h, 3, 'down'))), weps));
}

// ── 9. chest wheel ──────────────────────────────────────
{
  const cells = WHEEL.map((v) => el('div.cell', null, `×${v}`));
  const wheel = el('div.wheel', null, ...cells);
  const result = el('p', { 'aria-live': 'polite', style: 'min-height:1.6em;font-weight:700' });
  const btn = el('button.btn', { type: 'button' }, T('g.chest.spin'));
  let spins = 0, busy = false;
  const count = el('p.muted');
  btn.addEventListener('click', () => {
    if (busy) return;
    busy = true;
    const r = Math.random(), want = r < C.chest.p1 ? 1 : r < C.chest.p1 + C.chest.p2 ? 2 : 3;
    const targets = WHEEL.map((v, i) => (v === want ? i : -1)).filter((i) => i >= 0);
    const stop = targets[Math.floor(Math.random() * targets.length)];
    const steps = 16 + stop + Math.floor(Math.random() * 2) * 8;
    let i = 0, delay = 50;
    cells.forEach((c) => c.classList.remove('win', 'lit'));
    const go = (): void => {
      cells.forEach((c, j) => c.classList.toggle('lit', j === i % 8));
      if (i >= steps) {
        cells[i % 8].classList.add('win');
        spins++;
        result.dataset.t = 'g.chest.won'; result.dataset.args = JSON.stringify({ n: want });
        result.innerHTML = s('g.chest.won', { n: want });
        count.dataset.t = 'g.chest.stats'; count.dataset.args = JSON.stringify({ n: spins });
        count.innerHTML = s('g.chest.stats', { n: spins });
        busy = false;
        return;
      }
      i++; delay *= 1.09;
      setTimeout(go, delay);
    };
    go();
  });
  const pc = (x: number): number => Math.round(x * 100);
  const a = pc(C.chest.p1), b = pc(C.chest.p2), c = 100 - a - b;
  const odds = el('div.odds', null, el('div', { style: `width:${a}%;background:var(--paper2)` }, '×1'), el('div', { style: `width:${b}%;background:#ffd23f` }, '×2'), el('div', { style: `width:${c}%;background:#ff5cf4` }, '×3'));
  sec('chest', 'g.chest.h', T('g.chest.p', { n: C.economy.kingChest, ss: pl(C.economy.kingChest) }, 'p'),
    el('div.panel.demo', { style: 'display:flex;gap:26px;flex-wrap:wrap;align-items:center' },
      el('div', null, pickup('chest', 6), wheel, btn, result, count),
      el('div', { style: 'flex:1;min-width:240px' }, T('g.chest.odds', { a, b, c }, 'p'), odds)));
}

// ── 10. kings: dodge the red ───────────────────────────
{
  const field = groundBg(el('div.dodge', { role: 'application', 'aria-label': 'dodge demo' }), 1, 8, 8, 6);
  const king = el('div.king', { style: 'left:calc(50% - 24px);top:calc(50% - 30px)' }, enemy('bossD', 3));
  const me = el('div.me', { style: 'left:20%;top:70%' }, hero('ranger', 3));
  const timer = el('div.timer');
  const msg = el('div.msg');
  field.append(king, me, timer, msg);
  let zones: [number, number, number][] = [], tid = 0, live = false, mx = 20, my = 70;
  const again = el('button.btn.sm', { type: 'button' }, T('g.kings.again'));
  const round = (): void => {
    field.querySelectorAll('.zone').forEach((z) => z.remove());
    zones = Array.from({ length: 4 }, () => [10 + Math.random() * 80, 10 + Math.random() * 80, 16 + Math.random() * 14]);
    zones.push([mx, my, 20]); // one always lands on you
    for (const [x, y, r] of zones) field.append(el('div.zone', { style: `left:${x - r}%;top:${y - r}%;width:${r * 2}%;height:${r * 2}%` }));
    live = true;
    msg.replaceChildren(T('g.kings.warn'));
    timer.style.transition = 'none'; timer.style.width = '100%';
    requestAnimationFrame(() => { timer.style.transition = 'width 2.2s linear'; timer.style.width = '0%'; });
    clearTimeout(tid);
    tid = window.setTimeout(() => {
      live = false;
      const hitMe = zones.some(([x, y, r]) => Math.hypot(x - mx, y - my) < r + 3);
      msg.replaceChildren(T(hitMe ? 'g.kings.hit' : 'g.kings.safe'), document.createTextNode(' '), again);
      field.querySelectorAll('.zone').forEach((z) => { (z as HTMLElement).style.background = 'rgba(255,42,58,.8)'; });
    }, 2200);
  };
  field.addEventListener('click', (e) => {
    if (!live) return;
    const r = field.getBoundingClientRect();
    mx = ((e.clientX - r.left) / r.width) * 100; my = ((e.clientY - r.top) / r.height) * 100;
    me.style.left = `calc(${mx}% - 24px)`; me.style.top = `calc(${my}% - 30px)`;
  });
  again.addEventListener('click', (e) => { e.stopPropagation(); round(); });
  const start = el('button.btn.sm', { type: 'button' }, T('guide.try'));
  msg.append(start);
  start.addEventListener('click', (e) => { e.stopPropagation(); round(); });
  const quote = (id: string, key: string): HTMLElement => el('div.quote', null, enemy(id, 3), el('div.bubble', null, G(key)));
  sec('kings', 'g.kings.h', T('g.kings.p', { p: pct(C.kings.phaseAt) }, 'p'),
    el('div.grid.g2.demo', { style: 'align-items:start' },
      el('div', null, el('p', null, tryTag(), T('g.kings.warn')), field),
      el('div', null, T('g.kings.say', undefined, 'h3'), el('div.quotes', null, quote('boss', 'king.boss.arrive'), quote('bossE', 'king.bossE.arrive'), quote('bossG', 'king.bossG.half'), quote('bossL', 'king.bossL.arrive')))));
}

// ── 11. special events ─────────────────────────────────
{
  const card = (pic: HTMLElement, h: TextKey, p: TextKey, args?: Record<string, string | number>): HTMLElement => el('div.panel.ev', null, pic, el('div', null, T(h, undefined, 'h3'), T(p, args, 'p')));
  const E = C.events;
  sec('events', 'g.events.h', T('g.events.p', { a: E.bloodMoonFrom, b: Math.min(E.lastChapter, C.stage.chapters - 1) }, 'p'),
    el('div.grid.g2.demo', null,
      card(groundBg(el('div.pic.moon', null, el('div', { style: 'display:flex;gap:2px' }, enemy('slime', 2), enemy('bat', 2), enemy('slime', 2))), 0, 6, 6, 8), 'g.ev.moon.h', 'g.ev.moon.p', { s: E.bloodMoonSpawn, c: E.bloodMoonCoin }),
      card(groundBg(el('div.pic', null, enemy('dragon', 1)), 5, 6, 6, 1), 'g.ev.dragon.h', 'g.ev.dragon.p', { ch: Math.max(E.dragonFrom, E.bloodMoonFrom), k: 1 + C.companion.stored }),
      card(groundBg(el('div.pic', null, el('div', { style: 'display:flex;gap:6px' }, hero('mage', 3), enemy('rival', 3))), 2, 6, 6, 2), 'g.ev.rival.h', 'g.ev.rival.p', { s: C.rival.life, n: C.rival.shards }),
      card(groundBg(el('div.pic', null, el('div', { style: 'display:flex;gap:4px' }, enemy('bossE', 2), enemy('bossS', 2))), 3, 6, 6, 5), 'g.ev.double.h', 'g.ev.double.p', { ch: E.doubleKingFrom, hp: pct(E.doubleKingHp) })));
}

// ── 12. Skill Points ───────────────────────────────────
{
  const EC = C.economy;
  sec('skill-points', 'g.sp.h', T(EC.spShop ? 'g.sp.p2' : 'g.sp.p', undefined, 'p'),
    el('div.panel.demo', null, el('ul', { style: 'margin:0;padding-left:20px;display:grid;gap:8px' },
      T('g.sp.reroll', { n: EC.reroll }, 'li'), T('g.sp.banish', { n: EC.banish }, 'li'), T('g.sp.up', { n: EC.upgrade }, 'li'))));
}

// ── 13. Awakening ──────────────────────────────────────
{
  const lines = el('div.grid.g2.demo', null, ...HERO_IDS.map((h: HeroId) => {
    const A = AWAKENING[h], sig = signatureOf(h);
    return el('div.panel', { style: 'display:flex;gap:14px;align-items:center' }, hero(h, 4),
      el('div', null, G(`hero.${h}.name`, undefined, 'b'), el('div', { style: 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px' },
        skillIcon(sig, 'sm'), el('span', null, '+'), ...SKILL_LINES[h].map((id) => skillIcon(id, 'sm')), el('span', null, '→'),
        G(`form.${A.form}`, undefined, 'b', 'chip line'))));
  }));
  // The rule follows the Balance Config: awaken.keep (Links stay or are used up), awaken.slots, awaken.grant/grantLv.
  const A = C.awaken, nLine = AWAKENING.mage.line.length;
  const rule = parts('div', 'note',
    ['g.awaken.need', { n: A.links, of: SKILL_LINES.mage.length, st: A.stages, ss: pl(A.stages) }],
    ['g.awaken.accept', { d: A.sigDmg }],
    A.keep ? ['g.awaken.keep1'] : ['g.awaken.keep0', { n: A.links }],
    A.slots > 0 && ['g.awaken.slots', { n: A.slots, ss: pl(A.slots) }],
    A.grant > 0 ? ['g.awaken.grant', { g: Math.min(A.grant, nLine), lv: A.grantLv }] : ['g.awaken.nogrant', { k: nLine }],
    ['g.awaken.decline']);
  sec('awakening', 'g.awaken.h', T('g.awaken.p', undefined, 'p'), lines, rule, el('p', null, el('a', { href: './skills.html#lines' }, T('g.awaken.more'))));
}

// ── 14. Gold & shop ────────────────────────────────────
{
  const shop = el('div.grid.g3', null, ...SHOP_IDS.map((id) => el('div.panel', { style: 'display:flex;gap:10px;align-items:center;padding:12px' }, shopIcon(id),
    el('div', null, G(`shop.${id}.name`, undefined, 'b'), el('br'), G(`shop.${id}.desc`, undefined, 'span', 'muted'), el('div', { style: 'margin-top:4px' }, el('span.chip.gold', null, `${C.shop[id].base}G+`), ' ', el('span.chip', null, `MAX ${C.shop[id].max}`))))));
  const heroes = el('div.grid.g4', null, ...HERO_IDS.map((h) => el('div.panel', { style: 'display:flex;gap:10px;align-items:center;padding:12px' }, hero(h, 3), el('div', null, G(`hero.${h}.name`, undefined, 'b'), el('br'), el('span.chip.gold', null, C.heroes[h].cost ? `${C.heroes[h].cost}G` : s('home.free'))))));
  sec('gold', 'g.gold.h', T('g.gold.p', undefined, 'p'),
    el('h3.subh', null, T('g.gold.shop')), shop, el('h3.subh', null, T('g.gold.heroes')), heroes, note('g.gold.run', '', { p: pct(C.score.revivePenalty) }));
}

// ── 15. co-op ──────────────────────────────────────────
{
  const code = el('div.roomcode', null, ...'KQ7X'.split('').map((c) => el('span', null, c)));
  sec('coop', 'g.coop.h', T('g.coop.p', undefined, 'p'),
    el('div.grid.g2.demo', { style: 'align-items:start' },
      el('div.panel', null, el('ol.coop-steps', { style: 'padding:0;margin:0' }, T('g.coop.1', undefined, 'li'), T('g.coop.2', undefined, 'li'), T('g.coop.3', undefined, 'li')), el('div', { style: 'margin-top:14px' }, code)),
      el('div', null, T('g.coop.rules', undefined, 'h3'), el('ul', { style: 'display:grid;gap:8px;padding-left:20px' }, T('g.coop.r1', undefined, 'li'), T('g.coop.r2', { s: C.coop.pickTime }, 'li'), T('g.coop.r3', { s: C.coop.reviveTime }, 'li'), T('g.coop.r4', undefined, 'li')),
        el('div', { style: 'display:flex;gap:6px;align-items:end;margin-top:10px' }, ...HERO_IDS.map((h) => hero(h, 3)), pickup('heart', 3)))));
}

// ── 16. screen, settings & difficulty ──────────────────
{
  // Difficulty presets offered right now (an admin can hide some); ★ = the ranked one.
  const presets = el('div.grid.g3', { style: 'gap:10px' }, ...offeredPresets(C).map((id) => el('div.panel', { style: 'padding:10px 12px' },
    G(`preset.${id}`, undefined, 'b'), isRanked(id) ? el('b', { style: 'color:var(--gold)' }, ' ★') : null, el('br'), G(`preset.${id}.tag`, undefined, 'span', 'muted'))));
  sec('settings', 'g.set.h',
    T('g.set.hud', undefined, 'p'),
    T('g.set.streak', { s: C.streak.window, n: C.streak.popupEvery }, 'p'),
    T('g.set.diff', undefined, 'p'), presets,
    T('g.set.view', { z: VIEWS.map((v) => `×${viewZoom(v)}`).join(' / ') }, 'p'),
    T('g.set.fb', undefined, 'p'),
    T('g.set.news', undefined, 'p'));
}

// ── 17. tips ───────────────────────────────────────────
{
  const tips: [TextKey, () => Node][] = [
    ['g.tip.1', () => hero('ranger', 2, 'r')], ['g.tip.2', () => pickup('gem', 3)], ['g.tip.3', () => skillIcon('frost', 'sm')],
    ['g.tip.4', () => el('span.key', null, 'SPC')], ['g.tip.5', () => enemy('scorp', 2)], ['g.tip.6', () => hero('knight', 2)],
  ];
  sec('tips', 'g.tips.h', el('div.grid.g2', null, ...tips.map(([k, art]) => el('div.panel', { style: 'display:flex;gap:12px;align-items:center;padding:12px' }, art(), T(k)))),
    el('p', { style: 'margin-top:28px' }, el('a.btn', { 'data-play': '', href: './play/' }, T('home.cta'))));
  document.querySelectorAll<HTMLAnchorElement>('a[data-play]').forEach((a) => { a.href = document.querySelector<HTMLAnchorElement>('.btn-play')!.href; });
}

// Table of contents: highlight the section on screen.
{
  const links = new Map([...toc.querySelectorAll('a')].map((a) => [a.getAttribute('href')!.slice(1), a]));
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { links.forEach((a) => a.classList.remove('on')); links.get(en.target.id)?.classList.add('on'); }
  }, { rootMargin: '-30% 0px -60% 0px' });
  article.querySelectorAll('section').forEach((x) => io.observe(x));
}
reveals();
toHash();
