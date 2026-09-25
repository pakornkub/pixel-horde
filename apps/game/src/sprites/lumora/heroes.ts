// Heroes (ticket 34): Lyra, Bram, Kit, Vex — drafts for the owner's review in the Sprite Lab.
// Layers: a shared body (3 directions × 2 walk frames), a head per Hero and direction, and a small
// held-Weapon sprite drawn in the hand at runtime. `<hero>` = side view (right; left is mirrored),
// `<hero>_down` / `<hero>_up` = facing the camera / away.
import { OUTLINE, type RealmSprites, type SpriteDef } from '../types';

const BODY = {
  down: [
    ["...KKccccccKK...", "..KcCccccccCcK..", ".KsKcCccccCcKsK.", ".KsKccggggccKsK.", "..KKccccccccKK..", "...KccKKKKccK...", "...KbbK..KbbK...", "...KKKK..KKKK..."],
    ["...KKccccccKK...", "..KcCccccccCcK..", ".KsKcCccccCcKsK.", ".KsKccggggccKsK.", "..KKccccccccKK..", "...KccKKKKccK...", "..KbbK....KbbK..", "..KKKK....KKKK.."],
  ],
  up: [
    ["...KKccccccKK...", "..KcCccccccCcK..", ".KcKcCccccCcKcK.", ".KcKccccccccKcK.", "..KKccccccccKK..", "...KccKKKKccK...", "...KbbK..KbbK...", "...KKKK..KKKK..."],
    ["...KKccccccKK...", "..KcCccccccCcK..", ".KcKcCccccCcKcK.", ".KcKccccccccKcK.", "..KKccccccccKK..", "...KccKKKKccK...", "..KbbK....KbbK..", "..KKKK....KKKK.."],
  ],
  side: [
    ["....KKcccccK....", "...KcCcccccCK...", "...KcCccccKsK...", "...KcggggcKsK...", "...KccccccKK....", "....KccccK......", "....KbbKbbK.....", "....KKKKKKK....."],
    ["....KKcccccK....", "...KcCcccccCK...", "...KcCccccKsK...", "...KcggggcKsK...", "...KccccccKK....", "....KccccK......", "...KbbK.KbbK....", "...KKKK.KKKK...."],
  ],
};

const HEAD = {
  mage: {
    down: [".......KK.......", "......KhhK......", ".....KhhgK......", "...KKhhhhhhKK...", "..KhhgggggghhK..", "...KssssssssK...", "...KsKssssKsK...", "....KsspssK....."],
    up: [".......KK.......", "......KhhK......", ".....KhhhK......", "...KKhhhhhhKK...", "..KhhgggggghhK..", "...KaaaaaaaaK...", "...KaaaaaaaaK...", "....KaaaaaK....."],
    side: ["....KK..........", "...KhhK.........", "....KhhKK.......", "....KhhhhhK.....", "..KKhgggggghKK..", "....KassssK.....", "....KassKsK.....", ".....KsspK......"],
  },
  knight: {
    down: [".......HH.......", "......KHHK......", "....KKhhhhKK....", "...KhhhhhhhhK...", "...KhKKKKKKhK...", "...KhsKssKshK...", "...KhssssssHK...", "....KKhhhhKK...."],
    up: [".......HH.......", "......KHHK......", "....KKhhhhKK....", "...KhhhhhhhhK...", "...KhhhhhhhhK...", "...KhhhhhhhhK...", "...KhhhhhhhhK...", "....KKhhhhKK...."],
    side: ["...HH...........", "...KHHKK........", "....KhhhhK......", "...KhhhhhhK.....", "...KhhhKKKK.....", "...KhhhsKsK.....", "...KhhhssssK....", "....KKhhhhK....."],
  },
  ranger: {
    down: ["......KKKK......", "....KKhhhhKK....", "...KhhHhhhhhK...", "..KhhKKKKKKhhK..", "..KhKssssssKhK..", "..KhKsKssKsKhK..", "..KhhKsspssKhhK.", "...KhhKKKKKhhK.."],
    up: ["......KKKK......", "....KKhhhhKK....", "...KhhHhhhhhK...", "..KhhhhhhhhhhK..", "..KhhhhHhhhhhK..", "..KhhhhhhhhhhK..", "..KhhhhhhhhhhhK.", "...KhhhhhhhhhK.."],
    side: [".....KKKK.......", "...KKhhhhK......", "..KhhhHhhhK.....", ".KhhhhhKKKK.....", ".KhhhhKsssK.....", "..KhhhKsKsK.....", "..KhhhKsspK.....", "...KhhhKKK......"],
  },
  alchemist: {
    down: ["......KKKK......", "....KKhHhhKK....", "...KhhhhhhhhK...", "...KgggKKgggK...", "...KgwgKKgwgK...", "...KssssssssK...", "...KsKssssKsK...", "....KsspssK....."],
    up: ["......KKKK......", "....KKhHhhKK....", "...KhhhhhhhhK...", "...KhgggggghK...", "...KhhhhhhhhK...", "...KhhhhhhhhK...", "...KhhhhhhhhK...", "....KhhhhhhK...."],
    side: [".....KKK........", "...KKhHhK.......", "..KhhhhhhK......", "..KhhhKggK......", "..KhhKgwgK......", "..KhhhsssK......", "..KhhsKssK......", "...KKsspK......."],
  },
};

