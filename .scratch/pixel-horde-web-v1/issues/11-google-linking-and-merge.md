# 11: Link Google and merge accounts

**What to build:** A player can link Google from the title screen; if that Google account already has a save, both merge automatically (unlocks united, higher Shop levels, higher Gold kept, best scores kept).

**Blocked by:** 08 (Anonymous Player Accounts, nicknames and one-place-at-a-time sessions); 09 (Server-counted meta progression, Run submission and anti-cheat tier 0)

**Status:** ready-for-agent

- [ ] Manual linking enabled; `linkIdentity` flow works on desktop and mobile
- [ ] `identity_already_exists` triggers `merge_accounts` with the documented rules
- [ ] Merging never sums Gold
- [ ] pgTAP tests cover merge rules

Spec: `.scratch/pixel-horde-web-v1/spec.md` · Decisions: `docs/blueprint/pixel-horde-blueprint.md`
