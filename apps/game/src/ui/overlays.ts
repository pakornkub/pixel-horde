// DOM overlays: title, hero select, shop, level-up, chest wheel, stage clear, game over, pause.
import { AWAKENING, EVO_PASSIVE, HERO_IDS, WEAPON_IDS, type WeaponId, qualifiedLinks, HEROES, REALMS, SHOP_IDS, SKILL_LINES, WHEEL, adviceFor, benchSize, combosBetween, endlessBreakdown, scoreBreakdown, signatureOf, swapCost, shopCost, shopMax, skillStats, type LevelOption, type RealmId, type SimState, type SkillId } from '@pixel-horde/sim';
import { sfx } from '../audio/sfx';
import { META, U, getBest, metaSync, ownsHero } from '../meta';
import { active } from '../config';
import { HERO_SPR } from '../render/sprites';
import { fmtT } from '../render/draw';
import { t } from '@pixel-horde/i18n';
import { PASSIVE_ICON, SHOP_ICON, SKILL_ICON, elementName, kingName, realmName, traitName, evoDesc, evoName, heroDesc, heroName, heroRole, passiveDesc, passiveName, shopDesc, shopName, skillDesc, skillDetail, skillName } from './text';

export const $ = (id: string): HTMLElement => document.getElementById(id)!;
export const show = (id: string): void => { $(id).classList.add('on'); };
export const hide = (id: string): void => { $(id).classList.remove('on'); };
const focusSoon = (id: string): void => { setTimeout(() => $(id).focus({ preventScroll: true }), 30); };

export function bestLine(): string {
  const bb = getBest();
  return t('title.best', { gold: META.gold }) + (bb ? t('title.bestRecord', { stage: bb.stage, kills: bb.kills }) : '');
}

export function statRows(rows: [string, string | number][]): string {
  return rows.map(([a, c]) => `<span>${a}</span><span>${c}</span>`).join('');
}

/* ---------- hero select ---------- */
const CHIMG: Record<string, string> = {};
export function charImg(k: string): string {
  if (CHIMG[k]) return CHIMG[k];
  const c = document.createElement('canvas');
  c.width = 48; c.height = 48;
  const x = c.getContext('2d')!;
  x.imageSmoothingEnabled = false;
  x.drawImage(HERO_SPR[k].r[0], 0, 0, 48, 48);
  let u = '';
  try { u = c.toDataURL(); } catch { /* ignore */ }
  return (CHIMG[k] = u);
}

export function renderChars(): void {
  const box = $('chars');
  box.innerHTML = '';
  for (const k of HERO_IDS) {
    const c = active.cfg.heroes[k], name = heroName(k), owned = ownsHero(k);
    const bt = document.createElement('button');
    bt.className = 'ch' + (META.ch === k ? ' sel' : '') + (owned ? '' : ' locked');
    const im = document.createElement('img'); im.alt = ''; im.src = charImg(k);
    const cn = document.createElement('span'); cn.className = 'cn'; cn.textContent = name;
    const cc = document.createElement('span'); cc.className = 'cc'; cc.textContent = owned ? (META.ch === k ? t('hero.picked') : t('hero.pick')) : t('hero.unlock', { cost: c.cost });
    bt.append(im, cn, cc);
    bt.addEventListener('click', () => {
      void (async () => {
        if (!owned) {
          if (META.gold < c.cost) { $('chDesc').textContent = t('hero.needGold', { name, cost: c.cost, gold: META.gold }); return; }
          const err = await metaSync.unlockHero(k);
          if (err) { $('chDesc').textContent = t('hero.needGold', { name, cost: c.cost, gold: META.gold }); return; }
          sfx('lv');
        }
        metaSync.selectHero(k);
        renderChars();
        $('bestTxt').textContent = bestLine();
      })();
    });
    box.appendChild(bt);
  }
  renderWeapons();
  renderCracks();
  const sel = HEROES[META.ch];
  $('chDesc').textContent = t('hero.desc', { name: heroName(META.ch), role: heroRole(META.ch), skill: skillName(sel.start), bonus: heroDesc(META.ch) });
}

