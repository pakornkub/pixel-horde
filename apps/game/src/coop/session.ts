// Co-op session (ticket 41): the lobby and the in-Run message flow on top of a Transport.
// No DOM here — the lobby UI and main.ts drive it. Host: collects guest presence/damage and sends
// snapshots ~15 Hz. Guest: sends its presence + queued damage 10 Hz and applies the latest snapshot.
import { fitSnap, hostSnapshot, selfWire, takeHits, type Command, type HeroId, type HostSnap, type MateWire, type SimState, type WeaponId } from '@pixel-horde/sim';
import { MAX_MSG, type CloseReason, type PeerInfo, type Role } from '@pixel-horde/coop';
import type { Connect, Transport } from '../net/transport';

/** `build`: the game build (set from `hello`; -1 = an older game that does not say). */
export interface LobbyPlayer { id: string; name: string; hero: HeroId; weapon: WeaponId; ready: boolean; host: boolean; build?: number }

export type Msg =
  // guest → host
  | { k: 'hello'; hero: HeroId; weapon: WeaponId; ready: boolean; name?: string; build?: number }
  | { k: 'me'; p: MateWire; d: number[]; q?: number; ts?: number } // q = the damage batch number (acknowledged in the snapshot); ts = send time (ping)
  | { k: 'ready'; on: boolean } // Stage end: this player is done
  | { k: 'vote'; i: number } // route vote
  | { k: 'endless'; go: boolean }
  // host → guests
  | { k: 'lobby'; players: LobbyPlayer[] }
  | { k: 'start'; seed: number; cfg: number }
  | { k: 'snap'; s: HostSnap; n?: SnapNet }
  | { k: 'team'; ready: string[]; votes: Record<string, number>; left: number };

export type SessionEvent =
  | { t: 'lobby'; players: LobbyPlayer[] }
  | { t: 'start'; seed: number; cfg: number }
  | { t: 'team'; ready: string[]; votes: Record<string, number>; left: number }
  | { t: 'ready'; id: string; on: boolean }
  | { t: 'vote'; id: string; i: number }
  | { t: 'endless'; id: string; go: boolean }
  | { t: 'closed'; reason: CloseReason }
  | { t: 'netGap'; ms: number }; // guest: a snapshot arrived this long after the previous one (> 1 s)

/** `now`: a clock in ms for the net meter (tests pass their own; default performance.now). */
export interface SessionOptions { role: Role; code: string; name: string; pid: string; hero: HeroId; weapon: WeaponId; build?: number; now?: () => number }

/** Net facts that ride with a snapshot: host frames/s, each guest's last ping [its ts, ms the host held it], trimmed snapshots so far. */
export interface SnapNet { hf: number; pe: Record<string, [number, number]>; tr: number }
/** Co-op net meter (press I). Times in ms, rates in characters/s. */
export interface NetStats { ping: number; gapAvg: number; gapMax: number; jitter: number; rx: number; tx: number; hostFps: number; trims: number }

export const SNAP_EVERY = 1 / 15, ME_EVERY = 1 / 10;
/** A snapshot is trimmed (hazards, drops, then monsters) to fit the relay's message limit with room for the envelope. */
export const SNAP_BUDGET = MAX_MSG - 1500;
const perfNow = (): number => (typeof performance !== 'undefined' ? performance.now() : 0);
const cleanName = (n: unknown): string => (typeof n === 'string' ? n.trim().slice(0, 24) : '');

