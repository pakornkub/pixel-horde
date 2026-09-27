import { describe, expect, it, vi } from 'vitest';
import { BackendError, StatusBox, type Backend, type BackendStatus, type RunResult, type ServerMeta } from './net/backend';
import type { KeyValue } from './net/offline';

vi.mock('./net', () => ({ backend: { status: () => 'offline' } }));
const { createMetaSync } = await import('./meta');

const memStore = (init: Record<string, string> = {}): KeyValue & { m: Map<string, string> } => {
  const m = new Map(Object.entries(init));
  return { m, get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v) };
};

/** In-memory server with the same rules as the SQL (enough for game-side flows). */
function fakeBackend(start: BackendStatus = 'offline') {
  const status = new StatusBox();
  status.set(start);
  const server: ServerMeta = { gold: 0, shop: {}, heroes: ['mage', 'knight'], weapons: [], legacyImported: false };
  const calls: string[] = [];
  const guard = (): void => { if (status.get() !== 'online') throw new BackendError('OFFLINE'); };
  const clone = (): ServerMeta => JSON.parse(JSON.stringify(server));
  const b: Backend = {
    kind: 'supabase', status: () => status.get(), onStatus: (f) => status.on(f),
    start: async () => ({ id: 'u', nickname: 'x', anonymous: true, role: 'player' }), account: () => null,
    setNickname: async () => ({ id: 'u', nickname: 'x', anonymous: true, role: 'player' }), checkSession: async () => true, reclaim: async () => undefined,
    getMeta: async () => { guard(); calls.push('getMeta'); return clone(); },
    startRun: async () => null,
    submitRun: async () => { throw new BackendError('RUN_NOT_FOUND'); },
    submitOfflineRun: async (r: RunResult) => { guard(); calls.push('run:' + r.clientRunId); server.gold += r.gold; return { status: 'offline', meta: clone() }; },
    buyUpgrade: async (item) => {
      guard(); calls.push('buy:' + item);
      const lv = server.shop[item] || 0, cost = Math.round(30 * 1.6 ** lv);
      if (server.gold < cost) throw new BackendError('NOT_ENOUGH_GOLD');
      server.gold -= cost; server.shop[item] = lv + 1; return clone();
    },
    forgeWeapon: async (w) => {
      guard(); calls.push('forge:' + w);
      if (!((server.stats?.heartCrack ?? 0) >= 1)) throw new BackendError('SHOP_LOCKED');
      const k = 'forge:lumora:' + w, lv = server.shop[k] || 0, cost = Math.round(400 * 1.6 ** lv);
      if (server.gold < cost) throw new BackendError('NOT_ENOUGH_GOLD');
      server.gold -= cost; server.shop[k] = lv + 1; return clone();
    },
    buyOutfit: async (set, slot) => {
      guard(); calls.push(`outfit:${set}:${slot}`);
      if (!((server.stats?.heartCrack ?? 0) >= 1)) throw new BackendError('SHOP_LOCKED');
      const k = `outfit:${set}:${slot}`, lv = server.shop[k] || 0, cost = Math.round(500 * 1.6 ** lv);
      if (server.gold < cost) throw new BackendError('NOT_ENOUGH_GOLD');
      server.gold -= cost; server.shop[k] = lv + 1; return clone();
    },
    unlockHero: async (h) => { guard(); calls.push('hero:' + h); server.heroes.push(h); return clone(); },
    importLegacy: async (s) => {
      guard(); calls.push('legacy');
      if (!server.legacyImported) { server.gold += Math.min(Number((s as { gold: number }).gold) || 0, 50000); server.legacyImported = true; }
      return clone();
    },
    getLeaderboard: async () => { throw new BackendError('OFFLINE'); },
    getLive: async () => { throw new BackendError('OFFLINE'); },
    getConfig: async () => null,
    latestUpdate: async () => null,
    report: async () => false,
    linkGoogle: async () => undefined,
    linkResult: () => null,
    saveCheckpoint: async () => false,
    getCheckpoint: async () => null,
    resumeRun: async () => ({ ok: false, seasonChanged: false }),
    getCollection: async () => null,
    setTitle: async () => undefined,
    setTips: async (x: string[]) => x,
    sendFeedback: async () => undefined,
  };
  return { b, status, server, calls };
}

const run = (id: string, gold: number): RunResult => ({ clientRunId: id, hero: 'mage', mode: 'solo', result: 'dead', chapter: 2, kills: 100, level: 5, gold, score: 2000100, playMs: 90000, pausedMs: 1000, configVersion: 0 });

