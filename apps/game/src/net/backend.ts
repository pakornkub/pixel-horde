// The ONLY way the game talks to the backend (CLAUDE.md → Platform notes).
// Adapters: Supabase (online) and Offline (solo play keeps working when the server is down).

export interface Account {
  id: string;
  nickname: string;
  anonymous: boolean;
  role: 'player' | 'admin';
}

export type BackendStatus = 'online' | 'offline' | 'replaced';
export type BackendErrorCode =
  | 'SESSION_REPLACED' | 'NICKNAME_REJECTED' | 'NOT_SIGNED_IN' | 'OFFLINE' | 'UNKNOWN'
  | 'NOT_ENOUGH_GOLD' | 'MAXED' | 'HERO_LOCKED' | 'RATE_LIMITED' | 'RUN_ALREADY_SUBMITTED' | 'RUN_NOT_FOUND' | 'MAINTENANCE';

export class BackendError extends Error {
  constructor(public code: BackendErrorCode, message?: string) { super(message || code); }
}

/** Map a server error message/code to our codes. */
export function toBackendError(e: unknown): BackendError {
  if (e instanceof BackendError) return e;
  const msg = String((e as { message?: string })?.message ?? e ?? '');
  for (const code of ['SESSION_REPLACED', 'NICKNAME_REJECTED', 'NOT_SIGNED_IN', 'NOT_ENOUGH_GOLD', 'MAXED', 'HERO_LOCKED', 'RATE_LIMITED', 'RUN_ALREADY_SUBMITTED', 'RUN_NOT_FOUND', 'MAINTENANCE'] as const) {
    if (msg.includes(code)) return new BackendError(code, msg);
  }
  if (/fetch|network|Failed to|timeout|ECONN|503|502|504/i.test(msg)) return new BackendError('OFFLINE', msg);
  return new BackendError('UNKNOWN', msg);
}

/** Server-owned progression (Gold, Shop levels, unlocks). */
export interface ServerMeta {
  gold: number;
  shop: Record<string, number>;
  heroes: string[];
  weapons: string[];
  legacyImported: boolean;
}

/** Issued by start_run: the server picks the seed. */
export interface RunTicket { runId: string; token: string; seed: number; configVersion: number }

export interface RunResult {
  clientRunId: string;
  hero: string;
  mode: 'solo' | 'coop' | 'daily' | 'endless';
  result: 'dead' | 'quit' | 'victory' | 'escape' | 'closed';
  chapter: number;
  kills: number;
  level: number;
  gold: number;
  /** Gold taken from the wallet during the Run (Stage-end swaps); charged on submit. */
  walletSpent?: number;
  score: number;
  /** Active play time (sim time). */
  playMs: number;
  /** Wall time the Run was paused (menus, level-up, pause). */
  pausedMs: number;
  configVersion: number;
  summary?: Record<string, unknown>;
}

export interface SubmitOutcome { status: 'submitted' | 'offline' | 'rejected' | 'duplicate'; reason?: string | null; meta: ServerMeta }

export type BoardId = 'solo' | 'coop' | 'endless' | 'alltime';
export interface BoardRow {
  rank: number; userId: string; name: string; title: string | null; score: number; chapter: number;
  hero: string; weapon: string | null; verified: boolean; at: string; me: boolean;
}
export interface BoardView { board: BoardId; season: number; top: BoardRow[]; me: BoardRow | null; around: BoardRow[]; total: number }

export interface Announcement { id: number; title: { th: string; en: string }; body: { th: string; en: string }; endsAt: string | null }
export interface LiveState { flags: Record<string, unknown>; configVersion: number; announcements: Announcement[]; serverTime?: string }

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

  // --- progression (ticket 09); all throw BackendError('OFFLINE') when not online ---
  getMeta(): Promise<ServerMeta>;
  /** null when offline: the Run then uses a local seed and is submitted later as an offline Run. */
  startRun(hero: string, mode?: RunResult['mode']): Promise<RunTicket | null>;
  submitRun(ticket: RunTicket, r: RunResult): Promise<SubmitOutcome>;
  submitOfflineRun(r: RunResult): Promise<SubmitOutcome>;
  buyUpgrade(item: string): Promise<ServerMeta>;
  unlockHero(hero: string): Promise<ServerMeta>;
  importLegacy(save: unknown): Promise<ServerMeta>;
  getLeaderboard(board: BoardId, hero?: string | null): Promise<BoardView>;
  /** Flags + config version + announcements in one cheap REST call (works signed out too). */
  getLive(): Promise<LiveState>;
  getConfig(version: number): Promise<{ version: number; data: unknown } | null>;
  /** Fire-and-forget uploads (errors, samples). keepalive=true survives the tab closing. */
  report(fn: 'report_errors' | 'report_telemetry', payload: unknown, keepalive?: boolean): Promise<boolean>;
  /** Start linking Google (redirects away). Only for anonymous online accounts. */
  linkGoogle(): Promise<void>;
  /** After a link/merge round-trip: 'merged' | 'linked' | 'failed:<reason>' | null. */
  linkResult(): string | null;
}

/** Small helper both adapters use for status listeners. */
export class StatusBox {
  private s: BackendStatus = 'offline';
  private fns = new Set<(s: BackendStatus) => void>();
  get(): BackendStatus { return this.s; }
  set(s: BackendStatus): void { if (s !== this.s) { this.s = s; for (const f of this.fns) f(s); } }
  on(fn: (s: BackendStatus) => void): () => void { this.fns.add(fn); return () => this.fns.delete(fn); }
}
