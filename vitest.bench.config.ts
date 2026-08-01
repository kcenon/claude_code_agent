import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/performance/**/*.bench.ts'],
    benchmark: {
      include: ['tests/performance/**/*.bench.ts'],
      exclude: ['**/._*'],
      reporters: ['default'],
      outputJson: './perf-results/benchmark-results.json',
    },
    testTimeout: 60000, // Extended timeout for benchmarks
  },
});
