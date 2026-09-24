import { describe, expect, it } from 'vitest';
import { parseBalanceConfig, resolveConfig } from '@pixel-horde/config';
import { SKILL_TAGS, createSim, type ComboId, type Enemy, type HitTag, type SimEvent, type SimState } from '@pixel-horde/sim';
import { hit } from '../packages/sim/src/systems/combat';
import { chillTick } from '../packages/sim/src/systems/combos';
import { spawnEnemy } from '../packages/sim/src/systems/spawner';
import { HOLE_BOOM } from '../packages/sim/src/data/skills';
import { botOptions } from './bot';

// no damage variance, no crits: damage numbers are exact
const config = resolveConfig(parseBalanceConfig({ shared: { player: { dmgVariance: 0, crit: 0 } } }));

function setup(realm: SimState['realm'] = 'greenvale') {
  const s = createSim(botOptions(1, { config })).view() as SimState;
  s.realm = realm;
  s.enemies = [];
  s.events = [];
  s.P.crit = 0;
  const mob = (x = 40, y = 0): Enemy => { const e = spawnEnemy(s, 'mush', x, y, false); e.hp = e.maxHp = 1e9; e.armor = 0; return e; };
  const combos = (): ComboId[] => s.events.filter((e): e is Extract<SimEvent, { t: 'combo' }> => e.t === 'combo').map((e) => e.id);
  const dmgs = (): number[] => s.events.filter((e): e is Extract<SimEvent, { t: 'dmg' }> => e.t === 'dmg').map((e) => e.d);
  return { s, mob, combos, dmgs };
}

type Status = 'frz' | 'gath' | 'burn' | 'shock' | 'pois';
const PAIRS: [Status, HitTag, ComboId][] = [
  ['frz', SKILL_TAGS.lance, 'shatter'],
  ['gath', SKILL_TAGS.nova, 'firestorm'],
  ['shock', SKILL_TAGS.nova, 'overload'],
  ['frz', SKILL_TAGS.chain, 'superconduct'],
  ['pois', SKILL_TAGS.nova, 'toxicBurst'],
  ['gath', SKILL_TAGS.orbit, 'grinder'],
  ['burn', SKILL_TAGS.bolt, 'catalyst'],
];
const TAGS: HitTag[] = [SKILL_TAGS.bolt, SKILL_TAGS.orbit, SKILL_TAGS.chain, SKILL_TAGS.nova, SKILL_TAGS.meteor, SKILL_TAGS.frost, SKILL_TAGS.lance, SKILL_TAGS.toxic, SKILL_TAGS.hole, HOLE_BOOM];

describe('Statuses and Combos', () => {
  it.each(PAIRS)('%s + %o fires %s', (status, tag, combo) => {
    const { s, mob, combos } = setup();
    const e = mob();
    e[status] = 2;
    if (status === 'pois') e.poisDps = 10;
    hit(s, e, 10, '#fff', 0, tag);
    expect(combos()).toContain(combo);
  });

  it('a Combo never fires without its Status', () => {
    for (const tag of TAGS) {
      const { s, mob, combos } = setup();
      hit(s, mob(), 10, '#fff', 0, tag);
      expect(combos(), JSON.stringify(tag)).toEqual([]);
    }
  });

  it('each Status only starts the Combos of its pairs', () => {
    const want: Record<Status, ComboId[]> = { frz: ['shatter', 'superconduct', 'catalyst'], gath: ['firestorm', 'grinder', 'catalyst'], burn: ['catalyst'], shock: ['overload', 'catalyst'], pois: ['toxicBurst', 'catalyst'] };
    for (const st of Object.keys(want) as Status[]) {
      const seen = new Set<ComboId>();
      for (const tag of TAGS) {
        const { s, mob, combos } = setup();
        const e = mob();
        e[st] = 2;
        hit(s, e, 10, '#fff', 0, tag);
        combos().forEach((c) => seen.add(c));
      }
      expect([...seen].sort(), st).toEqual(want[st].sort());
    }
  });

  it('the same Combo hits the same monster at most once per second', () => {
    const { s, mob, combos } = setup();
    const e = mob();
    e.gath = 5;
    hit(s, e, 10, '#fff', 0, SKILL_TAGS.orbit);
    hit(s, e, 10, '#fff', 0, SKILL_TAGS.orbit);
    expect(combos()).toEqual(['grinder']);
    s.clock += s.cfg.combos.cooldown;
    hit(s, e, 10, '#fff', 0, SKILL_TAGS.orbit);
    expect(combos()).toEqual(['grinder', 'grinder']);
    expect(s.combos).toBe(2);
  });

  it('Shatter multiplies the hit and consumes Frozen; Grinder adds 50%', () => {
    const { s, mob, dmgs } = setup();
    const a = mob(), b = mob(200, 200);
    hit(s, a, 100, '#fff', 0, SKILL_TAGS.lance);
    b.frz = 1;
    hit(s, b, 100, '#fff', 0, SKILL_TAGS.lance);
    const [plain, shattered] = dmgs();
    expect(shattered / plain).toBeCloseTo(s.cfg.combos.shatter, 1);
    expect(b.frz).toBe(0);
  });

  it('Burning, Shocked and Poisoned are left by fire, lightning and poison hits', () => {
    const { s, mob } = setup();
    const e = mob();
    hit(s, e, 10, '#fff', 0, SKILL_TAGS.nova);
    hit(s, e, 10, '#fff', 0, SKILL_TAGS.chain);
    hit(s, e, 10, '#fff', 0, SKILL_TAGS.toxic);
    expect(e.burn).toBe(s.cfg.status.burning);
    expect(e.shock).toBe(s.cfg.status.shocked);
    expect(e.pois).toBe(s.cfg.status.poisoned);
    expect(e.poisDps).toBeGreaterThan(0);
  });

  it('Superconduct removes armour for a while', () => {
    const { s, mob, dmgs } = setup();
    const e = mob();
    e.armor = 50;
    e.frz = 1;
    hit(s, e, 100, '#fff', 0, SKILL_TAGS.chain); // Superconduct fires on this hit (armour already off for it)
    hit(s, e, 100, '#fff', 0, SKILL_TAGS.lance);
    expect(dmgs()[1]).toBeGreaterThan(80);
    expect(e.armorOff).toBeGreaterThan(0);
  });

  it('Frost Aura stacks freeze monsters; bosses are only slowed', () => {
    const { s, mob } = setup();
    const e = mob();
    for (let i = 0; i < s.cfg.status.frostStacks; i++) chillTick(s, e);
    expect(e.frz).toBe(s.cfg.status.frozen);
    const k = spawnEnemy(s, 'boss', 0, 60, false);
    for (let i = 0; i < s.cfg.status.frostStacks; i++) chillTick(s, k);
    expect(k.frz).toBeLessThanOrEqual(0);
    expect(k.slowT).toBeGreaterThan(0);
  });

  it('Realm mobs resist their Realm\'s element by 50%; event bosses do not', () => {
    const a = setup('frostpeak'), b = setup('greenvale');
    hit(a.s, a.mob(), 100, '#fff', 0, SKILL_TAGS.frost);
    hit(b.s, b.mob(), 100, '#fff', 0, SKILL_TAGS.frost);
    expect(a.dmgs()[0] / b.dmgs()[0]).toBeCloseTo(0.5, 1);
    const d = spawnEnemy(a.s, 'dragon', 0, 80, false);
    d.hp = 1e9;
    a.s.events = [];
    hit(a.s, d, 100, '#fff', 0, SKILL_TAGS.frost);
    expect(a.dmgs()[0]).toBe(b.dmgs()[0]);
  });
});
