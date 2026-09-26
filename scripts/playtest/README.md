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
PT_PASS=1 npm run playtest -- presets 10 # every difficulty preset on top of all balance passes
node scripts/playtest/exp.mjs patches.json 12 mid   # compare Balance Config patches on the same seeds
```

Suites (`suites.mjs`): `heroes` (fresh), `veteran`/`max` (Shop levels), `awaken` (accept vs decline),
`casual` (random picks, slower reactions), `presets` (`PT_PRESETS=relaxed,hard` limits the list), `patch`
(env `PT_PATCH_JSON`, `PT_SHOP`, `PT_PRESET`, `PT_MAXCH=1` stop after Chapter 1). Env for every suite: `PT_PASS=1`
start from every balance pass (= config v6), `PT_PASS=<id>` only up to that pass (`2026-09` = v4, `2026-09b` = v5),
`PT_BASE=defaults` skip the live stage lengths, `PT_HEROES=mage,ranger` limit the Heroes.

`build.mjs` bundles the sim with esbuild and wraps `hit()` / `hurtP()` so every point of damage is
attributed to a Skill, Combo, monster or boss move. The shipped sim is never changed by this.
The bot is better than most real players: in September 2026 about 80% of real solo deaths were in
Chapter 1 against about 50% for the bot on the same config, so read its numbers as "a skilled player".
