import { defineConfig } from 'vitest/config';

/**
 * Live acceptance lane (#954): real Claude Agent SDK execution through the
 * production CLI. Run it through `npm run test:live` (scripts/live-lane.ts),
 * which checks the required settings and writes the execution metadata.
 * The live tests fail, never skip, when selected without those settings.
 * No offline config includes tests/live/**.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/live/**/*.live.test.ts'],
    testTimeout: 1_500_000, // Upper bound; each live test sets its budget-derived timeout
    hookTimeout: 120_000,
    retry: 0, // A paid run is never retried silently
    fileParallelism: false,
    passWithNoTests: false,
  },
});
