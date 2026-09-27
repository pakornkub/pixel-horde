// Co-op transport (ticket 41): one interface, two adapters — a WebSocket to the room Durable Object
// and an in-memory hub (tests, and a local "second tab" dev mode). Rules: @pixel-horde/coop.
import { RoomCore, type CloseReason, type PeerInfo, type Role, type ServerMsg } from '@pixel-horde/coop';

export type TransportEvent =
  | { t: 'open'; id: string; host: string; peers: PeerInfo[] }
  | { t: 'peers'; peers: PeerInfo[] }
  | { t: 'msg'; from: string; data: unknown }
  | { t: 'closed'; reason: CloseReason };

export interface Transport {
  readonly code: string;
  readonly role: Role;
  /** Host: to every guest, or one guest with `to`. Guest: to the host. */
  send(data: unknown, to?: string): void;
  /** Host: stop (or allow) new players joining. */
  lock(on: boolean): void;
  onEvent(fn: (e: TransportEvent) => void): () => void;
  /** Characters received / sent so far (the co-op net meter). */
  stats(): { rx: number; tx: number };
  close(): void;
}

export interface JoinOptions { code: string; role: Role; name: string; pid: string }
export type Connect = (o: JoinOptions) => Transport;

function emitter() {
  const fns = new Set<(e: TransportEvent) => void>();
  let closed = false;
  return {
    on(fn: (e: TransportEvent) => void): () => void { fns.add(fn); return () => fns.delete(fn); },
    emit(e: TransportEvent): void {
      if (closed) return;
      if (e.t === 'closed') closed = true;
      for (const f of [...fns]) f(e);
    },
    get closed(): boolean { return closed; },
  };
}
const toEvent = (m: ServerMsg): TransportEvent => (m.t === 'welcome' ? { t: 'open', id: m.id, host: m.host, peers: m.peers } : m);

/* ---------- WebSocket adapter ---------- */
export function wsConnect(base: string): Connect {
  return (o) => {
    const ev = emitter();
    const q = new URLSearchParams({ role: o.role, name: o.name, pid: o.pid });
    const url = base.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws/' + o.code + '?' + q.toString();
    let ws: WebSocket | null = null;
    let opened = false;
    try { ws = new WebSocket(url); } catch { queueMicrotask(() => ev.emit({ t: 'closed', reason: 'network' })); }
    const out: string[] = [];
    let rx = 0, tx = 0;
    const raw = (s: string): void => { tx += s.length; if (ws && ws.readyState === 1) ws.send(s); else if (ws && ws.readyState === 0) out.push(s); };
    if (ws) {
      ws.onopen = () => { for (const s of out.splice(0)) ws!.send(s); };
      ws.onmessage = (e) => {
        const str = String(e.data);
        rx += str.length;
        try { const m = JSON.parse(str) as ServerMsg; if (m.t === 'welcome') opened = true; ev.emit(toEvent(m)); } catch { /* ignore */ }
      };
      // never welcomed → the server refused (quota, 503) or could not be reached
      ws.onclose = () => ev.emit({ t: 'closed', reason: opened ? 'network' : 'full' });
    }
    return {
      code: o.code,
      role: o.role,
      send: (data, to) => raw(JSON.stringify(to ? { d: data, to } : { d: data })),
      lock: (on) => raw(JSON.stringify({ ctl: on ? 'lock' : 'unlock' })),
      onEvent: ev.on,
      stats: () => ({ rx, tx }),
      close: () => { ev.emit({ t: 'closed', reason: 'left' }); try { ws?.close(1000); } catch { /* ignore */ } },
    };
  };
}

/* ---------- in-memory hub ---------- */
/**
 * Rooms live in this hub; messages are queued and delivered by `flush()` (tests) or automatically
 * on a microtask when `auto` is set. Behaves like the Durable Object (same RoomCore).
 */
export function createMemoryHub(auto = false) {
  const rooms = new Map<string, RoomCore>();
  const inbox = new Map<string, ReturnType<typeof emitter>>();
  const queue: [string, ServerMsg | null][] = []; // null = the connection was dropped by the room
  const rxOf = new Map<string, number>(), txOf = new Map<string, number>();
  let seq = 0, scheduled = false;
  const schedule = (): void => { if (auto && !scheduled) { scheduled = true; queueMicrotask(() => { scheduled = false; flush(); }); } };
  function flush(): number {
    let n = 0;
    while (queue.length) {
      const [id, m] = queue.shift()!;
      const ev = inbox.get(id);
      if (!ev) continue;
      if (m) { rxOf.set(id, (rxOf.get(id) ?? 0) + JSON.stringify(m).length); ev.emit(toEvent(m)); } else { inbox.delete(id); ev.emit({ t: 'closed', reason: 'left' }); }
      n++;
    }
    return n;
  }
  const room = (code: string): RoomCore => {
    let r = rooms.get(code);
    if (!r || r.isClosed) {
      r = new RoomCore((id, m) => { queue.push([id, m]); schedule(); }, (id) => { queue.push([id, null]); schedule(); });
      rooms.set(code, r);
    }
    return r;
  };
  const connect: Connect = (o) => {
    const id = 'm' + (++seq), ev = emitter(), r = room(o.code);
    inbox.set(id, ev);
    r.join(id, { role: o.role, name: o.name, pid: o.pid });
    return {
      code: o.code,
      role: o.role,
      send: (data, to) => { const str = JSON.stringify(to ? { d: data, to } : { d: data }); txOf.set(id, (txOf.get(id) ?? 0) + str.length); r.message(id, str); },
      lock: (on) => r.message(id, JSON.stringify({ ctl: on ? 'lock' : 'unlock' })),
      onEvent: ev.on,
      stats: () => ({ rx: rxOf.get(id) ?? 0, tx: txOf.get(id) ?? 0 }),
      close: () => { ev.emit({ t: 'closed', reason: 'left' }); inbox.delete(id); r.leave(id); },
    };
  };
  return { connect, flush, rooms };
}
