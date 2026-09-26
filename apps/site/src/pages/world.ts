import {
  AWAKENING, ENEMY_IDS, ET, HERO_IDS, KING_KITS, REALMS, REALM_IDS, SKILL_LINES, WEAPONS,
  adviceFor, signatureOf, type EnemyId, type HeroId, type RealmId, type SkillId,
} from '@pixel-horde/sim';
import { el, enemy, hero, heroWithWeapon, passiveIcon, pet, skillIcon, weaponIcon } from '../art';
import { siteConfig } from '../backend';
import { evoPassive, heroBonus } from '../data';
import { g, onLang } from '../lang';
import { reveals, shell, toHash } from '../shell';
import type { TextKey } from '../text';
import { G, T, groundBg, pageHead } from '../ui';

shell('world');
// Numbers follow the Balance Config the game uses right now (built-in defaults when offline).
const C = await siteConfig();
const main = document.getElementById('main')!;
const jump = el('div.jump', null, ...([['story', 'w.story.h'], ['heroes', 'w.heroes'], ['realms', 'w.realms'], ['guardians', 'w.guardians'], ['bestiary', 'w.bestiary']] as [string, TextKey][]).map(([id, k]) => el('a', { href: '#' + id }, T(k))));
main.append(pageHead('w.h', 'w.p', 4, [enemy('umbra', 3), enemy('boss', 3), enemy('bossS', 3), enemy('bossG', 3)], jump));

const section = (id: string, title: TextKey, ...kids: Node[]): HTMLElement => el('section', { id, style: 'scroll-margin-top:70px' }, el('div.wrap', null, el('h2', null, T(title)), ...kids));
const ultChip = (id: keyof typeof WEAPONS): HTMLElement => { const c = G(`weapon.${id}.ult`, undefined, 'span', 'chip'); c.style.cssText = `background:${WEAPONS[id].col};color:var(--ink)`; return c; };
const skn = (id: SkillId, evo = false): HTMLElement => el('span.skname', null, skillIcon(id, 'sm'), G(`${evo ? 'evo' : 'skill'}.${id}.name`));

// ── story ──
main.append(section('story', 'w.story.h', el('div.story', null, T('w.story.p', undefined, 'p', 'lead'), el('img', { src: './img/keyart.jpg', alt: '', loading: 'lazy' }))));

// ── heroes ──
const HERO_GROUND: Record<HeroId, number> = { mage: 2, knight: 0, ranger: 7, alchemist: 6 };
const HERO_WEAPON: Record<HeroId, string> = { mage: 'judgement', knight: 'sunblade', ranger: 'stormBow', alchemist: 'plagueCenser' };
const heroSec = section('heroes', 'w.heroes', el('div.grid', null, ...HERO_IDS.map((h) => {
  const sig = signatureOf(h), A = AWAKENING[h], cost = C.heroes[h].cost;
  const stage = groundBg(el('div.stage', null, heroWithWeapon(h, HERO_WEAPON[h], 6), el('div.dirs', null, hero(h, 3, 'down'), hero(h, 3, 'up'), hero(h, 3, 'l'))), HERO_GROUND[h], 8, 8, 3);
  return el('article.panel.herox', null, stage, el('div', null,
    el('h3', null, G(`hero.${h}.name`)), G(`hero.${h}.role`, undefined, 'p', 'muted'),
    el('dl.kv', null,
      el('dt', null, T('w.bonus')), el('dd', null, ...heroBonus(h, C).flatMap(([k, a], i) => [i ? ' · ' : '', T(k, a)])),
      el('dt', null, T('home.sig')), el('dd', null, skn(sig), '→', el('span.skname', null, passiveIcon(evoPassive(sig)!, 'sm'), G(`evo.${sig}.name`))),
      el('dt', null, T('w.line')), el('dd', null, ...SKILL_LINES[h].map((id) => skn(id))),
      el('dt', null, T('w.form')), el('dd', null, G(`form.${A.form}`, undefined, 'span', 'chip line'), ...A.line.map((id) => skn(id))),
      el('dt', null, T('w.unlock')), el('dd', null, cost ? el('span.chip.gold', null, `${cost}G`) : T('home.free', undefined, 'span', 'chip gold')))));
})));
main.append(heroSec);

// ── realms ──
function chapterTag(r: RealmId): TextKey { return r === 'greenvale' ? 'w.chapter1' : r === 'crater' ? 'w.chapter8' : 'w.chapterMid'; }
const realmSec = section('realms', 'w.realms', el('div.grid', null, ...REALM_IDS.map((r, i) => {
  const R = REALMS[r], w = Object.values(WEAPONS).find((x) => x.realm === r), kit = KING_KITS[R.king];
  const scene = groundBg(el('div.scene', null, T(chapterTag(r), { n: C.stage.chapters, m: C.stage.chapters - 1 }, 'span', 'chtag'), ...R.pool.map((m) => el('div.mob', null, enemy(m, 3))), el('div.mob', null, enemy(R.king, 4))), R.theme, 10, 8, i);
  const adv = adviceFor(R);
  return el('article.panel.realm-card.reveal', { id: `realm-${r}`, style: 'scroll-margin-top:80px' }, scene, el('div.body', null,
    el('h3', null, G(`realm.${r}.name`)),
    el('p.kingline', null, '👑 ', G(`realm.${r}.king`)),
    G(`lore.${R.king}`, undefined, 'p', 'lore'),
    el('dl.kv', null,
      el('dt', null, T('w.traits')), el('dd', null, ...(R.traits.length ? R.traits.map((t) => G(`trait.${t}`, undefined, 'span', 'chip st')) : [T('w.noTraits', undefined, 'span', 'chip st')])),
      el('dt', null, T('w.resist', { p: Math.round((1 - C.realms.resist) * 100) })), el('dd', null, R.element ? G(`element.${R.element}`, undefined, 'span', `chip el-${R.element}`) : T('w.noResist', undefined, 'span', 'chip st')),
      adv.length ? el('dt', null, T('w.advice')) : null, adv.length ? el('dd', null, ...adv.map((id) => skn(id as SkillId))) : null,
      kit ? el('dt', null, T('w.moves')) : null,
      kit ? el('dd', null, ...kit.moves.map((m) => G(`kingMove.${m}`, undefined, 'span', 'chip st')), el('span.chip', { style: 'background:#8a2030' }, G(`kingMove.${kit.ult}`), ' · ', T('w.ult'))) : null,
      w ? el('dt', null, T('w.weapon')) : null, w ? el('dd', null, weaponIcon(w.id, 3), G(`weapon.${w.id}.name`, undefined, 'b'), ultChip(w.id), G(`weapon.${w.id}.desc`, undefined, 'span', 'muted')) : null)));
})));
main.append(realmSec);