export const HERO_BASE_PAL: Record<string, string> = { K: OUTLINE, s: '#ffd9b0', p: '#f28b9b', b: '#6b3e26', a: '#3a2a8a', w: '#bff0f0' };
const PAL: Record<keyof typeof HEAD, Record<string, string>> = {
  mage: { h: '#5a3ad6', H: '#9a7aff', g: '#ffd23f', a: '#3a2a8a', c: '#3f5fd1', C: '#7fa2ff' },
  knight: { h: '#aab6c6', H: '#e8434f', g: '#ffd23f', c: '#6b7a8f', C: '#c7ced9' },
  ranger: { h: '#3f8f3a', H: '#8fe39a', g: '#c48a55', c: '#8a5a2b', C: '#c48a55' },
  alchemist: { h: '#1f9aa8', H: '#8fe8f2', g: '#8a5a3a', w: '#bff0f0', c: '#d0662a', C: '#ffa36b' },
};

/** Stack a head (8 rows) on a body (8 rows): one 16×16 frame. */
const stack = (head: string[], body: string[]): string[] => [...head, ...body];
function heroSprites(id: keyof typeof HEAD): Record<string, SpriteDef> {
  const pal = { ...HERO_BASE_PAL, ...PAL[id] }, h = HEAD[id];
  return {
    [id]: { frames: BODY.side.map((b) => stack(h.side, b)), pal, note: 'Hero side view (walk 2 frames)' },
    [id + '_down']: { frames: BODY.down.map((b) => stack(h.down, b)), pal, note: 'Hero facing down' },
    [id + '_up']: { frames: BODY.up.map((b) => stack(h.up, b)), pal, note: 'Hero facing up' },
  };
}

/** Held Weapon shapes (6×8, hand at the bottom); Y takes the Weapon's colour. */
const HELD: Record<string, string[]> = {
  staff: ["..KK..", ".KYYK.", ".KYYK.", "..KK..", "..KbK.", "..KbK.", "..KbK.", "..KKK."],
  sword: ["...K..", "..KYK.", "..KYK.", "..KYK.", "..KYK.", ".KKKKK", "..KbK.", "..KK.."],
  whip: [".KKK..", "KYYYK.", "KK.KYK", "...KYK", "..KYK.", "..KbK.", "..KbK.", "..KK.."],
  scythe: ["KKKKK.", "KYYYYK", ".KK.KK", "....Kb", "...KbK", "...KbK", "..KbK.", "..KK.."],
  lance: ["..K...", ".KYK..", ".KYK..", "KYYYK.", ".KbK..", ".KbK..", ".KbK..", ".KK..."],
  maul: ["KKKKKK", "KYYYYK", "KYYYYK", "KKKKKK", "..KbK.", "..KbK.", "..KbK.", "..KK.."],
  censer: ["..KK..", ".KbbK.", "..KK..", ".KYYK.", "KYYYYK", "KYYYYK", ".KKKK.", "..YY.."],
  bow: ["..KK..", ".KbK..", "KbK.K.", "Kb..YK", "Kb..YK", "KbK.K.", ".KbK..", "..KK.."],
  trident: ["K.K.K.", "KYKYK.", ".KYK..", "..Kb..", ".KbK..", ".KbK..", ".KbK..", ".KK..."],
  cannon: ["......", "KKKKK.", "KYYYYK", "KYYYYK", "KKKKK.", ".KbK..", ".KbK..", ".KK..."],
  tome: ["......", "KKKKKK", "KYwwYK", "KYwwYK", "KYwwYK", "KYYYYK", "KKKKKK", "......"],
};
/** Which shape each Weapon uses in the hand. */
export const WEAPON_HELD: Record<string, string> = {
  judgement: 'staff',
  thornwhip: 'whip',
  sunblade: 'sword',
  boneScythe: 'scythe',
  glacierLance: 'lance',
  magmaMaul: 'maul',
  plagueCenser: 'censer',
  stormBow: 'bow',
  coralTrident: 'trident',
  gearCannon: 'cannon',
  lichTome: 'tome',
};
const held = (): Record<string, SpriteDef> =>
  Object.fromEntries(Object.entries(HELD).map(([k, rows]) => ['held_' + k, { frames: [rows], pal: { K: OUTLINE, Y: '#ffd23f', b: '#6b3e26', w: '#fff4e0' }, note: 'Held Weapon (Y = Weapon colour)' }]));

export const HEROES: RealmSprites = {
  realm: 'heroes',
  palette: [OUTLINE, '#ffd9b0', '#f28b9b', '#6b3e26', '#5a3ad6', '#9a7aff', '#ffd23f', '#3f5fd1', '#7fa2ff', '#aab6c6', '#e8434f', '#3f8f3a'],
  ground: 0,
  sprites: { ...heroSprites('mage'), ...heroSprites('knight'), ...heroSprites('ranger'), ...heroSprites('alchemist'), ...held() },
};
