# Spec: Pixel Horde web v1

Status: ready-for-agent

Source of truth for every decision below: `docs/blueprint/pixel-horde-blueprint.md` (Blueprint 1.0) and the resolved wayfinder tickets in `.scratch/pixel-horde-web/issues/` (cited as `#NN`). Vocabulary follows `CONTEXT.md`; architecture follows `CLAUDE.md` and ADR-0001. All tunable numbers below are *defaults* that live in the Balance Config.

## Problem Statement

Pixel Horde is a fun horde-survivor that only exists as one 1,758-line HTML file running inside a Claude artifact. Its co-op, player names and leaderboard depend on `window.claude`, so they silently vanish anywhere else. There is no story or ending, the difficulty curve collapses mid-run (playtesters let the game play itself and only died to the dragon or Shadow Rival), the Ultimate fires every ~16 s and clears the whole screen including bosses, characters barely differ, and progress lives only in one browser's localStorage where it can be edited or lost. The owner wants to turn it into a serious free web game: hosted publicly, playable on desktop and mobile in Thai and English, with accounts, cloud saves, seasonal leaderboards, co-op with friends by room code, and an Admin Console to tune and monitor the live game — all on free tiers (0 THB).

## Solution

Port the game into a typed, modular codebase whose heart is a headless deterministic simulation, then build Blueprint 1.0's v1 scope on top of it:

- A story campaign in the World of Lumora: 8 Chapters per Run through a branching route of 10 Realms to the Heart Crater and Umbra, with Kings that must die, Escapes that strengthen Umbra, an ending, Endless Mode and Heart Crack tiers 1–3.
- Skill system v2 (4 attack slots incl. a Signature Skill, 3 passives, Bench, Links → Awakening, elemental Combos, counter-play per Realm), four distinct Heroes, Guardian dragons as levelling Companions that can fuse into the Three-headed Dragon, Weapons that reshape a rebalanced Ultimate.
- An in-run and permanent economy around Gold, Skill Points, King rewards and a permanent Shop.
- Player Accounts (anonymous → Google), server-counted Gold, cloud suspend/resume, arcade Score, seasonal leaderboards with cosmetic rewards, achievements, Titles and a bestiary.
- Co-op for 2–4 players on a Cloudflare Durable Object relay.
- An Admin Console (control-room home, tuning-lab balance editor) plus basic statistics, backed by Supabase with anti-cheat tiers 0–1.
- A title screen, first-login flow and contextual tutorial; pixel art hand-authored as character rows at Pokémon Red/Blue detail level in full color, ZzFX sound and ZzFXM music.

## User Stories

