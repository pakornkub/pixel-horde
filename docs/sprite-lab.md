# Sprite Lab

A developer-only pixel editor for the hand-authored sprites. It is **not** part of the
production build (CI checks this).

```sh
npm install
npm run lab        # opens http://localhost:5173/sprite-lab.html
```

- Sprites live in `apps/game/src/sprites/lumora/<file>.ts`: `heroes`, `common` (Shadow Rival, dragons,
  counter monsters) and one file per Realm (`greenvale`, `sunscar`, `deepdark`, `frostpeak`, `emberforge`,
  `mirefen`, `skyreach`, `tidehollow`, `gearspire`, `duskhold`, `crater`). The website (`apps/site`) draws its
  pictures from the same files. Each sprite is `{ frames: string[][], pal: { char: '#rrggbb' } }`;
  `.` is transparent, `K` is the outline colour `#1e1b33`.
- Pick a sprite on the left, paint on the grid (right-click erases), switch frames, add colours
  from the Realm palette, and watch the animated preview at game scale on that Realm's ground
  plus the hit-flash / elite / frozen / armored variants.
- Edits are kept as drafts in your browser (a red dot marks them). **"คัดลอกทั้งตัว (TS)"**
  copies the whole sprite as TypeScript: paste it over the same entry in the Realm file and
  commit. "คืนค่าจากไฟล์" drops the draft.
- The validator (`validateSprite` in `apps/game/src/sprites/types.ts`) runs in the Lab and in
  `npm test`: every row of every frame must have the same length and every character must be
  in the palette.

## Skill icons

The 32×32 icons on level-up cards, the HUD skill panel and the website (skills, passives, companions) are
not in the Lab: they are PNG files in `apps/game/src/assets/icons/<id>.png` (`<id>` = the skill / passive id).
After adding or replacing one, rebuild the atlas the game loads once (`apps/game/src/assets/icons.png` +
`icons.json`) and commit all three:

```sh
node scripts/build-icon-atlas.mjs   # uses sharp (installed with wrangler, not a direct dependency)
```
