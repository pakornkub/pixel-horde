# Pixel Horde — project guide for Claude Code

Retro pixel-art, top-down (Game Boy Pokémon-style camera) survivor game: survive each stage's timer
while hordes swarm the player, skills auto-fire, level up to pick upgrades. Built originally as a
single self-contained HTML file (`pixel-horde.html`, ~1,750 lines, vanilla JS + Canvas 2D, no deps).

## Working with the owner
- **Talk to the owner in Thai.** Keep code, identifiers, file names, commit messages and glossary terms in English.
- Explain simply, with examples; interactive widgets/visuals are welcome for anything non-trivial.
- The owner decides design questions; ask with a recommended option first.
- Current plan: Blueprint `docs/blueprint/pixel-horde-blueprint.md` → spec `.scratch/pixel-horde-web-v1/spec.md`
  → 44 implementation tickets in `.scratch/pixel-horde-web-v1/issues/` (start with 01; follow each ticket's "Blocked by").

## Goals of the migration
1. Split the single file into a typed, modular codebase (Vite + TypeScript, no framework).
2. Move off Claude-artifact-only APIs so the game can be hosted anywhere (itch.io / GitHub Pages)
   and anyone with the link can play co-op.
3. Keep gameplay identical first (port → then refactor → then new features).

## Platform notes (important)
The artifact version uses `window.claude.use('room' | 'db' | 'user')`. These do NOT exist outside
Claude artifacts. Replace them:
| Artifact API | Used for | Replacement |
|---|---|---|
| `room` presence + `emit('dmg')` | co-op sync | Cloudflare Worker + one Durable Object per room (WebSocket relay), host-authoritative sim; room code = DO name (4–6 chars). Fallback: PeerJS P2P + Cloudflare TURN. Both behind `net/transport.ts` |
| `user.profiles()` | player names | Supabase anonymous Player Account with nickname; can link Google later |
| `db` collection `scores` | leaderboard | Supabase, written only via server-side RPC (never direct table writes) |
Backend calls go through a single `net/backend.ts` (Supabase Free; fallback Cloudflare Workers + D1).
Hosting: Cloudflare Pages (game + separate Admin Console behind Cloudflare Access), mirrored on itch.io.
The game must stay fully playable solo offline with the built-in default Balance Config.
Meta progression already uses `localStorage` key `pixelhorde-meta` → keep as local cache/offline save. Best score key: `pixelhorde-best`.
Decisions and research: `.scratch/pixel-horde-web/map.md`, `docs/research/`.

## Structure (decided in ticket 11, `.scratch/pixel-horde-web/issues/11-*.md`)
npm workspaces:
```
apps/game/       # browser client: main.ts (fixed-step 60 tick loop), platform/input, render/, audio/, ui/ (DOM), net/
                 #   net/backend.ts (Supabase | offline adapters), net/transport.ts (PartyServer WS | PeerJS adapters), host.ts guest.ts
apps/admin/      # Admin Console (Preact + uPlot), shares packages/config
packages/sim/    # HEADLESS deterministic sim: createSim(...) -> step(inputFrame, commands) / view() / score() / hash()
                 #   core/rng.ts (seeded, named streams) core/fmath.ts, data/, systems/ (spawner, director, combat hit()/killE(),
                 #   skills/, combos, hazards, kings, guardians, rival), sprites stay in apps/game
packages/config/ # Balance Config zod schema (defaults + ranges + descriptions) and feature-flag schema
packages/i18n/   # th.json / en.json + t()
workers/room/    # Cloudflare Worker + Durable Object co-op room (PartyServer)
supabase/        # migrations, RLS, RPC (submit_run, run token), pg_cron jobs
tests/           # Vitest headless sim + golden replay; Playwright cross-browser determinism
```
Rules: every tunable number lives in the Balance Config schema (`packages/config`). All damage to enemies MUST go
through `hit()`; all damage to the player MUST go through `hurtP()`. `packages/sim` must never import DOM/Canvas/network,
`Math.random`, `Math.sin/cos/atan2/hypot/pow/exp/log`, `Date.now` or `performance.now` (ESLint-enforced); rendering
uses its own `fxRng`. Port order: move code with identical gameplay + determinism foundations → headless tests and
golden replay → backend/admin/co-op → new features.

## State machine
`title → play ⇄ (levelup | chest | pause) → clearing → clear → play(next stage) … → over`
(+ `joining` for co-op guests). Level-up and chest ALWAYS pause the sim; in co-op the whole room
waits while anyone is choosing (host phase `wait`).

## Core rules & balance (current values)
- Render: low-res buffer (≈190 px on short side, integer scale), world tiles 16×16, UI/HUD and
  damage numbers drawn on the hi-res canvas with "Press Start 2P" (+ "Chakra Petch" for Thai).
- Stage duration: `min(150, 60 + 20*(stage-1))` s. Boss at 55% of the stage.
- Themes cycle every 4 stages: grass → desert → cave → snow (own tiles, 3 mobs, boss each).
- Enemy HP: `base * 1.5^(stage-1) * (1 + 0.7*progress) * (1 + 0.08*(playerLv-1)) * (0.85 + 0.15*director)`.
- Enemy dmg: `base * 1.18^(stage-1) * (1 + 0.5*progress) * (1 + 0.015*(playerLv-1))`, each hit ±15%.
- Spawn rate/s: `(1.4 + 3.4*progress) * (1 + 0.35*(stage-1)) * (1 + 0.6*aliveMates) * (BloodMoon?2.3:1) * director`.
  Swarm ring every 18 s (10 s in Blood Moon). Enemy cap ≈ 320.
- Director: 0.7–2.4. Rises +0.06/s when HP>75% and not hurt for 6 s; −0.2/s when HP<40%.
- Player bonuses are ADDITIVE with caps: dmg = 1 + 0.2·Might + 0.08·Power(shop) + Mage 0.15;
  cooldown reduction cap 40% (Haste 8%/lv, Alchemist 10%); crit cap 50%, critMul 2.0 + 0.2/lv.
- XP to next level: `5 + 4lv + 0.5lv² + 1.4·max(0, lv-8)²`.
- 12 skills (6 attack slots max), 6 passives, 12 evolutions (max-level skill + paired passive).
- Characters: Mage (bolt, +15% dmg), Knight (orbit, +50 HP, −8% speed), Ranger 150G (lance, +15% speed,
  +30% pickup), Alchemist 300G (toxic, −10% CD, +5% crit).
- Shop (permanent, localStorage): Power, Vigor, Agility, Greed, Wisdom, Second Wind (revive).
- Counter enemies: Wild Boar (telegraphed charge, st≥2), Eye Caster (ranged, st≥3),
  Armored variant (flat damage reduction `10*1.4^(st-1)*(1+0.05*(lv-1))`, st≥3), Split Slime (st≥4).
- Special events (run-only rewards):
  - Blood Moon stage: from stage 2, 10% + 6% per miss (pity). Spawns ×2.3, coins ×2, bonus chest.
  - Inferno Dragon inside Blood Moon: stage ≥3, 25% + 15% per miss. Telegraphed breath cone / dash
    line / fireball rain / summon whelps. Reward: pet fire dragon (breath + dive bomb), stacks levels.
  - Shadow Rival: 25% on normal stages ≥2, 35 s to kill, uses 3 of 5 player-like skills (all
    telegraphed). Reward: 35% Shadow Clone else a shard (3 shards = clone). Clone repeats
    bolt/lance/boomer/chain/nova/meteor casts at 35–60% damage.
- Chest wheel: 8 cells [1,2,1,3,1,2,1,2], result weights 1:50% 2:35% 3:15%.

## Co-op protocol (host-authoritative)
- Host simulates everything and broadcasts ~15 Hz: stage, time, phase (`play|wait|pause|clear|over`),
  team XP + kill counters, boss/dragon/rival HP %, hazard list, and packed enemies:
  11 chars each = id(3) type(1) flags(1: elite=1, armor=2) x(3) y(3) in base64 relative to host pos.
- Guests: interpolate enemies, run their OWN skills locally, send aggregated damage `[id, dmg, …]`
  every 150 ms; take contact/hazard damage locally; gain team XP/kills/gold from deltas.
- Guest presence: position, hp, lv, down, facing, char, `sel` (choosing upgrade), pet.

## Testing
The original was verified with a headless Node harness (stubbed DOM/canvas, fake room hub for two
clients). Recreate it with Vitest: seed the RNG, run N minutes of sim with a scripted bot, assert
no exceptions, stage progression, hazards hitting, rewards granted, packet sizes < 4 KB.
Add debug flags (URL `?debug=dragon|rival|bloodmoon|god`) to force events.

## Backlog
Superseded by the v1 tickets in `.scratch/pixel-horde-web-v1/issues/` (see "Working with the owner").
The in-game meter (press **I**: DPS, TTK, multipliers, director, mob count) stays useful for balance passes.

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/` (committed to the repo; GitHub Issues are not used). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root (created lazily). See `docs/agents/domain.md`.
