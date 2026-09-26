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
      combos: { overload: 1.25, toxicBurst: 0.6, toxicBurstR: 28 },
      // Awakening used to cost as much as it gave (two maxed Links for level-1 skills)
      awaken: { sigDmg: 2.2, grant: 1, grantLv: 6, wLine: 2 },
      skills: {
        meteor: { n: { perLv: 0.6 }, dmg: { perLv: 32 } },
        // Signatures were among the weakest skills in the game
        hawk: { dmg: { base: 40, perLv: 22 }, cd: { base: 1.6, min: 0.8 }, r: 22, evo: { n: 3 } },
        flask: { dmg: { base: 28, perLv: 13 }, cd: { base: 2.3 }, r: { base: 26 } },
        shield: { dmg: { base: 10, perLv: 6 }, evo: { n: 4 } },
      },
      umbra: { boltDmg: 0.5 },
      heroes: { ranger: { spd: 0.15 } },
    },
    worlds: { lumora: { enemies: { boss: { hp: 1800 }, umbra: { hp: 2000, dmg: 24 } } } },
  },
};
