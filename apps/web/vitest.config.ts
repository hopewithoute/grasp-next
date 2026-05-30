import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    include: ['features/**/*.test.ts', 'features/**/*.test.tsx', 'server/**/*.test.ts'],
    testTimeout: 120_000,
  },
});