/* ---------- weapon pick (title) ---------- */
function renderWeapons(): void {
  const row = $('weaponRow');
  row.innerHTML = `<span class="lbl">${t('weapon.pick')}</span>`;
  for (const w of WEAPON_IDS) {
    if (!metaSync.ownsWeapon(w)) continue;
    const bt = document.createElement('button');
    bt.className = META.weapon === w ? 'sel' : '';
    bt.textContent = t(`weapon.${w}.name`);
    bt.title = t(`weapon.${w}.desc`);
    bt.addEventListener('click', () => { metaSync.selectWeapon(w); renderWeapons(); });
    row.appendChild(bt);
  }
  const d = document.createElement('span'); d.textContent = t(`weapon.${META.weapon}.desc`); d.style.flexBasis = '100%';
  row.appendChild(d);
}

/* ---------- Heart Crack pick (title) ---------- */
function renderCracks(): void {
  const row = $('crackRow');
  row.hidden = META.crackMax < 1;
  if (row.hidden) return;
  row.innerHTML = `<span class="lbl">${t('crack.pick')}</span>`;
  for (let n = 0; n <= META.crackMax; n++) {
    const bt = document.createElement('button');
    bt.className = META.crack === n ? 'sel' : '';
    bt.textContent = n ? t('crack.n', { n }) : t('crack.0');
    bt.addEventListener('click', () => { metaSync.selectCrack(n); renderCracks(); });
    row.appendChild(bt);
  }
}

/* ---------- shop ---------- */
let shopFrom = 'ovTitle';
function renderShop(): void {
  $('shopGold').textContent = 'GOLD ' + META.gold;
  const list = $('shopList');
  list.innerHTML = '';
  for (const id of SHOP_IDS) {
    const m = SHOP_ICON[id], lv = U(id), max = shopMax(active.cfg, id), maxed = lv >= max, c = shopCost(active.cfg, id, lv);
    const row = document.createElement('div');
    row.className = 'srow';
    row.innerHTML = `<span class="ico" style="background:${m.col}">${m.g}</span><span><span class="nm">${shopName(id)} ${lv}/${max}</span><span class="ds">${shopDesc(id)}</span></span>`;
    const bt = document.createElement('button');
    bt.className = 'buy';
    bt.textContent = maxed ? t('shop.maxed') : t('shop.buy', { cost: c });
    bt.disabled = maxed || META.gold < c;
    bt.addEventListener('click', async () => {
      bt.disabled = true;
      const err = await metaSync.buy(id);
      if (!err) sfx('lv');
      renderShop();
    });
    row.appendChild(bt);
    list.appendChild(row);
  }
}
export function openShop(from: string): void {
  shopFrom = from;
  hide(from);
  renderShop();
  show('ovShop');
  focusSoon('shopBack');
}
export function closeShop(): void {
  hide('ovShop');
  renderChars();
  $('bestTxt').textContent = bestLine();
  $('bestOver').textContent = bestLine();
  show(shopFrom);
}

/* ---------- level up ---------- */
export interface LevelTools { reroll: () => void; banish: (i: number) => void }
/** Level-up notes, one colored row per kind (Signature, Link, Skill Line, Combo, final level). */
type NoteKind = 'sig' | 'link' | 'line' | 'combo' | 'final';
const NOTE_ICON: Record<NoteKind, string> = { sig: '★', link: '⛓', line: '◆', combo: '⚡', final: '▲' };
function noteRows(notes: [NoteKind, string][]): string {
  if (!notes.length) return '';
  const clean = (s: string): string => s.replace(/^\s*[·,]\s*/, '').trim();
  return `<span class="nrows">${notes.map(([k, s]) => `<span class="nrow n-${k}"><b>${NOTE_ICON[k]}</b><span>${clean(s)}</span></span>`).join('')}</span>`;
}

