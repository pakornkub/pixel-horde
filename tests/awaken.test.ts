import { describe, expect, it } from 'vitest';
import { AWAKENING, HEROES, SKILL_LINES, awakenEligible, createSim, hostSnapshot, signatureOf, type HeroId, type SimState, type SkillId } from '@pixel-horde/sim';
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

describe('Awakening', () => {
  it('happens by itself as soon as the Signature is evolved and the Links are at max level by a Stage\'s end', () => {
    const { s, endStage, next, maxLinks } = setup();
    maxLinks(2);
    endStage(); // maxed mid-Stage: still counts, since both requirements are true by this Stage's end
    expect(s.P.awakened).toBe(true);
    expect(s.awakenNew).toBe(true); // the clear screen shows what it brought
    next();
    expect(s.awakenNew).toBe(false);
    expect(awakenEligible(s)).toBe(false); // once per Run
  });

  it('Awakens the Stage the Signature evolves and the 2nd required Link first maxes, even if both happen together mid-Stage', () => {
    const { s, endStage, next, maxLinks } = setup();
    maxLinks(1); // one Link already maxed from before; the Signature not evolved yet
    s.P.evo = {};
    endStage(); next();
    expect(s.P.awakened).toBe(false); // not eligible: the Signature has not evolved
    // mid-Stage: the Signature evolves AND the 2nd Link reaches max level, both for the first time
    s.P.evo = { [signatureOf('mage')]: true };
    const link2 = SKILL_LINES.mage[1];
    s.P.skills[link2] = s.cfg.skills[link2].max;
    endStage();
    expect(s.P.awakened).toBe(true);
    expect(s.awakenNew).toBe(true);
  });

  it('the retired awaken command changes nothing', () => {
    const { sim, s, endStage, next, maxLinks } = setup();
    maxLinks(2);
    endStage(); next();
    sim.step({ mx: 0, my: 0 }, [{ type: 'awaken', accept: false }]);
    endStage();
    expect(s.P.awakened).toBe(true);
  });

  it('needs the Signature evolved and the Links equipped (the Bench does not count)', () => {
    const a = setup();
    a.maxLinks(2);
    a.s.P.evo = {};
    a.endStage(); a.next(); a.endStage();
    expect(a.s.P.awakened).toBe(false);
    const b = setup();
    b.maxLinks(2);
    b.s.P.evo = {}; // the Signature has not evolved yet
    b.endStage(); b.next();
    const link = SKILL_LINES.mage[1];
    b.s.P.bench = [{ id: link, lv: b.s.P.skills[link]!, evo: false }];
    delete b.s.P.skills[link];
    b.s.P.evo = { [signatureOf('mage')]: true }; // now it evolves, but only 1 Link is still equipped
    b.endStage();
    expect(b.s.P.awakened).toBe(false);
  });

  it('by default it consumes two Links, transforms the Signature and adds the line skills at level 1', async () => {
    const { buildOptions } = await import('../packages/sim/src/systems/progress');
    const { s, endStage, maxLinks } = setup('knight');
    maxLinks(3);
    endStage();
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
    const { s, endStage, maxLinks } = setup('mage');
    s.cfg = { ...s.cfg, awaken: { ...s.cfg.awaken, grant: 1, grantLv: 6, wLine: 50 } };
    maxLinks(2);
    endStage();
    const [first, second] = AWAKENING.mage.line;
    expect(s.P.skills[first]).toBe(6);
    expect(s.P.skills[second]).toBeUndefined();
    let lineOffers = 0, total = 0;
    for (let i = 0; i < 200; i++) for (const o of buildOptions(s)) { total++; if (o.kind === 'skill' && AWAKENING.mage.line.includes(o.id as never)) lineOffers++; }
    expect(lineOffers / total).toBeGreaterThan(0.5);
  });

  it('awaken.keep + awaken.slots: the Links stay, an extra attack slot opens and holds the granted skill', async () => {
    const { attackSlots } = await import('@pixel-horde/sim');
    const { buildOptions } = await import('../packages/sim/src/systems/progress');
    const { s, endStage, maxLinks } = setup('ranger');
    s.cfg = { ...s.cfg, awaken: { ...s.cfg.awaken, keep: 1, slots: 1, grant: 1, grantLv: 6 } };
    maxLinks(3); // Signature + three Links: every base slot is full
    expect(attackSlots(s)).toBe(s.cfg.maxAttackSlots);
    endStage();
    for (const id of SKILL_LINES.ranger) expect(s.P.skills[id]).toBe(s.cfg.skills[id].max);
    expect(s.P.skills[signatureOf('ranger')]).toBeDefined();
    expect(attackSlots(s)).toBe(s.cfg.maxAttackSlots + 1);
    expect(s.P.skills[AWAKENING.ranger.line[0]]).toBe(6);
    expect(Object.keys(s.P.skills).length).toBe(s.cfg.maxAttackSlots + 1);
    // slots full again: new skills now go to the Bench
    for (let i = 0; i < 50; i++) for (const o of buildOptions(s)) if (o.kind === 'skill' && !s.P.skills[o.id]) expect(o.toBench).toBe(true);
  });

  it('awaken.keep without awaken.slots: full attack slots send the granted skill to the Bench, not nowhere', async () => {
    const { attackSlots, benchSize } = await import('@pixel-horde/sim');
    const { s, endStage, next, maxLinks } = setup('ranger');
    s.cfg = { ...s.cfg, awaken: { ...s.cfg.awaken, keep: 1, slots: 0, grant: 2, grantLv: 6 } };
    endStage(); next(); // an uneventful Stage 1, now on Chapter 2
    maxLinks(3); // Signature + three Links: every slot is full and stays full
    s.P.bench = [];
    expect(benchSize(s)).toBe(1); // Chapter 2: room for one of the two granted skills
    endStage(); // maxed mid-Stage: still counts by this Stage's end
    expect(Object.keys(s.P.skills).length).toBe(attackSlots(s));
    const [first, second] = AWAKENING.ranger.line;
    expect(s.P.skills[first]).toBeUndefined();
    expect(s.P.skills[second]).toBeUndefined();
    expect(s.P.bench).toEqual([{ id: first, lv: 6, evo: false }]); // a full Bench ends the grant
  });

  it('by default (version 0) Awakening adds no slot', async () => {
    const { attackSlots, lineSlots } = await import('@pixel-horde/sim');
    const { s, endStage, maxLinks } = setup('mage');
    maxLinks(2);
    endStage();
    expect(attackSlots(s)).toBe(s.cfg.maxAttackSlots);
    expect(lineSlots(s)).toBe(0);
  });

  it('awaken.lineSlots: Mora\'s Awakened skills (Bone Spear, Soulfire, Bone Ward) take the Awakened slots too', async () => {
    const { lineSlots, slotUse } = await import('@pixel-horde/sim');
    const { buildOptions } = await import('../packages/sim/src/systems/progress');
    const { s, endStage, maxLinks } = setup('necromancer');
    s.cfg = { ...s.cfg, awaken: { ...s.cfg.awaken, keep: 1, slots: 0, lineSlots: 3, grant: 3, grantLv: 1 } };
    maxLinks(3); // Signature + three Links: every normal slot is full
    endStage();
    expect(s.P.awakened).toBe(true);
    expect(lineSlots(s)).toBe(3);
    for (const id of AWAKENING.necromancer.line) expect(s.P.skills[id]).toBe(1); // all three in their own slots, none benched
    expect(AWAKENING.necromancer.line).toEqual(['boneSpear', 'soulfire', 'boneWard']);
    expect(slotUse(s, 'boneSpear')).toEqual({ used: 3, max: 3 });
    expect(slotUse(s, signatureOf('necromancer'))).toEqual({ used: 4, max: s.cfg.maxAttackSlots });
    expect(s.P.bench.some((b) => AWAKENING.necromancer.line.includes(b.id as never))).toBe(false);
    for (let i = 0; i < 30; i++) for (const o of buildOptions(s)) if (o.kind === 'skill' && AWAKENING.necromancer.line.includes(o.id as never)) expect(o.toBench).toBeUndefined();
  });

  it('awaken.lineSlots: three Awakened-only slots next to full normal slots (4 + 3 = 7)', async () => {
    const { attackSlots, lineSlots, slotUse } = await import('@pixel-horde/sim');
    const { buildOptions, swapBench } = await import('../packages/sim/src/systems/progress');
    const { s, endStage, maxLinks } = setup('ranger');
    s.cfg = { ...s.cfg, awaken: { ...s.cfg.awaken, keep: 1, slots: 0, lineSlots: 3, grant: 1, grantLv: 6 } };
    maxLinks(3); // Signature + three Links: every normal slot is full
    expect(lineSlots(s)).toBe(0); // not Awakened yet
    endStage();
    expect(s.P.awakened).toBe(true);
    expect(attackSlots(s)).toBe(s.cfg.maxAttackSlots);
    expect(lineSlots(s)).toBe(3);
    const [first, second, third] = AWAKENING.ranger.line;
    expect(s.P.skills[first]).toBe(6); // the granted skill takes an Awakened slot, not the Bench
    expect(slotUse(s, first)).toEqual({ used: 1, max: 3 });
    expect(slotUse(s, 'boomer')).toEqual({ used: 4, max: 4 });
    // Awakened skills are still offered into their own slots; general Skills only to the Bench
    let lineIn = 0;
    for (let i = 0; i < 80; i++) for (const o of buildOptions(s)) {
      if (o.kind !== 'skill' || s.P.skills[o.id]) continue;
      if (AWAKENING.ranger.line.includes(o.id as never)) { expect(o.toBench).toBeUndefined(); lineIn++; } else expect(o.toBench).toBe(true);
    }
    expect(lineIn).toBeGreaterThan(0);
    s.P.skills[second] = 1; s.P.skills[third] = 1;
    expect(Object.keys(s.P.skills).length).toBe(7);
    // an Awakened skill never swaps into a normal slot, nor a general Skill into an Awakened one
    s.runGold = 1e6;
    s.P.bench = [{ id: 'bolt', lv: 2, evo: false }];
    swapBench(s, 0, first);
    expect(s.P.skills.bolt).toBeUndefined();
    swapBench(s, 0, 'boomer');
    expect(s.P.skills.bolt).toBe(2);
    expect(s.P.bench).toEqual([{ id: 'boomer', lv: s.cfg.skills.boomer.max, evo: false }]);
    s.P.bench = [{ id: third, lv: 4, evo: false }];
    delete s.P.skills[third];
    swapBench(s, 0, 'bolt');
    expect(s.P.skills[third]).toBeUndefined();
    swapBench(s, 0, null); // the empty Awakened slot
    expect(s.P.skills[third]).toBe(4);
  });

});

