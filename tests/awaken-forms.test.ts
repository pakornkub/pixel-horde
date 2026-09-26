// Awakened forms (awaken.form 1): each Signature's new pattern and the Skill Line skills that combo with it,
// plus the Signature fixes that ship with them (Lance aim, Shield Bash) and co-op guests reaching Awakening.
import { describe, expect, it } from 'vitest';
import { parseBalanceConfig, resolveConfig, type BalanceConfigInput } from '@pixel-horde/config';
import { AWK_TAGS, createSim, hostSnapshot, shieldPoints, type Enemy, type HeroId, type SimState, type SkillId } from '@pixel-horde/sim';
import { spawnEnemy } from '../packages/sim/src/systems/spawner';
import { killE } from '../packages/sim/src/systems/combat';
import { botOptions } from './bot';

const quiet = { bloodMoon: false, dragon: false, rival: false };
const FORM: BalanceConfigInput = { shared: { awaken: { form: 1 }, player: { dmgVariance: 0, crit: 0 } } };

/** A god-mode Hero with exactly these skills and no spawns; `awakened` defaults to true. */
function hero(h: HeroId, skills: Partial<Record<SkillId, number>>, patch: BalanceConfigInput = FORM, awakened = true) {
  const sim = createSim(botOptions(3, { hero: h, config: resolveConfig(parseBalanceConfig(patch)), debug: { god: true }, events: quiet }));
  const s = sim.view() as SimState;
  s.spawnAcc = -1e9; s.waveT = 1e9; s.enemies = [];
  s.P.skills = { ...skills };
  s.P.awakened = awakened;
  const mob = (x: number, y: number, hp = 1e6): Enemy => { const e = spawnEnemy(s, 'mush', x, y, false); e.hp = e.maxHp = hp; e.spd = 0; e.armor = 0; return e; };
  const crowd = (x: number, y: number, n = 6): Enemy[] => Array.from({ length: n }, (_, i) => mob(x + (i % 3) * 6 - 6, y + Math.floor(i / 3) * 6 - 3));
  const run = (secs: number): void => { for (let i = 0; i < secs * 60; i++) { s.spawnAcc = -1e9; sim.step({ mx: 0, my: 0 }); } };
  return { sim, s, mob, crowd, run };
}

describe('Lance aim', () => {
  it('fires the way the Hero faces by default, at the thickest crowd with lance.aim', () => {
    const angle = (patch: BalanceConfigInput): number => {
      const { s, mob, crowd, run } = hero('knight', { lance: 1 }, patch, false);
      mob(60, 0); crowd(0, -80);
      run(0.1);
      const l = s.bolts.find((b) => b.kind === 'lance')!;
      return Math.atan2(l.vy, l.vx);
    };
    expect(Math.abs(angle({}))).toBeLessThan(0.01); // facing right
    expect(angle({ shared: { skills: { lance: { aim: 32 } } } })).toBeCloseTo(-Math.PI / 2, 0); // up, at the crowd
  });
});

describe('Shield Bash', () => {
  it('swings the shields out to reach monsters the plain ring never touches', () => {
    const reach = (patch: BalanceConfigInput): { far: number; hurt: boolean } => {
      const { s, mob, run } = hero('knight', { shield: 3 }, patch, false);
      const e = mob(46, 0);
      let far = 0;
      for (let i = 0; i < 3 * 60; i++) { run(1 / 60); for (const [x, y] of shieldPoints(s)) far = Math.max(far, Math.hypot(x - s.P.x, y - s.P.y)); }
      return { far, hurt: e.hp < e.maxHp };
    };
    const plain = reach({}), bash = reach({ shared: { skills: { shield: { bashCd: 1, bashMul: 2.2 } } } });
    expect(plain.hurt).toBe(false);
    expect(bash.hurt).toBe(true);
    expect(bash.far).toBeGreaterThan(plain.far * 1.8);
  });
});

