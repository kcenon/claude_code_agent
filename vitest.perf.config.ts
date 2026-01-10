import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/performance/**/*.test.ts'],
    testTimeout: 120000, // Extended timeout for performance tests
    pool: 'forks', // Use forks for memory isolation
    singleFork: true, // Single fork for consistent memory measurements
  },
});
