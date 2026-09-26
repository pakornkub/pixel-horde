// Summarise playtest metrics: `node scripts/playtest/report.mjs <results.json> [--detail]`
import { readFile } from 'node:fs/promises';

const [file, flag] = process.argv.slice(2);
const runs = JSON.parse(await readFile(file, 'utf8'));
const detail = flag === '--detail';

const groups = new Map();
for (const r of runs) {
  const k = `${r.label} ${r.hero}`;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(r);
}
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN);
const med = (a) => { if (!a.length) return NaN; const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)]; };
const pct = (a, f) => Math.round((a.filter(f).length / a.length) * 100);
const f1 = (x) => (Number.isFinite(x) ? x.toFixed(1) : '-');

console.log('label hero        n  ch(avg/med) clr  win%  esc  lv   min  awk%(ch)  offer%  sigEvo  ttkKing(med s)  revive  2ndW  death-by(top)');
for (const [k, rs] of [...groups].sort()) {
  const aw = rs.filter((r) => r.awakenAt !== null);
  const ttk = rs.flatMap((r) => r.kingTtk.filter((x) => x.t !== null).map((x) => x.t));
  const deaths = {};
  for (const r of rs) if (r.deathBy) deaths[r.deathBy.replace(/:.*/, (m) => m)] = (deaths[r.deathBy] || 0) + 1;
  const topDeath = Object.entries(deaths).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([d, c]) => `${d}×${c}`).join(' ');
  console.log(
    k.padEnd(18), String(rs.length).padStart(3),
    `${f1(avg(rs.map((r) => r.chapter)))}/${med(rs.map((r) => r.chapter))}`.padStart(10),
    f1(avg(rs.map((r) => r.cleared))).padStart(5),
    String(pct(rs, (r) => r.result === 'victory')).padStart(5),
    f1(avg(rs.map((r) => r.escapes))).padStart(4),
    f1(avg(rs.map((r) => r.level))).padStart(5),
    f1(avg(rs.map((r) => r.minutes))).padStart(5),
    `${pct(rs, (r) => r.awakenAt !== null)}(${f1(avg(aw.map((r) => r.awakenAt)))})`.padStart(9),
    String(pct(rs, (r) => r.awakenOfferAt !== null)).padStart(6),
    f1(avg(rs.filter((r) => r.sigEvoAt).map((r) => r.sigEvoAt))).padStart(7),
    f1(med(ttk)).padStart(10),
    f1(avg(rs.map((r) => r.revives))).padStart(8),
    f1(avg(rs.map((r) => r.secondWinds))).padStart(5),
    ' ' + topDeath,
  );
}

// chapter reach curve
console.log('\nreached chapter ≥ N (%)');
console.log('label hero         ' + [1, 2, 3, 4, 5, 6, 7, 8].map((c) => ('ch' + c).padStart(5)).join(''));
for (const [k, rs] of [...groups].sort()) console.log(k.padEnd(20) + [1, 2, 3, 4, 5, 6, 7, 8].map((c) => String(pct(rs, (r) => r.chapter >= c || r.result === 'victory')).padStart(5)).join(''));

// damage share per skill
console.log('\ndamage share (whole Run) — top skills');
for (const [k, rs] of [...groups].sort()) {
  const tot = {};
  for (const r of rs) for (const [s, d] of Object.entries(r.dmg)) tot[s] = (tot[s] || 0) + d;
  const sum = Object.values(tot).reduce((a, b) => a + b, 0) || 1;
  console.log(k.padEnd(20) + Object.entries(tot).sort((a, b) => b[1] - a[1]).slice(0, 9).map(([s, d]) => `${s} ${Math.round((d / sum) * 100)}%`).join(', '));
}
console.log('\ndamage share after Awakening');
for (const [k, rs] of [...groups].sort()) {
  const tot = {};
  for (const r of rs) for (const [s, d] of Object.entries(r.dmgAfterAwaken)) tot[s] = (tot[s] || 0) + d;
  const sum = Object.values(tot).reduce((a, b) => a + b, 0);
  if (!sum) continue;
  console.log(k.padEnd(20) + Object.entries(tot).sort((a, b) => b[1] - a[1]).slice(0, 9).map(([s, d]) => `${s} ${Math.round((d / sum) * 100)}%`).join(', '));
}
console.log('\ndamage taken by source (share)');
for (const [k, rs] of [...groups].sort()) {
  const tot = {};
  for (const r of rs) for (const [s, d] of Object.entries(r.hurt)) { const kk = s.startsWith('boss:') ? s : s.startsWith('bossContact') ? 'bossContact' : s; tot[kk] = (tot[kk] || 0) + d; }
  const sum = Object.values(tot).reduce((a, b) => a + b, 0) || 1;
  console.log(k.padEnd(20) + Object.entries(tot).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([s, d]) => `${s} ${Math.round((d / sum) * 100)}%`).join(', '));
}
console.log('\nDPS by chapter (median)');
for (const [k, rs] of [...groups].sort()) console.log(k.padEnd(20) + [1, 2, 3, 4, 5, 6, 7, 8].map((c) => String(med(rs.map((r) => r.dpsByChapter[c]).filter((x) => x > 0)) || '-').padStart(7)).join(''));
console.log('\nplayer level at chapter end (median)');
for (const [k, rs] of [...groups].sort()) console.log(k.padEnd(20) + [1, 2, 3, 4, 5, 6, 7, 8].map((c) => String(med(rs.map((r) => r.lvByChapter?.[c]).filter((x) => x > 0)) || '-').padStart(7)).join(''));
console.log('\nmin HP by chapter (median %)');
for (const [k, rs] of [...groups].sort()) console.log(k.padEnd(20) + [1, 2, 3, 4, 5, 6, 7, 8].map((c) => { const v = med(rs.map((r) => r.hpMin[c]).filter((x) => x != null)); return (Number.isFinite(v) ? String(Math.round(v * 100)) : '-').padStart(5); }).join(''));
console.log('\nKing time-to-kill by chapter (median s; E = escape rate %)');
for (const [k, rs] of [...groups].sort()) {
  const cells = [1, 2, 3, 4, 5, 6, 7, 8].map((c) => {
    const x = rs.flatMap((r) => r.kingTtk.filter((y) => y.ch === c));
    if (!x.length) return '     -';
    const ok = x.filter((y) => y.t !== null).map((y) => y.t);
    return `${f1(med(ok))}/E${Math.round(((x.length - ok.length) / x.length) * 100)}`.padStart(10);
  });
  console.log(k.padEnd(20) + cells.join(''));
}
console.log('\nKing HP left when the Run ended in Chapter 8 (median)');
for (const [k, rs] of [...groups].sort()) { const x = rs.filter((r) => r.chapter >= 8 && r.kingLeft != null).map((r) => r.kingLeft); if (x.length) console.log(k.padEnd(20), 'n', x.length, 'median left', f1(med(x) * 100) + '%'); }
if (detail) for (const r of runs) console.log(r.label, r.hero, r.seed, r.result, 'ch', r.chapter, 'lv', r.level, 'awk', r.awakenAt, r.build.join(' '), 'death', r.deathBy);
