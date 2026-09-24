// Lumora sprites shared by every Realm: Heroes, rival, dragons, counter enemies.
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

/** Base hero palette; each Hero overrides hair (h/H) and clothes (c/C). */
export const HERO_PAL: Record<string, string> = { K: OUTLINE, h: '#7b4bd6', H: '#b58cff', g: '#ffd23f', s: '#ffd9b0', p: '#f28b9b', c: '#3f5fd1', C: '#7fa2ff', b: '#6b3e26' };
const hero = (over: Record<string, string>, note: string) => ({ frames: [[...HERO_TOP, ...LEGS_A], [...HERO_TOP, ...LEGS_B]], pal: { ...HERO_PAL, ...over }, note });

export const COMMON: RealmSprites = {
  realm: 'common',
  palette: [OUTLINE, '#ffd23f', '#ffd9b0', '#f28b9b', '#6b3e26', '#d8342c', '#ffb347', '#8a1f1f', '#ffe14d', '#f0e6ff', '#b03ad6', '#8a5a3a'],
  ground: 0,
  sprites: {
    mage: hero({ h: '#7b4bd6', H: '#b58cff', c: '#3f5fd1', C: '#7fa2ff' }, 'Hero (walk 2 frames)'),
    knight: hero({ h: '#c23b3b', H: '#ff8a80', c: '#6b7a8f', C: '#aab6c6' }, 'Hero (walk 2 frames)'),
    ranger: hero({ h: '#3f8f3a', H: '#8fe39a', c: '#8a5a2b', C: '#c48a55' }, 'Hero (walk 2 frames)'),
    alchemist: hero({ h: '#1f9aa8', H: '#8fe8f2', c: '#d0662a', C: '#ffa36b' }, 'Hero (walk 2 frames)'),
    rival: { frames: [[...HERO_TOP, ...LEGS_A]], pal: { ...HERO_PAL, h: '#2a1f3d', H: '#5a3f8a', c: '#3a2a55', C: '#6a4a9a', s: '#b8a8d8', g: '#ff4b5c', p: '#ff4b5c', b: OUTLINE }, note: 'Shadow Rival' },
    dragon: { frames: [DRAGON], pal: { K: OUTLINE, r: '#d8342c', o: '#ffb347', w: '#8a1f1f', Y: '#ffe14d' }, note: 'Inferno Dragon (drawn ×2)' },
    whelp: { frames: [PETD], pal: { K: OUTLINE, r: '#a8231d', o: '#ff8a3d', w: '#5a1414', Y: '#ffe14d' }, note: 'Dragon whelp' },
    pet: { frames: [PETD], pal: { K: OUTLINE, r: '#ff6a2a', o: '#ffd08a', w: '#ffb347', Y: '#ffffff' }, note: 'Pet fire dragon' },
    caster: { frames: [EYE], pal: { K: OUTLINE, w: '#f0e6ff', r: '#b03ad6' }, note: 'Eye Caster' },
    charger: { frames: [BOAR], pal: { K: OUTLINE, b: '#8a5a3a', p: '#e0a0a0', w: '#fff4e0' }, note: 'Wild Boar' },
    splitter: { frames: [SLIME], pal: { K: OUTLINE, g: '#b36bff', G: '#e6ccff', d: '#6b2fb3' }, note: 'Split Slime (drawn ×2); minis reuse it' },
  },
};
