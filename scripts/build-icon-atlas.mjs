// Packs the 32×32 skill/passive/companion icons (apps/game/src/assets/icons/<id>.png) into one atlas
// the game loads once: apps/game/src/assets/icons.png + icons.json ({ size, cols, ids }).
// The icons were drawn with Gemini and reduced to real 32×32 pixel art; re-run after adding or replacing one:
//   node scripts/build-icon-atlas.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require('sharp');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const src = path.join(root, 'apps/game/src/assets/icons');
const outDir = path.join(root, 'apps/game/src/assets');
const SIZE = 32, COLS = 8;

const ids = fs.readdirSync(src).filter((f) => f.endsWith('.png')).map((f) => f.slice(0, -4)).sort();
const rows = Math.ceil(ids.length / COLS);
const tiles = await Promise.all(ids.map(async (id, i) => ({
  input: await sharp(path.join(src, id + '.png')).resize(SIZE, SIZE, { kernel: 'nearest' }).png().toBuffer(),
  left: (i % COLS) * SIZE,
  top: Math.floor(i / COLS) * SIZE,
})));
fs.mkdirSync(outDir, { recursive: true });
await sharp({ create: { width: COLS * SIZE, height: rows * SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite(tiles).png({ compressionLevel: 9, palette: true }).toFile(path.join(outDir, 'icons.png'));
fs.writeFileSync(path.join(outDir, 'icons.json'), JSON.stringify({ size: SIZE, cols: COLS, ids }, null, 1) + '\n');
console.log(`icons.png: ${ids.length} icons, ${COLS}×${rows}`);
