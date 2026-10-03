# 63: Hawk description says nothing about guard and Hawk Gust

**Status:** ready-for-human (owner review)

**Scope note:** the first version of this ticket was broader ("skill descriptions might describe unpublished behaviour",
i.e. read every description from the live Balance Config). It was dropped after the Orchestrator and the owner checked
`balance_configs`: pass 2026-09j and 2026-09k are both live (v13, published 2026-09-27 23:48 UTC; `skills.hawk.guardN`
live since v11), and the Arrow Rain / Gale Step texts (`skill.arrowRain.*`, `skill.galeStep.*`, `awk.arrowRain.desc`,
`awk.galeStep.desc`) already match the live 09k values. What is left is one real gap, and this ticket is only that.

**Problem:** `skill.hawk.desc` and `awk.hawk.desc` (Kit's Signature, before and after Awakening) only say the Hawk dives at
the biggest monster. The live rules also have a defend mode: once `skills.hawk.guardN` monsters are within `guardR` of Kit
the Hawk dives the nearest one instead, and Hawk Gust (`gustKb` > 0) pushes the monsters around Kit back and stuns them
(`gustStun`, at most once every `gustCd` s, never bosses). Players cannot learn this from the skill text.

**Checked in the sim** (`packages/sim/src/systems/skills.ts`, `id === 'hawk'`): the guard / gust code runs before the
`awkForm(s)` branch, so it applies to the base Hawk **and** to the Awakened Hawk Flock. It does not depend on
`P.awakened` or on the Evolution. A Shadow Clone's Hawk defends but never gusts (`!cl`).

**What to build:**
- `skill.hawk.descGuard` and `awk.hawk.descGuard` in `th.json` / `en.json`: the old sentence plus the defend + gust line,
  in the same terse style as the other skill texts, no numbers (they come from the Balance Config and the Admin can change them).
- `skillDescIn` / `formDesc` (game) and the website's Skills page choose the `descGuard` key only while the config has
  `skills.hawk.guardN > 0` and `gustKb > 0`, the same pattern as `skill.lance.descAim` and `skill.shield.descBash`.
  Built-in defaults (version 0, both 0) keep the old text, so the offline game never describes a rule it does not have.
- The website needs no text of its own: it already reads the i18n key; only the key it asks for changes.

**Not in this ticket:** Arrow Rain / Gale Step texts, Balance Config values, migrations, pgTAP.

**Review:** player-visible text. Flag for Tester + UX/UI after hand-off.

**What was built:**
- `th.json` / `en.json`: `skill.hawk.descGuard`, `awk.hawk.descGuard` (the old sentence + "when you are crowded it dives the
  nearest one instead, and a gust pushes monsters back and stuns them (not bosses)"). Old keys stay for configs without guard / gust.
- `apps/game/src/ui/text.ts`: `hawkGusts(cfg)` (`guardN > 0 && gustKb > 0`) picks the key in `skillDescIn` and `formDesc`.
  The Awakening card (clear screen) is the only in-game place that shows the Awakened Hawk text; `skillDescIn` also covers a
  level-up / chest card for the Hawk.
- `apps/site/src/pages/skills.ts`: `descKey(id)` with the same rule for the card, the detail panel and the search. The site reads the
  live config (v13 loaded in the check below), so it shows the new text now.
- `apps/game/src/ui/text.test.ts`: off → old text (also guard without gust), on → `descGuard` in both languages before and
  after Awakening, other Signatures unchanged.
- Gust copy has no numbers on purpose; `guardN`, `guardR`, `gustKb`, `gustStun`, `gustCd` stay Admin-tunable.
- Not done here: a patch-notes entry in Admin → อัปเดตเกม (the Orchestrator / Documenter decides whether a text-only fix needs one).

**Checked:** `npm run check` green. Site Skills page on the live v13 config shows the new Hawk text (EN + TH). In the game the
Awakening card was rendered with the live Hawk values (`guardN 3`, `gustKb 70`, `gustStun 0.6`, `awaken.form 1`), guard off vs on.