// Regression (B1): Links() used to be counted the instant 'clearing' began, before the King/Blood Moon chest and
// pending level-ups (opened during that same clearing sequence) had a chance to evolve the Signature or max a Link.
describe('Awakening via a Stage-end reward opened during clearing', () => {
  it('Awakens when the Signature only evolves from a level-up opened after the Stage already started clearing (host)', () => {
    const sim = createSim(botOptions(6, { hero: 'mage', debug: { god: true }, events: quiet }));
    const s = sim.view() as SimState;
    const max = (id: SkillId): number => s.cfg.skills[id].max;
    // both Links already maxed mid-Stage; the Signature (sigil) not evolved yet
    s.P.skills = { sigil: 1, bolt: max('bolt'), chain: max('chain') };
    s.P.evo = {};
    s.bossSpawned = true; s.boss = null; s.stageTime = s.stageDur;
    for (let i = 0; i < 400 && s.phase !== 'clearing'; i++) sim.step({ mx: 0, my: 0 });
    expect(s.phase).toBe('clearing'); // rewards not opened yet
    // a King chest granting a level, mid-clearing: the Signature reaches max level and its evolution passive
    s.P.skills.sigil = max('sigil');
    s.P.pas.might = 1;
    s.pendingLv = 1;
    for (let i = 0; i < 400 && s.phase !== 'clear'; i++) {
      if (s.phase === 'levelup') {
        const idx = s.levelUp!.options.findIndex((o) => o.kind === 'evo');
        sim.step({ mx: 0, my: 0 }, [{ type: 'pick', index: idx < 0 ? 0 : idx }]); // "Grand Sigil EVOLVE!"
      } else if (s.phase === 'chest') sim.step({ mx: 0, my: 0 }, [{ type: 'chestStop' }]);
      else sim.step({ mx: 0, my: 0 });
    }
    expect(s.phase).toBe('clear');
    expect(s.P.evo.sigil).toBe(true);
    expect(s.P.awakened).toBe(true);
  });

  it('same, for a guest: the Signature evolves from its own level-up opened after the host left play', () => {
    const host = createSim(botOptions(23, { events: quiet, coop: { role: 'host', self: 'H' }, debug: { god: true } }));
    const guest = createSim(botOptions(103, { hero: 'mage', events: quiet, coop: { role: 'guest', self: 'G0' }, debug: { god: true } }));
    const hs = host.view() as SimState, gs = guest.view() as SimState;
    const max = (id: SkillId): number => gs.cfg.skills[id].max;
    const snap = (): void => { guest.step({ mx: 0, my: 0 }, [{ type: 'snap', snap: JSON.parse(JSON.stringify(hostSnapshot(hs))) }]); };
    snap();
    // both Links already maxed mid-Stage; the Signature not evolved yet
    gs.P.skills = { sigil: 1, bolt: max('bolt'), chain: max('chain') };
    gs.P.evo = {};
    let injected = false;
    hs.bossSpawned = true; hs.boss = null; hs.stageTime = hs.stageDur;
    for (let i = 0; i < 600 && gs.phase !== 'clear'; i++) {
      host.step({ mx: 0, my: 0 }, hs.phase === 'levelup' ? [{ type: 'pick', index: 0 }] : hs.phase === 'chest' ? [{ type: 'chestStop' }] : []);
      // once the host has left 'play' (Stage ending) but before this guest's own snap sees it: a King kill's
      // level-up, queued locally for this guest, evolves the Signature -- mirroring the host repro above
      if (!injected && hs.phase !== 'play') { injected = true; gs.P.skills.sigil = max('sigil'); gs.P.pas.might = 1; gs.pendingLv = 1; }
      if (i % 4 === 0) snap();
      if (gs.phase === 'levelup') {
        const idx = gs.levelUp!.options.findIndex((o) => o.kind === 'evo');
        guest.step({ mx: 0, my: 0 }, [{ type: 'pick', index: idx < 0 ? 0 : idx }]); // "Grand Sigil EVOLVE!"
      }
      if (gs.phase === 'chest') guest.step({ mx: 0, my: 0 }, [{ type: 'chestStop' }]);
    }
    expect(gs.phase).toBe('clear');
    expect(gs.P.evo.sigil).toBe(true);
    expect(gs.P.awakened).toBe(true);
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