export function renderLevelUp(v: Readonly<SimState>, onPick: (i: number) => void, tools?: LevelTools): void {
  const lu = v.levelUp!, P = v.P;
  const box = $('opts');
  box.innerHTML = '';
  $('lvSlots').textContent = t('level.slots', { n: Object.keys(P.skills).length, max: v.cfg.maxAttackSlots, b: P.bench.length, bmax: benchSize(v as SimState) });
  $('lvTitle').textContent = lu.chest ? t('level.chestTitle') : t('level.title', { lv: lu.lv });
  lu.options.forEach((o: LevelOption, idx) => {
    const bt = document.createElement('button');
    bt.className = 'opt';
    let meta: { col: string; g: string }, name: string, desc: string, tag = '', stats = '';
    const notes: [NoteKind, string][] = [];
    if (o.kind === 'evo') {
      meta = { col: '#ffd23f', g: SKILL_ICON[o.id].g };
      name = evoName(o.id); tag = `<b class="tag evo">${t('level.evolve')}</b>`;
      desc = evoDesc(o.id);
      stats = `${skillName(o.id)} + ${passiveName(EVO_PASSIVE[o.id]!)}`;
      bt.classList.add('evo');
    } else if (o.kind === 'skill') {
      meta = SKILL_ICON[o.id];
      const lv = P.skills[o.id] || 0;
      name = skillName(o.id);
      tag = lv ? `<b class="tag up">LV ${lv} → ${lv + 1}</b>` : `<b class="tag new">${t(o.toBench ? 'level.bench' : 'level.new')}</b>`;
      desc = lv ? '' : skillDesc(o.id);
      stats = skillDetail(o.id, skillStats(v.cfg, o.id, lv + 1, false));
      if (o.id === signatureOf(P.ch)) notes.push(['sig', t('level.signature')]);
      else if (SKILL_LINES[P.ch].includes(o.id)) notes.push(['link', t('level.link')]);
      else if (AWAKENING[P.ch].line.includes(o.id as never)) notes.push(['line', t('level.line')]);
      const partners = (Object.keys(P.skills) as SkillId[]).filter((k) => k !== o.id && combosBetween(o.id, k).length);
      for (const k of partners.slice(0, 2)) notes.push(['combo', t('level.combos', { list: `${skillName(k)} → ${combosBetween(o.id, k).map((c) => t('combo.' + c).replace('!', '')).join(' / ')}` })]);
      const evoPas = EVO_PASSIVE[o.id];
      if (evoPas && lv + 1 === v.cfg.skills[o.id].max) notes.push(['final', t('level.final', { passive: passiveName(evoPas) })]);
    } else if (o.kind === 'pas') {
      meta = PASSIVE_ICON[o.id];
      const lv = P.pas[o.id] || 0;
      name = passiveName(o.id);
      tag = lv ? `<b class="tag up">LV ${lv} → ${lv + 1}</b>` : `<b class="tag new">${t('level.new')}</b>`;
      desc = passiveDesc(o.id);
    } else if (o.kind === 'comp') {
      meta = { col: '#ffd23f', g: 'D' };
      name = t('level.comp');
      desc = t('level.compDesc', { dragon: t(`guardian.${P.pet!.kind}`), lv: P.pet!.lv, next: P.pet!.lv + 1 });
    } else {
      meta = { col: '#ffa6c2', g: '♥' };
      name = t('level.recover');
      desc = t('level.recoverDesc');
    }
    bt.innerHTML = `<span class="key">${idx + 1}</span><span class="ico" style="background:${meta.col}">${meta.g}</span><span class="body"><span class="nm">${name} ${tag}</span>`
      + (desc ? `<span class="ds">${desc}</span>` : '') + (stats ? `<span class="st">${stats}</span>` : '') + noteRows(notes) + '</span>';
    bt.addEventListener('click', () => onPick(idx));
    bt.dataset.k = String(idx + 1);
    const E = v.cfg.economy;
    const ownedAlready = (o.kind === 'skill' && P.skills[o.id]) || (o.kind === 'pas' && P.pas[o.id]);
    if (tools && (o.kind === 'skill' || o.kind === 'pas') && !ownedAlready && v.sp >= E.banish) {
      const x = document.createElement('span'); x.className = 'ban'; x.textContent = '✕'; x.title = t('sp.banish', { n: E.banish });
      x.addEventListener('click', (ev) => { ev.stopPropagation(); tools.banish(idx); });
      bt.appendChild(x);
    }
    box.appendChild(bt);
  });
  const tb = $('lvTools');
  tb.innerHTML = '';
  if (tools && v.sp > 0) {
    tb.innerHTML = `<span class="lbl">${t('sp.count', { n: v.sp })}</span>`;
    const rr = document.createElement('button'); rr.textContent = t('sp.reroll', { n: v.cfg.economy.reroll });
    rr.disabled = v.sp < v.cfg.economy.reroll;
    rr.addEventListener('click', () => tools.reroll());
    tb.appendChild(rr);
  }
  show('ovLevel');
  setTimeout(() => { const f = box.querySelector<HTMLElement>('.opt'); if (f) f.focus({ preventScroll: true }); }, 30);
}

