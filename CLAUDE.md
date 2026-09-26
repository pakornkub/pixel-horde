# Pixel Horde — project guide for Claude Code

Retro pixel-art, top-down (Game Boy Pokémon-style camera) survivor game: survive each stage's timer
while hordes swarm the player, skills auto-fire, level up to pick upgrades. Built originally as a
single self-contained HTML file (`pixel-horde.html`, ~1,750 lines, vanilla JS + Canvas 2D, no deps).

## Working with the owner
- **Talk to the owner in Thai.** Keep code, identifiers, file names, commit messages and glossary terms in English.
- Explain simply, with examples; interactive widgets/visuals are welcome for anything non-trivial.
- The owner decides design questions; ask with a recommended option first.
- Plan so far: Blueprint `docs/blueprint/pixel-horde-blueprint.md` → spec `.scratch/pixel-horde-web-v1/spec.md`
  → 44 implementation tickets in `.scratch/pixel-horde-web-v1/issues/`. The code for all 44 is in; most wait for an
  owner playtest / review or an owner-only setup step (see each ticket's **Status**). New work gets new tickets.
- Player-facing docs: the official website `apps/site` (served at `/`, the game at `/play/`) and `README.md` /
  `README.th.md`. When gameplay changes, check the site's own sentences in `apps/site/src/text.ts` (names and sprites come
  from the code; numbers from the live Balance Config via `apps/site/src/backend.ts`, built-in defaults when offline) and re-take screenshots with `npm run shots` if the look changed.

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
Hosting: Cloudflare Pages project `pixel-horde` serves the website at `/` and the game at `/play/`
(`npm run build:pages` → `dist/pages`); the Admin Console is a separate Pages project behind Cloudflare Access.
Old root links (`/?join=…`, OAuth returns, `#draftcfg=`, `?debug=`) are forwarded to `/play/` by the site's index.html.
The game must stay fully playable solo offline with the built-in default Balance Config.
Meta progression already uses `localStorage` key `pixelhorde-meta` → keep as local cache/offline save. Best score key: `pixelhorde-best`.
Decisions and research: `.scratch/pixel-horde-web/map.md`, `docs/research/`.

## Structure (decided in ticket 11, `.scratch/pixel-horde-web/issues/11-*.md`)
npm workspaces:
```
apps/game/       # browser client: main.ts (fixed-step 60 tick loop), platform/input, render/, audio/, ui/ (DOM), net/
                 #   net/backend.ts (Supabase | offline adapters), net/transport.ts (PartyServer WS | PeerJS adapters), host.ts guest.ts
apps/admin/      # Admin Console (Preact + uPlot), shares packages/config
apps/site/       # official website (vanilla TS, multi-page: home, guide, skills, world). Imports game data from
                 #   packages/sim + packages/i18n and sprites/tiles from apps/game/src (read-only); own text in src/text.ts
packages/sim/    # HEADLESS deterministic sim: createSim(...) -> step(inputFrame, commands) / view() / score() / hash()
                 #   core/rng.ts (seeded, named streams) core/fmath.ts, data/, systems/ (spawner, director, combat hit()/killE(),
                 #   skills/, combos, hazards, kings, guardians, rival), sprites stay in apps/game
packages/config/ # Balance Config zod schema (defaults + ranges + descriptions) and feature-flag schema
packages/i18n/   # th.json / en.json + t()
packages/coop/   # co-op room relay rules (pure), shared by the room Durable Object and the in-memory test/offline hub
workers/room/    # Cloudflare Worker + Durable Object co-op room (PartyServer)
workers/keepalive/ # daily ping so the Supabase Free project is never paused
supabase/        # migrations, RLS, RPC (submit_run, run token), pg_cron jobs
tests/           # Vitest headless sim + golden replay; Playwright cross-browser determinism
```
Rules: every tunable number lives in the Balance Config schema (`packages/config`). All damage to enemies MUST go
through `hit()`; all damage to the player MUST go through `hurtP()`. `packages/sim` must never import DOM/Canvas/network,
`Math.random`, `Math.sin/cos/atan2/hypot/pow/exp/log`, `Date.now` or `performance.now` (ESLint-enforced); rendering
uses its own `fxRng`. Port order: move code with identical gameplay + determinism foundations → headless tests and
golden replay → backend/admin/co-op → new features.

## State machine
`title → play ⇄ (levelup | chest | pause | revive) → clearing → clear → route → play(next Chapter) … → victory | over`
(sim `Phase` in `packages/sim/src/types.ts`; `victory` = Umbra defeated → Endless or finish; `+ joining` for co-op guests). Solo: level-up and chest pause the sim. Co-op: they never stop the
room — the choosing player stands in a shield bubble (no damage, monsters pushed out) and a pick is
made for them after `coop.pickTime` (10 s). Rewards still waiting when a Stage ends (the King's
vacuumed chest, the Blood Moon bonus chest, pending level-ups) open during `clearing`, before the
clear screen — never at the next Stage start.

