import { describe, expect, it } from 'vitest';
import { createSim, type SimState } from '@pixel-horde/sim';
import { createMemoryHub } from '../net/transport';
import { createSession, type SessionEvent } from './session';

const opts = (seed: number, role: 'host' | 'guest', self: string) => ({ seed, hero: 'mage' as const, meta: { up: {} }, viewport: { w: 338, h: 190 }, events: { bloodMoon: false, dragon: false, rival: false }, debug: { god: true }, coop: { role, self } });

describe('co-op session over the in-memory hub', () => {
  it('lobby: guests show their Hero, ready up, the host starts; snapshots and damage flow', () => {
    const hub = createMemoryHub();
    const host = createSession(hub.connect, { role: 'host', code: 'ABCDE', name: 'Host', pid: 'h', hero: 'mage', weapon: 'judgement' });
    const guest = createSession(hub.connect, { role: 'guest', code: 'ABCDE', name: 'Ann', pid: 'a', hero: 'knight', weapon: 'judgement' });
    const gev: SessionEvent[] = [];
    guest.on((e) => gev.push(e));
    hub.flush();
    expect(host.players().map((p) => [p.name, p.hero, p.ready])).toEqual([['Host', 'mage', true], ['Ann', 'knight', false]]);
    expect(host.allReady()).toBe(false);
    guest.setMe('knight', 'judgement', true);
    hub.flush();
    expect(host.allReady()).toBe(true);
    expect((gev.filter((e) => e.t === 'lobby').pop() as { players: { name: string }[] }).players.map((p) => p.name)).toEqual(['Host', 'Ann']);
    host.start(42, 0);
    hub.flush();
    expect(gev.find((e) => e.t === 'start')).toMatchObject({ seed: 42, cfg: 0 });

    const hs = createSim(opts(42, 'host', host.selfId)), gs = createSim(opts(7, 'guest', guest.selfId));
    for (let i = 0; i < 20 * 60; i++) {
      hs.step({ mx: 0, my: 0 }, host.commands());
      gs.step({ mx: 0.3, my: 0 }, guest.commands());
      host.tick(1 / 60, hs.view(), 5);
      expect(guest.tick(1 / 60, gs.view(), 5)).toBe(true);
      hub.flush();
    }
    const h = hs.view() as SimState, g = gs.view() as SimState;
    expect(h.coop!.mates.map((m) => m.id)).toEqual([guest.selfId]);
    expect(Math.abs(h.coop!.mates[0].x - g.P.x)).toBeLessThan(20);
    expect(g.enemies.length).toBeGreaterThan(0);
    expect(g.kills).toBeGreaterThan(0);
  });

  it('a guest notices when the host is gone', () => {
    const hub = createMemoryHub();
    const host = createSession(hub.connect, { role: 'host', code: 'QQQQQ', name: 'H', pid: 'h', hero: 'mage', weapon: 'judgement' });
    const guest = createSession(hub.connect, { role: 'guest', code: 'QQQQQ', name: 'G', pid: 'g', hero: 'mage', weapon: 'judgement' });
    const ev: SessionEvent[] = [];
    guest.on((e) => ev.push(e));
    hub.flush();
    host.leave();
    hub.flush();
    expect(ev.pop()).toEqual({ t: 'closed', reason: 'host-left' });
  });

  it('a quiet host: the guest counts the silence, reports a gap, only leaves after hostGone; ping and host FPS arrive', () => {
    const hub = createMemoryHub();
    let clock = 0;
    const now = (): number => clock;
    const host = createSession(hub.connect, { role: 'host', code: 'WWWWW', name: 'H', pid: 'h', hero: 'mage', weapon: 'judgement', now });
    const guest = createSession(hub.connect, { role: 'guest', code: 'WWWWW', name: 'G', pid: 'g', hero: 'mage', weapon: 'judgement', now });
    const ev: SessionEvent[] = [];
    guest.on((e) => ev.push(e));
    hub.flush();
    guest.setMe('mage', 'judgement', true); hub.flush();
    host.start(1, 0); hub.flush();
    const hs = createSim(opts(1, 'host', host.selfId)), gs = createSim(opts(2, 'guest', guest.selfId));
    const run = (n: number, hostOn = true): boolean => {
      let ok = true;
      for (let i = 0; i < n; i++) {
        clock += 1000 / 60;
        if (hostOn) { hs.step({ mx: 0, my: 0 }, host.commands()); host.tick(1 / 60, hs.view(), 60); }
        gs.step({ mx: 0, my: 0 }, guest.commands());
        ok = guest.tick(1 / 60, gs.view(), 60);
        hub.flush();
      }
      return ok;
    };
    expect(run(120)).toBe(true);
    expect(guest.silent()).toBeLessThan(0.1);
    const st = guest.stats();
    expect(st.hostFps).toBeGreaterThan(50);
    expect(st.gapAvg).toBeGreaterThanOrEqual(0);
    expect(st.trims).toBe(0);
    // the host stops sending: silence grows, the guest stays (hostGone 60 s) …
    expect(run(10 * 60, false)).toBe(true);
    expect(guest.silent()).toBeGreaterThan(9);
    // … and when snapshots come back the long gap is reported
    run(30);
    expect(ev.some((e) => e.t === 'netGap' && e.ms > 1000)).toBe(true);
    expect(guest.silent()).toBeLessThan(0.1);
  });

  it('players on another game build are flagged on both sides (the lobby blocks the start)', () => {
    const hub = createMemoryHub();
    const host = createSession(hub.connect, { role: 'host', code: 'VVVVV', name: 'H', pid: 'h', hero: 'mage', weapon: 'judgement', build: 200 });
    const same = createSession(hub.connect, { role: 'guest', code: 'VVVVV', name: 'Same', pid: 's', hero: 'mage', weapon: 'judgement', build: 200 });
    const old = createSession(hub.connect, { role: 'guest', code: 'VVVVV', name: 'Old', pid: 'o', hero: 'mage', weapon: 'judgement', build: 199 });
    hub.flush();
    same.setMe('mage', 'judgement', true); old.setMe('mage', 'judgement', true);
    hub.flush();
    expect(host.allReady()).toBe(true);
    expect(host.otherBuild().map((p) => p.name)).toEqual(['Old']);
    expect(same.otherBuild()).toEqual([]);
    expect(old.otherBuild().map((p) => p.name)).toEqual(['H']);
  });
});
