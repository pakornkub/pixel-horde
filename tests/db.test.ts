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
  it('version 0 in the migrations equals the built-in defaults', async () => {
    const { DEFAULT_CONFIG } = await import('@pixel-horde/config');
    const db = await freshDb();
    const r = await db.query<{ data: unknown }>('select data from public.balance_configs where version = 0');
    expect(r.rows[0].data).toEqual(JSON.parse(JSON.stringify(DEFAULT_CONFIG)));
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