## Core rules & balance (current values)
- Render: low-res buffer (≈190 px on short side, integer scale), world tiles 16×16, UI/HUD and
  damage numbers drawn on the hi-res canvas with "Press Start 2P" (+ "Chakra Petch" for Thai).
  Settings "Camera distance" (×1 / 1.25 / 1.5) only zooms the picture out: the sim always gets the zoom-1 view
  (`screen.RW × RH`), so auto-aim "on screen", Ultimate reach and spawn distance never change with it.
- Stage duration: `min(150, 60 + 20*(stage-1))` s. King at 55% of the stage.
- A Run = 8 Chapters (one Stage each): Greenvale → pick 1 of 2 Realms (Chapters 2–7) → Heart Crater (Umbra).
  11 Realms (`packages/sim/src/content/lumora/realms.ts`): own tiles, 3 mobs, King, traits and a resisted element (−50%).
  Difficulty follows the Chapter number, not the Realm. A Chapter clears only when its King dies; after the timer
  comes 45 s of overtime, then the King **escapes** (no King rewards, Umbra stronger, one re-pick for that Chapter).
- Kings: 2 telegraphed moves + an ultimate below 50% HP (`KING_KITS`). Umbra: 3 phases (shadow skills → stolen King
  ultimates below 66% → darkened heart below 33%). Beating Umbra → Endless mode and Heart Crack tiers 1–3.
- Enemy HP: `base * 1.5^(stage-1) * (1 + 0.7*progress) * (1 + 0.08*(playerLv-1)) * (0.85 + 0.15*director)`.
  `scaling.lvCapBase/lvCapPerCh` (2026-09b) cap the counted playerLv at `base + perCh*(stage-1+progress)` for HP, damage and armor.
- Enemy dmg: `base * 1.18^(stage-1) * (1 + 0.5*progress) * (1 + 0.015*(playerLv-1))`, each hit ±15%.
- Spawn rate/s: `(1.4 + 3.4*progress) * (1 + 0.35*(stage-1)) * (1 + 0.6*aliveMates) * (BloodMoon?2.3:1) * director`.
  Swarm ring every 18 s (10 s in Blood Moon). Enemy cap ≈ 320.
- Director: 0.7–2.4. Rises +0.06/s when HP>75% and not hurt for 6 s; −0.2/s when HP<40%.
- Player bonuses are ADDITIVE with caps: dmg = 1 + 0.2·Might + 0.08·Power(shop) + Lyra 0.10;
  cooldown reduction cap 40% (Haste 8%/lv, Vex 8%); crit 8% base + Keen Eye 7%/lv, cap 50%; critMul 2.0 + 0.2/lv.
- XP to next level: `5 + 4lv + 0.5lv² + 1.4·max(0, lv-8)²`.
- Skills: 12 general + 4 Signature (one per Hero, locked slot) + 12 Skill Line skills (after Awakening).
  4 attack slots (1 = Signature), 3 passive slots, Bench 1 (+1 after Chapters 2 and 4; holds Skills and, once the passive slots are full, passives). 6 passives,
  16 Evolutions (max-level skill + paired passive). Awakening: evolved Signature + 2 of 3 max Links equipped ≥1 Stage;
  version 0 consumes the 2 Links, `awaken.keep` + `awaken.slots` (2026-09b) keep them and add a 5th attack slot (`attackSlots()`).
- When too few upgrades are left, level-ups and chests fill up to 3 cards from `overflow` (ticket 47): Limit Break
  (+4% dmg / +5% max HP / +3% speed / +2% crit per pick, 10 each), train a Bench entry +1, Gold bag 25G × Chapter,
  Recover (only when hurt). The reroll draws a new set.
- Statuses (Frozen, Gathered, Burning, Shocked, Poisoned) + 7 Combos (Shatter, Firestorm, Overload, Superconduct,
  Toxic Burst, Grinder, Catalyst); tags in `packages/sim/src/data/skills.ts`, logic in `systems/combos.ts`.
- Heroes: Lyra/Mage (Arcane Sigil, +10% dmg, free), Bram/Knight (Holy Shield, +40 HP, −5% speed, free),
  Kit/Ranger 500G (Hawk Companion, +12% speed, +30% pickup; `skills.hawk.guardN` = Hawk defends Kit when crowded), Vex/Alchemist 1000G (Volatile Flask, −8% CD, Statuses +20%).
- Ultimate: gauge fills in 60 s (kills up to 2× faster), damage tied to the Chapter's mob HP, capped at 8% of a boss
  (Umbra 5%). 11 Weapons change only its form (default Judgement); a King drops its Realm's Weapon at 5%.
- Shop (permanent): Power, Vigor, Agility, Greed, Wisdom, Second Wind (revive). A revive can also be bought in a Run
  (75G × Chapter, once, −15% Score).
- Counter enemies: Armored variant (flat damage reduction `10*1.4^(st-1)*(1+0.05*(lv-1))`, st≥3), Split Slime (st≥4,
  and st≥2 in `split` Realms). Wild Boar / Eye Caster spawn only while `charger.on` / `caster.on` are 1 (default 0);
  Realm mobs (Skeleton Archer, Turret, Sawfish, Griffin…) now cover ranged and charging.
