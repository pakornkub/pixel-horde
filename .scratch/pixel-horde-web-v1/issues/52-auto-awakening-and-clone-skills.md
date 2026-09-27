# 52: Automatic Awakening with a picture card, no Awakened skill handed out, a Shadow Clone that uses your Skills, "Recommended" tags, SP tip

**What to build:** Owner review of the skill system (2026-09-27):
1. Awakening keeps the Links (`awaken.keep` 1), so asking "accept / decline" makes no sense: Awakening happens by itself.
   The clear screen shows it with little text and big pictures: the new form and the three Awakened skills, one line each.
2. No Awakened skill handed out at Awakening (`awaken.grant` 0): find them in level-ups.
3. The Shadow Clone never attacked for most builds (it only copied Bolt/Lance/Boomer/Chain/Nova/Meteor). Owner choice:
   it mimics the player's own Skills, casting one at random at a time.
4. Level-up cards on the Hero's own path get a "Recommended" tag, on every matching card (owner choice).
5. Skill Points: when do you get them, where do you use them? A tip the first time, and the website guide says it all.

**Blocked by:** —

**Status:** ready-for-human (owner playtest; migration 0034 + pass `2026-09f` go live together)

- [x] Sim: `updateLinks` Awakens at once when eligible (host stageClear and co-op guests); `awakenOffer` → `awakenNew`
      (clear screen card), `awakenDeclined` removed, the `awaken` command is a no-op kept for old replays
- [x] Clear screen: `renderAwaken` card at the top (form icon + form text, 3 Awakened skill icons + one line, "Got it · LvN"
      when owned, chips Signature ×, +slots, Links stay / used); th + en; the phone layout stacks the three
- [x] `?debug=awaken` also shows the card at the first Stage end (owner testing)
- [x] Shadow Clone: the cast code of every Skill is one `fire(s, id, stats, lv, caster)` shared by the player and the clone
      (golden replays unchanged). New `clone.every` (s between clone casts; 0 = old rule), `clone.auraMul`, `clone.pulseR`:
      always-on Skills become one pulse; Transmute / Elixir Rain / Aegis Dome are never copied. Clone shots are purple;
      a clone Laser turns around the clone and its Boomerang flies back to it
- [x] Level-up / chest cards: `onHeroPath` (apps/game/src/ui/path.ts) tags the Signature, the Hero's Links and Awakened
      skills, their Evolutions, and passives that evolve the Signature or an owned Link
- [x] Tip `sp` when the first Skill Point arrives; the website guide lists all four uses (reroll, banish, +1 level, Companion)
- [x] Balance pass `2026-09f`: `awaken.grant` 0, `clone.every` 1 (+ changelog lines, Thai report)
- [x] Migration `20260930000034_clone_every_fields.sql` patches `shared.clone` in the live config_schema
- [x] Tests: tests/awaken.test.ts (automatic, once per Run, retired command), tests/awaken-forms.test.ts (co-op guest),
      tests/clone.test.ts, apps/game/src/ui/path.test.ts, tips.test.ts, balance-pass.test.ts
- [x] Playtest bot: the `decline` profile / `awaken` suite / `PT_NOAWAKEN` removed (Awakening cannot be declined)
- [ ] Owner: publish pass `2026-09f` after the build and migration are live; playtest a Run with the clone
