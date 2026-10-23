import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Offline pipeline E2E lane (#954): mocked SDK boundary, no credentials.
    include: ['tests/e2e/**/*.test.ts'],
    testTimeout: 120000, // 2 minute timeout for E2E tests
    hookTimeout: 60000, // 1 minute for setup/teardown
    retry: 0, // The first failure fails the lane; a retry would hide a flaky test
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
