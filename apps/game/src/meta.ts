// Meta progression. The server owns Gold/Shop/unlocks (ticket 09); this module keeps a local cache
// (`pixelhorde-meta`, also the offline save) plus a queue of offline actions, and lets the server
// win whenever it is reachable. The old artifact save is uploaded once.
import { HERO_IDS, isHero, SHOP_IDS, shopCost, type HeroId, type Meta, type ShopId } from '@pixel-horde/sim';
import { active } from './config';
import { BackendError, type Backend, type RunResult, type RunTicket, type ServerMeta } from './net/backend';
import { browserStore, type KeyValue } from './net/offline';
import { backend } from './net';

export interface MetaSave {
  gold: number;
  up: Partial<Record<ShopId, number>>;
  owned: HeroId[];
  ch: HeroId;
}

export type QueueOp =
  | { kind: 'run'; result: RunResult; ticket?: RunTicket; live?: boolean }
  | { kind: 'buy'; item: ShopId }
  | { kind: 'hero'; hero: HeroId };

const K_META = 'pixelhorde-meta', K_VER = 'pixelhorde-meta-v', K_QUEUE = 'pixelhorde-queue', K_LEGACY = 'pixelhorde-legacy', K_LEGACY_DONE = 'pixelhorde-legacy-done';

export function parseMeta(raw: unknown): MetaSave {
  const m = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const upIn = (m.up && typeof m.up === 'object' ? m.up : {}) as Record<string, unknown>;
  const up: Partial<Record<ShopId, number>> = {};
  for (const id of SHOP_IDS) { const v = Number(upIn[id]); if (v > 0) up[id] = Math.floor(v); }
  return {
    gold: Math.max(0, Number(m.gold) || 0),
    up,
    owned: Array.isArray(m.owned) ? m.owned.filter(isHero) : [],
    ch: isHero(m.ch) ? m.ch : 'mage',
  };
}

