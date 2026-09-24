// Frostpeak (snow): ice slime, ice bat, snowman, Frost King.
import { OUTLINE, type RealmSprites } from '../types';
import { CROWN, SLIME } from './common';
import { pad1 } from './deepdark';
import { BAT1, BAT2 } from './greenvale';
const SNOWM: string[] = [
  "....KKKK....",
  "...KwwwwK...",
  "..KwKwwKwK..",
  "..KwwoowwK..",
  "...KwwwwK...",
  "..KKrrrrKK..",
  ".KwwwwwwwwK.",
  "KwwwwKwwwwwK",
  "KwwwwwwwwwwK",
  "KwwwwKwwwwwK",
  ".KwwwwwwwwK.",
  "..KKKKKKKK..",
];

export const FROSTPEAK: RealmSprites = {
  realm: 'frostpeak',
  palette: [OUTLINE, '#8fd8ff', '#ffffff', '#3f7fbf', '#5cc8e8', '#f4fbff', '#ff8a3d', '#e8434f', '#e6f6ff', '#4fa8ff', '#ffd23f'],
  ground: 3,
  sprites: {
    islime: { frames: [SLIME], pal: { K: OUTLINE, g: '#8fd8ff', G: '#ffffff', d: '#3f7fbf' } },
    ibat: { frames: [BAT1, BAT2], pal: { K: OUTLINE, p: '#5cc8e8', r: '#ffffff' } },
    snowman: { frames: [SNOWM], pal: { K: OUTLINE, w: '#f4fbff', o: '#ff8a3d', r: '#e8434f' } },
    bossS: { frames: [[...CROWN, ...pad1(SNOWM)]], pal: { K: OUTLINE, w: '#e6f6ff', o: '#ff8a3d', r: '#4fa8ff', Y: '#ffd23f' }, note: 'Frost King (drawn ×3)' },
  },
};
