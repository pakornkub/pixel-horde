// Weapons (ticket 27): one per Realm plus the default Judgement. A Weapon changes only the
// Ultimate's form (and the Status it leaves) — never the player's stats.
import type { RealmId } from '../content/lumora/realms';

export const WEAPON_IDS = ['judgement', 'thornwhip', 'sunblade', 'boneScythe', 'glacierLance', 'magmaMaul', 'plagueCenser', 'stormBow', 'coralTrident', 'gearCannon', 'lichTome'] as const;
export type WeaponId = (typeof WEAPON_IDS)[number];

export interface Weapon {
  id: WeaponId;
  /** Realm whose King drops it (null: the default). */
  realm: RealmId | null;
  /** Ultimate form. */
  form: 'judgement' | 'root' | 'burn' | 'reap' | 'freeze' | 'crash' | 'plague' | 'shock' | 'push' | 'turret' | 'harvest';
  col: string;
  /** Playable now (its Realm's content exists). */
  available: boolean;
}

export const WEAPONS: Record<WeaponId, Weapon> = {
  judgement: { id: 'judgement', realm: null, form: 'judgement', col: '#fff35c', available: true },
  thornwhip: { id: 'thornwhip', realm: 'greenvale', form: 'root', col: '#6fb553', available: true },
  sunblade: { id: 'sunblade', realm: 'sunscar', form: 'burn', col: '#ff8a3d', available: true },
  boneScythe: { id: 'boneScythe', realm: 'deepdark', form: 'reap', col: '#d8d0ff', available: true },
  glacierLance: { id: 'glacierLance', realm: 'frostpeak', form: 'freeze', col: '#9fd8ff', available: true },
  magmaMaul: { id: 'magmaMaul', realm: 'emberforge', form: 'crash', col: '#d8342c', available: true },
  plagueCenser: { id: 'plagueCenser', realm: 'mirefen', form: 'plague', col: '#b6f24a', available: true },
  stormBow: { id: 'stormBow', realm: 'skyreach', form: 'shock', col: '#5cc8ff', available: true },
  coralTrident: { id: 'coralTrident', realm: 'tidehollow', form: 'push', col: '#3fbfbf', available: true },
  gearCannon: { id: 'gearCannon', realm: 'gearspire', form: 'turret', col: '#c7ced9', available: true },
  lichTome: { id: 'lichTome', realm: 'duskhold', form: 'harvest', col: '#b07cff', available: true },
};

export const isWeapon = (k: unknown): k is WeaponId => typeof k === 'string' && (WEAPON_IDS as readonly string[]).includes(k);
/** Stored in meta_progress.weapons as "<world>:<id>" so each World keeps its own collection. */
export const weaponKey = (id: WeaponId, world = 'lumora'): string => `${world}:${id}`;
export const weaponOfRealm = (r: RealmId): Weapon | null => Object.values(WEAPONS).find((w) => w.realm === r && w.available) ?? null;
