// Suspend / resume (ticket 31): the checkpoint of the current Stage start is kept locally
// (`pixelhorde-save`) and on the server (single use there). One save slot per account.
import { parseBalanceConfig, resolveConfig, type ResolvedConfig } from '@pixel-horde/config';
import { DEFAULT_RESOLVED, isHero, isWeapon, type HeroId, type WeaponId } from '@pixel-horde/sim';
import { active } from './config';
import { backend } from './net';
import { browserStore } from './net/offline';

export interface LocalSave {
  runId?: string; token?: string;
  seed: number; hero: HeroId; weapon: WeaponId; crack: number;
  chapter: number; configVersion: number; hash: string; data: string;
  savedAt: number; clientRunId: string;
}

const K = 'pixelhorde-save';

export function readSave(): LocalSave | null {
  try {
    const v = JSON.parse(browserStore.get(K) || 'null') as LocalSave | null;
    if (!v || typeof v.data !== 'string' || !isHero(v.hero)) return null;
    if (Date.now() - v.savedAt > 30 * 24 * 3600 * 1000) { clearSave(); return null; } // saves live 30 days
    return { ...v, weapon: isWeapon(v.weapon) ? v.weapon : 'judgement' };
  } catch { return null; }
}
export function writeSave(s: LocalSave): void { try { browserStore.set(K, JSON.stringify(s)); } catch { /* storage full: server copy only */ } }
export function clearSave(): void { try { browserStore.set(K, ''); } catch { /* ignore */ } }

/** The Balance Config a checkpoint was locked to (the resumed Stage replays under it). */
export async function configFor(version: number): Promise<ResolvedConfig | null> {
  if (version === active.cfg.version) return active.cfg;
  if (version === 0) return DEFAULT_RESOLVED;
  try {
    const c = await backend.getConfig(version);
    return c ? resolveConfig({ ...parseBalanceConfig(c.data), version: c.version }) : null;
  } catch { return null; }
}
