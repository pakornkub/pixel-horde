// Deepdark (cave): bat, Skeleton Archer, ghost, Bone King (skeletons are raised by the King).
import { OUTLINE, type RealmSprites } from '../types';
import { CROWN } from './common';

/** Pad a 12-wide body to the 14-wide crown. */
export const pad1 = (rows: string[]): string[] => rows.map((r) => '.' + r + '.');

export const GHOST: string[] = [
  "....KKKK....",
  "..KKwwwwKK..",
  ".KwwwwwwwwK.",
  "KwwwwwwwwwwK",
  "KwwKKwwKKwwK",
  "KwwKKwwKKwwK",
  "KwwwwwwwwwwK",
  "KwwwwKKwwwwK",
  "KwwwwwwwwwwK",
  "KwwwwwwwwwwK",
  "KwwwKwwKwwwK",
  ".KK.K.KK.KK.",
];
export const SKEL: string[] = [
  "...KKKKKK...",
  "..KwwwwwwK..",
  ".KwwwwwwwwK.",
  ".KwKKwwKKwK.",
  ".KwKKwwKKwK.",
  ".KwwwwwwwwK.",
  "..KwKwKwKK..",
  "...KKKKKK...",
  "....KwwK....",
  "..KKwwwwKK..",
  ".KwKwKKwKwK.",
  "..K.KwwK.K..",
  "...KwK.KwK..",
  "...KK...KK..",
];

/** Skeleton Archer (ticket 35): bow on its left side. */
const ARCHER: string[] = [
  "...KKKKKK.....",
  "..KwwwwwwK....",
  ".KwKKwwKKwK...",
  ".KwKKwwKKwK.K.",
  ".KwwwwwwwwK.Kb",
  "..KwKwKwKK..Kb",
  "...KKKKKK...Kb",
  "..KKwwwwKK.KbK",
  ".KwKwKKwKwKKbK",
  "..K.KwwK.KwKb.",
  "...KwK.KwK.Kb.",
  "...KK...KK..K.",
];

export const DEEPDARK: RealmSprites = {
  realm: 'deepdark',
  palette: [OUTLINE, '#8a5ad6', '#ff4b5c', '#e9f1ff', '#f0ece0', '#d8d0ff', '#ffd23f'],
  ground: 2,
  sprites: {
    ghost: { frames: [GHOST], pal: { K: OUTLINE, w: '#e9f1ff' } },
    skel: { frames: [SKEL], pal: { K: OUTLINE, w: '#f0ece0' } },
    archer: { frames: [ARCHER], pal: { K: OUTLINE, w: '#f0ece0', b: '#8a5a3a' }, note: 'Skeleton Archer (draft for review)' },
    bossC: { frames: [[...CROWN, ...pad1(SKEL)]], pal: { K: OUTLINE, w: '#d8d0ff', Y: '#ffd23f' }, note: 'Bone King (drawn ×3)' },
  },
};
