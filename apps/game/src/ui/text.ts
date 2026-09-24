// Player-facing text comes from packages/i18n (t). This file maps game ids to keys
// and keeps the non-text visuals (icon colour and glyph) next to them.
import { t } from '@pixel-horde/i18n';
import type { BannerKey, Element, HeroId, PassiveId, RealmId, ShopId, SkillId, SkillStats, Trait } from '@pixel-horde/sim';

export interface Icon { col: string; g: string }

export const SKILL_ICON: Record<SkillId, Icon> = {
  bolt: { col: '#ff5cf4', g: 'B' }, orbit: { col: '#7df9ff', g: 'O' }, chain: { col: '#fff35c', g: 'L' }, nova: { col: '#ff8a3d', g: 'N' },
  meteor: { col: '#ff4b3a', g: 'M' }, frost: { col: '#9fd8ff', g: 'F' }, lance: { col: '#ffe9a8', g: 'I' }, boomer: { col: '#7dffb0', g: 'R' },
  cyclone: { col: '#d8f3e0', g: 'T' }, toxic: { col: '#b6f24a', g: 'X' }, laser: { col: '#5cf4ff', g: 'Z' }, hole: { col: '#b07cff', g: 'Q' },
  sigil: { col: '#e08cff', g: '*' }, shield: { col: '#fff8c0', g: '=' }, hawk: { col: '#c48a55', g: '^' }, flask: { col: '#ff9f5c', g: '%' },
};
export const PASSIVE_ICON: Record<PassiveId, Icon> = {
  might: { col: '#ff7a7a', g: '+' }, haste: { col: '#c9a8ff', g: 'H' }, swift: { col: '#a9e38a', g: 'S' },
  vital: { col: '#ffa6c2', g: 'V' }, magnet: { col: '#8fdcff', g: 'G' }, crit: { col: '#ffe27a', g: 'C' },
};
export const SHOP_ICON: Record<ShopId, Icon> = {
  power: { col: '#ff7a7a', g: 'P' }, vigor: { col: '#ffa6c2', g: 'V' }, speed: { col: '#a9e38a', g: 'A' },
  greed: { col: '#ffd23f', g: '$' }, wisdom: { col: '#8fdcff', g: 'W' }, revive: { col: '#fff35c', g: '!' },
};

export const skillName = (id: SkillId): string => t(`skill.${id}.name`);
export const skillDesc = (id: SkillId): string => t(`skill.${id}.desc`);
export const passiveName = (id: PassiveId): string => t(`passive.${id}.name`);
export const passiveDesc = (id: PassiveId): string => t(`passive.${id}.desc`);
export const evoName = (id: SkillId): string => t(`evo.${id}.name`);
export const evoDesc = (id: SkillId): string => t(`evo.${id}.desc`);
export const heroName = (id: HeroId): string => t(`hero.${id}.name`);
export const heroDesc = (id: HeroId): string => t(`hero.${id}.desc`);
export const heroRole = (id: HeroId): string => t(`hero.${id}.role`);
export const shopName = (id: ShopId): string => t(`shop.${id}.name`);
export const shopDesc = (id: ShopId): string => t(`shop.${id}.desc`);
export const realmName = (r: RealmId): string => t(`realm.${r}.name`);
export const realmShort = (r: RealmId): string => t(`realm.${r}.short`);
export const kingName = (r: RealmId): string => t(`realm.${r}.king`);
export const traitName = (x: Trait): string => t(`trait.${x}`);
export const elementName = (x: Element): string => t(`element.${x}`);

/** Banner title + subtitle for a sim banner event. */
export function bannerText(key: BannerKey, a: Record<string, string | number>, realm: RealmId): { txt: string; sub: string } {
  const args: Record<string, string | number> = { ...a, theme: realmShort(realm), boss: kingName(realm) };
  if (key === 'evolved') args.evo = evoName(a.id as SkillId);
  if (key === 'bossIncoming') args.dir = a.dir ? t(`dir.${a.dir}`) : '';
  return { txt: t(`banner.${key}.txt`, args), sub: t(`banner.${key}.sub`, args) };
}

export function skillDetail(id: SkillId, s: SkillStats): string {
  const args = { dmg: s.dmg, n: s.n, jumps: s.jumps, r: s.r, len: s.len, boom: s.boom };
  let out = t(`skill.${id}.detail`, args);
  if (id === 'bolt' && s.pierce) out += t('skill.bolt.pierce', { n: s.pierce });
  return out;
}
