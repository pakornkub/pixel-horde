# 03 — Co-op transport: which network layer for 2–4 player co-op?

- **Date checked:** 2026-09-24 (all quotas/prices below read from the linked pages on that date)
- **Budget:** 0 THB — free tiers only
- **Scope:** 2–4 players, join by a 4–6 character room code, no matchmaking. Many players on Thai
  mobile data (CGNAT likely). Host-authoritative sim as described in `CLAUDE.md` and implemented in
  `pixel-horde.html` lines ~1011–1200 (`netTick`, `guestSync`, `applySnap`, `onDmg`).

## TL;DR

**Recommendation: Cloudflare Workers + one Durable Object (DO) per room, relaying WebSocket
messages.** Room code = DO name. It works on every network (outbound WSS on port 443, so CGNAT and
symmetric NAT don't matter), needs no credit card, and 50 h/month of 4-player play uses about 29% of
the daily free request allowance on an average day. The room also survives a host disconnect, which
gives us reconnect and later host migration.

**Fallback: PeerJS (WebRTC data channels) on the free `0.peerjs.com` signalling server**, using the
TURN servers that PeerJS configures by default. Add Cloudflare Realtime TURN (1,000 GB/month free)
only if billing can be enabled on the account. Put both behind the same `net/transport.ts` interface
so we can switch between them.

**Rejected: Supabase Realtime Broadcast.** Our traffic uses up the free 2 M messages/month in about 1.5
hours of play and the 5 GB egress in about 7 hours.

---

## 1. Traffic model (what the current code sends)

Taken from `pixel-horde.html`:

| Flow | Rate | Size (assumption) | Source line |
|---|---|---|---|
| Host snapshot → every guest | 15 Hz (`NET.pT=1/15`) | ≤ 4,000 B worst (230 enemies × 11 chars + stage/HP/hazard fields); ~2,000 B typical | 1107–1113, guest rejects `e` > 4000 chars at 1173 |
| Guest presence → host | 20 Hz (`NET.pT=1/20`) | ~180 B JSON | 1119–1120 |
| Guest aggregated damage → host | every 150 ms (6.67 Hz) when non-empty | ~300 B average (`[id,dmg,…]`, max 300 entries/msg) | 1121–1123 |

Scenario for the quota math: **1 host + 3 guests, 50 hours/month of 4-player sessions** (≈1.67 h/day
on average).

### Per-second and per-month totals

| Quantity | Formula | Worst (4 KB snapshot) | Typical (2 KB) |
|---|---|---|---|
| Unique messages sent | 15 (host) + 3 × (20 + 6.67) (guests) | **95 msg/s** | 95 msg/s |
| …per hour / per 50 h | × 3,600 / × 180,000 | 342 k/h · **17.1 M/month** | same |
| Host → guests bytes | 15 × S × 3 | 180 kB/s = 648 MB/h | 90 kB/s = 324 MB/h |
| Guests → host bytes | 3 × (20×180 + 6.67×300) | 16.8 kB/s = 60.5 MB/h | 60.5 MB/h |
| **All game traffic** | sum | **0.71 GB/h · 35.4 GB/month** | 0.38 GB/h · 19.2 GB/month |
| Guest mobile data (download) | 15 × S | 216 MB/h | 108 MB/h |
| Host mobile upload, **P2P star** | 15 × S × 3 | **648 MB/h (1.44 Mbit/s)** | 324 MB/h |
| Host mobile upload, **server relay** | 15 × S × 1 (server fans out) | 216 MB/h (0.48 Mbit/s) | 108 MB/h |

With P2P, the host uploads each snapshot once per guest. On a phone that means three times the upload
and three times the mobile data. A relay removes this cost for the host. No quota counts it, but players
on Thai prepaid data plans will notice it.

---

## 2. Options compared

| | A. PeerJS + free cloud signalling (P2P WebRTC) | B. WebRTC + free STUN + TURN (Cloudflare / Metered / Open Relay) | C. Supabase Realtime Broadcast (relay) | D. Cloudflare DO + WebSockets (relay) |
|---|---|---|---|---|
| **Works behind CGNAT / mobile** | Only when ICE finds a direct path. Symmetric NAT and CGN break P2P, so TURN is needed ([MDN][mdn-proto], [RFC 7021 §3.1][rfc7021]). The current PeerJS source includes shared public TURN (`turn:eu-0/us-0.turn.peerjs.com:3478`, user `peerjs`/`peerjsp`) ([util.ts][peerjs-util]), with no published limits or SLA. The API docs still list STUN-only defaults ([Peer API][peerjs-peer]). | Good if the TURN server is reachable over TCP/TLS 443. Cloudflare offers TURN over UDP 3478, TCP 3478/80 and TLS 5349/443 ([CF TURN][cf-turn]). | Good: WSS/443 to Supabase servers, which relay every message ([Broadcast][sb-bcast]). | Good: WSS/443 to the nearest Cloudflare PoP (anycast), then to the DO. |
| **Latency** | Best when direct (one hop). With TURN, one relay hop. UDP-based; can be unordered/unreliable (`ordered:false`, `maxRetransmits`) ([MDN createDataChannel][mdn-dc]), so no head-of-line blocking on lossy mobile links. | Same as A. The CF relay is homed at the nearest PoP via anycast ([CF TURN FAQ][cf-turn-faq]). | Two hops (host → Supabase region → guest). TCP, so head-of-line blocking on packet loss. Pick the Singapore region. | Two hops (host → DO → guest). The DO is created near the first request, and `apac` location hints exist, but not every PoP hosts DOs ([DO data location][cf-do-loc]). TCP. *Not measured:* likely +20–60 ms vs a direct path from Thailand. Guests already run their own skills locally and interpolate enemies, so this is fine for PvE co-op. |
| **Free quota fit (50 h/month, 4p)** | Direct P2P costs nothing. Signalling is a few messages per join. The cloud server has no published quota and **no SLA**: recurring outage issues, and an open Oct 2025 issue reports 6+ min connect delays ([#1350][peerjs-1350], [#941][peerjs-941]). | **CF Realtime TURN:** 1,000 GB/month free, then $0.05/GB, billed on egress to the client ([CF pricing][cf-rt-price], [FAQ][cf-turn-faq]). Worst case, if every session were relayed, uses 35 GB, about 3.5% of the quota. Community reports say setup needs billing/credit card (unverified; the FAQ says no card is needed "initially"). Credentials must be minted server-side ([generate creds][cf-turn-creds]), so a free Worker is also needed. **Metered free:** 500 MB/month ([Metered pricing][metered-price]), about 42 min of worst-case relayed play. Next plan is $99/mo. **Open Relay:** page says 20 GB/month free, sign-up + API key required ([Open Relay][openrelay]). The Metered pricing page doesn't mention it, so treat it as unreliable. | ❌ **Does not fit.** Broadcast counts 1 sent + 1 per receiving client ([billing][sb-msgs]). One channel with everyone receiving: (15 + 80) × 4 = **380 counted msgs/s = 68 M/month vs 2 M free** (gone after ~88 min). Even an optimised layout (guests → host channel, 10 Hz): 120/s = 21.6 M/month (10× over). Egress 0.7 GB/h vs **5 GB/month** ([pricing][sb-pricing], [egress][sb-egress]). The 95 sends/s is also at the **100 msg/s** project limit ([limits][sb-limits]). Free projects pause after 1 week of inactivity. | ✅ **Fits.** Incoming WS messages are billed 20:1 and outgoing are free ([DO pricing][cf-do-price]): 95/20 = 4.75 req/s = **17.1 k req per room-hour**. Free: **100 k req/day**, so ~5.8 room-hours/day. Average 50 h/month ≈ 28.5 k/day (29%). Duration: 128 MB × 3,600 s = 450 GB-s per room-hour vs **13,000 GB-s/day**, so 28.9 room-hours/day. No egress charge on Workers ([Workers pricing][cf-w-price]). |
| **Room codes** | Custom peer ID = code. IDs must start and end alphanumeric; `-`/`_` allowed ([Peer API][peerjs-peer]). The cloud server's ID space is **shared by everyone** using the default key, so prefix it (`pxh-ABCD`) and show only `ABCD`. A taken ID gives `unavailable-id`. | Needs a separate signalling channel (PeerJS, or the DO from option D). TURN only relays. | Channel name = code. | `env.ROOM.idFromName(code)`: same code, same DO. A Worker can issue unused codes. |
| **Host disconnects** | The game ends. The host holds the whole sim, and the room ID disappears with the host peer. Guests detect it with a heartbeat timeout (the current code uses 5 s, `NET.lost>5`, line 1132) and `hostLost()` banks their gold. The host can't cleanly reclaim the same ID straight away (`unavailable-id` until the server drops it). | Same as A. | Channel persists and presence shows the leave. No server-side state, so the run is lost unless a guest was already simulating. | The **room persists.** The DO gets `webSocketClose` and can immediately broadcast `host-left`. It can keep a grace window so the host can reconnect after a Wi-Fi↔4G switch with the same code. It can also store the last snapshot or checkpoint, which makes host migration possible later. Deploying new Worker code disconnects all sockets ([DO WebSockets][cf-do-ws]). |
| **Ops / code cost** | Lowest: no server of ours. | Medium: needs a credential-minting endpoint and, for Cloudflare, possibly billing setup. | Low code, but the quota makes it unusable. | Medium: ~100–150 lines of Worker/DO TypeScript, deployed with `wrangler` on the free plan (SQLite-backed DO class, [DO limits][cf-do-limits]). |

---

## 3. Durable Object quota detail (the recommended option)

| Load | Incoming msgs/s | Billable req/s (÷20) | Req per room-hour | 4-player room-hours/day before the 100 k cap |
|---|---|---|---|---|
| Current protocol (15 Hz snapshot, 20 Hz presence, 6.67 Hz dmg) | 95 | 4.75 | 17,100 | **5.8** |
| Suggested: guests merge presence + damage into one 10 Hz message | 15 + 30 = 45 | 2.25 | 8,100 | **12.3** |
| 2 players, suggested protocol | 15 + 10 = 25 | 1.25 | 4,500 | 22.2 |

- When a free limit is exceeded, "further operations of that type will fail with an error". Limits
  reset at 00:00 UTC (07:00 Thailand time) ([DO pricing][cf-do-price]). The client should catch this and
  show "co-op server busy, try P2P" (the fallback).
- Monthly: 50 h × 17.1 k = 855 k requests, spread over days. Heavy days are the only risk, and the
  10 Hz batching halves it.
- The host snapshot is not fanned out as separate billable requests, because outgoing messages are free.
  A 4-player room is not much more expensive than a 2-player room.
- Upgrade path (not 0 THB): Workers Paid includes 1 M DO requests/month + $0.15/M
  ([DO pricing][cf-do-price]).

## 4. TURN detail (for the fallback)

Egress, if **every** session needed a relay (worst case): CF→guests 648 MB/h + CF→host 60.5 MB/h
≈ 0.71 GB/h, so 35.4 GB for 50 h.

| Provider | Free allowance | Worst-case relayed hours/month | Notes |
|---|---|---|---|
| Cloudflare Realtime TURN | 1,000 GB (shared with SFU) | ~1,400 h | Keep the key server-side, so a Worker is needed to mint credentials. Billing setup may be required (community report, unverified). |
| Open Relay (Metered) | "20 GB" per the project page | ~28 h (52 h typical) | Needs sign-up + API key. Not on the current Metered pricing page. |
| Metered free plan | 500 MB (ingress + egress) | ~0.7 h | Next tier is $99/mo. |
| PeerJS public TURN (`*.turn.peerjs.com`) | not published | unknown | Shared credentials hard-coded in the library. Best effort. |
| Hugging Face × Cloudflare (10 GB) | 10 GB with an HF token | — | Aimed at FastRTC (Python) and would expose the token to browsers. **Not suitable** ([HF blog][hf-fastrtc]). |

---

## 5. Recommendation

1. **Primary: Cloudflare Worker + Durable Object room relay (option D).**
   - `GET /new` → Worker picks a free 4–6 char code (A–Z minus ambiguous letters, 2–9). `GET /ws/:code` → `idFromName(code)` → DO.
   - The DO tracks role (`host`/`guest`), nickname and seat. It forwards host → all guests and guest → host only.
     Guest positions reach the other guests inside the host snapshot, not through fan-out.
   - The DO keeps the last host snapshot and a 15–30 s host-reconnect grace window, then broadcasts `room-closed`.
   - Protocol tweaks that make the quota comfortable: merge guest presence + damage into one 10 Hz
     message, and optionally send enemies as binary (`ArrayBuffer`) instead of base64 text.
   - Set `locationHint: 'apac'` when creating the DO, and measure RTT from AIS/True/dtac 4G in the
     first playtest.
2. **Fallback: PeerJS P2P (option A)** on the free cloud signalling server with default TURN.
   - Use it when the DO returns quota errors, or as a "Direct connect (beta)" toggle.
   - Prefix room IDs (`pxh-CODE`).
   - Open unordered data channels for snapshots (`ordered:false, maxRetransmits:0`) and reliable ones for damage/events.
   - If P2P often fails on mobile (measure with `getStats()`: selected candidate pair `relay` vs `srflx`/`host`), add Cloudflare TURN credentials from the same Worker.
3. **Do not use Supabase Realtime for gameplay.** Keep Supabase only for the planned leaderboard (a few writes per run).
4. Update `CLAUDE.md` → *Platform notes*: replace the "PeerJS (WebRTC)" row with "Cloudflare DO relay (PeerJS P2P fallback)", and rename `net/transport-peerjs.ts` to `net/transport-ws.ts` + `net/transport-peerjs.ts`.

### Open questions / not verified

- Where DOs for Thai players actually land (Singapore? Hong Kong?) and the real RTT. The docs only say
  "near the first request" and that not all locations host DOs.
- How often Thai carriers' CGNAT is symmetric, i.e. what share of P2P attempts would need TURN. No
  primary source found. Measure it in the playtest.
- Whether Cloudflare Realtime TURN can be enabled on an account with no payment method (FAQ vs
  community report disagree).
- Open Relay's current status: the project page says 20 GB free, but the Metered pricing page lists
  only a 500 MB free plan.

## Sources (checked 2026-09-24)

- `mdn-proto` — <https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Protocols> — NAT/STUN/TURN, symmetric NAT needs TURN
- `mdn-dc` — <https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createDataChannel> — `ordered`, `maxRetransmits`
- `rfc7021` — <https://www.rfc-editor.org/rfc/rfc7021.html> — CGN impact; P2P gaming failed under NAT444 (§3.1)
- `peerjs-util` — <https://github.com/peers/peerjs/blob/master/lib/util.ts> — default iceServers incl. `*.turn.peerjs.com`, `CLOUD_HOST 0.peerjs.com`
- `peerjs-peer` — <https://peerjs.com/client/api/peer> — ID rules, errors (`unavailable-id`, `peer-unavailable`), `reconnect()`
- `peerjs-dc` — <https://peerjs.com/client/api/data-connection> — `reliable`, `serialization`
- `peerjs-1350` — <https://github.com/peers/peerjs/issues/1350> — 0.peerjs.com 6+ min delays (Oct 2025, open)
- `peerjs-941` — <https://github.com/peers/peerjs/issues/941> — 0.peerjs.com down (2022)
- `cf-turn` — <https://developers.cloudflare.com/realtime/turn/> — TURN ports/protocols
- `cf-turn-faq` — <https://developers.cloudflare.com/realtime/turn/faq/> — pricing by egress, anycast, P2P use without SFU
- `cf-turn-creds` — <https://developers.cloudflare.com/realtime/turn/generate-credentials/> — server-side credential minting
- `cf-rt-price` — <https://developers.cloudflare.com/realtime/pricing/> — $0.05/GB, first 1,000 GB/month free (shared SFU+TURN)
- `cf-do-price` — <https://developers.cloudflare.com/durable-objects/platform/pricing/> — 100 k req/day, 13,000 GB-s/day, 20:1 WS ratio, outgoing free, 128 MB duration, free-limit errors
- `cf-do-limits` — <https://developers.cloudflare.com/durable-objects/platform/limits/> — Free plan = SQLite-backed DOs only, 32 MiB WS message, 1,000 req/s soft limit per object
- `cf-do-ws` — <https://developers.cloudflare.com/durable-objects/best-practices/websockets/> — hibernation, deploys disconnect sockets
- `cf-do-loc` — <https://developers.cloudflare.com/durable-objects/reference/data-location/> — placement near first request, location hints
- `cf-w-price` — <https://developers.cloudflare.com/workers/platform/pricing/> — no egress/bandwidth charges, 100 k req/day free
- `sb-limits` — <https://supabase.com/docs/guides/realtime/limits> — Free: 200 connections, 100 msg/s, 256 KB payload
- `sb-msgs` — <https://supabase.com/docs/guides/platform/manage-your-usage/realtime-messages> — broadcast counts sender + each receiver
- `sb-pricing` — <https://supabase.com/pricing> — Free: 2 M messages, 200 peak connections, 5 GB egress, pause after 1 week
- `sb-egress` — <https://supabase.com/docs/guides/platform/manage-your-usage/egress> — egress includes Realtime
- `sb-bcast` — <https://supabase.com/docs/guides/realtime/broadcast> — all broadcasts relayed via Supabase servers
- `metered-price` — <https://www.metered.ca/pricing> — Free 500 MB/month; Growth $99/mo 150 GB
- `openrelay` — <https://www.metered.ca/tools/openrelay/> — "20 GB free TURN usage every month", ports 80/443, API key
- `hf-fastrtc` — <https://huggingface.co/blog/fastrtc-cloudflare> — 10 GB/month TURN via HF token (FastRTC)

[mdn-proto]: https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Protocols
[mdn-dc]: https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/createDataChannel
[rfc7021]: https://www.rfc-editor.org/rfc/rfc7021.html
[peerjs-util]: https://github.com/peers/peerjs/blob/master/lib/util.ts
[peerjs-peer]: https://peerjs.com/client/api/peer
[peerjs-dc]: https://peerjs.com/client/api/data-connection
[peerjs-1350]: https://github.com/peers/peerjs/issues/1350
[peerjs-941]: https://github.com/peers/peerjs/issues/941
[cf-turn]: https://developers.cloudflare.com/realtime/turn/
[cf-turn-faq]: https://developers.cloudflare.com/realtime/turn/faq/
[cf-turn-creds]: https://developers.cloudflare.com/realtime/turn/generate-credentials/
[cf-rt-price]: https://developers.cloudflare.com/realtime/pricing/
[cf-do-price]: https://developers.cloudflare.com/durable-objects/platform/pricing/
[cf-do-limits]: https://developers.cloudflare.com/durable-objects/platform/limits/
[cf-do-ws]: https://developers.cloudflare.com/durable-objects/best-practices/websockets/
[cf-do-loc]: https://developers.cloudflare.com/durable-objects/reference/data-location/
[cf-w-price]: https://developers.cloudflare.com/workers/platform/pricing/
[sb-limits]: https://supabase.com/docs/guides/realtime/limits
[sb-msgs]: https://supabase.com/docs/guides/platform/manage-your-usage/realtime-messages
[sb-pricing]: https://supabase.com/pricing
[sb-egress]: https://supabase.com/docs/guides/platform/manage-your-usage/egress
[sb-bcast]: https://supabase.com/docs/guides/realtime/broadcast
[metered-price]: https://www.metered.ca/pricing
[openrelay]: https://www.metered.ca/tools/openrelay/
[hf-fastrtc]: https://huggingface.co/blog/fastrtc-cloudflare
