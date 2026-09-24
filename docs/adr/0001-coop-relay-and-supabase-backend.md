# Co-op goes through a Cloudflare Durable Object relay; accounts and scores live in Supabase

Date: 2026-09-24 · Status: accepted

The original migration plan (`CLAUDE.md`) said co-op would use PeerJS peer-to-peer WebRTC. We chose a Cloudflare Worker with one Durable Object per room, relaying WebSocket messages, with PeerJS + Cloudflare TURN kept as a fallback behind the same `net/transport.ts` interface. Players are mostly on Thai mobile networks behind CGNAT, where direct P2P often fails and needs TURN anyway; the free PeerJS cloud server has no SLA; and a P2P host must upload a separate stream to every guest (up to ~648 MB/h worst case). A WSS relay on port 443 works on every network, the room code maps directly to a Durable Object name, and the room survives a host disconnect. The cost is a hard free-quota ceiling (~100k requests/day ≈ 6–12 four-player room-hours per day, reset 07:00 Thai time); past it co-op is unavailable for the day and the game says so.

Supabase Realtime Broadcast was rejected for co-op: it bills every receiver, so four players exhaust the monthly free quota in about 88 minutes. Supabase Free is still the backend for Player Accounts (anonymous, later linked to Google), scores, Balance Config and statistics, because it provides anonymous auth with identity linking, RLS, RPC and cron without us writing auth. Cloudflare Workers + D1 is the fallback, reached through a single `net/backend.ts`.

Evidence: `docs/research/02-free-backend-database.md`, `docs/research/03-coop-transport.md`. Assumptions still to verify are in ticket 17 of `.scratch/pixel-horde-web/`.