/* ---------- chest wheel (animation only; the sim already chose the result) ---------- */
interface Spin { idx: number; left: number; iv: number; acc: number; res: number; hold: number; done: boolean }
let spin: Spin | null = null;

export function openChest(res: number, target: number, start: number): void {
  spin = { idx: start, left: 24 + ((target - start + 8) % 8), iv: 0.035, acc: 0, res, hold: 0, done: false };
  const w = $('wheel');
  w.innerHTML = '';
  WHEEL.forEach((val) => { const c = document.createElement('div'); c.className = 'cell'; c.textContent = 'x' + val; w.appendChild(c); });
  $('chestTxt').textContent = t('chest.spinning');
  hlWheel();
  show('ovChest');
}
function hlWheel(): void {
  const cs = $('wheel').children;
  for (let i = 0; i < cs.length; i++) cs[i].classList.toggle('on', i === spin!.idx);
}
/** Returns true once the spin + hold has finished (then the caller sends chestStop). */
export function chestTick(rdt: number): boolean {
  if (!spin) return false;
  if (spin.left > 0) {
    spin.acc += rdt;
    while (spin.left > 0 && spin.acc >= spin.iv) { spin.acc -= spin.iv; spin.idx = (spin.idx + 1) % 8; spin.left--; spin.iv *= 1.06; sfx('tick'); }
    hlWheel();
    if (spin.left === 0) {
      spin.done = true;
      $('chestTxt').textContent = t('chest.won', { n: spin.res });
      sfx('clear');
      const c = $('wheel').children[spin.idx];
      if (c) c.classList.add('win');
    }
    return false;
  }
  spin.hold += rdt;
  if (spin.hold > 1.1) { spin = null; hide('ovChest'); return true; }
  return false;
}
export function cancelChest(): void { spin = null; hide('ovChest'); }

/* ---------- route choice ---------- */
const REALM_ICON: Record<RealmId, string> = {
  greenvale: '#6fb553', sunscar: '#dcb86e', deepdark: '#3d3853', frostpeak: '#a9c6e0', emberforge: '#d8342c', mirefen: '#6b8a3a',
  skyreach: '#8fdcff', tidehollow: '#3f7fbf', gearspire: '#8a94a8', duskhold: '#5a3f8a', crater: '#1a1030',
};
export function renderRoute(v: Readonly<SimState>, onPick: (i: number) => void): void {
  const r = v.route!;
  $('routeTitle').textContent = t('route.title', { n: r.chapter });
  $('routeNote').textContent = v.lastEnd === 'escape' && r.chapter === v.stage ? t('route.repick') : t('route.pick');
  const box = $('routeOpts');
  box.innerHTML = '';
  r.choices.forEach((id, idx) => {
    const realm = REALMS[id];
    const traits = realm.traits.length ? t('route.traits', { list: realm.traits.map(traitName).join(', ') }) : t('route.noTraits');
    const resist = realm.element ? t('route.resists', { el: elementName(realm.element) }) : t('route.noResist');
    const advice = adviceFor(realm);
    const lines = [t('route.king', { king: kingName(id) }), traits, resist];
    if (advice.length) lines.push(t('route.advice', { list: advice.map((k) => skillName(k as SkillId)).join(', ') }));
    const bt = document.createElement('button');
    bt.className = 'opt';
    bt.innerHTML = `<span class="key">${idx + 1}</span><span class="ico" style="background:${REALM_ICON[id]}">${realmName(id)[0]}</span><span class="body"><span class="nm">${realmName(id)}</span>${lines.map((l) => `<span class="route-meta">${l}</span>`).join('')}</span>`;
    bt.addEventListener('click', () => onPick(idx));
    bt.dataset.k = String(idx + 1);
    box.appendChild(bt);
  });
  show('ovRoute');
  setTimeout(() => { const f = box.querySelector<HTMLElement>('.opt'); if (f) f.focus({ preventScroll: true }); }, 30);
}

/* ---------- stage clear / game over ---------- */
export function showClear(v: Readonly<SimState>, runGold: number): void {
  const escaped = v.lastEnd === 'escape';
  $('clearTitle').textContent = escaped ? t('clear.escapedTitle') : t('clear.title', { n: v.stage });
  $('clearNote').textContent = escaped ? (v.repicks < v.cfg.stage.escapeRepicks && v.realm !== 'crater' ? t('clear.escapedNote') : t('clear.escapedNoRepick')) : t('clear.note');
  $('clearStats').innerHTML = statRows([[t('stat.stageKills'), v.stageKills], [t('stat.runGold'), runGold + 'G'], [t('stat.kills'), v.kills], [t('stat.streak'), v.maxStreak], [t('stat.level'), v.P.lv]]);
  show('ovClear');
  focusSoon('nextBtn');
}