- Special events, Chapters 2–7 only (run-only rewards):
  - Blood Moon: 10% + 6% per miss (pity). Spawns ×2.3, coins ×2, bonus chest. Never announced in advance.
  - Guardian dragon inside Blood Moon (Inferno / Frost / Storm): Chapter ≥3, 25% + 15% per miss; after the first one,
    Realms whose element is still missing favour Blood Moon ×2 and a Guardian 60%. Beaten = Companion (1 active +
    2 stored, levels 1–5); all three in one Run can fuse into the Three-headed Dragon.
  - Shadow Rival: 25% on normal Stages, 35 s to kill, uses 3 of 5 player-like skills (all
    telegraphed). Reward: 35% Shadow Clone else a shard (3 shards = clone). Clone repeats
    bolt/lance/boomer/chain/nova/meteor casts at 35–60% damage.
  - Double King: Chapters 4–7, 10%, never announced; the second King is the skipped Realm's, each at 70% HP.
- Chest wheel: 8 cells [1,2,1,3,1,2,1,2], result weights 1:50% 2:35% 3:15%. A King gives ONE chest (the wheel,
  `economy.kingChest`); it drops no chest item (its Gold rides on the King coin). Skill Points come only
  from Kings — they are not sold for Gold at the Stage end. Bench skills can be removed for free at the
  Stage end. Owner switches in the Admin bring the old rules back: `loot.kingChestItem` (1 = the chest
  item too), `economy.spShop` (1 = buy Skill Points), `bench.discard` (0 = no removing), `bench.passives` (0 = no new passives once the slots are full).

## Co-op protocol (host-authoritative)
- Host simulates everything and broadcasts ~15 Hz: stage, time, phase (`play|wait|pause|clear|route|victory|over`),
  team XP + kill counters, boss/dragon/rival HP %, hazard list, and packed enemies:
  11 chars each = id(3) type(1) flags(1: elite=1, armor=2) x(3) y(3) in base64 relative to host pos.
- Guests: interpolate enemies, run their OWN skills locally, send aggregated damage `[id, dmg, …]`
  every 150 ms; take contact/hazard damage locally; gain team XP/kills/gold/chests from deltas.
- Drops are shared ("help each other collect"): the host owns them and sends them packed in the
  snapshot (7 chars each); anyone standing picks them up (guests at their reported position);
  EXP, Gold and chests go to the whole team; a heart heals and a Shield pickup guards the picker + allies within `coop.heartShare`.
- Kings aim their moves at the nearest standing player (never at a downed host).
- Guest presence: position, hp, lv, down, facing, char, `sel` (choosing upgrade), pet, `pk` (pickup radius).

## Testing
`npm run check` = lint + typecheck + Vitest + builds. Vitest (`tests/`) runs the headless sim with a scripted bot
(`tests/bot.ts`), golden replays, determinism, co-op hubs and the database (PGlite); Playwright (`tests/browser/`)
drives the built game and Admin in Chromium/Firefox/WebKit (golden replay, title, save, route, co-op, Admin draft…). Game URL flags: `?offline` (no backend) and
`?debug=god|bloodmoon|dragon|frostdragon|stormdragon|rival|realm:<id>` (comma separated) to force events.
Balance passes: `npm run playtest` (scripts/playtest, a human-like bot with damage/death attribution; see its README).
Recommended tuning lives in `packages/config/src/balance-pass.ts` (patch + Thai report; the report is stored with the
published version in `config_reports` and shown in Admin → Balance → รายงาน) and is published from Admin → Balance, never by
changing built-in defaults (version 0 must equal the migration seed). Difficulty presets (`packages/config/src/presets.ts`)
scale the published config for solo Runs; their multipliers (and whether each is offered) are Balance Config fields
`shared.presets.*`, tuned from Admin → Balance; only `balanced` is ranked.
Changelog (patch notes, `packages/config/src/changelog.ts`, table `changelog`): every config publish writes a `balance`
entry (player-facing lines from the pass's `changelog`, else auto-generated from the diff); every code release that players
would notice gets an entry in Admin → อัปเดตเกม (kind feature/fix/content/system, lines per category, Thai + English).
The website's `updates.html` reads public entries via `get_changelog`.

## Backlog
Superseded by the v1 tickets in `.scratch/pixel-horde-web-v1/issues/` (see "Working with the owner").
The in-game meter (press **I**: DPS, TTK, multipliers, director, mob count) stays useful for balance passes.
A daily cloud routine triages the live error list + player feedback (`docs/agents/triage-routine.md`): clear bugs →
PR, owner decisions → Admin → งานแก้ไข (`public.work_items`, written only via `agent_report`). Client errors are not
recorded from dev / local hosts; known browser noise is filtered in `apps/game/src/telemetry.ts`.

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/` (committed to the repo; GitHub Issues are not used). See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root (created lazily). See `docs/agents/domain.md`.
