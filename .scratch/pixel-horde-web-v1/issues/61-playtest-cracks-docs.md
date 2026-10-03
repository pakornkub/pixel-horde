# 61: The playtest README's `cracks` example runs only tiers 0–3

**Status:** done (merged in PR #84; docs only, no code, migration or config change)

**Problem:** `scripts/playtest/README.md` documents `PT_PASS=1 npm run playtest -- cracks 10  # every Heart Crack tier on
top of all balance passes`. The `cracks` suite (`scripts/playtest/suites.mjs`) takes its tiers from `PT_CRACKS` (default
`0,1,2,3`); the trailing `10` is the seed count (`n`, per Hero and variant), not a tier. So the example covers tiers 0–3
only, and a reader can mistake the number for a tier.

**Fix:** docs only. The example sets `PT_CRACKS` to every live tier (0–10: pass 2026-09e sets `heartCrack.maxTier` 10,
the schema default is 3) and says which argument is which. No code, migration or config change.
