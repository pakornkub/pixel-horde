import type { RealmSprites } from '../types';
import { COMMON } from './common';
import { CRATER } from './crater';
import { DEEPDARK } from './deepdark';
import { FROSTPEAK } from './frostpeak';
import { GREENVALE } from './greenvale';
import { SUNSCAR } from './sunscar';

/** Every Lumora sprite file, in Realm order (theme index = order − 1 for the four Realms). */
export const LUMORA: RealmSprites[] = [COMMON, GREENVALE, SUNSCAR, DEEPDARK, FROSTPEAK, CRATER];

/** Flat lookup: sprite name → definition (names are unique across files). */
export const SPRITES = Object.fromEntries(LUMORA.flatMap((r) => Object.entries(r.sprites)));
