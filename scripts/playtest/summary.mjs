// Condense playtest results into one JSON for a report: `node summary.mjs out.json name=file.json ...`
import { readFile, writeFile } from 'node:fs/promises';

const [out, ...pairs] = process.argv.slice(2);
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const pct = (a, f) => (a.length ? Math.round((a.filter(f).length / a.length) * 100) : null);
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
const result = {};
for (const pair of pairs) {
  const [name, file] = pair.split('=');
  const runs = JSON.parse(await readFile(file, 'utf8'));
  const groups = {};
  for (const r of runs) (groups[`${r.label}|${r.hero}`] ??= []).push(r);
  result[name] = Object.entries(groups).map(([k, rs]) => {
    const [label, hero] = k.split('|');
    const share = (key) => {
      const tot = {};
      for (const r of rs) for (const [s, d] of Object.entries(r[key])) tot[s] = (tot[s] || 0) + d;
      const sum = Object.values(tot).reduce((a, b) => a + b, 0) || 1;
      return Object.entries(tot).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([s, d]) => [s, Math.round((d / sum) * 100)]);
    };
    const hurt = {};
    for (const r of rs) for (const [s, d] of Object.entries(r.hurt)) { const kk = s.startsWith('bossContact') ? 'bossContact' : s; hurt[kk] = (hurt[kk] || 0) + d; }
    const hsum = Object.values(hurt).reduce((a, b) => a + b, 0) || 1;
    return {
      label, hero, n: rs.length,
      ch: r1(avg(rs.map((r) => r.chapter))), win: pct(rs, (r) => r.result === 'victory'),
      reach: [1, 2, 3, 4, 5, 6, 7, 8].map((c) => pct(rs, (r) => r.chapter >= c || r.result === 'victory')),
      awaken: pct(rs, (r) => r.awakenAt !== null), awakenCh: r1(avg(rs.filter((r) => r.awakenAt !== null).map((r) => r.awakenAt))),
      level: r1(avg(rs.map((r) => r.level))), minutes: r1(avg(rs.map((r) => r.minutes))),
      dmg: share('dmg'), dmgAfter: share('dmgAfterAwaken'),
      hurt: Object.entries(hurt).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([s, d]) => [s, Math.round((d / hsum) * 100)]),
    };
  });
}
await writeFile(out, JSON.stringify(result));
console.log('wrote', out);
