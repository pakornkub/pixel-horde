import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// The official website. Production serves it at `/` with the game under `/play/`
// (scripts/assemble-pages.mjs); in dev the PLAY buttons point at the game's own dev server.
const page = (name: string): string => resolve(import.meta.dirname, name);

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    rolldownOptions: {
      input: { index: page('index.html'), guide: page('guide.html'), skills: page('skills.html'), world: page('world.html'), updates: page('updates.html') },
    },
  },
  server: { port: 5180 },
});
