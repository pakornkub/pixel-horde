import { describe, expect, it } from 'vitest';
import { AWAKENING, HEROES, SKILL_LINES, awakenEligible, createSim, signatureOf, type HeroId, type SimState, type Sim, type SkillId } from '@pixel-horde/sim';
import { spawnEnemy } from '../packages/sim/src/systems/spawner';
import { botOptions } from './bot';

const quiet = { bloodMoon: false, dragon: false, rival: false };

/** A sim whose current Stage is about to end with the King dead. */
function setup(hero: HeroId = 'mage') {
  const sim = createSim(botOptions(4, { hero, debug: { god: true }, events: quiet }));
  const s = sim.view() as SimState;
  const max = (id: SkillId) => s.cfg.skills[id].max;
  const endStage = (): void => {
    s.bossSpawned = true; s.boss = null; s.stageTime = s.stageDur;
    for (let i = 0; i < 400 && s.phase !== 'clear'; i++) {
      const cmds = s.phase === 'levelup' ? [{ type: 'pick' as const, index: 0 }] : s.phase === 'chest' ? [{ type: 'chestStop' as const }] : [];
      sim.step({ mx: 0, my: 0 }, cmds);
    }
    expect(s.phase).toBe('clear');
  };
  const next = (): void => {
    sim.step({ mx: 0, my: 0 }, [{ type: 'next' }]);
    if (s.phase === 'route') sim.step({ mx: 0, my: 0 }, [{ type: 'route', index: 0 }]);
  };
  const maxLinks = (n: number): void => {
    const sig = signatureOf(hero);
    s.P.skills = { [sig]: max(sig) };
    s.P.evo = { [sig]: true };
    for (const id of SKILL_LINES[hero].slice(0, n)) s.P.skills[id] = max(id);
  };
  return { sim, s, endStage, next, maxLinks };
}

function say(sim: Sim, accept: boolean): void { sim.step({ mx: 0, my: 0 }, [{ type: 'awaken', accept }]); }

describe('Awakening', () => {
  it('is offered only after two Links spent a full Stage at max level and equipped', () => {
    const { s, endStage, next, maxLinks } = setup();
    maxLinks(2);
    endStage(); // maxed mid-Stage: this Stage does not count yet
    expect(s.awakenOffer).toBe(false);
    next();
    endStage(); // a full Stage at max
    expect(s.awakenOffer).toBe(true);
  });

  it('needs the Signature evolved and the Links equipped (the Bench does not count)', () => {
    const a = setup();
    a.maxLinks(2);
    a.s.P.evo = {};
    a.endStage(); a.next(); a.endStage();
    expect(a.s.awakenOffer).toBe(false);
    const b = setup();
    b.maxLinks(2);
    b.endStage(); b.next();
    const link = SKILL_LINES.mage[1];
    b.s.P.bench = [{ id: link, lv: b.s.P.skills[link]!, evo: false }];
    delete b.s.P.skills[link];
    b.endStage();
    expect(b.s.awakenOffer).toBe(false);
  });

  it('accepting consumes two Links, transforms the Signature and adds the line skills at level 1', async () => {
    const { buildOptions } = await import('../packages/sim/src/systems/progress');
    const { sim, s, endStage, next, maxLinks } = setup('knight');
    maxLinks(3);
    endStage(); next(); endStage();
    say(sim, true);
    expect(s.P.awakened).toBe(true);
    const left = SKILL_LINES.knight.filter((id) => s.P.skills[id]);
    expect(left.length).toBe(1);
    const offered = new Set<string>();
    for (let i = 0; i < 400; i++) for (const o of buildOptions(s)) if (o.kind === 'skill' && !s.P.skills[o.id]) offered.add(o.id);
    for (const id of AWAKENING.knight.line) expect(offered).toContain(id);
    for (const other of (Object.keys(HEROES) as HeroId[]).filter((h) => h !== 'knight')) for (const id of AWAKENING[other].line) expect(offered).not.toContain(id);
  });

  it('awaken.grant gives the first Skill Line skills at awaken.grantLv; awaken.wLine favours them in offers', async () => {
    const { buildOptions } = await import('../packages/sim/src/systems/progress');
    const { sim, s, endStage, next, maxLinks } = setup('mage');
    s.cfg = { ...s.cfg, awaken: { ...s.cfg.awaken, grant: 1, grantLv: 6, wLine: 50 } };
    maxLinks(2);
    endStage(); next(); endStage();
    say(sim, true);
    const [first, second] = AWAKENING.mage.line;
    expect(s.P.skills[first]).toBe(6);
    expect(s.P.skills[second]).toBeUndefined();
    let lineOffers = 0, total = 0;
    for (let i = 0; i < 200; i++) for (const o of buildOptions(s)) { total++; if (o.kind === 'skill' && AWAKENING.mage.line.includes(o.id as never)) lineOffers++; }
    expect(lineOffers / total).toBeGreaterThan(0.5);
  });

  it('declining forfeits Awakening for the Run', () => {
    const { sim, s, endStage, next, maxLinks } = setup();
    maxLinks(2);
    endStage(); next(); endStage();
    say(sim, false);
    expect(s.P.awakenDeclined).toBe(true);
    next(); endStage();
    expect(s.awakenOffer).toBe(false);
    expect(awakenEligible(s)).toBe(false);
  });

  it('an unanswered prompt comes back at the next Stage end', () => {
    const { s, endStage, next, maxLinks } = setup();
    maxLinks(2);
    endStage(); next(); endStage();
    expect(s.awakenOffer).toBe(true);
    next(); endStage();
    expect(s.awakenOffer).toBe(true);
  });
});

