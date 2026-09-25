import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: './',
  plugins: [preact()],
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true },
  server: { port: 5174 },
});
