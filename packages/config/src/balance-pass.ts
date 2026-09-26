// Recommended Balance Config changes from the September 2026 playtest pass (scripts/playtest, ~2,000
// headless Runs with a scripted player). Version 0 (the built-in defaults) stays the original game;
// these values reach players only when the admin loads them into a draft in the Admin Console
// (Balance → "ใส่ค่าจากรอบจูน") and publishes a new version.
import type { BalanceConfigInput } from './schema';

export interface BalancePass { id: string; note: string; patch: BalanceConfigInput }

export const BALANCE_PASS_2026_09: BalancePass = {
  id: '2026-09',
  note: 'Playtest balance pass 2026-09: Chapter 1 wall, beatable Umbra, Awakening worth taking, weak Signatures, runaway combos',
  patch: {
    shared: {
      // Stages as long as the live version; Kings grow slower so late Kings stop escaping
      stage: { durBase: 80, durMax: 180, bossHpGrowth: 1.15 },
      // King Slime's Royal Splash was unavoidable at base speed and caused about half of all Chapter 1 damage
      kings: { splash: { r: 100, dur: 1.6, dmg: 1.2 } },
      scaling: { eliteDmg: 1.35 },
      spawn: { base: 1.2 },
      // Toxic Burst and Overload carried 40–70% of some Heroes' damage
      combos: { overload: 1.25, toxicBurst: 0.8, toxicBurstR: 28 },
      // Awakening used to cost as much as it gave (two maxed Links for level-1 skills)
      awaken: { sigDmg: 2.2, grant: 1, grantLv: 6, wLine: 2 },
      skills: {
        meteor: { n: { perLv: 0.6 }, dmg: { perLv: 32 } },
        // Signatures were among the weakest skills in the game
        hawk: { dmg: { base: 40, perLv: 26 }, cd: { base: 1.6, min: 0.8 }, r: 22, evo: { n: 3 } },
        flask: { dmg: { base: 28, perLv: 13 }, cd: { base: 2.3 }, r: { base: 26 }, evo: { dmgMul: 1.5 } },
        shield: { dmg: { base: 10, perLv: 6 }, evo: { n: 4 } },
        // Kit and Vex lagged behind at the top end: their weakest Skill Line skills get real damage
        galeStep: { dmg: { base: 30, perLv: 14 } },
        arrowRain: { dmg: { perLv: 8 } },
        cauldron: { dmg: { base: 16, perLv: 9 } },
      },
      umbra: { boltDmg: 0.5 },
      heroes: { ranger: { spd: 0.15 } },
    },
    worlds: { lumora: { enemies: { boss: { hp: 1800 }, umbra: { hp: 2000, dmg: 24 } } } },
  },
};

/** Follow-up to 2026-09 (published there as config v4): load it on top of v4 and publish a new version. */
export const BALANCE_PASS_2026_09B: BalancePass = {
  id: '2026-09b',
  note: 'Playtest follow-up 2026-09b: Awakening keeps the Links and adds a slot, extra EXP no longer toughens monsters, Kit survives the late game',
  patch: {
    shared: {
      // Awakening was only as good as declining it: the Links now stay and a 5th attack slot holds the new skills
      awaken: { keep: 1, slots: 1 },
      // monsters count the player's level only up to the usual level for that point of the Run (7 + 7 per Chapter),
      // so Wisdom and Transmute stop making the game harder; the Chapter curve stays where it was
      scaling: { lvCapBase: 7, lvCapPerCh: 7 },
      // Kit died to regular monsters: the Hawk clears a crowd around Kit, and a little more HP
      skills: { hawk: { guardN: 4, guardR: 40 } },
      heroes: { ranger: { hp: 20 } },
    },
  },
};

/** Every pass in order; the playtest harness (PT_PASS=1) applies them all. */
export const BALANCE_PASSES: readonly BalancePass[] = [BALANCE_PASS_2026_09, BALANCE_PASS_2026_09B];
