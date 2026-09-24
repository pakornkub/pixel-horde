// Greenvale (grass): slime, bat, mushroom, King Slime.
import { OUTLINE, type RealmSprites } from '../types';
import { CROWN, SLIME } from './common';
export const BAT1: string[] = [
  "K.............K",
  "KK...K...K...KK",
  "KpK.KKKKKKK.KpK",
  "KppKpprprppKppK",
  ".KpppppppppppK.",
  "..KKpppppppKK..",
  "....KpKKKpK....",
  ".....K...K.....",
];
export const BAT2: string[] = [
  "...............",
  ".....K...K.....",
  "....KKKKKKK....",
  "..KKpprprppKK..",
  ".KppppppppppppK",
  "KpppKpppppKpppK",
  "KppK.KKKKK.KppK",
  "KKK.........KKK",
];
export const MUSH: string[] = [
  "....KKKKKK....",
  "..KKrrwwrrKK..",
  ".KrrrrwwrrrrK.",
  "KrwwrrrrrrwwrK",
  "KrwwrrrrrrwwrK",
  "KrrrrrrrrrrrrK",
  ".KKKKKKKKKKKK.",
  "...KssssssK...",
  "...KsKssKsK...",
  "...KssssssK...",
  "..KKssssssKK..",
  "..KbbK..KbbK..",
  "..KKKK..KKKK..",
];

export const GREENVALE: RealmSprites = {
  realm: 'greenvale',
  palette: [OUTLINE, '#6fd34e', '#c6f7a0', '#2f7d2a', '#8a5ad6', '#ff4b5c', '#e8434f', '#fff4e0', '#f2d6a8', '#6b3e26', '#4fa8ff', '#ffd23f'],
  ground: 0,
  sprites: {
    slime: { frames: [SLIME], pal: { K: OUTLINE, g: '#6fd34e', G: '#c6f7a0', d: '#2f7d2a' } },
    bat: { frames: [BAT1, BAT2], pal: { K: OUTLINE, p: '#8a5ad6', r: '#ff4b5c' } },
    mush: { frames: [MUSH], pal: { K: OUTLINE, r: '#e8434f', w: '#fff4e0', s: '#f2d6a8', b: '#6b3e26' } },
    boss: { frames: [[...CROWN, ...SLIME]], pal: { K: OUTLINE, g: '#4fa8ff', G: '#c9ecff', d: '#1f4f9d', Y: '#ffd23f' }, note: 'King Slime (drawn ×3)' },
  },
};