describe('Skill Line skills', () => {
  function lineRun(hero: HeroId, id: SkillId, secs = 4, lv = 3) {
    const sim = createSim(botOptions(5, { hero, debug: { god: true }, events: quiet }));
    const s = sim.view() as SimState;
    s.spawnAcc = -1e9; s.waveT = 1e9; s.enemies = [];
    s.P.skills = { [id]: lv };
    s.P.awakened = true;
    const mobs = [0, 1, 2, 3, 4].map((i) => { const e = spawnEnemy(s, 'mush', 30 + i * 8, (i - 2) * 8, false); e.hp = e.maxHp = 1e6; e.spd = 0; e.armor = 0; return e; });
    for (let i = 0; i < secs * 60; i++) { s.spawnAcc = -1e9; sim.step({ mx: i % 120 < 60 ? 0.5 : -0.5, my: 0 }); }
    return { s, mobs };
  }
  it.each([
    ['mage', 'manaNova'], ['mage', 'timeWarp'], ['mage', 'starfall'],
    ['knight', 'sacredBlades'], ['knight', 'judgePillar'],
    ['ranger', 'arrowRain'], ['ranger', 'galeStep'], ['ranger', 'thunderHawk'],
    ['alchemist', 'cauldron'],
  ] as [HeroId, SkillId][])('%s: %s damages monsters', (hero, id) => {
    const { mobs } = lineRun(hero, id);
    expect(mobs.some((e) => e.hp < e.maxHp)).toBe(true);
  });

  it('Aegis Dome makes the player invulnerable for a moment', () => {
    const { s } = lineRun('knight', 'aegisDome', 1.5);
    expect(s.effects.some((f) => f.type === 'dome') || s.P.inv > 0).toBe(true);
  });

  it('Elixir Rain heals and cuts cooldowns', () => {
    const sim = createSim(botOptions(5, { hero: 'alchemist', events: quiet }));
    const s = sim.view() as SimState;
    s.P.skills = { elixirRain: 3, flask: 1 };
    s.P.hp = 30; s.P.cds.flask = 5;
    for (let i = 0; i < 20; i++) sim.step({ mx: 0, my: 0 });
    expect(s.P.hp).toBeGreaterThan(30);
    expect(s.P.cds.flask!).toBeLessThan(5 - 20 / 60);
  });

  it('Transmute turns dying monsters into EXP crystals, never Gold', async () => {
    const { killE } = await import('../packages/sim/src/systems/combat');
    const sim = createSim(botOptions(5, { hero: 'alchemist', events: quiet }));
    const s = sim.view() as SimState;
    s.P.skills = { transmute: 8 };
    s.gems = [];
    const coinsBefore = s.runGold;
    for (let i = 0; i < 200; i++) { const e = spawnEnemy(s, 'slime', 10, 0, false); killE(s, e); }
    const bigXp = s.gems.filter((g) => g.kind === 'xp' && g.v >= s.cfg.skills.transmute.xp.base);
    expect(bigXp.length).toBeGreaterThan(20);
    expect(s.runGold).toBe(coinsBefore);
  });
});