describe('Paladin: Judgement Shields', () => {
  it('adds an outer ring only once Awakened with awaken.form', () => {
    expect(shieldPoints(hero('knight', { shield: 6 }, FORM, false).s).length).toBe(shieldPoints(hero('knight', { shield: 6 }, {}, true).s).length);
    const { s } = hero('knight', { shield: 6 });
    expect(shieldPoints(s).filter((p) => p[2] === 1).length).toBe(s.cfg.skills.shield.awk.n);
  });

  it('throws the outer shields at a crowd: the slam hurts, gathers and marks it', () => {
    const { s, crowd, run } = hero('knight', { shield: 6 });
    const mobs = crowd(90, 0);
    run(0.1);
    expect(s.effects.filter((f) => f.type === 'sshield').length).toBe(s.cfg.skills.shield.awk.n);
    run(0.5);
    expect(mobs.every((e) => e.hp < e.maxHp)).toBe(true);
    expect(mobs.some((e) => (e.gath || 0) > 1.5)).toBe(true);
    expect(s.P.mark).toBeTruthy();
    run(1);
    expect(s.effects.some((f) => f.type === 'sshield')).toBe(false); // back in orbit
  });

  it('Judgement Pillar burns on the slam: Firestorm; Sacred Blades grind the gathered', () => {
    const { s, crowd, run } = hero('knight', { shield: 6, judgePillar: 5, sacredBlades: 5 });
    for (const e of [...crowd(70, 0, 9), ...crowd(-40, 0, 9)]) e.spd = 20; // they keep coming back after the knockback
    run(12);
    expect(s.comboCounts.firestorm || 0).toBeGreaterThan(0);
    expect(s.comboCounts.grinder || 0).toBeGreaterThan(0);
  });

  it('Aegis Dome bursts every shield outward', () => {
    const { s, mob, run } = hero('knight', { shield: 6, aegisDome: 1 });
    mob(0, 50);
    run(0.1);
    const burst = s.effects.find((f) => f.type === 'nova' && f.tag === AWK_TAGS.slam);
    expect(burst?.R).toBe(s.cfg.skills.shield.awk.domeR);
  });
});

describe('Archmage: Wandering Sigils', () => {
  it('sigils drift toward the crowd, gather it and leave a trail', () => {
    const { s, crowd, run } = hero('mage', { sigil: 4 });
    const mobs = crowd(80, 0);
    run(0.1);
    const f = s.effects.find((x) => x.type === 'sigil' && x.awk)!;
    const x0 = f.x;
    run(1.5);
    expect(f.x).toBeGreaterThan(x0 + 20);
    expect(s.effects.filter((x) => x.type === 'sigil' && !x.awk).length).toBeGreaterThan(0); // trail marks
    run(1.5);
    expect(mobs.some((e) => (e.gath || 0) > 0)).toBe(true);
    expect(mobs.some((e) => e.hp < e.maxHp)).toBe(true);
  });

  it('Starfall aims at the sigils (Catalyst); Time Warp freezes; Mana Nova echoes', () => {
    const { s, crowd, mob, run } = hero('mage', { sigil: 4, starfall: 4, timeWarp: 4, manaNova: 1 });
    crowd(70, 0, 9);
    const near = mob(20, 20);
    run(6);
    expect(s.comboCounts.catalyst || 0).toBeGreaterThan(0);
    expect(near.frz > 0 || (s.comboCounts.shatter || 0) > 0).toBe(true);
    expect(s.effects.filter((f) => f.type === 'nova').length + (s.comboCounts.catalyst || 0)).toBeGreaterThan(0);
  });
});

describe('Stormhunter: Hawk Flock', () => {
  it('a flock of hawks dives separate prey and leaves them Shocked', () => {
    const { s, mob, run } = hero('ranger', { hawk: 3 });
    const mobs = [mob(60, 0), mob(-60, 0), mob(0, 50), mob(0, -50), mob(80, 40)];
    run(0.05);
    expect(s.effects.filter((f) => f.type === 'hawk').length).toBe(s.cfg.skills.hawk.awk.n);
    run(0.6);
    expect(mobs.filter((e) => e.hp < e.maxHp).length).toBe(5);
    expect(mobs.filter((e) => (e.shock || 0) > 0).length).toBe(5);
  });

  it('Arrow Rain turns to fire on the prey (Overload); Gale Step gathers for the flock (Grinder)', () => {
    const { s, crowd, sim } = hero('ranger', { hawk: 3, arrowRain: 4, galeStep: 4 });
    crowd(24, 12, 9); crowd(-24, -12, 9);
    for (let i = 0; i < 8 * 60; i++) { s.spawnAcc = -1e9; sim.step({ mx: i % 120 < 60 ? 0.5 : -0.5, my: 0 }); }
    expect(s.comboCounts.overload || 0).toBeGreaterThan(0);
    expect(s.comboCounts.grinder || 0).toBeGreaterThan(0);
  });
});

