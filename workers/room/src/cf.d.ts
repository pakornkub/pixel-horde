// Minimal Cloudflare Workers runtime types used by the room worker (no @cloudflare/workers-types dependency).
interface DurableObject { fetch(req: Request): Promise<Response> }
interface DurableObjectId { readonly name?: string }
interface DurableObjectStub { fetch(req: Request): Promise<Response> }
interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId, opts?: { locationHint?: string }): DurableObjectStub;
}
declare class WebSocketPair { 0: WebSocket; 1: WebSocket }
interface WebSocket { accept(): void }
interface ResponseInit { webSocket?: WebSocket }
