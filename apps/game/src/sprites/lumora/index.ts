import type { RealmSprites } from '../types';
import { COMMON } from './common';
import { HEROES } from './heroes';
import { CRATER } from './crater';
import { DEEPDARK } from './deepdark';
import { FROSTPEAK } from './frostpeak';
import { GREENVALE } from './greenvale';
import { SUNSCAR } from './sunscar';
import { EMBERFORGE } from './emberforge';
import { MIREFEN } from './mirefen';
import { SKYREACH } from './skyreach';
import { TIDEHOLLOW } from './tidehollow';
import { GEARSPIRE } from './gearspire';
import { DUSKHOLD } from './duskhold';

/** Every Lumora sprite file (`ground` is the Realm's tile theme index). */
export const LUMORA: RealmSprites[] = [HEROES, COMMON, GREENVALE, SUNSCAR, DEEPDARK, FROSTPEAK, CRATER, EMBERFORGE, MIREFEN, SKYREACH, TIDEHOLLOW, GEARSPIRE, DUSKHOLD];

/** Flat lookup: sprite name → definition (names are unique across files). */
export const SPRITES = Object.fromEntries(LUMORA.flatMap((r) => Object.entries(r.sprites)));
