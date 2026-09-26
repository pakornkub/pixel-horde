// Smoke test against a running room worker (deploy check / local `wrangler dev`):
//   node scripts/room-smoke.mjs ws://127.0.0.1:8787
import { randomInt } from 'node:crypto';
import { clearTimeout } from 'node:timers';
// Each step waits for the room's own reply (welcome / peers / msg / closed), bounded by TIMEOUT, instead of fixed sleeps.
const base = (process.argv[2] || 'ws://127.0.0.1:8787').replace(/^http/, 'ws');
// a random valid room code (packages/coop CODE_ALPHABET × CODE_LEN = 31^5 ≈ 29M), so parallel runs never share a room
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const code = Array.from({ length: 5 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
const TIMEOUT = 10_000; // per step: generous for a cold Durable Object, still fails a hung deploy fast

const open = (role, pid) => {
  const ws = new WebSocket(`${base}/ws/${code}?role=${role}&name=${pid}&pid=${pid}`);
  const peer = { ws, got: [], waiters: [] };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    peer.got.push(m);
    for (const w of [...peer.waiters]) if (w.test(m)) w.done(true);
  };
  return peer;
};
/** Resolves true once a message matching `test` has arrived (or already had), false after TIMEOUT. */
const waitFor = (peer, test) => new Promise((res) => {
  if (peer.got.some(test)) return res(true);
  const w = { test, done: (ok) => { clearTimeout(timer); peer.waiters.splice(peer.waiters.indexOf(w), 1); res(ok); } };
  const timer = setTimeout(() => w.done(false), TIMEOUT);
  peer.waiters.push(w);
});
const msg = (k) => (m) => m.t === 'msg' && m.data?.k === k;

const host = open('host', 'h');
const hostIn = await waitFor(host, (m) => m.t === 'welcome');
const guest = hostIn ? open('guest', 'g') : null; // a guest before the host would be refused with no-room
const guestIn = !!guest && await waitFor(guest, (m) => m.t === 'welcome')
  && await waitFor(host, (m) => m.t === 'peers' && m.peers.some((p) => p.pid === 'g'));
let ok1 = false, ok2 = false, ok3 = false;
if (guestIn) {
  const snap = waitFor(guest, msg('snap'));
  host.ws.send(JSON.stringify({ d: { k: 'snap' } }));
  ok1 = await snap;
  const me = waitFor(host, msg('me'));
  guest.ws.send(JSON.stringify({ d: { k: 'me' } }));
  ok2 = await me;
  const left = waitFor(guest, (m) => m.t === 'closed' && m.reason === 'host-left');
  host.ws.close();
  ok3 = await left;
}
for (const p of [host, guest]) p?.ws.close();
console.log(JSON.stringify({ code, hostJoined: hostIn, guestJoined: guestIn, relayToGuest: ok1, relayToHost: ok2, hostLeftClosesRoom: ok3 }));
process.exit(ok1 && ok2 && ok3 ? 0 : 1);
