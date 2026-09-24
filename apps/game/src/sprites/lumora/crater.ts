// Heart Crater (Chapter 8): Umbra, the final King. Placeholder until ticket 29 gives it its own art:
// a crowned shadow of the Hero.
import { OUTLINE, type RealmSprites } from '../types';
import { CROWN, HERO_PAL, HERO_TOP, LEGS_A, LEGS_B } from './common';

const CROWN16 = CROWN.map((r) => '.' + r + '.');
const UMBRA_PAL = { ...HERO_PAL, h: '#1a1030', H: '#3a1f66', c: '#241640', C: '#4a2d80', s: '#6a5a8a', g: '#ff2a5c', p: '#ff2a5c', b: OUTLINE, Y: '#b07cff' };

export const CRATER: RealmSprites = {
  realm: 'crater',
  palette: [OUTLINE, '#1a1030', '#3a1f66', '#241640', '#4a2d80', '#6a5a8a', '#ff2a5c', '#b07cff', '#ffd9b0', '#f28b9b', '#ffd23f', '#6b3e26'],
  ground: 1,
  sprites: {
    umbra: { frames: [[...CROWN16, ...HERO_TOP, ...LEGS_A], [...CROWN16, ...HERO_TOP, ...LEGS_B]], pal: UMBRA_PAL, note: 'Umbra, final King (placeholder, drawn ×3)' },
  },
};
