// Lumora sprites shared by every Realm: Shadow Rival, dragons, counter enemies (Heroes: heroes.ts).
import { OUTLINE, type RealmSprites } from '../types';

export const HERO_TOP: string[] = [
  "......KKKK......",
  "....KKhhhhKK....",
  "...KhHHhhhhhK...",
  "..KhHhhhhhhhhK..",
  "..KggggggggggK..",
  "..KhsssssssshK..",
  "..KhsKssssKshK..",
  "..KhsssssssshK..",
  "...KKssppssKK...",
  "..KcccKKKKcccK..",
  ".KcCccgggcccCcK.",
  ".KcCcccgcccccCK.",
  ".KsKccccccccKsK.",
  "..KKccccccccKK..",
];
export const LEGS_A = ["...KbbK..KbbK...", "...KKKK..KKKK..."];
export const LEGS_B = ["..KbbK....KbbK..", "..KKKK....KKKK.."];
export const SLIME: string[] = [
  ".....KKKK.....",
  "...KKggggKK...",
  "..KgGGgggggK..",
  ".KgGgggggggggK",
  ".KggKggggKgggK",
  ".KggKggggKgggK",
  ".KgggggggggggK",
  ".KggggddddgggK",
  "..KKKKKKKKKK..",
];
export const CROWN = ["...KYKYYKYK...", "...KYYYYYYK..."];
const DRAGON: string[] = [
  "..........KKKK..........",
  ".........KrrrrK.........",
  "........KrYrrYrK........",
  "........KrrrrrrK........",
  ".KK......KrrrrK......KK.",
  "KwwK....KrroorrK....KwwK",
  "KwwwK..KrrooooorK..KwwwK",
  "KwwwwKKrrrooooorrKKwwwwK",
  "KwwwwwKrrrooooorrKwwwwwK",
  ".KwwwwKrrrooooorrKwwwwK.",
  "..KwwwKrrrrooorrrKwwwK..",
  "...KKKKrrrrrrrrrrKKKK...",
  "......KrrrrrrrrrrK......",
  ".......KrrKrrKrrK.......",
  ".......KKK.KrrK.KKK.....",
  "...........KrrK.........",
  "............KrrK........",
  ".............KrK........",
  "..............KK........",
];
const PETD: string[] = [
  "....KKKK....",
  "...KrYrYK...",
  "....KrrK....",
  "KK..KrrK..KK",
  "KwK.KooK.KwK",
  "KwwKroorKwwK",
  ".KwKroorKwK.",
  "..KKrrrrKK..",
  "....KrrK....",
  ".....KrK....",
  "......KK....",
];
const EYE: string[] = [
  "...KKKKKK...",
  "..KwwwwwwK..",
  ".KwwwwwwwwK.",
  "KwwwKKKKwwwK",
  "KwwKrrrrKwwK",
  "KwwKrKKrKwwK",
  "KwwKrKKrKwwK",
  "KwwKrrrrKwwK",
  "KwwwKKKKwwwK",
  ".KwwwwwwwwK.",
  "..KwKwwKwK..",
  "..K.K..K.K..",
];
const BOAR: string[] = [
  "...KK......KK...",
  "..KbbK....KbbK..",
  "..KbbbKKKKbbbK..",
  ".KbbbbbbbbbbbbK.",
  "KwKbbKbbbbKbbKwK",
  "KwKbbbbbbbbbbKwK",
  ".KKbbbppppbbbKK.",
  "..KbbbpKKpbbbK..",
  "..KbbbbbbbbbbK..",
  "...KbK....KbK...",
  "...KK......KK...",
];

/** The old shared hero palette (the Shadow Rival still uses the first hero drawing). */
export const HERO_PAL: Record<string, string> = { K: OUTLINE, h: '#7b4bd6', H: '#b58cff', g: '#ffd23f', s: '#ffd9b0', p: '#f28b9b', c: '#3f5fd1', C: '#7fa2ff', b: '#6b3e26' };

export const COMMON: RealmSprites = {
  realm: 'common',
  palette: [OUTLINE, '#ffd23f', '#ffd9b0', '#f28b9b', '#6b3e26', '#d8342c', '#ffb347', '#8a1f1f', '#ffe14d', '#f0e6ff', '#b03ad6', '#8a5a3a'],
  ground: 0,
  sprites: {
    rival: { frames: [[...HERO_TOP, ...LEGS_A]], pal: { ...HERO_PAL, h: '#2a1f3d', H: '#5a3f8a', c: '#3a2a55', C: '#6a4a9a', s: '#b8a8d8', g: '#ff4b5c', p: '#ff4b5c', b: OUTLINE }, note: 'Shadow Rival' },
    dragon: { frames: [DRAGON], pal: { K: OUTLINE, r: '#d8342c', o: '#ffb347', w: '#8a1f1f', Y: '#ffe14d' }, note: 'Inferno Dragon (drawn ×2)' },
    frostDragon: { frames: [DRAGON], pal: { K: OUTLINE, r: '#4fa8ff', o: '#dff4ff', w: '#1f4a8a', Y: '#ffffff' }, note: 'Frost Dragon (drawn ×2)' },
    stormDragon: { frames: [DRAGON], pal: { K: OUTLINE, r: '#d8b400', o: '#fff35c', w: '#6a5a1a', Y: '#ffffff' }, note: 'Storm Dragon (drawn ×2)' },
    petFrost: { frames: [PETD], pal: { K: OUTLINE, r: '#4fa8ff', o: '#dff4ff', w: '#9fd8ff', Y: '#ffffff' }, note: 'Companion: Frost' },
    petStorm: { frames: [PETD], pal: { K: OUTLINE, r: '#d8b400', o: '#fff8c0', w: '#fff35c', Y: '#ffffff' }, note: 'Companion: Storm' },
    whelp: { frames: [PETD], pal: { K: OUTLINE, r: '#a8231d', o: '#ff8a3d', w: '#5a1414', Y: '#ffe14d' }, note: 'Dragon whelp' },
    pet: { frames: [PETD], pal: { K: OUTLINE, r: '#ff6a2a', o: '#ffd08a', w: '#ffb347', Y: '#ffffff' }, note: 'Pet fire dragon' },
    caster: { frames: [EYE], pal: { K: OUTLINE, w: '#f0e6ff', r: '#b03ad6' }, note: 'Eye Caster' },
    charger: { frames: [BOAR], pal: { K: OUTLINE, b: '#8a5a3a', p: '#e0a0a0', w: '#fff4e0' }, note: 'Wild Boar' },
    splitter: { frames: [SLIME], pal: { K: OUTLINE, g: '#b36bff', G: '#e6ccff', d: '#6b2fb3' }, note: 'Split Slime (drawn ×2); minis reuse it' },
  },
};
