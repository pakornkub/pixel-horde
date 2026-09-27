// Co-op room relay rules (ticket 41), shared by the Cloudflare Durable Object and the in-memory
// test/offline hub. Pure: no timers, sockets or globals — the host adapter delivers messages.
//
// A room is named by a 5-character code. The first connection claims it as host; up to 3 guests
// join while the room is waiting (a player who dropped may come back later with the same pid).
// Host messages go to every guest (or one, with `to`); guest messages go to the host only. When the
// host leaves, the room closes for everyone — except when the host's connection drops during a Run
// (no `bye`): the room then waits HOST_GRACE_MS for the same host (same pid) to come back.

/** No I/L/O/0/1: codes are read aloud and typed on phones. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LEN = 5;
export const MAX_PLAYERS = 4;
/** Larger client messages are dropped (host snapshots stay under ~4 KB). */
export const MAX_MSG = 16_000;
/** A started room waits this long (ms) for a host whose connection dropped (a phone screen turning off). */
export const HOST_GRACE_MS = 45_000;

export function newCode(rand: () => number): string {
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) s += CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length) % CODE_ALPHABET.length];
  return s;
}
export function normalizeCode(s: string): string {
  return s.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
export const isCode = (s: string): boolean => s.length === CODE_LEN && [...s].every((c) => CODE_ALPHABET.includes(c));

export type Role = 'host' | 'guest';
export interface PeerInfo { id: string; name: string; role: Role; pid: string }
export type CloseReason = 'host-left' | 'full' | 'started' | 'no-room' | 'taken' | 'bad-request' | 'network' | 'left';

/** Server → client. */
export type ServerMsg =
  | { t: 'welcome'; id: string; host: string; peers: PeerInfo[] }
  | { t: 'peers'; peers: PeerInfo[] }
  | { t: 'msg'; from: string; data: unknown }
  | { t: 'closed'; reason: CloseReason };

/** Client → server. `lock` (host only) stops new players joining once a Run starts; `bye` = leaving on purpose. */
export type ClientMsg = { d: unknown; to?: string } | { ctl: 'lock' | 'unlock' | 'bye' };

export interface JoinRequest { role: Role; name: string; pid: string }

export function parseJoin(q: { get(k: string): string | null }): JoinRequest | null {
  const role = q.get('role'), name = (q.get('name') || '').slice(0, 24), pid = (q.get('pid') || '').slice(0, 64);
  if ((role !== 'host' && role !== 'guest') || !pid) return null;
  return { role, name: name || 'Hero', pid };
}

export class RoomCore {
  private peers = new Map<string, PeerInfo>();
  private hostId: string | null = null;
  private hostPid: string | null = null;
  private locked = false;
  private closed = false;
  /** The host's connection dropped during a Run: waiting for it (`awaySeq` counts the waits, for hostTimeout). */
  private away = false;
  private seq = 0;
  private bye = false;
  /** Players who were in this Run (they may reconnect after a drop). */
  private members = new Set<string>();

  constructor(
    private send: (connId: string, msg: ServerMsg) => void,
    private kick: (connId: string) => void,
  ) {}

  get isClosed(): boolean { return this.closed; }
  get size(): number { return this.peers.size; }
  get hostAway(): boolean { return this.away; }
  get awaySeq(): number { return this.seq; }
  get hostConn(): string | null { return this.hostId; }

  /** Returns false (and tells the client why) when the connection is refused. */
  join(connId: string, req: JoinRequest): boolean {
    const refuse = (reason: CloseReason): boolean => { this.send(connId, { t: 'closed', reason }); this.kick(connId); return false; };
    if (this.closed) return refuse('no-room');
    if (req.role === 'host') {
      if (this.hostId || (this.away && req.pid !== this.hostPid)) return refuse('taken');
      this.hostId = connId; this.hostPid = req.pid; this.away = false; this.bye = false; // a host who dropped is back
    } else {
      if (!this.hostId && !this.away) return refuse('no-room');
      const rejoin = this.members.has(req.pid);
      if (this.locked && !rejoin) return refuse('started');
      for (const [id, p] of this.peers) if (p.pid === req.pid) { this.peers.delete(id); this.kick(id); } // same player, new tab/socket
      if (this.peers.size >= MAX_PLAYERS) return refuse('full');
    }
    this.peers.set(connId, { id: connId, name: req.name, role: req.role, pid: req.pid });
    this.members.add(req.pid);
    this.send(connId, { t: 'welcome', id: connId, host: this.hostId ?? '', peers: this.list() });
    this.broadcast({ t: 'peers', peers: this.list() }, connId);
    return true;
  }

  message(connId: string, raw: string): void {
    const me = this.peers.get(connId);
    if (!me || raw.length > MAX_MSG) return;
    let m: ClientMsg;
    try { m = JSON.parse(raw) as ClientMsg; } catch { return; }
    if (!m || typeof m !== 'object') return;
    if ('ctl' in m) { if (me.role === 'host') { if (m.ctl === 'bye') this.bye = true; else this.locked = m.ctl === 'lock'; } return; }
    if (me.role === 'host') {
      if (typeof m.to === 'string') { if (this.peers.has(m.to)) this.send(m.to, { t: 'msg', from: connId, data: m.d }); }
      else this.broadcast({ t: 'msg', from: connId, data: m.d }, connId);
    } else if (this.hostId) this.send(this.hostId, { t: 'msg', from: connId, data: m.d });
  }

  leave(connId: string): void {
    if (!this.peers.delete(connId)) return;
    if (connId === this.hostId) {
      this.hostId = null;
      if (this.locked && !this.bye && this.peers.size) { // dropped mid-Run: wait (the adapter calls hostTimeout later)
        this.away = true; this.seq++;
        this.broadcast({ t: 'peers', peers: this.list() });
        return;
      }
      this.closeAll();
      return;
    }
    if (this.away && !this.peers.size) { this.closed = true; return; } // everyone gone while waiting
    this.broadcast({ t: 'peers', peers: this.list() });
  }

  /** The adapter's timer, HOST_GRACE_MS after a host dropped (`seq` = awaySeq then): still gone → the room closes. */
  hostTimeout(seq: number): void { if (this.away && seq === this.seq && !this.closed) this.closeAll(); }

  private closeAll(): void {
    this.closed = true; this.away = false;
    for (const id of [...this.peers.keys()]) { this.send(id, { t: 'closed', reason: 'host-left' }); this.kick(id); }
    this.peers.clear();
    this.hostId = null;
  }

  private list(): PeerInfo[] { return [...this.peers.values()]; }
  private broadcast(msg: ServerMsg, except?: string): void { for (const id of this.peers.keys()) if (id !== except) this.send(id, msg); }
}
