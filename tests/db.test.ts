// Runs every supabase/tests/*.test.sql (pgTAP style) against the migrations inside PGlite.
import { readFileSync, readdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const read = (p: string): string => readFileSync(new URL(p, root), 'utf8');
const migrations = readdirSync(new URL('supabase/migrations/', root)).filter((f) => f.endsWith('.sql')).sort();
const tests = readdirSync(new URL('supabase/tests/', root)).filter((f) => f.endsWith('.test.sql')).sort();

export async function freshDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(read('tests/db/supabase-stub.sql'));
  await db.exec(read('tests/db/pgtap-shim.sql'));
  for (const m of migrations) await db.exec(read('supabase/migrations/' + m));
  return db;
}

describe('database (pgTAP files in PGlite)', () => {
  it.each(tests)('%s', async (file) => {
    const db = await freshDb();
    const results = await db.exec(read('supabase/tests/' + file));
    const lines = results.flatMap((r) => r.rows.flatMap((row) => Object.values(row))).filter((v): v is string => typeof v === 'string' && /^(not )?ok\b/.test(v));
    const failed = lines.filter((l) => l.startsWith('not ok'));
    expect(lines.length).toBeGreaterThan(1);
    expect(failed, lines.join('\n')).toEqual([]);
  });

  it('the SQL nickname filter matches supabase/profanity.json', async () => {
    const words: string[] = JSON.parse(read('supabase/profanity.json')).words;
    const sql = migrations.map((m) => read('supabase/migrations/' + m)).join('\n');
    for (const w of words) expect(sql, w).toContain(`'${w}'`);
  });
});

describe('nickname rules agree between client and server', () => {
  it('same verdict for sample names', async () => {
    const { nicknameProblem } = await import('../apps/game/src/net/nickname');
    const db = await freshDb();
    const names = ['Alice', 'ab', 'x', 'ผู้กล้า', 'เหี้ยมาก', 'F.u.c.k', 'sh1t', 'Grape', 'Hero#0420', 'a<b', 'ชาติหมา99', 'Peacock', 'n1gga', 'Sunny_Day', '   ', 'This name is way too long'];
    for (const n of names) {
      const r = await db.query<{ ok: boolean }>('select public.nickname_is_valid($1) as ok', [n]);
      expect(r.rows[0].ok, n).toBe(nicknameProblem(n) === null);
    }
  });
});

describe('server copy of the Balance Config', () => {
  it('version 0 in the migrations, with later fields filled in, equals the built-in defaults', async () => {
    const { DEFAULT_CONFIG, parseBalanceConfig } = await import('@pixel-horde/config');
    const db = await freshDb();
    const r = await db.query<{ data: Record<string, unknown> }>('select data from public.balance_configs where version = 0');
    // published versions are immutable, so fields added after launch come from the client's defaults
    const rest = { ...r.rows[0].data };
    delete rest.version;
    expect(JSON.parse(JSON.stringify({ ...parseBalanceConfig(rest), version: 0 }))).toEqual(JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
  });

  it('shop prices match the client', async () => {
    const { shopCost, SHOP_IDS, DEFAULT_RESOLVED } = await import('@pixel-horde/sim');
    const db = await freshDb();
    for (const id of SHOP_IDS) for (let lv = 0; lv < DEFAULT_RESOLVED.shop[id].max; lv++) {
      const r = await db.query<{ c: string }>('select public.shop_cost(0, $1, $2)::text as c', [id, lv]);
      expect(Number(r.rows[0].c), `${id} ${lv}`).toBe(shopCost(DEFAULT_RESOLVED, id, lv));
    }
  });
});

describe('server copy of the config JSON Schema', () => {
  it('equals the schema generated from zod', async () => {
    const { z } = await import('zod');
    const { BalanceConfigSchema, DEFAULT_CONFIG } = await import('@pixel-horde/config');
    const db = await freshDb();
    const r = await db.query<{ schema: unknown }>('select schema from public.config_schema where id = 1');
    expect(r.rows[0].schema).toEqual(JSON.parse(JSON.stringify(z.toJSONSchema(BalanceConfigSchema, { io: 'input', unrepresentable: 'any' }))));
    const p = await db.query<{ p: string[] }>('select public.config_problems($1::jsonb) as p', [JSON.stringify(DEFAULT_CONFIG)]);
    expect(p.rows[0].p).toEqual([]);
  });
});

describe('achievement rules agree between the sim and the server', () => {
  it('same achievements for sample Runs', async () => {
    const { ACHIEVEMENTS, newAchievements } = await import('@pixel-horde/sim');
    const db = await freshDb();
    const ids = (await db.query<{ id: string }>('select id from public.achievements order by sort')).rows.map((r) => r.id);
    expect(ids).toEqual(ACHIEVEMENTS.map((a) => a.id));
    const base = { hero: 'mage', victory: false, chapter: 1, escapes: 0, kingsKilled: 0, kills: 0, maxStreak: 0, time: 0, victoryTime: 0, revivesBought: 0,
      awakened: false, crack: 0, endlessChapter: 0, combos: {}, guardians: [] as string[], fused: false, companionMax: 0, doubleKings: 0, killsByType: {} };
    const fixtures = [
      base,
      { ...base, chapter: 5, kingsKilled: 4, combos: { overload: 3 }, guardians: ['storm'], maxStreak: 600 },
      { ...base, hero: 'ranger', victory: true, chapter: 8, kingsKilled: 8, victoryTime: 800, crack: 3, fused: true, companionMax: 5, guardians: ['inferno', 'frost', 'storm'] },
      { ...base, hero: 'alchemist', victory: true, chapter: 12, endlessChapter: 12, escapes: 2, revivesBought: 1, awakened: true, doubleKings: 1,
        combos: { shatter: 30, firestorm: 20, overload: 10, superconduct: 5, toxicBurst: 5, grinder: 20, catalyst: 20 } },
    ];
    let n = 0;
    for (const f of fixtures) {
      const uid = `00000000-0000-0000-0000-${String(900 + n++).padStart(12, '0')}`;
      await db.query(`insert into auth.users (id, raw_user_meta_data) values ($1, '{"nickname":"Fx"}')`, [uid]);
      await db.query('insert into public.meta_progress (user_id) values ($1) on conflict do nothing', [uid]);
      await db.query('select public.apply_run_facts($1, $2::jsonb)', [uid, JSON.stringify(f)]);
      const sql = (await db.query<{ a: string }>('select achievement_id as a from public.player_achievements where user_id = $1', [uid])).rows.map((r) => r.a).sort();
      const ts = newAchievements(f as never, { heroesWon: [], combos: {} }, []).sort();
      expect(sql, JSON.stringify(f)).toEqual(ts);
    }
  });
});
