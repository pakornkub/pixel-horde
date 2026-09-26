// Bundles the playtest harness with esbuild and wraps hit() / hurtP() so every point of damage
// can be attributed (the shipped sim is untouched; these hooks exist only in this bundle).
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

const instrument = {
  name: 'instrument',
  setup(b) {
    b.onLoad({ filter: /packages[\\/]sim[\\/]src[\\/]systems[\\/](combat|events|enemies|combos)\.ts$/ }, async (args) => {
      let src = await readFile(args.path, 'utf8');
      const file = path.basename(args.path);
      if (file === 'combat.ts') {
        src = src.replace('export function hit(', 'function hit__o(').replace('export function hurtP(', 'function hurtP__o(');
        src += `
export function hit(s, e, base, col, kb, tag) {
  const g = globalThis.__PT;
  if (!g) return hit__o(s, e, base, col, kb, tag);
  const h0 = e.hp, dead0 = e.dead || e.hide, fr = { e, inner: 0 };
  (g.stack ??= []).push(fr);
  hit__o(s, e, base, col, kb, tag);
  g.stack.pop();
  if (dead0) return;
  const d = Math.max(0, Math.min(h0, h0 - e.hp) - fr.inner); // combos nested inside this hit count on their own
  for (const f of g.stack) if (f.e === e) f.inner += d;
  g.onHit(s, e, tag, d);
}
export function hurtP(s, d) {
  const g = globalThis.__PT, hp0 = s.P.hp;
  hurtP__o(s, d);
  if (g) g.onHurt(s, s.P.hp < hp0 ? hp0 - Math.max(0, s.P.hp) : (s.P.hp > hp0 ? hp0 : 0));
}
`;
      } else if (file === 'events.ts') {
        src = src.replaceAll('hurtP(s, h.d!)', '(globalThis.__PT && (globalThis.__PT.cur = { hz: h }), hurtP(s, h.d!))');
      } else if (file === 'combos.ts') {
        for (const id of ['shatter', 'overload', 'firestorm', 'toxicBurst']) src = src.replace(`aoe(s, x, y, C.${id}R`, `aoeAs('${id}', s, x, y, C.${id}R`);
        src += `
function aoeAs(id, ...a) { const g = globalThis.__PT; if (g) g.combo = id; aoe(...a); if (g) g.combo = null; }
`;
      } else if (file === 'enemies.ts') {
        src = src.replace('hurtP(s, e.dmg * (e.dmgMul || 1));', '(globalThis.__PT && (globalThis.__PT.cur = { en: e })); hurtP(s, e.dmg * (e.dmgMul || 1));');
      }
      return { contents: src, loader: 'ts' };
    });
  },
};

const outfile = process.env.PT_OUT || path.join(here, '.out', 'worker.mjs');
// .out/FREEZE keeps the default bundle as is (a long batch keeps using the code it started with)
if (!(process.env.PT_OUT === undefined && existsSync(path.join(here, '.out', 'FREEZE')))) await build({
  entryPoints: [process.env.PT_ENTRY || path.join(here, 'worker.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile,
  plugins: [instrument],
  logLevel: 'warning',
});
