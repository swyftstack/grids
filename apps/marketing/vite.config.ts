import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// In dev, `scripts/dev-with-demo.mjs` sets this to the desktop demo server's URL so `/demo` serves
// the real app (matching the production single-origin layout). Plain `vite` (dev:site) leaves it
// unset, so `/demo` 404s — run `pnpm dev` for the demo, or `build:cf` for a production bundle.
const demoProxy = process.env.SWYFTGRID_DEMO_PROXY;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@swyftgrid/ui': resolve(__dirname, '../../packages/ui/src/index.ts'),
      '@': resolve(__dirname, 'src'),
    },
  },
  server: demoProxy
    ? { proxy: { '/demo': { target: demoProxy, changeOrigin: true, ws: true } } }
    : undefined,
  build: {
    target: ['es2021', 'chrome105', 'safari13'],
    sourcemap: false,
  },
  envPrefix: ['VITE_'],
});