/* ---------- Weapons found this Run (clear screen) ---------- */
export function renderWeaponSwitch(v: Readonly<SimState>, onUse: (id: WeaponId) => void): void {
  const box = $('weaponBox'), found = v.foundWeapons.filter((w) => w !== v.weapon);
  box.hidden = !found.length;
  if (!found.length) return;
  box.innerHTML = `<span class="lbl">${t('weapon.using', { weapon: t(`weapon.${v.weapon}.name`) })}</span>`;
  for (const w of found) {
    const bt = document.createElement('button');
    bt.textContent = t('weapon.use', { weapon: t(`weapon.${w}.name`) });
    bt.title = t(`weapon.${w}.desc`);
    bt.addEventListener('click', () => onUse(w));
    box.appendChild(bt);
  }
}

/* ---------- Skill Points (clear screen) ---------- */
export function renderSp(v: Readonly<SimState>, onBuy: () => void, onUp: (id: SkillId) => void): void {
  const box = $('spBox'), E = v.cfg.economy, P = v.P;
  box.hidden = false;
  box.innerHTML = `<span class="lbl">${t('sp.count', { n: v.sp })}</span>`;
  const buy = document.createElement('button'); buy.className = 'buysp'; buy.textContent = t('sp.buy', { cost: Math.round(E.spCost * v.stage) });
  buy.addEventListener('click', onBuy);
  box.appendChild(buy);
  for (const id of Object.keys(P.skills) as SkillId[]) {
    const lv = P.skills[id]!;
    if (lv >= v.cfg.skills[id].max) continue;
    const bt = document.createElement('button');
    bt.className = 'uprow';
    bt.innerHTML = `<span class="ico" style="background:${SKILL_ICON[id].col}">${SKILL_ICON[id].g}</span><span class="nm">${skillName(id)}</span><b class="tag up">LV ${lv} → ${lv + 1}</b><span class="cost">${t('sp.upgrade', { n: E.upgrade })}</span>`;
    bt.disabled = v.sp < E.upgrade;
    bt.addEventListener('click', () => onUp(id));
    box.appendChild(bt);
  }
}

export function showRevive(v: Readonly<SimState>, cost: number): void {
  const wallet = Math.max(0, (v.meta.wallet || 0) - v.walletSpent), run = Math.min(v.runGold, cost);
  $('reviveTxt').textContent = t('revive.text', { cost, run, wallet: Math.min(wallet, cost - run) });
  show('ovRevive');
  focusSoon('reviveBtn');
}

/* ---------- Companions and fusion (clear screen) ---------- */
export function renderCompanions(v: Readonly<SimState>, onSwap: (i: number) => void, onFuse: (ok: boolean) => void, onLevel: () => void): void {
  const box = $('compBox'), P = v.P, C = v.cfg.companion;
  box.hidden = !P.pet && !P.petStore.length;
  if (box.hidden) return;
  box.innerHTML = `<span class="lbl">${t('comp.title')}</span>`;
  if (P.pet) {
    const a = document.createElement('button'); a.className = 'sel'; a.disabled = true;
    a.textContent = `${t('comp.active')}: ${t(`guardian.${P.pet.kind}`)} LV ${P.pet.lv}`;
    box.appendChild(a);
  }
  P.petStore.forEach((p, i) => {
    const b = document.createElement('button');
    b.textContent = `${t(`guardian.${p.kind}`)} LV ${p.lv}`;
    b.addEventListener('click', () => onSwap(i));
    box.appendChild(b);
  });
  if (P.pet && P.pet.lv < C.maxLv) {
    const up = document.createElement('button'); up.textContent = t('sp.comp', { n: C.spCost }); up.disabled = v.sp < C.spCost;
    up.addEventListener('click', onLevel);
    box.appendChild(up);
  }
  if (v.fuseOffer) {
    const all = [P.pet, ...P.petStore].filter((p) => p && p.kind !== 'tri') as { lv: number }[];
    const lv = Math.max(3, Math.ceil(all.reduce((a, p) => a + p.lv, 0) / Math.max(1, all.length)));
    const f = document.createElement('div'); f.className = 'awaken'; f.style.flexBasis = '100%';
    f.innerHTML = `<h3>${t('fuse.title')}</h3><p>${t('fuse.text', { lv })}</p>`;
    const yes = document.createElement('button'); yes.className = 'btn'; yes.textContent = t('fuse.accept'); yes.addEventListener('click', () => onFuse(true));
    const no = document.createElement('button'); no.className = 'btn ghost'; no.textContent = t('fuse.decline'); no.addEventListener('click', () => onFuse(false));
    f.append(yes, no);
    box.appendChild(f);
  }
}

