// Fails (exit 1) when a key is missing in either language. Runs before every game build.
import { readFileSync } from 'node:fs';
const load = (l) => JSON.parse(readFileSync(new URL(`./src/${l}.json`, import.meta.url), 'utf8'));
const dicts = { th: load('th'), en: load('en') };
const ph = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const problems = [];
const all = new Set(Object.values(dicts).flatMap((d) => Object.keys(d)));
for (const k of all) {
  for (const [l, d] of Object.entries(dicts)) if (!(k in d)) problems.push(`missing ${l}: ${k}`);
  if (k in dicts.th && k in dicts.en && ph(dicts.th[k]) !== ph(dicts.en[k])) problems.push(`placeholders differ: ${k}`);
}
if (problems.length) { console.error('i18n check failed:\n  ' + problems.join('\n  ')); process.exit(1); }
console.log(`i18n ok: ${all.size} keys in th + en`);