// ── guardians ──
const DRAG: ['inferno' | 'frost' | 'storm', EnemyId, number, TextKey][] = [['inferno', 'dragon', 5, 'w.drag.inferno'], ['frost', 'frostDragon', 3, 'w.drag.frost'], ['storm', 'stormDragon', 7, 'w.drag.storm']];
main.append(section('guardians', 'w.guardians', T('w.drag.p', { n: C.companion.maxLv }, 'p', 'lead'), el('div.grid.g3', null, ...DRAG.map(([k, id, th, d]) => el('article.panel.drag-card', null,
  groundBg(el('div.pic', null, enemy(id, 2)), th, 10, 8, 2), el('h3', null, G(`guardian.${k}`)), T(d, undefined, 'p'),
  el('div', { style: 'display:flex;gap:8px;justify-content:center;align-items:center' }, el('span.muted', null, '→'), pet(k, 4), T('g.ev.dragon.h', undefined, 'span', 'muted'))))),
  el('div.panel', { style: 'margin-top:20px;display:flex;gap:16px;align-items:center;flex-wrap:wrap' }, pet('inferno', 4), pet('frost', 4), pet('storm', 4), el('span', { style: 'font:400 18px var(--pix)' }, '='), G('guardian.tri', undefined, 'b', 'pixh'))));

// ── bestiary ──
const GROUPS: [string, EnemyId[]][] = [
  ...REALM_IDS.map((r): [string, EnemyId[]] => [r, [...REALMS[r].pool, REALMS[r].king]]),
  // Counter monsters: the Split Slime always; Wild Boar / Eye Caster only while switched on in the Balance Config.
  ['counter', ['splitter', ...(C.charger.on ? ['charger' as const] : []), ...(C.caster.on ? ['caster' as const] : [])]],
  ['event', ['dragon', 'frostDragon', 'stormDragon', 'whelp', 'rival', 'umbra']],
];
const tip = el('div.beast-tip', { hidden: '' });
document.body.append(tip);
const best = el('div');
let group = 'all';
const filter = el('div.filters');
function drawBest(): void {
  const seen = new Set<string>();
  const list = (group === 'all' ? GROUPS : GROUPS.filter(([k]) => k === group)).flatMap(([, ids]) => ids).filter((id) => ENEMY_IDS.includes(id) && !seen.has(id) && seen.add(id));
  best.replaceChildren(el('div.bestiary', null, ...list.map((id) => {
    const b = el('button.beast', { type: 'button' }, enemy(id, ET[id].boss ? (ET[id].sc === 2 ? 1 : 2) : 3), ET[id].boss ? el('span.chip.gold', null, 'BOSS') : ET[id].trait ? G(`trait.${ET[id].trait}`, undefined, 'span', 'chip st tr') : null);
    const show = (x: number, y: number): void => { tip.textContent = g(`lore.${id}`); tip.hidden = false; tip.style.left = Math.min(x + 12, innerWidth - 300) + 'px'; tip.style.top = y + 14 + 'px'; };
    b.addEventListener('mousemove', (e) => show(e.clientX, e.clientY));
    b.addEventListener('mouseleave', () => { tip.hidden = true; });
    b.addEventListener('focus', () => { const r = b.getBoundingClientRect(); show(r.left, r.bottom); });
    b.addEventListener('blur', () => { tip.hidden = true; });
    b.addEventListener('click', () => { const r = b.getBoundingClientRect(); show(r.left, r.bottom); });
    b.setAttribute('aria-label', g(`lore.${id}`));
    return b;
  })));
}
const opts: [string, () => HTMLElement][] = [['all', () => T('sk.f.all')], ...REALM_IDS.map((r): [string, () => HTMLElement] => [r, () => G(`realm.${r}.short`)]), ['counter', () => T('w.best.counter')], ['event', () => T('w.best.event')]];
const seg = el('div.seg', null, ...opts.map(([k, label]) => {
  const b = el('button', { type: 'button', 'aria-pressed': String(k === group) }, label());
  b.addEventListener('click', () => { group = k; seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); drawBest(); });
  return b;
}));
filter.append(seg);
drawBest();
onLang(drawBest);
addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });
main.append(section('bestiary', 'w.bestiary', T('w.best.p', undefined, 'p', 'lead'), filter, best));

reveals();
toHash();
