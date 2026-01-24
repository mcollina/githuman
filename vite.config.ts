import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist/web',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000, // Shiki core is large, suppress warning
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3847',
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/web'),
    },
  },
});
