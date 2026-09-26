# Playtest harness (balance passes)

Headless Runs with a scripted player that moves like a decent human (dodges telegraphs after a
0.25 s reaction, collects EXP, stays near the King, picks level-ups toward its Signature, Links and
Awakening). Used for the 2026-09 balance pass (`packages/config/src/balance-pass.ts`).

```
npm run playtest -- heroes 16            # every Hero, fresh account, 16 seeds → scripts/playtest/.out/heroes.json
npm run playtest:report -- scripts/playtest/.out/heroes.json
PT_PASS=1 npm run playtest -- presets 10 # every difficulty preset on top of the balance pass
node scripts/playtest/exp.mjs patches.json 12 mid   # compare Balance Config patches on the same seeds
```

Suites (`suites.mjs`): `heroes` (fresh), `veteran`/`max` (Shop levels), `awaken` (accept vs decline),
`casual` (random picks, slower reactions), `presets`, `patch` (env `PT_PATCH_JSON`). Env: `PT_PASS=1`
start from the balance pass, `PT_BASE=defaults` skip the live stage lengths, `PT_MAXCH=1` stop after
Chapter 1.

`build.mjs` bundles the sim with esbuild and wraps `hit()` / `hurtP()` so every point of damage is
attributed to a Skill, Combo, monster or boss move. The shipped sim is never changed by this.
The bot is better than most real players: in September 2026 about 80% of real solo deaths were in
Chapter 1 against about 50% for the bot on the same config, so read its numbers as "a skilled player".
