// Regenerates the JSON embedded in migrations (built-in Balance Config = version 0, its JSON
// Schema, default flags) from packages/config. ONLY for migrations not yet applied anywhere:
// once a migration is applied to the live project, change defaults by publishing a new version.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const gen = (what) => execFileSync('npx', ['tsx', 'scripts/config-json.ts', what], { encoding: 'utf8' });
const files = {
  'supabase/migrations/20260925000002_meta_and_runs.sql': [['$cfg$', gen('defaults')]],
  'supabase/migrations/20260925000004_flags_config_audit.sql': [['$schema$', gen('schema')]],
};
for (const [file, subs] of Object.entries(files)) {
  let sql = readFileSync(file, 'utf8');
  for (const [tag, json] of subs) {
    const a = sql.indexOf(tag), b = sql.indexOf(tag, a + tag.length);
    if (a < 0 || b < 0) throw new Error(`${tag} not found in ${file}`);
    sql = sql.slice(0, a + tag.length) + json + sql.slice(b);
  }
  writeFileSync(file, sql);
  console.log('updated', file);
}
