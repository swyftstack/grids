import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Tauri expects a fixed port and host during development.
const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [react()],
  // Resolve workspace packages to their source so no pre-build step is needed in dev.
  resolve: {
    alias: {
      '@swyftgrid/core': resolve(__dirname, '../../packages/core/src/index.ts'),
      '@swyftgrid/ui': resolve(__dirname, '../../packages/ui/src/index.ts'),
      '@': resolve(__dirname, 'src'),
    },
  },
  // Prevent Vite from obscuring Rust errors.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: {
      // Don't watch the Rust backend.
      ignored: ['**/src-tauri/**'],
    },
  },
  // Produce a build the Tauri bundler can serve.
  build: {
    target: ['es2021', 'chrome105', 'safari13'],
    minify: 'esbuild',
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        // Split the heaviest leaf libraries into long-cacheable chunks for a lighter initial load.
        // CodeMirror (the bulk) is only fetched when the SQL editor first opens.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('@codemirror') || id.includes('@uiw') || id.includes('@lezer'))
            return 'codemirror';
          if (id.includes('lucide-react')) return 'icons';
          return 'vendor';
        },
      },
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
});
