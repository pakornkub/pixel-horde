import { defineConfig } from 'vite';

/** Monotonic client build number (yyyymmddHHMM, UTC) for the minimum-build flag. */
const BUILD = Number(new Date().toISOString().slice(0, 16).replace(/[-T:]/g, ''));

export default defineConfig({
  define: { __BUILD__: JSON.stringify(BUILD) },
  base: './',
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: { port: 5173 },
});