/* ---------- Awakening prompt (clear screen) ---------- */
export function renderAwaken(v: Readonly<SimState>, onAnswer: (accept: boolean) => void): void {
  const box = $('awakenBox');
  box.hidden = !v.awakenOffer;
  if (!v.awakenOffer) return;
  const P = v.P, links = qualifiedLinks(v as SimState).slice(0, v.cfg.awaken.links);
  box.innerHTML = `<h3>${t('awaken.title')}</h3><p>${t('awaken.text', { name: heroName(P.ch), form: t('form.' + AWAKENING[P.ch].form), links: links.map(skillName).join(' + ') })}</p>`;
  const yes = document.createElement('button'); yes.className = 'btn'; yes.textContent = t('awaken.accept');
  const no = document.createElement('button'); no.className = 'btn ghost'; no.textContent = t('awaken.decline');
  let armed = false;
  yes.addEventListener('click', () => { box.hidden = true; onAnswer(true); });
  no.addEventListener('click', () => {
    if (!armed) { armed = true; no.textContent = t('awaken.confirm'); return; } // decline needs a second click
    box.hidden = true; onAnswer(false);
  });
  box.append(yes, no);
}

/* ---------- Bench ↔ attack slots (clear screen) ---------- */
let benchSel = -1;
export function renderBench(v: Readonly<SimState>, onSwap: (bench: number, slot: SkillId | null) => void, denied = false): void {
  const P = v.P, box = $('benchBox');
  box.hidden = !P.bench.length;
  if (!P.bench.length) return;
  if (benchSel >= P.bench.length) benchSel = -1;
  const sig = signatureOf(P.ch), cost = swapCost(v as SimState), wallet = Math.max(0, (v.meta.wallet || 0) - v.walletSpent);
  const fromRun = Math.min(v.runGold, cost), afford = v.runGold + wallet >= cost;
  const chip = (id: SkillId, lv: number, evo: boolean): string =>
    `<span class="ico" style="background:${SKILL_ICON[id].col}${evo ? ';box-shadow:0 0 0 2px #ffd23f' : ''}">${SKILL_ICON[id].g}</span><span class="nm">${skillName(id)}</span><b class="lv">LV ${lv}</b>`;
  box.innerHTML = `<div class="lbl">${t('bench.title')}</div><div class="step">${benchSel >= 0 ? t('bench.step2', { name: skillName(P.bench[benchSel].id) }) : t('bench.step1')}</div>`;
  box.classList.toggle('picking', benchSel >= 0);
  const attack = document.createElement('div'); attack.className = 'row';
  attack.innerHTML = `<span class="lbl">${t('bench.attack')}</span>`;
  const ids = Object.keys(P.skills) as SkillId[];
  for (const id of ids) {
    const bt = document.createElement('button'); bt.className = 'sk';
    bt.innerHTML = chip(id, P.skills[id]!, !!P.evo[id]);
    if (id === sig) { bt.disabled = true; bt.title = t('bench.locked'); }
    else bt.addEventListener('click', () => { if (benchSel >= 0 && afford) { onSwap(benchSel, id); benchSel = -1; } });
    attack.appendChild(bt);
  }
  for (let i = ids.length; i < v.cfg.maxAttackSlots; i++) {
    const bt = document.createElement('button'); bt.className = 'sk empty'; bt.textContent = t('bench.empty');
    bt.addEventListener('click', () => { if (benchSel >= 0 && afford) { onSwap(benchSel, null); benchSel = -1; } });
    attack.appendChild(bt);
  }
  const bench = document.createElement('div'); bench.className = 'row';
  bench.innerHTML = `<span class="lbl">${t('bench.bench')}</span>`;
  P.bench.forEach((b, i) => {
    const bt = document.createElement('button'); bt.className = 'sk' + (i === benchSel ? ' sel' : '');
    bt.innerHTML = chip(b.id, b.lv, b.evo);
    bt.addEventListener('click', () => { benchSel = benchSel === i ? -1 : i; renderBench(v, onSwap); });
    bench.appendChild(bt);
  });
  const c = document.createElement('div'); c.className = 'cost' + (afford ? '' : ' warn');
  c.textContent = denied || !afford ? t('bench.short') + ' — ' + t('bench.cost', { cost, run: fromRun, wallet: cost - fromRun }) : t('bench.cost', { cost, run: fromRun, wallet: cost - fromRun });
  box.append(attack, bench, c);
}

