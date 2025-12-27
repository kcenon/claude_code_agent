import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/index.ts',
        'src/cli.ts', // CLI entry point - interactive, tested via E2E
        'src/init/InteractiveWizard.ts', // Interactive prompts - tested via E2E
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 79, // Slightly lower due to complex error handling paths
        statements: 80,
      },
    },
  },
});
