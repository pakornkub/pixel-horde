// Co-op session (ticket 41): the lobby and the in-Run message flow on top of a Transport.
// No DOM here — the lobby UI and main.ts drive it. Host: collects guest presence/damage and sends
// snapshots ~15 Hz. Guest: sends its presence + queued damage 10 Hz and applies the latest snapshot.
import { hostSnapshot, selfWire, takeHits, type Command, type HeroId, type HostSnap, type MateWire, type SimState, type WeaponId } from '@pixel-horde/sim';
import type { CloseReason, PeerInfo, Role } from '@pixel-horde/coop';
import type { Connect, Transport } from '../net/transport';

export interface LobbyPlayer { id: string; name: string; hero: HeroId; weapon: WeaponId; ready: boolean; host: boolean }

export type Msg =
  // guest → host
  | { k: 'hello'; hero: HeroId; weapon: WeaponId; ready: boolean; name?: string }
  | { k: 'me'; p: MateWire; d: number[]; q?: number } // q = the damage batch number (acknowledged in the snapshot)
  | { k: 'ready'; on: boolean } // Stage end: this player is done
  | { k: 'vote'; i: number } // route vote
  | { k: 'endless'; go: boolean }
  // host → guests
  | { k: 'lobby'; players: LobbyPlayer[] }
  | { k: 'start'; seed: number; cfg: number }
  | { k: 'snap'; s: HostSnap }
  | { k: 'team'; ready: string[]; votes: Record<string, number>; left: number };

export type SessionEvent =
  | { t: 'lobby'; players: LobbyPlayer[] }
  | { t: 'start'; seed: number; cfg: number }
  | { t: 'team'; ready: string[]; votes: Record<string, number>; left: number }
  | { t: 'ready'; id: string; on: boolean }
  | { t: 'vote'; id: string; i: number }
  | { t: 'endless'; id: string; go: boolean }
  | { t: 'closed'; reason: CloseReason };

export interface SessionOptions { role: Role; code: string; name: string; pid: string; hero: HeroId; weapon: WeaponId }

export const SNAP_EVERY = 1 / 15, ME_EVERY = 1 / 10;
const cleanName = (n: unknown): string => (typeof n === 'string' ? n.trim().slice(0, 24) : '');

export function createSession(connect: Connect, o: SessionOptions) {
  const tr: Transport = connect({ code: o.code, role: o.role, name: o.name, pid: o.pid });
  const fns = new Set<(e: SessionEvent) => void>();
  const emit = (e: SessionEvent): void => { for (const f of [...fns]) f(e); };
  let selfId = '', hostId = '', peers: PeerInfo[] = [], open = false, closed = false;
  const me: LobbyPlayer = { id: '', name: o.name, hero: o.hero, weapon: o.weapon, ready: o.role === 'host', host: o.role === 'host' };
  const lobby = new Map<string, LobbyPlayer>();
  let started: { seed: number; cfg: number } | null = null;
  // host
  const presence = new Map<string, MateWire>();
  let hits: { from: string; q?: number; d: number[] }[] = [];
  let matesDirty = false;
  // guest
  let snap: HostSnap | null = null;
  let sinceSnap = 0, snapT = 0, meT = 0;

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
  const hello = (): void => { if (o.role === 'guest' && open) tr.send({ k: 'hello', hero: me.hero, weapon: me.weapon, ready: me.ready, name: me.name } satisfies Msg); };

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
      if (m.k === 'hello') { lobby.set(e.from, { id: e.from, name: cleanName(m.name) || p.name, hero: m.hero, weapon: m.weapon, ready: !!m.ready, host: false }); pushLobby(); }
      else if (m.k === 'me' && m.p) {
        presence.set(e.from, { ...m.p, id: e.from, name: nameOf(e.from, p.name) });
        matesDirty = true;
        if (Array.isArray(m.d) && m.d.length && hits.length < 200) hits.push({ from: e.from, q: Number.isFinite(m.q) ? m.q : undefined, d: m.d.slice(0, 1200) });
      }
      else if (m.k === 'ready') emit({ t: 'ready', id: e.from, on: !!m.on });
      else if (m.k === 'vote') emit({ t: 'vote', id: e.from, i: Number(m.i) });
      else if (m.k === 'endless') emit({ t: 'endless', id: e.from, go: !!m.go });
    } else if (e.from === hostId) {
      if (m.k === 'lobby') { for (const p of m.players) if (p.id !== selfId) lobby.set(p.id, p); emit({ t: 'lobby', players: players() }); }
      else if (m.k === 'start') { started = { seed: m.seed, cfg: m.cfg }; snap = null; emit({ t: 'start', seed: m.seed, cfg: m.cfg }); }
      else if (m.k === 'snap') { snap = m.s; sinceSnap = 0; }
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
    /** Once per frame: send what is due. Returns false when a guest lost the host. */
    tick(rdt: number, v: Readonly<SimState>, hostLost: number): boolean {
      if (!open || closed) return !closed;
      if (o.role === 'host') {
        snapT -= rdt;
        if (snapT <= 0) { snapT = SNAP_EVERY; tr.send({ k: 'snap', s: hostSnapshot(v as SimState, names()) } satisfies Msg); }
        return true;
      }
      sinceSnap += rdt;
      meT -= rdt;
      if (meT <= 0) {
        meT = ME_EVERY;
        const d = takeHits(v as SimState);
        tr.send({ k: 'me', p: selfWire(v as SimState), d, q: v.coop?.seq } satisfies Msg);
      }
      return !(started && sinceSnap > hostLost);
    },
    leave(): void { if (!closed) { closed = true; tr.close(); } },
  };
}

export type Session = ReturnType<typeof createSession>;
