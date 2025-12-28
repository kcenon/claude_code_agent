import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/e2e/**/*.test.ts'],
    testTimeout: 120000, // 2 minute timeout for E2E tests
    hookTimeout: 60000, // 1 minute for setup/teardown
    retry: 1, // Retry failed tests once
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      include: [
        'src/cli.ts',
        'src/init/InteractiveWizard.ts',
        'src/config/loader.ts',
        'src/config/watcher.ts',
        'src/pr-reviewer/PRReviewerAgent.ts',
        'src/pr-reviewer/PRCreator.ts',
      ],
    },
  },
});
