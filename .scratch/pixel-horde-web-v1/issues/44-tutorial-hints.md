# 44: Tutorial hints and the easier first Greenvale

**What to build:** A first-time player gets short non-blocking hints in their first Greenvale (move, auto Skills, crystals, level-up, Ultimate, King, Stage end) and just-in-time hints later (first Combo, Bench unlock, Blood Moon, dragon, Awakening, Escape), each once per account; that very first Greenvale is slightly easier (King HP ×0.8, lower starting pressure). Co-op shows hints only to players who haven't seen them.

**Blocked by:** 43 (Title screen, first-login flow and Gemini backgrounds); 21 (Skill slots v2, Bench and Stage-end swaps); 22 (Statuses, Combos, Realm traits and resistances)

**Status:** done (awaiting owner review of the hint texts)

- [x] Hints can be turned off and replayed from Settings
- [x] Sim/UI tests: each hint fires once per account

## Notes (implementation)

- Hints (`apps/game/src/tips.ts`): basics in order — move, auto Skills, crystals, level-up, Ultimate, King, Stage end — and just-in-time ones the first time they happen — Combo, Bench grew, Blood Moon, Guardian dragon, Awakening, overtime/Escape. A small bar at the bottom (never blocks input, `pointer-events: none`), 5.5 s each, one at a time.
- Once per account: the seen list is kept in `pixelhorde-meta` (`tips`) and on the server in `meta_progress.stats.tips` via `set_tips` (`supabase/migrations/20260925000010_tips.sql`); `get_meta` returns it, so another device skips hints already seen. A hint counts as seen when it shows.
- Settings: "Hints" on/off; "Show hints again" clears the account's list (keeps the first-Run marker).
- First Run: until the account finishes its first Run (`first` marker), Chapter 1 has King HP ×0.8 and spawns ×0.8 (`tutorial` in the Balance Config; sim option `firstRun`, recorded in replays).
- Co-op: hints are local to each player, so only players who haven't seen one get it.
- Tests: `apps/game/src/tips.test.ts` (order, once, events, turned off/already seen), `tests/juice.test.ts` (first-Run King HP and spawns), `supabase/tests/010_tips.test.sql`.

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
