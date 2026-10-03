# Playtest harness (balance passes)

Headless Runs with a scripted player that moves like a decent human (dodges telegraphs after a
0.25 s reaction, collects EXP, stays near the King, picks level-ups toward its Signature, Links and
Awakening). Used for the balance passes in `packages/config/src/balance-pass.ts` (`BALANCE_PASSES`, newest first):
2026-09 (published as config v4), 2026-09b (v5) and 2026-09c (v6). A pass never changes the built-in defaults:
the owner loads it in Admin → Balance (several passes stack onto one draft, with their reports and patch notes)
and publishes from there.

```
npm run playtest -- heroes 16            # every Hero, fresh account, 16 seeds → scripts/playtest/.out/heroes.json
npm run playtest:report -- scripts/playtest/.out/heroes.json
PT_PASS=1 PT_CRACKS=0,1,2,3,4,5,6,7,8,9,10 npm run playtest -- cracks 24  # every Heart Crack tier (0-10) on top of all balance passes, 24 seeds per Hero and variant
node scripts/playtest/exp.mjs patches.json 12 mid   # compare Balance Config patches on the same seeds
```

The trailing number of `npm run playtest -- <suite> <seeds>` is always the seed count (per Hero and variant), never a tier,
a Chapter or a Shop level. What a suite varies comes from env: `cracks` reads its tiers from `PT_CRACKS` (default `0,1,2,3`;
the live `heartCrack.maxTier` is 10 since pass 2026-09e, so list 0–10 for every tier), `patch` reads `PT_CRACK`, `PT_SHOP`
and so on. The sim clamps a Run's crack to `heartCrack.maxTier` (`packages/sim/src/sim.ts`), which is 3 in the built-in
defaults, so tiers above it need `PT_PASS=1` (or a patch with `heartCrack.maxTier` at least the highest tier); without it
`PT_CRACKS=…,10` quietly runs tiers 4–10 as tier 3 while the labels still read `crack4`…`crack10`. The full example is
11 tiers × 2 variants × 5 Heroes × 24 seeds = 2,640 Runs, a long job that keeps the machine busy. The `VAR=value npm …` lines are POSIX shell; in PowerShell set `$env:PT_PASS = '1'` first.

Per-job gear for the `patch` suite (and `exp.mjs` patch entries as `"forge"` / `"outfit"`): `PT_FORGE=<weapon>:<level>`
(equipped Weapon and its forge level), `PT_OUTFIT=<set>:<level>` (all three pieces of one outfit set), `PT_CRACK=<tier>`.

Suites (`suites.mjs`): `heroes` (fresh), `veteran`/`max` (Shop levels),
`casual` (random picks, slower reactions), `cracks` (`PT_CRACKS=0,3` limits the list), `patch`
(env `PT_PATCH_JSON`, `PT_SHOP`, `PT_CRACK`, `PT_MAXCH=1` stop after Chapter 1). Env for every suite: `PT_PASS=1`
start from every balance pass (= config v6), `PT_PASS=<id>` only up to that pass (`2026-09` = v4, `2026-09b` = v5),
`PT_BASE=defaults` skip v3's Stage lengths, `PT_HEROES=mage,ranger` limit the Heroes.

`build.mjs` bundles the sim with esbuild and wraps `hit()` / `hurtP()` so every point of damage is
attributed to a Skill, Combo, monster or boss move. The shipped sim is never changed by this.
The bot is better than most real players: in September 2026 about 80% of real solo deaths were in
Chapter 1 against about 50% for the bot on the same config, so read its numbers as "a skilled player".