/** Itemised Score that counts up line by line (decision #15). */
const countUps: (() => void)[] = [];
function showScore(v: Readonly<SimState>): void {
  countUpBox($('scoreBox'), scoreBreakdown(v));
  const eb = $('endlessBox');
  eb.hidden = !v.endless;
  if (v.endless) { countUpBox(eb, endlessBreakdown(v)); eb.insertAdjacentHTML('afterbegin', `<span class="tot">${t('score.endlessTitle')}</span><span></span>`); }
}
function countUpBox(box: HTMLElement, b: { lines: { key: string; count: number; points: number }[]; total: number }): void {
  const { lines, total } = b;
  const rows = lines.filter((l) => l.points !== 0 || l.key === 'kills');
  box.innerHTML = '';
  const cells = rows.map((l) => {
    const a = document.createElement('span'); a.textContent = t(`score.${l.key}`, { n: l.count });
    const b = document.createElement('span'); b.textContent = '0';
    box.append(a, b);
    return { b, to: l.points };
  });
  const ta = document.createElement('span'); ta.textContent = t('score.total');
  const tb = document.createElement('span'); tb.className = 'tot'; tb.textContent = '0';
  box.append(ta, tb);
  const fmt = (n: number): string => (n < 0 ? '−' : '') + Math.abs(n).toLocaleString('en-US');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const per = reduce ? 0 : 450, start = performance.now();
  let raf = 0;
  const tick = (now: number): void => {
    const el = now - start;
    cells.forEach((c, i) => { const f = per ? Math.min(1, Math.max(0, (el - i * per) / per)) : 1; c.b.textContent = fmt(Math.round(c.to * f)); });
    const done = !per || el >= cells.length * per;
    tb.textContent = fmt(done ? total : Math.round(total * Math.min(1, el / (cells.length * per))));
    if (!done) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  countUps.push(() => cancelAnimationFrame(raf));
}

export function showOver(v: Readonly<SimState>, runGold: number, newAch: string[] = []): void {
  $('retryBtn').hidden = false;
  $('overTitle').textContent = v.endless ? t('over.endlessEnd') : v.victory ? t('over.victory') : t('over.title');
  countUps.splice(0).forEach((f) => f());
  showScore(v);
  $('overStats').innerHTML = statRows([[t('stat.hero'), heroName(v.hero)], [t('stat.runGoldOver'), runGold + 'G'], [t('stat.wallet'), META.gold + 'G'], [t('stat.chapter'), v.stage], [t('stat.time'), fmtT(v.totalTime)], [t('stat.kills'), v.kills], [t('stat.streak'), v.maxStreak], [t('stat.level'), v.P.lv]]);
  $('bestOver').textContent = bestLine();
  const na = $('newAch');
  na.hidden = !newAch.length;
  na.textContent = newAch.length ? t('over.newAch', { list: newAch.map((a) => t(`ach.${a}.name`)).join(', ') }) : '';
  show('ovOver');
  focusSoon('retryBtn');
}

export function showPause(): void {
  $('leaveBtn').textContent = t('pause.leave');
  $('pauseTxt').textContent = t('pause.text');
  show('ovPause');
  focusSoon('resumeBtn');
}

export function setPlayUI(on: boolean): void {
  $('ultBtn').style.display = on ? 'block' : 'none';
  $('pauseBtn').style.display = on ? 'block' : 'none';
}

/** Fill every [data-i18n], [data-i18n-html] and [data-i18n-aria] element. */
export function applyStaticText(): void {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n!); });
  document.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml!); });
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria!)); });
  document.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder!); });
}
