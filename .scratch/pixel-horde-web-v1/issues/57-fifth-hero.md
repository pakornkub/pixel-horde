# 57: A 5th Hero, for sale after the first win

**What to build:** Owner request (2026-09-27): one more Hero / class, bought with Gold like Kit and Vex, but only offered
after the player has won a Run once.

Facts: the 12 general skills are all Links of the 4 Heroes already, so a 5th Hero needs Links shared with another Hero or
new general skills. A Hero needs: a Signature + its Evolution + an Awakened form + 3 Awakened skills, sprites (HEAD/PAL,
held weapon), 32×32 icons, th/en text, website pages, achievements (`win<Hero>`, `legend` = "all four"), SQL
(`apply_run_facts` lists the 4 Heroes; `unlock_hero` needs a "has won" check), leaderboard filters, the playtest bot.

## Owner decisions (2026-09-27)

- Concept: **Necromancer "Mora"** (id `necromancer`), a summoner: kills and time raise Skeletons that fight for Mora.
  Mora is on Lumora's side: a grave-keeper who calls the fallen monsters' souls back to defend the world.
- Links: **3 new general skills** (every Hero can be offered them), not shared Links.
- Price **2000G** (`heroes.necromancer.cost`), offered only after the first win.
- `legend` stays "the original four"; Mora gets her own `winMora`.
- Art: characters / Skeleton / Wraith in the existing pixel pipeline (HEAD/PAL in code); the 7 skill icons with AI in
  the style of the existing icons (`scripts/build-icon-atlas.mjs`, the owner approved AI for skill icons).

## Design

### Hero bonus (`shared.heroes.necromancer`)
- `cost` 2000 — unlock price; the shop offers Mora only after a win (`stats.heroesWon` non-empty or Heart Crack ≥ 1).
  Before that the title's Hero list shows a locked silhouette "Win a Run to unlock".
- `minion` 0.25 — Mora's minions deal +25%: Skeletons / Frost Wraiths, the Companion dragon and the Shadow Clone.
- `hp` 0 — max HP penalty (designed as −10 “frail”; the playtest put her at Kit's level with it, so the default is 0).
- `pool` 0 — her three Links go to the other Heroes only with 1 (balance pass `2026-09-mora`).

### Signature: Soul Rise (`soulRise`, locked slot)
Every `cd` s Mora raises `n` Skeletons while fewer than `army` stand. A Skeleton climbs out of the latest monster grave
within reach (a kill near Mora), else next to her; it walks to the nearest monster (never leaving `leash` around Mora),
swings every `hitCd` s at everything within `reach` (a sweep hit: Grinder on the Gathered) and crumbles after `life` s.
Monsters do not attack Skeletons (no extra targets for the horde AI).
- Levels 1–7: dmg `12 + 8/lv` per swing (every 0.55 s), raise every `3 − 0.2/lv` s (min 1.4), army `3 + 0.5/lv` (→ 6).
- **Evolution Bone Legion** (max level + Magnet): army +3, 2 per raise, a crumbling Skeleton bursts (heavy: Shatter on
  the Frozen) for `burstMul` × its damage in `burstR`.
- Shadow Clone: raises one shade Skeleton (clone damage) that counts toward the cap.

### New general skills (Links of Mora; any Hero can pick them)
| Skill | What it does | Tag | Evolution |
|---|---|---|---|
| **Soul Drain** `soulDrain` | Every `cd` s tethers `n` nearest monsters within `range` for `dur` s, ticking dark damage; a tethered monster that dies heals Mora `heal` HP (once per tether). The first general skill that sustains. | dark | **Soul Feast** (+Vital): +2 tethers, damage ×1.3, a tether whose monster dies jumps to the nearest one |
| **Bone Prison** `bonePrison` | Every `cd` s bone spikes rise in a ring around the thickest crowd after a short warning: a heavy hit, pulls the crowd in (Gathered) and roots non-bosses `root` s. | heavy + Gathered | **Ossuary** (+Might): a prison at each of 2 crowds, damage ×1.3 |
| **Wailing Skulls** `wailSkull` | Every `cd` s fires `n` homing skulls; each hit adds a frost stack (3 = Frozen, like Frost Aura). | ice → Frozen | **Banshee** (+Keen Eye): a skull that kills splits into 2 that seek new prey, damage ×1.25 |

Evolution passives after this: Might 4, Haste 3, Swift 3, Vital 4, Magnet 3, Keen Eye 3.

### Awakened form: Lich (`awaken.form` 1) + Skill Line
- **Lich:** Skeletons rise as **Frost Wraiths**: they float faster (`awk.spdMul`), hit harder (`awk.dmgMul`) and every
  swing adds a frost stack (3 = Frozen); a Wraith that freezes a monster marks it (`mark`, like the other forms).
- **Bone Spear** `boneSpear` (Skill Line): heavy piercing bone spears at the Wraiths' latest freeze (Lich: waits up to
  `awaken.mark` s for it, = Shatter), else through the thickest crowd.