describe('meta sync (offline queue, server wins)', () => {
  it('plays fully offline: local Gold, local purchases, queued work', async () => {
    const { b } = fakeBackend('offline');
    const store = memStore();
    const ms = createMetaSync(b, store);
    ms.bankLocal(200);
    ms.recordRun(run('r1', 200), null, false);
    expect(await ms.buy('power')).toBeNull();
    expect(ms.meta.gold).toBe(170);
    expect(ms.meta.up.power).toBe(1);
    expect(ms.pending().map((o) => o.kind)).toEqual(['run', 'buy']);
    expect(await ms.sync()).toBe(false);
    expect(JSON.parse(store.m.get('pixelhorde-meta')!).gold).toBe(170);
  });

  it('when back online the queue is replayed in order and the server numbers win', async () => {
    const f = fakeBackend('offline');
    const ms = createMetaSync(f.b, memStore());
    ms.bankLocal(200);
    ms.recordRun(run('r1', 200), null, false);
    await ms.buy('power');
    f.status.set('online');
    expect(await ms.sync()).toBe(true);
    expect(f.calls).toEqual(['run:r1', 'buy:power', 'getMeta']);
    expect(ms.meta.gold).toBe(170);
    expect(ms.pending()).toEqual([]);
  });

  it('reports the server verdict on each submitted Run (rejected Runs pay nothing)', async () => {
    const f = fakeBackend('online');
    f.b.submitOfflineRun = async (r) => ({ status: r.gold > 1000 ? 'rejected' : 'offline', reason: r.gold > 1000 ? 'GOLD_CEILING' : null, meta: JSON.parse(JSON.stringify(f.server)) });
    const ms = createMetaSync(f.b, memStore());
    const seen: string[] = [];
    ms.onRunChecked((id, out) => seen.push(`${id}:${out.status}:${out.reason ?? ''}`));
    ms.bankLocal(5000);
    ms.recordRun(run('big', 5000), null, false);
    ms.recordRun(run('ok', 10), null, false);
    await ms.sync();
    expect(seen).toEqual(['big:rejected:GOLD_CEILING', 'ok:offline:']);
    expect(ms.meta.gold).toBe(0); // the shown Gold goes back to the server's
  });

  it('a Run still in progress is not submitted early', async () => {
    const f = fakeBackend('online');
    const ms = createMetaSync(f.b, memStore());
    ms.recordRun(run('live', 50), null, true);
    await ms.sync();
    expect(f.calls).not.toContain('run:live');
    ms.recordRun(run('live', 80), null, false);
    await ms.sync();
    expect(f.calls.filter((c) => c === 'run:live')).toHaveLength(1);
    expect(ms.meta.gold).toBe(80);
  });

  it('actions the server refuses are dropped; network failures keep the queue', async () => {
    const f = fakeBackend('offline');
    const ms = createMetaSync(f.b, memStore());
    ms.bankLocal(100);
    await ms.buy('power'); // allowed locally (100 ≥ 30) but the server has 0 Gold
    f.status.set('online');
    await ms.sync();
    expect(ms.pending()).toEqual([]);
    expect(ms.meta.gold).toBe(0);
    expect(ms.meta.up.power).toBeUndefined();
  });

  it('a Run finished during maintenance waits in the queue and uploads once maintenance ends', async () => {
    const f = fakeBackend('online');
    const upload = f.b.submitOfflineRun;
    let maintenance = true;
    f.b.submitOfflineRun = async (r) => { if (maintenance) throw new BackendError('MAINTENANCE'); return upload(r); };
    const ms = createMetaSync(f.b, memStore());
    ms.recordRun(run('m1', 40), null, false);
    expect(await ms.sync()).toBe(false);
    expect(ms.pending().map((o) => o.kind)).toEqual(['run']);
    maintenance = false;
    expect(await ms.sync()).toBe(true);
    expect(f.calls).toContain('run:m1');
    expect(ms.pending()).toEqual([]);
  });

  it('maintenance (server online but refusing gameplay RPCs): buy/unlockHero/forgeWeapon fall back to a local purchase, same as OFFLINE', async () => {
    const f = fakeBackend('online');
    f.b.buyUpgrade = async () => { throw new BackendError('MAINTENANCE'); };
    f.b.unlockHero = async () => { throw new BackendError('MAINTENANCE'); };
    f.b.forgeWeapon = async () => { throw new BackendError('MAINTENANCE'); };
    const ms = createMetaSync(f.b, memStore());
    ms.bankLocal(3000);
    ms.unlockCrack(0); // beating Umbra unlocks the forge shop
    expect(await ms.buy('power')).toBeNull();
    expect(ms.meta.up.power).toBe(1);
    expect(await ms.unlockHero('ranger')).toBeNull();
    expect(ms.meta.owned).toContain('ranger');
    expect(await ms.forgeWeapon('judgement')).toBeNull();
    expect(ms.forgeLv('judgement')).toBe(1);
    expect(ms.pending().map((o) => o.kind)).toEqual(['buy', 'hero', 'forge']);
  });

  it('Weapon forge: locked before the first win, then levels an owned Weapon (queued offline)', async () => {
    const f = fakeBackend('offline');
    const ms = createMetaSync(f.b, memStore());
    ms.bankLocal(2000);
    expect(ms.hasWon()).toBe(false);
    expect((await ms.forgeWeapon('judgement'))?.code).toBe('SHOP_LOCKED');
    ms.unlockCrack(0); // beating Umbra
    expect(ms.hasWon()).toBe(true);
    expect((await ms.forgeWeapon('thornwhip'))?.code).toBe('WEAPON_LOCKED');
    expect(await ms.forgeWeapon('judgement')).toBeNull();
    expect(await ms.forgeWeapon('judgement')).toBeNull();
    expect(ms.meta.gold).toBe(2000 - 400 - 640);
    expect(ms.forgeLv('judgement')).toBe(2);
    expect(ms.pending().map((o) => o.kind)).toEqual(['forge', 'forge']);
    // back online: the server (which also knows the win) replays both and its shop keys become forge levels
    f.server.gold = 2000; f.server.stats = { heartCrack: 1 };
    f.status.set('online');
    expect(await ms.sync()).toBe(true);
    expect(f.calls).toEqual(['forge:judgement', 'forge:judgement', 'getMeta']);
    expect(ms.meta.forge).toEqual({ judgement: 2 });
    expect(ms.meta.gold).toBe(960);
  });

  it('outfits: locked before the first win, a new piece is worn at once, the sim gets the worn levels', async () => {
    const f = fakeBackend('offline');
    const ms = createMetaSync(f.b, memStore());
    ms.bankLocal(3000);
    expect((await ms.buyOutfit('frost', 'hat'))?.code).toBe('SHOP_LOCKED');
    ms.unlockCrack(0);
    expect(await ms.buyOutfit('frost', 'hat')).toBeNull();
    expect(await ms.buyOutfit('frost', 'hat')).toBeNull();
    expect(await ms.buyOutfit('ember', 'cloak')).toBeNull();
    expect(ms.meta.gold).toBe(3000 - 500 - 800 - 500);
    expect(ms.worn()).toEqual({ hat: { set: 'frost', lv: 2 }, cloak: { set: 'ember', lv: 1 } });
    ms.wearOutfit('cloak', null);
    ms.wearOutfit('body', 'frost'); // not owned: ignored
    expect(ms.worn()).toEqual({ hat: { set: 'frost', lv: 2 } });
    // back online: the queue replays and the server's shop keys become piece levels
    f.server.gold = 3000; f.server.stats = { heartCrack: 1 };
    f.status.set('online');
    expect(await ms.sync()).toBe(true);
    expect(f.calls).toEqual(['outfit:frost:hat', 'outfit:frost:hat', 'outfit:ember:cloak', 'getMeta']);
    expect(ms.meta.outfits).toEqual({ 'frost:hat': 2, 'ember:cloak': 1 });
  });

  it('outfits: buying a piece for a filled slot never takes off what is worn (a full set stays whole)', async () => {
    for (const status of ['offline', 'online'] as const) {
      const f = fakeBackend(status);
      f.server.stats = { heartCrack: 1 }; f.server.gold = 5000;
      const ms = createMetaSync(f.b, memStore());
      ms.unlockCrack(0);
      if (status === 'offline') ms.bankLocal(5000); else await ms.sync();
      for (const slot of ['hat', 'body', 'cloak'] as const) expect(await ms.buyOutfit('ember', slot)).toBeNull();
      const set = { hat: { set: 'ember', lv: 1 }, body: { set: 'ember', lv: 1 }, cloak: { set: 'ember', lv: 1 } };
      expect(ms.worn(), status).toEqual(set);
      expect(await ms.buyOutfit('frost', 'hat')).toBeNull(); // bought, but the Ember hat stays on
      expect(ms.worn(), status).toEqual(set);
      expect(ms.outfitLv('frost', 'hat'), status).toBe(1);
      ms.wearOutfit('hat', 'frost'); // the player puts it on by hand
      expect(ms.worn().hat, status).toEqual({ set: 'frost', lv: 1 });
    }
  });

  it('uploads an old artifact save exactly once, before anything else', async () => {
    const f = fakeBackend('online');
    const store = memStore({ 'pixelhorde-meta': JSON.stringify({ gold: 900, up: { power: 2 }, owned: ['ranger'], ch: 'ranger' }) });
    const ms = createMetaSync(f.b, store);
    await ms.sync();
    expect(f.calls[0]).toBe('legacy');
    expect(ms.meta.gold).toBe(900);
    const again = createMetaSync(f.b, store);
    await again.sync();
    expect(f.calls.filter((c) => c === 'legacy')).toHaveLength(1);
  });

  it('a save written by this version is never treated as legacy', async () => {
    const f = fakeBackend('offline');
    const store = memStore();
    const ms = createMetaSync(f.b, store);
    ms.bankLocal(500);
    const later = createMetaSync(f.b, store);
    f.status.set('online');
    await later.sync();
    expect(f.calls).not.toContain('legacy');
  });
});
