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
