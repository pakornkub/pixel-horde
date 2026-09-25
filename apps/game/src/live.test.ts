import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '@pixel-horde/config';
import type { Backend, LiveState } from './net/backend';
import type { KeyValue } from './net/offline';

vi.mock('./net', () => ({ backend: { getLive: async () => { throw new Error('x'); } } }));
const { createLive } = await import('./live');
const { active } = await import('./config');

const memStore = (): KeyValue => { const m = new Map<string, string>(); return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v) }; };
const hooks = () => ({ onMaintenance: vi.fn(), onTooOld: vi.fn(), onAnnouncements: vi.fn(), onConfig: vi.fn() });
const fake = (state: LiveState | null, config?: unknown): Backend => ({
  getLive: async () => { if (!state) throw new Error('offline'); return state; },
  getConfig: async (v: number) => ({ version: v, data: config }),
} as unknown as Backend);

describe('live state', () => {
  it('offline: keeps the built-in config and default flags', async () => {
    const l = createLive(fake(null), memStore());
    const h = hooks();
    expect(await l.refresh(h)).toBe(false);
    expect(l.flags().coop).toBe(true);
    expect(h.onConfig).not.toHaveBeenCalled();
    expect(l.loadCachedConfig().version).toBe(0);
  });

  it('a newer published config is validated, cached and handed to the Run', async () => {
    active.cfg = (await import('@pixel-horde/config')).DEFAULT_RESOLVED;
    const store = memStore();
    const data = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    data.shared.stage.durBase = 45;
    const l = createLive(fake({ flags: { maintenance: true, minClientBuild: 99999999999999 }, configVersion: 3, announcements: [] }, data), store);
    const h = hooks();
    await l.refresh(h);
    expect(h.onMaintenance).toHaveBeenCalledWith(true);
    expect(h.onTooOld).toHaveBeenCalled();
    expect(h.onConfig).toHaveBeenCalledTimes(1);
    expect(h.onConfig.mock.calls[0][0]).toMatchObject({ version: 3, stage: { durBase: 45 } });
    // next launch, offline: the cached version is used
    expect(createLive(fake(null), store).loadCachedConfig().version).toBe(3);
  });

  it('an invalid config from the server is rejected and the current one kept', async () => {
    active.cfg = (await import('@pixel-horde/config')).DEFAULT_RESOLVED;
    const l = createLive(fake({ flags: {}, configVersion: 4, announcements: [] }, { shared: { stage: { bossAt: 7 } } }), memStore());
    const h = hooks();
    await l.refresh(h);
    expect(h.onConfig).not.toHaveBeenCalled();
    expect(active.cfg.version).toBe(0);
  });
});