export function createMetaSync(backend: Backend, store: KeyValue) {
  const json = <T>(k: string, def: T): T => { try { const v = store.get(k); return v ? (JSON.parse(v) as T) : def; } catch { return def; } };
  // An old artifact save (no version marker) is kept aside once for the legacy upload.
  if (store.get(K_META) && !store.get(K_VER) && !store.get(K_LEGACY) && !store.get(K_LEGACY_DONE)) store.set(K_LEGACY, store.get(K_META)!);
  const meta: MetaSave = parseMeta(json(K_META, null));
  let queue: QueueOp[] = json<QueueOp[]>(K_QUEUE, []).map((o) => (o.kind === 'run' ? { ...o, live: false } : o));
  const listeners = new Set<() => void>();

  const save = (): void => {
    store.set(K_META, JSON.stringify(meta));
    store.set(K_VER, '2');
    store.set(K_QUEUE, JSON.stringify(queue));
    for (const f of listeners) f();
  };
  const U = (id: ShopId): number => meta.up[id] || 0;
  const online = (): boolean => backend.status() === 'online';

  function applyServer(s: ServerMeta): void {
    meta.gold = Math.max(0, Number(s.gold) || 0);
    const up: Partial<Record<ShopId, number>> = {};
    for (const id of SHOP_IDS) { const v = Number(s.shop?.[id]); if (v > 0) up[id] = v; }
    meta.up = up;
    meta.owned = (s.heroes || []).filter(isHero);
    if (!ownsHero(meta.ch)) meta.ch = 'mage';
    save();
  }

  function ownsHero(k: HeroId): boolean { return active.cfg.heroes[k].cost === 0 || meta.owned.includes(k); }

  /** Push queued offline work, then take the server's numbers. Safe to call often. */
  async function sync(): Promise<boolean> {
    if (!online()) return false;
    try {
      const legacy = store.get(K_LEGACY);
      if (legacy) {
        applyServer(await backend.importLegacy(JSON.parse(legacy)));
        store.set(K_LEGACY_DONE, '1');
        store.set(K_LEGACY, '');
      }
      for (const op of [...queue]) {
        if (op.kind === 'run' && op.live) continue;
        try {
          if (op.kind === 'run') {
            if (op.ticket) {
              try { await backend.submitRun(op.ticket, op.result); }
              catch (e) { if (e instanceof BackendError && e.code === 'RUN_NOT_FOUND') await backend.submitOfflineRun(op.result); else throw e; }
            } else await backend.submitOfflineRun(op.result);
          } else if (op.kind === 'buy') await backend.buyUpgrade(op.item);
          else await backend.unlockHero(op.hero);
        } catch (e) {
          const code = e instanceof BackendError ? e.code : 'UNKNOWN';
          // Refused by the rules (not enough Gold, duplicate…): drop it. Network/session problems: stop and retry later.
          if (code === 'OFFLINE' || code === 'SESSION_REPLACED' || code === 'UNKNOWN' || code === 'RATE_LIMITED') return false;
        }
        queue = queue.filter((q) => q !== op);
        save();
      }
      applyServer(await backend.getMeta());
      if (!store.get(K_LEGACY_DONE)) store.set(K_LEGACY_DONE, '1');
      return true;
    } catch {
      return false;
    }
  }

  async function buy(id: ShopId): Promise<BackendError | null> {
    const lv = U(id), cost = shopCost(active.cfg, id, lv);
    if (lv >= active.cfg.shop[id].max) return new BackendError('MAXED');
    if (meta.gold < cost) return new BackendError('NOT_ENOUGH_GOLD');
    if (online()) {
      try { applyServer(await backend.buyUpgrade(id)); return null; } catch (e) { if (!(e instanceof BackendError) || e.code !== 'OFFLINE') return e instanceof BackendError ? e : new BackendError('UNKNOWN'); }
    }
    meta.gold -= cost;
    meta.up[id] = lv + 1;
    queue.push({ kind: 'buy', item: id });
    save();
    return null;
  }

  async function unlockHero(k: HeroId): Promise<BackendError | null> {
    if (ownsHero(k)) return null;
    const cost = active.cfg.heroes[k].cost;
    if (meta.gold < cost) return new BackendError('NOT_ENOUGH_GOLD');
    if (online()) {
      try { applyServer(await backend.unlockHero(k)); return null; } catch (e) { if (!(e instanceof BackendError) || e.code !== 'OFFLINE') return e instanceof BackendError ? e : new BackendError('UNKNOWN'); }
    }
    meta.gold -= cost;
    meta.owned.push(k);
    queue.push({ kind: 'hero', hero: k });
    save();
    return null;
  }

  /** Record a Run's progress (every Stage clear and at the end) so a crash still pays out later. */
  function recordRun(result: RunResult, ticket: RunTicket | null, live: boolean): void {
    queue = queue.filter((q) => !(q.kind === 'run' && q.result.clientRunId === result.clientRunId));
    queue.push({ kind: 'run', result, ticket: ticket ?? undefined, live });
    save();
  }

  /** Local wallet display during a Run (the server credits Gold on submit). */
  function bankLocal(amount: number): void { if (amount > 0) { meta.gold += amount; save(); } }
  /** Local wallet display when the Run spends wallet Gold (the server charges it on submit). */
  function spendLocal(amount: number): void { if (amount > 0) { meta.gold = Math.max(0, meta.gold - amount); save(); } }

  return {
    meta,
    U,
    ownsHero,
    selectHero(k: HeroId): void { if (ownsHero(k)) { meta.ch = k; save(); } },
    sync,
    buy,
    unlockHero,
    recordRun,
    bankLocal,
    spendLocal,
    pending: (): readonly QueueOp[] => queue,
    onChange(fn: () => void): () => void { listeners.add(fn); return () => listeners.delete(fn); },
    save,
  };
}

export type MetaSync = ReturnType<typeof createMetaSync>;

/* ---------- the game's instance ---------- */
export const metaSync: MetaSync = createMetaSync(backend, browserStore);
export const META = metaSync.meta;
export const U = metaSync.U;
export const ownsHero = metaSync.ownsHero;
export const saveMeta = metaSync.save;
export const simMeta = (): Meta => ({ up: { ...META.up }, wallet: META.gold });
export const HEROES_ALL = HERO_IDS;

export interface Best { stage: number; kills: number }
export function getBest(): Best | null {
  try { return JSON.parse(localStorage.getItem('pixelhorde-best') || 'null'); } catch { return null; }
}
export function setBest(o: Best): void {
  try { localStorage.setItem('pixelhorde-best', JSON.stringify(o)); } catch { /* ignore */ }
}
