// Co-op Stage-end decisions on the host (ticket 42): everyone handles their own clear screen at
// the same time (continue when all are ready or after `clearWait` s), then the route is voted
// (`voteTime` s; the most votes win, a tie goes to the host's pick).

export type TeamAction = { k: 'next' } | { k: 'route'; index: number } | null;

export function createTeam(clearWait: number, voteTime: number) {
  let mode: 'none' | 'clear' | 'route' = 'none';
  let left = 0;
  const ready = new Set<string>();
  const votes = new Map<string, number>();
  let host = '';

  function winner(options: number): number {
    const n = Array.from({ length: options }, () => 0);
    for (const v of votes.values()) if (v >= 0 && v < options) n[v]++;
    const best = Math.max(...n);
    const tied = n.map((c, i) => (c === best ? i : -1)).filter((i) => i >= 0);
    const hv = votes.get(host);
    return hv !== undefined && tied.includes(hv) ? hv : tied[0] ?? 0;
  }

  return {
    /** Call when the host's phase changes. */
    enter(phase: 'clear' | 'route' | 'other', hostId: string, t: { clearWait?: number; voteTime?: number } = {}): void {
      host = hostId;
      if (phase === 'clear' && mode !== 'clear') { mode = 'clear'; ready.clear(); left = t.clearWait ?? clearWait; }
      else if (phase === 'route' && mode !== 'route') { mode = 'route'; votes.clear(); left = t.voteTime ?? voteTime; }
      else if (phase === 'other') mode = 'none';
    },
    setReady(id: string, on = true): void { if (mode === 'clear') { if (on) ready.add(id); else ready.delete(id); } },
    vote(id: string, i: number): void { if (mode === 'route' && Number.isInteger(i) && i >= 0) votes.set(id, i); },
    /** Advance; returns what the host should do now. `players` = everyone in the Run (host included). */
    tick(dt: number, players: readonly string[], options = 2): TeamAction {
      if (mode === 'none') return null;
      left = Math.max(0, left - dt);
      if (mode === 'clear') {
        if (players.every((p) => ready.has(p)) || left <= 0) { mode = 'none'; return { k: 'next' }; }
      } else if (players.every((p) => votes.has(p)) || left <= 0) {
        mode = 'none';
        return { k: 'route', index: winner(options) };
      }
      return null;
    },
    status: () => ({ ready: [...ready], votes: Object.fromEntries(votes), left: Math.ceil(left) }),
    get mode() { return mode; },
  };
}
