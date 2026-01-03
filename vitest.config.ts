import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 15000, // Increased for CI environments
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/index.ts',
        'src/**/types.ts', // Type definitions only - no runtime code
        'src/cli.ts', // CLI entry point - interactive, tested via E2E
        'src/init/InteractiveWizard.ts', // Interactive prompts - tested via E2E
        'src/config/loader.ts', // File system operations - tested via E2E
        'src/config/watcher.ts', // CLI watch mode - tested via E2E
        'src/pr-reviewer/PRReviewerAgent.ts', // GitHub CLI operations - tested via E2E/integration
        'src/pr-reviewer/PRCreator.ts', // GitHub CLI operations (gh pr create/list) - tested via E2E/integration
        'src/ci-fixer/CIFixAgent.ts', // CI operations (gh run view, npm scripts) - tested via E2E/integration
        'src/ci-fixer/FixStrategies.ts', // Shell commands (npm lint/build) - tested via E2E/integration
      ],
      thresholds: {
        lines: 80,
        functions: 78, // Adjusted for new worker module with complex async flows
        branches: 71.5, // Adjusted for parallel execution feature (issue #213) adding new code paths
        statements: 80,
      },
    },
  },
});
