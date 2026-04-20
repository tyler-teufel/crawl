import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: '.',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    // Auth tests run bcrypt (12 rounds) which is intentionally slow
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
