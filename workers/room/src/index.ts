// Cloudflare Worker + one Durable Object per co-op room (ticket 41). The DO only relays: the host's
// browser runs the simulation. Rules live in @pixel-horde/room (shared with the in-memory hub).
//   GET /ws/<CODE>?role=host|guest&name=..&pid=..  → WebSocket
//   GET /health                                    → "ok"
import { RoomCore, isCode, normalizeCode, parseJoin, type ServerMsg } from '@pixel-horde/coop';

interface Env { ROOM: DurableObjectNamespace }

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === '/health') return new Response('ok');
    const m = url.pathname.match(/^\/ws\/([A-Za-z0-9]+)$/);
    if (!m) return new Response('not found', { status: 404 });
    const code = normalizeCode(m[1]);
    if (!isCode(code) || !parseJoin(url.searchParams)) return new Response('bad request', { status: 400 });
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    try {
      const stub = env.ROOM.get(env.ROOM.idFromName(code), { locationHint: 'apac' });
      return await stub.fetch(req);
    } catch {
      // the free daily Durable Object allowance is used up (or the platform is down)
      return new Response('co-op full', { status: 503 });
    }
  },
};

export class Room implements DurableObject {
  private sockets = new Map<string, WebSocket>();
  private core = this.makeCore();
  private seq = 0;

  async fetch(req: Request): Promise<Response> {
    const join = parseJoin(new URL(req.url).searchParams)!;
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    server.accept();
    const id = 'c' + (++this.seq).toString(36);
    this.sockets.set(id, server);
    server.addEventListener('message', (e) => this.core.message(id, typeof e.data === 'string' ? e.data : ''));
    const gone = (): void => { if (this.sockets.delete(id)) this.core.leave(id); };
    server.addEventListener('close', gone);
    server.addEventListener('error', gone);
    if (this.core.isClosed) this.core = this.makeCore(); // a closed room's code can be used again
    this.core.join(id, join);
    return new Response(null, { status: 101, webSocket: client } as ResponseInit);
  }

  private makeCore(): RoomCore {
    return new RoomCore(
      (id: string, msg: ServerMsg) => { try { this.sockets.get(id)?.send(JSON.stringify(msg)); } catch { /* gone */ } },
      (id: string) => { const ws = this.sockets.get(id); this.sockets.delete(id); try { ws?.close(1000, 'bye'); } catch { /* gone */ } },
    );
  }
}
