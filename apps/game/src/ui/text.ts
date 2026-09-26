// Player-facing text comes from packages/i18n (t). This file maps game ids to keys
// and keeps the non-text visuals (icon colour and glyph) next to them.
import { t } from '@pixel-horde/i18n';
import { isLine, isSignature, type BannerKey, type Element, type HeroId, type PassiveId, type RealmId, type ResolvedConfig, type ShopId, type SkillId, type SkillStats, type Trait } from '@pixel-horde/sim';

export interface Icon { col: string; g: string }

export const SKILL_ICON: Record<SkillId, Icon> = {
  bolt: { col: '#ff5cf4', g: 'B' }, orbit: { col: '#7df9ff', g: 'O' }, chain: { col: '#fff35c', g: 'L' }, nova: { col: '#ff8a3d', g: 'N' },
  meteor: { col: '#ff4b3a', g: 'M' }, frost: { col: '#9fd8ff', g: 'F' }, lance: { col: '#ffe9a8', g: 'I' }, boomer: { col: '#7dffb0', g: 'R' },
  cyclone: { col: '#d8f3e0', g: 'T' }, toxic: { col: '#b6f24a', g: 'X' }, laser: { col: '#5cf4ff', g: 'Z' }, hole: { col: '#b07cff', g: 'Q' },
  sigil: { col: '#e08cff', g: '*' }, shield: { col: '#fff8c0', g: '=' }, hawk: { col: '#c48a55', g: '^' }, flask: { col: '#ff9f5c', g: '%' },
  manaNova: { col: '#c9a8ff', g: 'M' }, timeWarp: { col: '#8fdcff', g: 'W' }, starfall: { col: '#fff35c', g: '+' },
  sacredBlades: { col: '#fff8c0', g: '/' }, judgePillar: { col: '#ffd23f', g: '|' }, aegisDome: { col: '#ffe9a8', g: 'D' },
  arrowRain: { col: '#c48a55', g: 'A' }, galeStep: { col: '#d8f3e0', g: '~' }, thunderHawk: { col: '#fff35c', g: 'V' },
  cauldron: { col: '#ff9f5c', g: 'U' }, transmute: { col: '#ff5cf4', g: '$' }, elixirRain: { col: '#6fe36a', g: '!' },
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
/** The Awakened Signature's new form (`awaken.form`), with its numbers from the live config. */
export function formDesc(cfg: ResolvedConfig, sig: SkillId): string {
  const K = cfg.skills, n = sig === 'shield' ? K.shield.awk.n : sig === 'hawk' ? K.hawk.awk.n : sig === 'flask' ? K.flask.awk.shards : 0;
  return t(`awk.${sig}.desc`, { n, cd: K.shield.awk.cd });
}
/** A Skill's description under the live rules: Lance aim, Shield Bash, awakened forms and their Skill Line combos. */
export function skillDescIn(cfg: ResolvedConfig, id: SkillId, awakened: boolean): string {
  if (cfg.awaken.form && isLine(id)) return t(`awk.${id}.desc`);
  if (cfg.awaken.form && awakened && isSignature(id)) return formDesc(cfg, id);
  if (id === 'lance' && cfg.skills.lance.aim > 0) return t('skill.lance.descAim');
  if (id === 'shield' && cfg.skills.shield.bashCd > 0) return t('skill.shield.descBash');
  return skillDesc(id);
}
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
  if (a.kind) args.dragon = t(`guardian.${a.kind}`);
  if (key === 'weaponFound') args.weapon = t(`weapon.${a.id}.name`);
  if (key === 'judgement') args.ult = t(`weapon.${a.weapon || 'judgement'}.ult`);
  if (key === 'bossIncoming') args.dir = a.dir ? t(`dir.${a.dir}`) : '';
  return { txt: t(`banner.${key}.txt`, args), sub: t(`banner.${key}.sub`, args) };
}

export function skillDetail(id: SkillId, s: SkillStats): string {
  const args = { dmg: Math.round(s.dmg), n: s.n, jumps: s.jumps, r: Math.round(s.r), len: s.len, boom: s.boom, cd: Math.round(s.cd * 10) / 10 };
  let out = t(`skill.${id}.detail`, args);
  if (id === 'bolt' && s.pierce) out += t('skill.bolt.pierce', { n: s.pierce });
  return out;
}
