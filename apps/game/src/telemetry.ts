// Play statistics (ticket 14): one ~0.8 KB summary per Run (sent with submit_run), detail events
// from 5% of players, client errors grouped by fingerprint. Outbox in localStorage, flushed on an
// interval and with fetch keepalive when the tab is hidden. Nothing is sent if the player opts out.
import type { SimState } from '@pixel-horde/sim';
import { BUILD } from './live';
import { backend, type Backend } from './net';
import { browserStore, type KeyValue } from './net/offline';
import { settings } from './settings';

export interface ErrorEntry { fingerprint: string; message: string; stack: string; count: number; build: number; ua: string; lang: string }
interface Outbox { errors: ErrorEntry[]; samples: unknown[] }

const K_OUT = 'pixelhorde-outbox';

/** Short stable hash (FNV-1a, base36). */
export function fingerprint(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

/** FPS histogram buckets: <30, 30–45, 45–55, ≥55 frames per second. */
export function fpsBucket(fps: number): number { return fps < 30 ? 0 : fps < 45 ? 1 : fps < 55 ? 2 : 3; }

/** Browser noise that is not a game bug: WebKit rejects pending promises when the page is closed or left. */
const NOISE = [/browsing context is going away/i];
export const isNoise = (message: string): boolean => NOISE.some((re) => re.test(message));

/** Errors from a dev server or a local build are not players' errors: keep them out of the live list. */
export const isLocalHost = (host: string): boolean => /^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$|\.test$/.test(host);

/** 5% of players (stable per account) send detail events. */
export function inSample(accountId: string): boolean { return parseInt(fingerprint('sample:' + accountId), 36) % 100 < 5; }

export function createTelemetry(b: Backend, store: KeyValue, enabled: () => boolean) {
  let out: Outbox = { errors: [], samples: [] };
  try { out = { errors: [], samples: [], ...JSON.parse(store.get(K_OUT) || '{}') }; } catch { /* empty */ }
  const save = (): void => store.set(K_OUT, JSON.stringify(out));
  const fps = [0, 0, 0, 0];
  let picks: string[] = [];
  let events: unknown[] = [];

  return {
    recordError(message: string, stack = ''): void {
      if (!enabled() || isNoise(message)) return;
      const top = stack.split('\n').slice(0, 2).join('\n');
      const fp = fingerprint(message + '|' + top);
      const e = out.errors.find((x) => x.fingerprint === fp);
      if (e) e.count++;
      else if (out.errors.length < 20) out.errors.push({ fingerprint: fp, message: message.slice(0, 500), stack: stack.slice(0, 2000), count: 1, build: BUILD, ua: navigator.userAgent.slice(0, 200), lang: navigator.language });
      save();
    },
    frame(dt: number): void { if (dt > 0) fps[fpsBucket(1 / dt)]++; },
    pick(id: string): void { picks.push(id); },
    event(e: Record<string, unknown>): void { if (events.length < 200) events.push(e); },
    startRun(): void { fps.fill(0); picks = []; events = []; },
    /** The per-Run summary stored on `runs.summary` (~0.8 KB). */
    summary(v: Readonly<SimState>): Record<string, unknown> {
      const skills: Record<string, number> = {};
      for (const [k, lv] of Object.entries(v.P.skills)) skills[k] = lv!;
      return { v: 1, hero: v.hero, chapter: v.stage, lv: v.P.lv, kills: v.kills, t: Math.round(v.totalTime), skills, pas: v.P.pas, evo: Object.keys(v.P.evo),
        picks: picks.slice(0, 60), fps: [...fps], streak: v.maxStreak, pet: v.P.pet?.lv ?? 0, clone: v.P.clone?.lv ?? 0, configVersions: v.configVersions };
    },
    /** Detail events for the 5% sample, queued for upload. */
    queueSample(accountId: string, runId: string | null, configVersion: number): void {
      if (!enabled() || !inSample(accountId) || !events.length) return;
      out.samples.push({ runId, configVersion, events: events.slice(0, 200) });
      if (out.samples.length > 5) out.samples.shift();
      save();
    },
    async flush(keepalive = false): Promise<void> {
      if (!enabled()) { out = { errors: [], samples: [] }; save(); return; }
      if (out.errors.length && (await b.report('report_errors', out.errors, keepalive))) { out.errors = []; save(); }
      while (out.samples.length) {
        if (!(await b.report('report_telemetry', out.samples[0], keepalive))) break;
        out.samples.shift();
        save();
      }
    },
    pending: (): Outbox => out,
  };
}

export const telemetry = createTelemetry(backend, browserStore, () => settings.stats && !import.meta.env.DEV && !isLocalHost(location.hostname));

/** Global error capture + periodic / on-hide flushing. */
export function installTelemetry(): void {
  addEventListener('error', (e) => telemetry.recordError(String(e.message || e.error), e.error?.stack || ''));
  addEventListener('unhandledrejection', (e) => telemetry.recordError('unhandled: ' + String((e.reason as Error)?.message ?? e.reason), (e.reason as Error)?.stack || ''));
  document.addEventListener('visibilitychange', () => { if (document.hidden) void telemetry.flush(true); });
  setInterval(() => void telemetry.flush(), 60_000);
}