- **Soulfire** `soulfire` (Skill Line): green ghost fire flares on the latest monster graves (else random monsters):
  fire + Burning → Firestorm on the Gathered (Bone Prison), Toxic Burst on the Poisoned (Toxic Pool), Overload on the
  Shocked.
- **Bone Ward** `boneWard` (Skill Line, survival): when a hit would land on Mora, the nearest standing Skeleton within
  `r` throws itself in the way and crumbles instead (damage cancelled), at most once every `cd` s. With Bone Legion
  the crumbling Skeleton still bursts.

Combos Mora makes alone: Grinder (Skeletons on Bone Prison), Shatter (Wailing Skulls / Wraiths freeze + Bone Prison,
Bone Spear, Bone Legion bursts), Firestorm (Soulfire on Bone Prison). The Shadow Clone never copies Bone Ward.

### Numbers
Every number above is a Balance Config field (`shared.skills.<id>`, `shared.heroes.necromancer`) with an English and a
Thai description; version 0 carries them as defaults (new fields → migration updating `config_schema`).

### Everything that lists Heroes / Skills
sim (`HERO_IDS`, `HEROES`, `SKILL_LINES`, `AWAKENING`, `SKILL_IDS`, `SIGNATURE_IDS`, `LINE_IDS`, `EVO_PASSIVE`,
tags/statuses, `recompute`, skills.ts, `hurtP`), config schema + `desc-th.ts`, i18n th/en, game UI (`ui/text.ts`
glyphs/colours, hero select/shop lock, skill screen), render (Skeleton/Wraith, tether, prison, skull, flare), sprites
(Mora HEAD/PAL + staff, awakened Lich look), icons (7), sounds, achievements (`winMora`), SQL migration
(`apply_run_facts`, achievements row, `unlock_hero` has-won check + price fallback to the schema default until a config
with `heroes.necromancer` is published, `import_legacy_meta` never grants Mora), leaderboard hero filter, Admin labels,
website (home / guide / skills / world), playtest bot + suites, tests.

**Blocked by:** —

## Build notes (2026-09-27)

- Code: sim (`data/skills.ts`, `data/heroes.ts`, `systems/skills.ts` fire / `stepSkeleton` / `boneWard`, graves in
  `killE`, Bone Ward in `hurtP`, `minionMul`), config fields + Thai, `levelup.wLink` (own Links ×, default 1), game UI
  (locked silhouette until a win, `metaSync.hasWon`), sprites (Mora HEAD/PAL, `minion` / `wraith`), 7 AI icons, sounds,
  i18n, website, playtest bot, migration `20260930000036_fifth_hero.sql` (number to confirm), tests
  (`tests/necro.test.ts`, `supabase/tests/018_fifth_hero.test.sql`).
- Playtest (bot, all earlier passes, mid Shop, 12 seeds): Umbra wins at Heart Crack 3 — Vex 100 / Lyra 92 / Bram 83 /
  Mora 75 / Kit 58–67%; Crack 2 — Mora 100%. After merging passes 2026-09e/09g (Heart Crack 1–10) and this pass,
  mid Shop Umbra wins — Crack 0: all 92–100%; Crack 3: Vex 100 / Lyra 100 / Bram 92 / Kit 83 / Mora 83% (after the final
  Soul Rise buff); Crack 6: Vex 83 / Bram 83 / Lyra 75 / Mora 50 / Kit 42%. Mora sits with Kit, above him at Crack 6. With `pool` 1 alone the other Heroes' Awakening dropped (Kit 75 → 42%);
  `wLink` 1.3 restores it.
- To publish: balance pass `2026-09-mora` (`heroes.necromancer.pool` 1, `levelup.wLink` 1.3).

**Status:** ready-for-human (merged 2026-09-27 in PR #53; migration 0037 is applied and pass `2026-09-mora` is live in config v11.
Waiting for the owner to review the art in game and playtest)
