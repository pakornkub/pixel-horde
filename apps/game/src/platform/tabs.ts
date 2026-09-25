// One tab at a time in the same browser (Web Locks + BroadcastChannel).
// The newest tab can take over: the old tab is told the game moved.

const LOCK = 'pixelhorde-play';
let release: (() => void) | null = null;
let handlers: TabHandlers | null = null;
const chan = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('pixelhorde') : null;

export interface TabHandlers {
  /** Another tab holds the game; call takeOver() to move it here. */
  onBlocked(): void;
  /** This tab lost the game to another tab. */
  onLost(): void;
  /** This tab now owns the game. */
  onAcquired(): void;
}

const hasLocks = (): boolean => typeof navigator !== 'undefined' && !!navigator.locks;

function holdUntilReleased(): Promise<void> {
  handlers?.onAcquired();
  return new Promise<void>((r) => { release = r; });
}

/** Move the game to this tab (the other tab shows "moved to another tab"). */
export function takeOver(): void {
  if (!hasLocks()) return;
  chan?.postMessage({ type: 'takeover' });
  void navigator.locks.request(LOCK, (lock) => (lock ? holdUntilReleased() : undefined));
}

export async function guardTab(h: TabHandlers): Promise<void> {
  handlers = h;
  if (!hasLocks()) { h.onAcquired(); return; }
  chan?.addEventListener('message', (ev) => {
    if (ev.data?.type === 'takeover' && release) { release(); release = null; h.onLost(); }
  });
  const got = await new Promise<boolean>((resolve) => {
    void navigator.locks.request(LOCK, { ifAvailable: true }, (lock) => {
      resolve(!!lock);
      return lock ? holdUntilReleased() : undefined;
    });
  });
  if (!got) h.onBlocked();
}
