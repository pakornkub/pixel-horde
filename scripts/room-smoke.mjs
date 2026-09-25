// Smoke test against a running room worker (deploy check / local `wrangler dev`):
//   node scripts/room-smoke.mjs ws://127.0.0.1:8787
const base = (process.argv[2] || 'ws://127.0.0.1:8787').replace(/^http/, 'ws');
const code = 'SMK' + 'ABCDEFGHJK'[Math.floor(Math.random() * 10)] + 'Z';
const open = (role, pid) => new Promise((res, rej) => {
  const ws = new WebSocket(`${base}/ws/${code}?role=${role}&name=${pid}&pid=${pid}`);
  const got = [];
  ws.onmessage = (e) => got.push(JSON.parse(e.data));
  ws.onerror = rej;
  ws.onopen = () => res({ ws, got });
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const host = await open('host', 'h');
const guest = await open('guest', 'g');
await wait(300);
host.ws.send(JSON.stringify({ d: { k: 'snap' } }));
guest.ws.send(JSON.stringify({ d: { k: 'me' } }));
await wait(300);
const ok1 = guest.got.some((m) => m.t === 'msg' && m.data.k === 'snap');
const ok2 = host.got.some((m) => m.t === 'msg' && m.data.k === 'me');
host.ws.close();
await wait(300);
const ok3 = guest.got.some((m) => m.t === 'closed' && m.reason === 'host-left');
console.log(JSON.stringify({ code, relayToGuest: ok1, relayToHost: ok2, hostLeftClosesRoom: ok3 }));
process.exit(ok1 && ok2 && ok3 ? 0 : 1);
