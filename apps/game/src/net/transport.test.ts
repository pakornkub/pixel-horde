import { describe, expect, it } from 'vitest';
import { CODE_ALPHABET, isCode, newCode } from '@pixel-horde/coop';
import { createMemoryHub, type Transport, type TransportEvent } from './transport';

function watch(t: Transport): TransportEvent[] { const log: TransportEvent[] = []; t.onEvent((e) => log.push(e)); return log; }
const msgs = (log: TransportEvent[]): unknown[] => log.filter((e) => e.t === 'msg').map((e) => (e as { data: unknown }).data);
const closed = (log: TransportEvent[]): string | undefined => (log.find((e) => e.t === 'closed') as { reason: string } | undefined)?.reason;

describe('co-op room transport (in-memory hub)', () => {
  it('room codes avoid ambiguous characters', () => {
    for (const bad of 'ILO01') expect(CODE_ALPHABET).not.toContain(bad);
    let x = 0.123;
    const rand = (): number => (x = (x * 9301 + 0.49297) % 1);
    for (let i = 0; i < 50; i++) expect(isCode(newCode(rand))).toBe(true);
  });

  it('host broadcasts, guests talk to the host only', () => {
    const hub = createMemoryHub();
    const h = hub.connect({ code: 'ABCDE', role: 'host', name: 'Host', pid: 'p1' }), hl = watch(h);
    const g1 = hub.connect({ code: 'ABCDE', role: 'guest', name: 'Ann', pid: 'p2' }), l1 = watch(g1);
    const g2 = hub.connect({ code: 'ABCDE', role: 'guest', name: 'Bo', pid: 'p3' }), l2 = watch(g2);
    hub.flush();
    expect(hl.filter((e) => e.t === 'peers').pop()).toMatchObject({ peers: [{ role: 'host' }, { name: 'Ann' }, { name: 'Bo' }] });
    h.send({ k: 'snap' });
    g1.send({ k: 'me', v: 1 });
    hub.flush();
    expect(msgs(l1)).toEqual([{ k: 'snap' }]);
    expect(msgs(l2)).toEqual([{ k: 'snap' }]); // guest 1's message never reaches guest 2
    expect(msgs(hl)).toEqual([{ k: 'me', v: 1 }]);
    const g2id = (l2.find((e) => e.t === 'open') as { id: string }).id;
    h.send({ k: 'only-bo' }, g2id);
    hub.flush();
    expect(msgs(l2)).toContainEqual({ k: 'only-bo' });
    expect(msgs(l1)).not.toContainEqual({ k: 'only-bo' });
  });

  it('refuses a second host, unknown rooms, a 5th player and joins after the start (except rejoins)', () => {
    const hub = createMemoryHub();
    const h = hub.connect({ code: 'QWERT', role: 'host', name: 'H', pid: 'h' });
    const again = watch(hub.connect({ code: 'QWERT', role: 'host', name: 'X', pid: 'x' }));
    const nobody = watch(hub.connect({ code: 'ZZZZZ', role: 'guest', name: 'X', pid: 'y' }));
    const gs = ['a', 'b', 'c'].map((pid) => watch(hub.connect({ code: 'QWERT', role: 'guest', name: pid, pid })));
    const fifth = watch(hub.connect({ code: 'QWERT', role: 'guest', name: 'e', pid: 'e' }));
    hub.flush();
    expect(closed(again)).toBe('taken');
    expect(closed(nobody)).toBe('no-room');
    expect(closed(fifth)).toBe('full');
    expect(gs.every((l) => !closed(l))).toBe(true);
    h.lock(true);
    const late = watch(hub.connect({ code: 'QWERT', role: 'guest', name: 'f', pid: 'f' }));
    const back = watch(hub.connect({ code: 'QWERT', role: 'guest', name: 'a', pid: 'a' })); // "a" reconnects
    hub.flush();
    expect(closed(late)).toBe('started');
    expect(closed(back)).toBeUndefined();
    expect(closed(gs[0])).toBe('left'); // the old socket of "a" was replaced
  });

  it('closes for everyone when the host leaves', () => {
    const hub = createMemoryHub();
    const h = hub.connect({ code: 'HJKMN', role: 'host', name: 'H', pid: 'h' });
    const g = watch(hub.connect({ code: 'HJKMN', role: 'guest', name: 'G', pid: 'g' }));
    hub.flush();
    h.close();
    hub.flush();
    expect(closed(g)).toBe('host-left');
    const fresh = watch(hub.connect({ code: 'HJKMN', role: 'host', name: 'N', pid: 'n' }));
    hub.flush();
    expect(fresh[0]).toMatchObject({ t: 'open' }); // the code can be used again
  });
});