### Playing a Run
1. As a player, I want to only move while my Skills fire automatically, so that the game stays easy to pick up.
2. As a player, I want each Run to be 8 Chapters of about 20 minutes total, so that a full Run fits a single sitting on web or mobile.
3. As a player, I want Chapter 1 to always be Greenvale and Chapter 8 to always be the Heart Crater, so that every Run has a clear start and finale.
4. As a player, I want to choose 1 of 2 unvisited Realms for Chapters 2–7, so that each Run follows a route I pick.
5. As a player, I want the route screen to show each Realm's traits, resisted element and which Skills have the advantage, so that I can plan my build.
6. As a player, I want difficulty to follow the Chapter number rather than the Realm, so that any route is fair.
7. As a player, I want each Stage to last `min(150, 60+20·(n−1))` seconds with its King appearing at 55%, so that pacing matches the current game.
8. As a player, I want a Stage to clear only when its King dies, so that each Chapter ends with a real boss fight.
9. As a player, I want ~45 s of overtime with an enraged King when the timer ends, so that I get a last chance to win.
10. As a player, I want a King that survives overtime to Escape, costing me its rewards and making Umbra stronger (HP +15% and that King's ultimate), with dialogue telling me so, so that Escapes have visible consequences.
11. As a player, I want to pick another Realm for the same Chapter once after an Escape, so that one failure does not end my Run.
12. As a player, I want off-screen arrows with the boss's icon pointing to Kings, Guardians, Shadow Rivals and Umbra, and the spawn banner to name the direction, so that I always know where the boss is.
13. As a player, I want a boss HP bar on screen while a boss lives, so that I can track the fight.
14. As a player, I want Blood Moon, Guardian, Shadow Rival and double-King Stages to appear only in Chapters 2–7 and never be announced in advance, so that they stay exciting.
15. As a player, I want a guaranteed new Weapon when I defeat Umbra (or 500 Gold if I own them all) before being asked whether to continue, so that choosing is never a loss.
16. As a player, I want to continue into Endless Mode with everything I have, so that a strong build can keep going.
17. As a player, I want my main-mode Score recorded at the moment I beat Umbra, so that dying in Endless never costs me that rank.
18. As a player, I want death (including in Endless) to end the Run, bank my Gold and return me to the title, so that the roguelite loop stays clear.
19. As a player, I want Heart Crack tiers 1–3 unlocked by winning, so that I have a harder goal after my first victory.

### Skills, Heroes and progression inside a Run
20. As a player, I want 4 attack slots (one locked to my Hero's Signature Skill), 3 passive slots and a Bench, so that builds are focused instead of stacking everything.
21. As a player, I want the Bench to start with 1 slot and gain one after clearing Chapters 2 and 4, so that I learn it gradually.
22. As a player, I want level-ups to offer 3 choices and to let a new Skill go into the Bench when attack slots are full, so that I can prepare counters.
23. As a player, I want benched Skills to keep their level but not be offered upgrades, so that the Bench cannot become a power farm.
24. As a player, I want to swap between Bench and attack slots only at Stage end for 20 × Chapter Gold (doubling for a second swap), so that swapping is a considered choice.
25. As a player, I want the 12 existing Evolutions (max Skill + paired Passive) to remain, so that my existing knowledge still pays off.
26. As a player, I want my Signature Skill to Evolve with my Hero's passive and later Awaken when it is evolved and 2 of my 3 Skill Line Links have been max level and equipped for a full Stage, so that Awakening rewards Skills I actually used.
27. As a player, I want the Awakening prompt at Stage end to warn that declining forfeits it for this Run, so that I understand the trade.
28. As a player, I want Awakening to consume my two Links, transform my Signature Skill and unlock my Hero's 3 Skill Line skills starting at level 1, so that my playstyle changes.
29. As a player, I want Skills to leave Statuses (Frozen, Gathered, Burning, Shocked, Poisoned) and other elements to trigger Combos automatically (Shatter, Firestorm, Overload, Superconduct, Toxic Burst, Grinder, Catalyst), so that mixing Skills is rewarding without extra input.
30. As a player, I want a big Combo name and sound when one triggers, so that it feels satisfying.
31. As a player, I want level-up cards labelled "combos with Frost" or "counts as a Link", so that I don't need to memorise the system.
32. As a player, I want Realm mobs to follow the Realm's traits and resist its element by 50%, so that counter-play matters.
33. As a player, I want Skill Points from bosses to spend on reroll (1), banish (1) or +1 level to a chosen Skill (2), and to buy more with Gold (30 × Chapter), so that I can steer a build.
34. As a player, I want the Ultimate to charge mainly over time (full in 60 s, kills can at most double the rate), deal damage relative to that Chapter's mob HP without player bonuses, and be capped at 8% of a King's or Guardian's HP (5% for Umbra), so that it is a panic button rather than a boss killer.
35. As a player, I want mid-game pressure (Chapters 4–7) to force me to dodge every 10–15 s, so that I cannot win by letting the game play itself.
36. As a player, I want a buyable revive once per Run for 75 × Chapter Gold, separate from Second Wind, so that I can save a good Run.

### Heroes, Weapons and Companions
37. As a player, I want to choose Lyra, Bram, Kit or Vex, each with a distinct role, Signature Skill, Awakened form and stat bonus, so that each Hero plays differently.
38. As a player, I want Lyra and Bram free and Kit (500 Gold) and Vex (1,000 Gold) unlockable, so that I have early goals.
39. As a player, I want to pick one owned Weapon before a Run that changes only my Ultimate's form (and leaves a Status), never my stats, so that Weapons add variety without breaking fairness.
40. As a player, I want a Weapon found mid-Run to be offered as a free switch at the next Stage end, so that I can try it immediately.
41. As a player, I want defeated Guardians (Inferno, Frost, Storm) to become Companions with 1 active and 2 stored slots, swappable at Stage end, so that I can match my Companion to the next Realm.
42. As a player, I want Companions to level 1–5 via a level-up card, 2 Skill Points or by defeating the same Guardian again, unlocking a second move at level 3 and a grown form at level 5, so that investing in them is a real choice.
43. As a player, I want Companion attacks to leave Statuses and trigger Combos with my own Skills, so that they fit my build.
44. As a player, I want the option to fuse all three Guardians defeated in one Run into the Three-headed Dragon at Stage end, so that I can chase a legendary moment.
45. As a player, I want missing Guardians to become likelier after I find the first one, so that a fusion is achievable by planning my route.

### Kings, Guardians and Umbra
46. As a player, I want each of the 10 Kings to have two normal moves and an ultimate below 50% HP, all telegraphed, so that every Chapter's finale is distinct and fair.
47. As a player, I want Kings to speak on arrival, at 50%, on defeat and on Escape in their personality, skippable and non-blocking, so that the light story comes through.
48. As a player, I want Frost Dragon's blizzard to freeze me when I stop moving, so that dragons demand attention.
49. As a player, I want Umbra to fight in three phases (shadow Hero skills, stolen King ultimates, darkened heart), so that the finale reflects my Run.
50. As a player, I want double-King Stages (Chapters 4–7, 10%) to bring the King of the Realm I skipped at ×0.7 HP each with both rewards, so that the surprise feels earned.

### Economy, collection and meta progression
51. As a player, I want every King kill to give 50 × Chapter Gold, 1 Skill Point, a chest wheel and a 5% chance at that Realm's Weapon, so that bosses always pay off.
52. As a player, I want in-Run Gold spending to draw from this Run's Gold before my wallet, with both totals shown, so that I know what I'm spending.
53. As a player, I want the permanent Shop available only outside Runs, so that leaderboards stay comparable.
54. As a player, I want ~30 achievements across story, Heroes, Combos, dragons and challenges, some granting Titles, so that I have long-term goals.
55. As a player, I want a bestiary that unlocks an entry (sprite, one-line lore, kill count) on my first kill of each monster, King and Guardian, so that I can collect.
56. As a player, I want to choose which Title shows under my name, so that I can show off.

### Score, leaderboards and Seasons
57. As a player, I want an arcade Score where progress dominates (Chapters, Kings, victory, fast finish) and kills and Combos separate equal progress, shown as an itemised count-up at the end, so that the number feels earned.
58. As a player, I want Escapes to subtract 3,000 and a bought revive to cut 15% (Endless-only when bought in Endless), so that skill ranks above spending.
59. As a player, I want Season boards for solo and co-op plus Endless and an all-time board, so that there is always something to compete in.
60. As a player, I want to see the top 100, my own rank with neighbours, and filter by Hero, so that I stay motivated even far from the top.
61. As a player, I want cosmetic Season rewards (rank-1 Title, gold frame and Hero palette; top-10 Title and badge; top-100 badge; a badge for beating Umbra), so that competing is worth it without giving power.

### Co-op
62. As a player, I want to host a room that gives a 5-character code and an invite link, so that friends can join easily.
63. As a player, I want friends to pick their Hero and Weapon in the lobby and ready up before the host starts, so that everyone starts together.
64. As a player, I want route choices by vote (15 s, host breaks ties) and personal Stage-end decisions in parallel, so that nobody waits on one person.
65. As a player, I want the room to pause while anyone chooses a level-up or opens a chest, as today, so that choices are not rushed.
66. As a player, I want bosses to scale HP by ×(1 + 0.6 × extra players), so that a team of four still gets a real fight.
67. As a player, I want every teammate to receive their own full rewards (team XP, Gold from team kills with their own Greed, King rewards, their own Companion), so that nobody competes for loot.
68. As a player, I want to revive a downed friend by standing next to them for 3 s (once per player per Stage) and see arrows pointing to downed friends, so that co-op feels like teamwork.
69. As a player, I want the Run to end for everyone only when all players are down, so that one fall is not fatal.
70. As a player, I want to be told clearly when co-op is full for the day or disabled, so that I don't get stuck connecting.
71. As a player, I want the team to vote on continuing into Endless, letting those who leave keep their rewards, so that everyone chooses for themselves.
72. As a player, I want the room to close and everyone to keep collected rewards if the host disconnects, so that a drop is not a total loss (host migration comes later).

### Accounts, saves and sessions
73. As a new player, I want to only enter a nickname (or skip and get "Hero#1234"), so that I can start immediately.
74. As a player, I want to link Google later, prompted after my 3rd Run and my first victory, so that my progress survives device changes.
75. As a player, I want linking to an already-used Google account to merge automatically (unlocks united, higher Gold kept, best scores kept), so that I lose nothing.
76. As a player, I want my Gold and unlocks counted by the server and my offline Runs queued for submission, so that my progress is safe and consistent across devices.
77. As a returning player, I want my old local save uploaded once to my new account, so that friends who played the artifact keep their progress.
78. As a player, I want the game auto-saved at every Stage start and an Esc "save and quit", so that I can resume from that Stage start even after my mobile browser closes.
79. As a player, I want to resume a suspended solo Run (main or Endless) on another device, so that I can switch devices.
80. As a player, I want to be warned before starting a new Run discards my suspended one, and told if a Season ended while I was away that the Run will not rank, so that nothing surprises me.
81. As a player, I want a second tab to say the game is open elsewhere with "use this tab instead", and an older device to say the account was opened elsewhere, so that my account is only played in one place.
82. As a player, I want solo play to work fully when the server is down, with online features paused and explained, so that outages don't stop me playing.

### Title screen, tutorial and settings
83. As a player, I want a title screen with a big Play button, my animated Hero, "continue from Chapter N" when available, and menus for Hero+Weapon, Co-op, leaderboard, Shop, collection and settings, so that everything is one tap away.
84. As a player, I want an illustrated pixel-art background that fits both landscape desktop and portrait mobile, with subtle animated sparkle, so that the game feels like a real online game.
85. As a player, I want admin announcements shown on the title screen, so that I know about events and maintenance.
86. As a first-time player, I want short non-blocking hints in my first Greenvale (move, auto skills, crystals, level-up, Ultimate, King, Stage end) and just-in-time hints later (first Combo, Bench unlock, Blood Moon, dragon, Awakening, Escape), each shown once, so that I learn without a tutorial level.
87. As a first-time player, I want my very first Greenvale slightly easier (King HP ×0.8, lower starting pressure), so that I clear my first Chapter.
88. As a player, I want settings for music and effects volume, screen shake (off/light/full), mobile vibration, Ultimate flash, effects and damage numbers (off/some/all), and tips (off/replay), stored on my device, so that the game suits me and my phone.
89. As a player on a slow phone, I want the game to suggest lowering effects when FPS stays under 45, so that it stays playable.
90. As a player, I want every text in Thai and English, so that I can play in my language.

### Presentation
91. As a player, I want characters and scenes drawn at Pokémon Red/Blue detail level in full color (readable 16×16 Heroes, 32×32 Kings, hand-drawn props like stumps, big trees, signs and dithered tall grass), so that the world looks crafted.
92. As a player, I want props to be decorative and walk-through, so that fleeing the horde is never blocked.
93. As a player, I want King intro cards, slow-motion King deaths, a zoom moment for Evolution/Awakening/fusion, "×50 KO!" Kill Streak popups, visible Statuses on monsters, per-family death animations and end-of-Stage pickup vacuum, so that every action feels punchy.
94. As a player, I want distinct sounds for every Skill, Combo and Ultimate and a music track for the title, each Realm, Kings and Umbra, so that the game sounds alive.

### Admin
95. As the admin, I want to sign in with an admin role, so that only I can change the live game.
96. As the admin, I want a control-room home with key numbers and an automatic "needs attention" list (abnormal Chapter drop-off, suspicious scores, new errors, over/under-performing Skills, abnormal Gold, free-quota warnings, co-op boards awaiting review) with inline fixes, so that I can see and act on problems at a glance.
97. As the admin, I want a three-pane tuning lab to search every Balance Config value, edit it with range validation, see its impact chart and history, stage changes with a note, test them live on my own device, and publish or roll back as new versions, so that tuning is safe and reversible.
98. As the admin, I want published Balance Config to apply to players from their next Stage start, so that nobody's Stage changes mid-fight.
99. As the admin, I want feature flags (co-op, score submission, each event, maintenance mode, minimum client build) that apply immediately, so that I can react to incidents.
100. As the admin, I want to hide suspicious scores, ban players from leaderboards and review co-op top entries, so that boards stay fair.
101. As the admin, I want to open a new Season with a confirmation list of reward recipients, so that rewards go to the right people.
102. As the admin, I want to post a Thai/English announcement with start and end times, so that I can inform players.
103. As the admin, I want basic statistics (players per day, Runs, play time, deaths per Chapter, Skill picks and how far they go, errors, FPS), so that I can tune from data.
104. As the admin, I want every admin action recorded automatically in an audit log I cannot edit, so that changes are traceable.

## Implementation Decisions

**Architecture and repository (#11, ADR-0001)**
- npm workspaces: a browser game app, an admin app, a headless simulation package, a Balance Config schema package, an i18n package, a Cloudflare Worker for co-op rooms, and a Supabase project folder.
- The simulation package is the single deep module for gameplay. Interface: `createSim({seed, config, world, hero, weapon, meta})` returning `step(inputFrame, commands)`, `view()`, `score()`, `hash()`. It must not touch DOM, Canvas, network, wall-clock or `Math.random`/`Math.sin|cos|atan2|hypot|pow|exp|log` (enforced by lint). UI sends Commands (level-up pick, chest stop, Bench swap, route choice, Awakening/fusion answer, pause); the sim emits events the UI listens to.
- Determinism foundations are built during the port, not after: fixed 60 tick/s step with an accumulator, a seeded 32-bit RNG with named streams (rendering uses its own `fxRng`), deterministic math helpers, an always-on recorder of InputFrames and Commands, a state hash every 60 ticks, and one `scoreOf(state)`.
- Port order: (1) move the existing game into the new structure with identical gameplay plus the determinism foundations, (2) headless tests and a golden replay, (3) backend, Admin and co-op, (4) new systems and content.
- Content is organised per World (only Lumora now); the sim receives `world` at Run start. No World-rules plug-in is built until a second World exists.
- Keep the existing rules: all damage to enemies through `hit()`, all damage to the player through `hurtP()`. Rename the old kill-streak variable `combo` to Kill Streak.

**Balance Config and flags (#11, #13)**
- Every tunable number is defined once in a zod schema with default, allowed range and description; the same schema types the sim, validates at load, generates Admin forms and validates publishes on the server. The schema has shared and per-World sections.
- Published versions are immutable; publish and rollback both create a new version. Each Stage locks the version current at its start; every Run records the versions it used. The game ships the defaults so it runs offline.
- Feature flags are separate from Balance Config and take effect immediately; clients check them at launch, Stage start and before creating a room or submitting a score. Players never hold Realtime subscriptions (free cap of 200 connections); they check versions over REST and cache the config locally.

**Services (#01–#04, #12, #17)**
- Cloudflare Pages hosts the game and a separate Admin site behind Cloudflare Access; the game is mirrored on itch.io.
- Supabase Free (project `pixel-horde`, ap-southeast-1, pg_cron enabled) provides Auth (anonymous → Google via identity linking), Postgres with RLS on every table, RPCs and scheduled jobs. A Cloudflare Worker cron pings Supabase daily to prevent inactivity pausing. Anonymous sign-in rate limits are raised and protected with Turnstile.
- The game reaches the backend only through one backend interface with a Supabase adapter and an offline adapter; Cloudflare Workers + D1 is the documented fallback.
- Co-op transport goes through one transport interface with a WebSocket adapter to a Durable Object per room (built with PartyServer/partysocket) and a PeerJS + Cloudflare TURN fallback adapter. When the daily Durable Object quota is exhausted the client shows "co-op full today".
- Libraries: zod, supabase-js, Preact + uPlot (Admin only; the game uses plain DOM), ZzFX/ZzFXM, Vitest, Playwright. No game engine, no ECS, no Colyseus. PixiJS is the documented fallback renderer.

**Data model (#13, #15, #19, #22)**
- Tables: `profiles` (nickname, role, name_hidden, banned_until, active_session_id, shown_title), `meta_progress` (gold, shop levels, heroes, weapons keyed by World, heirloom weapon, stats), `runs` (world, token, server-chosen seed, mode, room, hero, weapon, config versions, timestamps and pause segments, result, chapter, kills, level, escapes, gold earned, score, status incl. suspended/verified/rejected/hidden, summary, checkpoint blob and hash), `leaderboard` (world, season, board, user, best run, score, weapon, verified), `seasons`, `balance_configs`, `feature_flags`, `scheduled_events`, `daily_challenges`, `announcements`, `player_days`, `telemetry_samples`, `client_errors`, `stats_daily`, `audit_log`, `gold_grants`, `achievements`, `player_titles`, `player_badges`. Replays for top entries live in Storage. `scheduled_events` and `daily_challenges` exist for later releases.
- Players never write tables directly. RPCs: `claim_session`, `start_run` (token + seed, records player_days), `submit_run` (minimum real play time excluding pauses, score/Gold ceilings per Chapter and config version, rate limit, checkpoint hash check, then credits Gold and updates leaderboards), `buy_upgrade`, `set_nickname`, `merge_accounts`, `report_errors`, `report_telemetry`, suspend/resume checkpoint calls; admin: `publish_config`, `rollback_config`, `set_flag`, `ban`, `hide_score`, `open_season` (distributes cosmetic rewards to verified entries), `grant_gold`, announcements. A trigger writes `audit_log` for every admin RPC.
- Every gameplay RPC compares the JWT `session_id` with `profiles.active_session_id` and rejects stale sessions (latest login wins); tabs in the same browser coordinate with Web Locks/BroadcastChannel.
- Retention: runs 30 days except leaderboard-best or flagged; telemetry samples 14 days; errors 30 days; daily stats forever; replays for the top 50 per board plus flagged ones. A pg_cron job deletes anonymous accounts unlinked and inactive for 90 days. Legacy `pixelhorde-meta` is uploaded once and tagged. Settings stay on the device.

**Game rules (numbers are Balance Config defaults)** — Run structure #08; skills #18; economy #20; Weapons and Ultimate #23; Heroes #19; Kings, Guardians, Umbra and Companions #21; Realm mobs and meta #09; Score and Seasons #15; co-op #16; suspend/resume #22; title and tutorial #24; art, sprites and props #10; release scope, performance budget, translation and audio #25. Key values: stage-length formula as today; overtime 45 s; Escape = Umbra HP +15% and its ultimate; Bench 1→3 at Chapters 2 and 4; swap 20×Ch; revive 75×Ch; Skill Point purchase 30×Ch; King reward 50×Ch Gold + 1 Skill Point + wheel + 5% Weapon; Ultimate full in 60 s, 1.5× Chapter mob HP, boss cap 8%/5%; Combo repeat cooldown 1 s per enemy; Realm resistance −50%; co-op boss HP ×(1+0.6×extra); Score formula as in #15; Hero prices 500/1,000 Gold.

**Presentation (#10, #24, #25)**
- Sprites stay hand-authored character rows converted to offscreen canvases at boot, moved into per-Realm files with a validator (equal row lengths, palette-only characters). Sizes: Hero 16×16 (3 directions × 2 walk frames), mobs 12–16 (2 frames), Kings 32×32 (2 idle + 1 wind-up), dragons 32 (grown 40), Umbra 48, Three-headed Dragon 48×40, icons 16×16. Heroes are composed of body + head + held Weapon layers. Recolouring handles hit flash, elites, frozen, armour and Season palettes. Outline `#1e1b33`, light from top-left, ≤~12 colors per Realm.
- A developer-only Sprite Lab (paint grid, Realm palette, animated preview on Realm ground, copy in/out as rows) is one of the first graphics tasks.
- Title backgrounds are the only AI-generated art: two pixel-art-style images (16:9 and 9:16) from Gemini, WebP ≤ ~300 KB each, animated overlays in code.
- Performance budget: 60 FPS target on a 3–4-year-old mid-range Android (45 minimum); monster cap 320 desktop / 240 mobile; particle cap 900 / 500.
- i18n keys in Thai and English with a completeness check.

## Testing Decisions

- A good test drives a module only through its public interface and asserts observable outcomes (state visible through `view()`/`score()`/`hash()`, events emitted, RPC responses, messages on the wire), never private fields or call order.
- **Seam 1 — the simulation package (primary).** Headless Vitest suites run seeded Runs with scripted bot input and Commands and assert: no exceptions over many minutes; Stage clear only on King death; overtime and Escape consequences; route choice validity; level-up offers obey slot/Bench rules; Awakening and fusion prompts appear exactly when their conditions hold; Combos trigger from the right Status/trigger pairs and respect the repeat cooldown; Realm resistances; Ultimate charge and boss caps; Companion levelling; Score equals the documented formula; co-op boss HP scaling. A **golden replay** (recorded inputs + expected hash sequence) must reproduce identically in Node and in Chromium, Firefox and WebKit via Playwright on every build.
- **Seam 2 — the backend interface.** Game-side flows (start/submit Run, offline queue, suspend/resume including cross-device, session replacement, account merge, Gold only via server) are tested against the offline adapter and an in-memory fake with the same interface. Server rules (RLS, RPC validation, Gold and Score ceilings, minimum play time excluding pauses, checkpoint hash, stale-session rejection, audit trigger, Season reward distribution, retention jobs) are tested inside Postgres with pgTAP (available on Supabase).
- **Seam 3 — the transport interface.** An in-memory room adapter runs one host and 1–3 guest sims in one process to test damage aggregation, route voting, lobby/ready, downed-ally revive, all-down Run end, host-disconnect room close, and that host snapshots stay under 4 KB. The Durable Object adapter gets a deploy-time smoke test only.
- Config schema tests: defaults validate, out-of-range values are rejected, shared + per-World sections merge as documented.
- UI (menus, HUD, Admin Console) gets Playwright smoke tests only (pages load, primary buttons respond); behaviour is covered through the seams above.
- Prior art: the original game was verified with a headless Node harness (stubbed DOM/canvas, a fake room hub for two clients) described in `CLAUDE.md` → Testing; the new suites replace it with the seams above.

## Out of Scope

- Later updates (#25): Heart Crack 4–10, co-op host migration, daily challenge with anti-cheat tier 2 (replay validation on GitHub Actions), Admin scheduled events / D1-D7 retention / version comparison / Gold grants and account reset UI, daily and weekly quests, shape-changing skins, cross-player Combos, new Heroes, additional Worlds and World-specific rules.
- Monetisation and donations; public matchmaking; live online-player views in Admin.
- AI-generated in-game art (only the title backgrounds are AI-made).
- Solid obstacles or pathfinding; props are decorative only.
- Measuring real co-op latency from Thailand and P2P failure rates is a verification task during the first co-op spike, not a spec decision.

## Further Notes

- The v1 scope is large (all 10 Realms, ~30 King frames, ~18 new mob shapes, ~80 props, ~50 icons, 13 music tracks). Keep the game playable at every step of the port order and add Realms one by one.
- Free-tier limits are designed around: Supabase inactivity pause, 5 GB egress, 500 MB storage, 200 Realtime connections, 50k MAU including anonymous users; Durable Object 100k requests/day (≈6–12 four-player room-hours).
- Pokémon Red/Blue is a style reference only; all characters and scenes are original designs.
- An Admin Console prototype (three variants) lives on branch `prototype/admin-console`; the chosen layout is A shell + B home + C tuning lab.
