import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/domain', 'packages/db', 'packages/ai', 'apps/web'],
  },
});
