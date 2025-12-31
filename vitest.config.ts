import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/web/setup.ts'],
    include: ['tests/web/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/web/**/*.{ts,tsx}'],
      exclude: ['src/web/main.tsx'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/web'),
    },
  },
});
