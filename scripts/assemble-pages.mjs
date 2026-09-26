// Puts the website and the game into one Cloudflare Pages output (dist/pages):
//   /        → apps/site/dist  (official website)
//   /play/   → apps/game/dist  (the game)
// Run after both builds: `npm run build:pages` does all three steps.
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const OUT = 'dist/pages';
for (const dir of ['apps/site/dist', 'apps/game/dist']) {
  if (!existsSync(dir)) throw new Error(`${dir} is missing: build it first (npm run build:pages)`);
}
rmSync(OUT, { recursive: true, force: true });
cpSync('apps/site/dist', OUT, { recursive: true });
cpSync('apps/game/dist', `${OUT}/play`, { recursive: true });

// Cloudflare Pages reads _headers / _redirects only at the root: move the game's rules under /play.
const gameHeaders = existsSync(`${OUT}/play/_headers`) ? readFileSync(`${OUT}/play/_headers`, 'utf8') : '';
rmSync(`${OUT}/play/_headers`, { force: true });
const moved = gameHeaders.replace(/^(\/\S*)/gm, '/play$1');
writeFileSync(`${OUT}/_headers`, `# website\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n\n# game (from apps/game/public/_headers)\n${moved}`);
writeFileSync(`${OUT}/_redirects`, [
  '# The game used to live at the root.',
  '/privacy.html /play/privacy.html 301',
  '',
].join('\n'));
console.log(`assembled ${OUT}: site at /, game at /play/`);
