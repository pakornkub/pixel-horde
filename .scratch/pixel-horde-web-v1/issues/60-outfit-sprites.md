# 60: Outfit sprites and shop icons

**What to build:** Follow-up art for ticket 51 (outfit gear, PR #55). The owner chose new pixel art, not palette swaps
(2026-09-27). Until this lands, the Outfits tab shows coloured H/B/C slot tiles, and the worn pieces don't change the
Hero's look in a Run.

- Worn pieces drawn on the Hero in a Run: 5 Heroes (Lyra, Bram, Kit, Vex, Mora) × 4 sets (Ember, Frost, Storm, Shadow) × 3
  pieces (hat, body, cloak), with side, down and up walk frames. They must read at the low-res buffer (≈190 px on the short
  side) and keep the player's white rim.
- 12 shop icons, one per set × piece, 32×32 in the skill-atlas style (`scripts/build-icon-atlas`), for the Outfits tab and
  the website.
- A Hero preview in the Outfits tab that shows the worn pieces on the selected Hero.

Sprites stay in `apps/game/src/sprites/` (the sim never imports them). A missing sprite falls back to today's look.

**Related:** 51 (outfit gear), 49 (the forge's 11 Weapon icons, same icon style), 57 (Mora).

**Blocked by:** —

**Status:** needs-triage
