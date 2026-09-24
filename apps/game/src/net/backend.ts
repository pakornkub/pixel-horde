// The ONLY way the game talks to the backend (CLAUDE.md → Platform notes).
// Adapters: Supabase (online) and Offline (solo play keeps working when the server is down).

export interface Account {
  id: string;
  nickname: string;
  anonymous: boolean;
  role: 'player' | 'admin';
}

export type BackendStatus = 'online' | 'offline' | 'replaced';
export type BackendErrorCode = 'SESSION_REPLACED' | 'NICKNAME_REJECTED' | 'NOT_SIGNED_IN' | 'OFFLINE' | 'UNKNOWN';

export class BackendError extends Error {
  constructor(public code: BackendErrorCode, message?: string) { super(message || code); }
}

/** Map a server error message/code to our codes. */
export function toBackendError(e: unknown): BackendError {
  if (e instanceof BackendError) return e;
  const msg = String((e as { message?: string })?.message ?? e ?? '');
  for (const code of ['SESSION_REPLACED', 'NICKNAME_REJECTED', 'NOT_SIGNED_IN'] as const) if (msg.includes(code)) return new BackendError(code, msg);
  if (/fetch|network|Failed to|timeout|ECONN|503|502|504/i.test(msg)) return new BackendError('OFFLINE', msg);
  return new BackendError('UNKNOWN', msg);
}

export interface Backend {
  readonly kind: 'supabase' | 'offline';
  status(): BackendStatus;
  onStatus(fn: (s: BackendStatus) => void): () => void;
  /** Sign in (anonymously on first launch) and claim this device's session. Never throws: falls back to offline. */
  start(opts: { nickname?: string }): Promise<Account>;
  account(): Account | null;
  setNickname(nick: string): Promise<Account>;
  /** false when another device took over the account (status becomes 'replaced'). */
  checkSession(): Promise<boolean>;
  /** "Play here": make this device the active one again. */
  reclaim(): Promise<void>;
}

/** Small helper both adapters use for status listeners. */
export class StatusBox {
  private s: BackendStatus = 'offline';
  private fns = new Set<(s: BackendStatus) => void>();
  get(): BackendStatus { return this.s; }
  set(s: BackendStatus): void { if (s !== this.s) { this.s = s; for (const f of this.fns) f(s); } }
  on(fn: (s: BackendStatus) => void): () => void { this.fns.add(fn); return () => this.fns.delete(fn); }
}
