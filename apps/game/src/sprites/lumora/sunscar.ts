// Sunscar (desert): sand slime, scorpion, mummy, Sand King.
import { OUTLINE, type RealmSprites } from '../types';
import { CROWN, SLIME } from './common';
import { GHOST } from './deepdark';
const SCORP: string[] = [
  "..KK......KK..",
  ".KrrK....KrrK.",
  ".KrK......KrK.",
  "..KK.KKKK.KK..",
  "....KrrrrK....",
  "...KrKrrKrK...",
  "...KrrrrrrK...",
  "..KrKrrrrKrK..",
  "...KKrrrrKK...",
  ".....KrrK.....",
  "......KrK.....",
  ".......KK.....",
];

export const SUNSCAR: RealmSprites = {
  realm: 'sunscar',
  palette: [OUTLINE, '#e0a040', '#ffe0a0', '#9a5a1a', '#d9822b', '#e8d9b0', '#ff9a2a', '#ffd23f'],
  ground: 1,
  sprites: {
    sslime: { frames: [SLIME], pal: { K: OUTLINE, g: '#e0a040', G: '#ffe0a0', d: '#9a5a1a' } },
    scorp: { frames: [SCORP], pal: { K: OUTLINE, r: '#d9822b' } },
    mummy: { frames: [GHOST], pal: { K: OUTLINE, w: '#e8d9b0' } },
    bossD: { frames: [[...CROWN, ...SCORP]], pal: { K: OUTLINE, r: '#ff9a2a', Y: '#ffd23f' }, note: 'Sand King (drawn ×3)' },
  },
};