describe('Grand Alchemist: Giant Flask', () => {
  it('a giant flask bursts into small flasks of every element', () => {
    const { s, crowd, run } = hero('alchemist', { flask: 3 });
    crowd(60, 0, 9);
    run(0.6);
    const shards = s.effects.filter((f) => f.type === 'flask' && !f.awk);
    expect(shards.length).toBe(s.cfg.skills.flask.awk.shards);
    expect(new Set(shards.map((f) => f.el)).size).toBe(3);
    expect(s.P.mark).toBeTruthy();
  });

  it('the Cauldron lands on the burst and Toxic Burst follows; Elixir Rain readies the next flask', () => {
    const { s, crowd, run } = hero('alchemist', { flask: 3, cauldron: 4, elixirRain: 1 });
    crowd(70, 0, 9);
    s.P.hp = 50;
    run(6);
    expect(s.comboCounts.toxicBurst || 0).toBeGreaterThan(0);
    expect(s.effects.some((f) => f.type === 'cauldron' && f.x > 30) || (s.comboCounts.toxicBurst || 0) > 0).toBe(true);
  });

  it('Transmute passes a dying monster\'s Statuses to its neighbours', () => {
    const { s, mob } = hero('alchemist', { flask: 1, transmute: 4 });
    const a = mob(20, 0), b = mob(30, 0);
    a.burn = 2; a.pois = 3; a.poisDps = 5;
    killE(s, a);
    expect(b.burn).toBe(2);
    expect(b.pois).toBe(3);
  });
});

describe('co-op guests', () => {
  it('a guest is offered Awakening when the host clears the Stage', () => {
    const host = createSim(botOptions(21, { events: quiet, coop: { role: 'host', self: 'H' }, debug: { god: true } }));
    const guest = createSim(botOptions(100, { hero: 'knight', events: quiet, coop: { role: 'guest', self: 'G0' }, debug: { god: true } }));
    const hs = host.view() as SimState, gs = guest.view() as SimState;
    const max = (id: SkillId): number => gs.cfg.skills[id].max;
    gs.P.skills = { shield: max('shield'), orbit: max('orbit'), lance: max('lance') };
    gs.P.evo = { shield: true };
    const snap = (): void => { guest.step({ mx: 0, my: 0 }, [{ type: 'snap', snap: JSON.parse(JSON.stringify(hostSnapshot(hs))) }]); };
    const clear = (): void => {
      hs.bossSpawned = true; hs.boss = null; hs.stageTime = hs.stageDur;
      for (let i = 0; i < 600 && hs.phase !== 'clear'; i++) {
        host.step({ mx: 0, my: 0 }, hs.phase === 'levelup' ? [{ type: 'pick', index: 0 }] : hs.phase === 'chest' ? [{ type: 'chestStop' }] : []);
        if (i % 4 === 0) snap();
        if (gs.phase === 'levelup') guest.step({ mx: 0, my: 0 }, [{ type: 'pick', index: 0 }]);
        if (gs.phase === 'chest') guest.step({ mx: 0, my: 0 }, [{ type: 'chestStop' }]);
      }
      for (let i = 0; i < 30; i++) { snap(); if (gs.phase === 'levelup') guest.step({ mx: 0, my: 0 }, [{ type: 'pick', index: 0 }]); if (gs.phase === 'chest') guest.step({ mx: 0, my: 0 }, [{ type: 'chestStop' }]); }
    };
    snap();
    clear(); // Links maxed mid-Stage: this one does not count
    host.step({ mx: 0, my: 0 }, [{ type: 'next' }]);
    if (hs.phase === 'route') host.step({ mx: 0, my: 0 }, [{ type: 'route', index: 0 }]);
    snap();
    gs.P.skills = { shield: max('shield'), orbit: max('orbit'), lance: max('lance') }; // level-ups may have added skills
    expect(gs.stage).toBe(hs.stage);
    clear();
    expect(gs.awakenOffer).toBe(true);
  });
});