export function createSession(connect: Connect, o: SessionOptions) {
  const tr: Transport = connect({ code: o.code, role: o.role, name: o.name, pid: o.pid });
  const now = o.now ?? perfNow;
  const fns = new Set<(e: SessionEvent) => void>();
  const emit = (e: SessionEvent): void => { for (const f of [...fns]) f(e); };
  let selfId = '', hostId = '', peers: PeerInfo[] = [], open = false, closed = false;
  const me: LobbyPlayer = { id: '', name: o.name, hero: o.hero, weapon: o.weapon, ready: o.role === 'host', host: o.role === 'host', build: o.build ?? 0 };
  const lobby = new Map<string, LobbyPlayer>();
  let started: { seed: number; cfg: number } | null = null;
  // host
  const presence = new Map<string, MateWire>();
  let hits: { from: string; q?: number; d: number[] }[] = [];
  let matesDirty = false;
  // guest
  let snap: HostSnap | null = null;
  let sinceSnap = 0, snapT = 0, meT = 0;
  // net meter
  const pings = new Map<string, [number, number]>(); // host: guest id → [its ts, when it arrived]
  let hostFps = 0, trims = 0, ping = 0, lastSnapAt = 0;
  const gaps: number[] = [];
  let rate = { at: 0, rx: 0, tx: 0, rxs: 0, txs: 0 };

  const players = (): LobbyPlayer[] => {
    const out: LobbyPlayer[] = [];
    for (const p of peers) {
      if (p.id === selfId) out.push({ ...me, id: selfId });
      else out.push(lobby.get(p.id) ?? { id: p.id, name: p.name, hero: 'mage', weapon: 'judgement', ready: false, host: p.role === 'host' });
    }
    return out.sort((a, c) => (a.host ? -1 : c.host ? 1 : 0));
  };
  /** The latest name of each player (a nickname set after joining replaces the one sent on connect). */
  const nameOf = (id: string, fallback: string): string => (id === selfId ? me.name : lobby.get(id)?.name) || fallback;
  const names = (): Record<string, string> => Object.fromEntries(peers.map((p) => [p.id, nameOf(p.id, p.name)]));
  const pushLobby = (): void => { if (o.role === 'host' && open) tr.send({ k: 'lobby', players: players() } satisfies Msg); emit({ t: 'lobby', players: players() }); };
  const hello = (): void => { if (o.role === 'guest' && open) tr.send({ k: 'hello', hero: me.hero, weapon: me.weapon, ready: me.ready, name: me.name, build: me.build } satisfies Msg); };

  tr.onEvent((e) => {
    if (e.t === 'open') { open = true; selfId = e.id; me.id = e.id; hostId = e.host; peers = e.peers; hello(); pushLobby(); return; }
    if (e.t === 'peers') {
      peers = e.peers;
      for (const id of [...presence.keys()]) if (!peers.some((p) => p.id === id)) { presence.delete(id); matesDirty = true; }
      for (const id of [...lobby.keys()]) if (!peers.some((p) => p.id === id)) lobby.delete(id);
      // a player who dropped and came back during the Run gets the start again
      if (o.role === 'host' && started) for (const p of peers) if (p.role === 'guest' && !lobby.has(p.id)) tr.send({ k: 'start', ...started } satisfies Msg, p.id);
      pushLobby();
      return;
    }
    if (e.t === 'closed') { closed = true; emit({ t: 'closed', reason: e.reason }); return; }
    const m = e.data as Msg;
    if (!m || typeof m !== 'object') return;
    if (o.role === 'host') {
      const p = peers.find((x) => x.id === e.from);
      if (!p) return;
      if (m.k === 'hello') { lobby.set(e.from, { id: e.from, name: cleanName(m.name) || p.name, hero: m.hero, weapon: m.weapon, ready: !!m.ready, host: false, build: typeof m.build === 'number' ? m.build : -1 }); pushLobby(); }
      else if (m.k === 'me' && m.p) {
        presence.set(e.from, { ...m.p, id: e.from, name: nameOf(e.from, p.name) });
        if (Number.isFinite(m.ts)) pings.set(e.from, [m.ts!, now()]);
        matesDirty = true;
        if (Array.isArray(m.d) && m.d.length && hits.length < 200) hits.push({ from: e.from, q: Number.isFinite(m.q) ? m.q : undefined, d: m.d.slice(0, 1200) });
      }
      else if (m.k === 'ready') emit({ t: 'ready', id: e.from, on: !!m.on });
      else if (m.k === 'vote') emit({ t: 'vote', id: e.from, i: Number(m.i) });
      else if (m.k === 'endless') emit({ t: 'endless', id: e.from, go: !!m.go });
    } else if (e.from === hostId) {
      if (m.k === 'lobby') { for (const p of m.players) if (p.id !== selfId) lobby.set(p.id, p); emit({ t: 'lobby', players: players() }); }
      else if (m.k === 'start') { started = { seed: m.seed, cfg: m.cfg }; snap = null; emit({ t: 'start', seed: m.seed, cfg: m.cfg }); }
      else if (m.k === 'snap') {
        snap = m.s; sinceSnap = 0;
        const t = now();
        if (lastSnapAt) {
          const gap = t - lastSnapAt;
          gaps.push(gap); if (gaps.length > 90) gaps.shift();
          if (gap > 1000) emit({ t: 'netGap', ms: Math.round(gap) });
        }
        lastSnapAt = t;
        const pe = m.n?.pe?.[selfId];
        if (Array.isArray(pe)) { const rtt = t - pe[0] - pe[1]; if (rtt >= 0 && rtt < 30000) ping = ping ? ping + (rtt - ping) * 0.2 : rtt; }
        if (m.n) { hostFps = Number(m.n.hf) || 0; trims = Number(m.n.tr) || 0; }
      }
      else if (m.k === 'team') emit({ t: 'team', ready: m.ready, votes: m.votes, left: m.left });
    }
  });

  return {
    role: o.role,
    code: o.code,
    get selfId(): string { return selfId; },
    get isOpen(): boolean { return open && !closed; },
    get started(): boolean { return !!started; },
    players,
    names,
    on(fn: (e: SessionEvent) => void): () => void { fns.add(fn); return () => fns.delete(fn); },
    /** Lobby: my Hero/Weapon and ready flag. */
    setMe(hero: HeroId, weapon: WeaponId, ready = me.ready): void { me.hero = hero; me.weapon = weapon; me.ready = o.role === 'host' || ready; hello(); pushLobby(); },
    /** My nickname changed (set after joining, or renamed): tell the room. */
    setName(name: string): void { const n = cleanName(name); if (!n || n === me.name) return; me.name = n; hello(); pushLobby(); },
    /** Host: everyone (but the host) ready? */
    allReady: (): boolean => players().every((p) => p.ready),
    /** Players on another game build than mine (host: guests who said hello; guest: the host). */
    otherBuild: (): LobbyPlayer[] => players().filter((p) => p.id !== selfId && p.build !== undefined && p.build !== me.build && (o.role === 'host' || p.host)),
    start(seed: number, cfg: number): void {
      if (o.role !== 'host') return;
      started = { seed, cfg };
      tr.lock(true);
      tr.send({ k: 'start', seed, cfg } satisfies Msg);
      emit({ t: 'start', seed, cfg });
    },
    send(m: Msg): void { tr.send(m); },
    /** Commands for the next sim step (host: presence and damage; guest: the latest snapshot). */
    commands(): Command[] {
      const out: Command[] = [];
      if (o.role === 'host') {
        if (matesDirty) { matesDirty = false; out.push({ type: 'mates', mates: [...presence.values()].filter((m) => peers.some((p) => p.id === m.id)) }); }
        for (const b of hits) out.push({ type: 'remoteHits', hits: b.d, from: b.from, q: b.q });
        hits = [];
      } else if (snap) { out.push({ type: 'snap', snap }); snap = null; }
      return out;
    },
    /** Once per frame: send what is due. Returns false when a guest has heard nothing from the host for `hostGone` s. */
    tick(rdt: number, v: Readonly<SimState>, hostGone: number): boolean {
      if (!open || closed) return !closed;
      if (o.role === 'host') {
        if (rdt > 0) hostFps = hostFps ? hostFps + (1 / rdt - hostFps) * 0.05 : 1 / rdt;
        snapT -= rdt;
        if (snapT <= 0) {
          snapT = SNAP_EVERY;
          const s = fitSnap(hostSnapshot(v as SimState, names()), SNAP_BUDGET), t = now(), pe: Record<string, [number, number]> = {};
          if (s.trim) trims++;
          for (const [id, [ts, at]] of pings) pe[id] = [ts, Math.round(t - at)];
          tr.send({ k: 'snap', s, n: { hf: Math.round(hostFps), pe, tr: trims } } satisfies Msg);
        }
        return true;
      }
      sinceSnap += rdt;
      meT -= rdt;
      if (meT <= 0) {
        meT = ME_EVERY;
        const d = takeHits(v as SimState);
        tr.send({ k: 'me', p: selfWire(v as SimState), d, q: v.coop?.seq, ts: Math.round(now()) } satisfies Msg);
      }
      return !(started && sinceSnap > hostGone);
    },
    /** Guest: seconds since the last snapshot (0 before the Run starts). */
    silent: (): number => (o.role === 'guest' && started ? sinceSnap : 0),
    /** Co-op net meter. */
    stats(): NetStats {
      const t = now(), c = tr.stats();
      if (t - rate.at >= 1000) { const d = (t - rate.at) / 1000; rate = { at: t, rx: c.rx, tx: c.tx, rxs: rate.at ? (c.rx - rate.rx) / d : 0, txs: rate.at ? (c.tx - rate.tx) / d : 0 }; }
      const avg = gaps.length ? gaps.reduce((a, g) => a + g, 0) / gaps.length : 0;
      const jitter = gaps.length ? gaps.reduce((a, g) => a + Math.abs(g - avg), 0) / gaps.length : 0;
      return { ping: Math.round(ping), gapAvg: Math.round(avg), gapMax: Math.round(gaps.length ? Math.max(...gaps) : 0), jitter: Math.round(jitter), rx: Math.round(rate.rxs), tx: Math.round(rate.txs), hostFps: Math.round(hostFps), trims };
    },
    leave(): void { if (!closed) { closed = true; tr.close(); } },
  };
}

export type Session = ReturnType<typeof createSession>;
