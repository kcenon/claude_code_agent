/**
 * Exclude pattern matching of CodeReaderAgent (kcenon/claude_code_agent#973).
 */

import { describe, it, expect } from 'vitest';
import { CodeReaderAgent } from '../../src/code-reader/index.js';

type ExcludeMatcher = { matchesExcludePattern(relativePath: string, pattern: string): boolean };

const agent = new CodeReaderAgent() as unknown as ExcludeMatcher;

describe('CodeReaderAgent exclude patterns', () => {
  it.each([
    ['src/foo.test.ts', '**/*.test.ts', true],
    ['src/a/b.test.ts', '**/*.test.ts', true],
    ['foo.test.ts', '**/*.test.ts', false],
    ['src/footest.ts', '**/*.test.ts', false],
    ['src/foo.test.ts.bak', '**/*.test.ts', true],
    ['src/node_modules/x/index.ts', '**/node_modules/**', true],
    ['node_modules/x/index.ts', '**/node_modules/**', false],
    ['src/dist/a.ts', 'dist', true],
    ['src/types.d.ts', '*.d.ts', true],
    ['src/a.ts', '*.d.ts', false],
  ])('should match %s against %s as %s', (relativePath, pattern, expected) => {
    expect(agent.matchesExcludePattern(relativePath, pattern)).toBe(expected);
  });

  it.each([
    ['src/c++/a.ts', '**/c++/**', true],
    ['src/ccc/a.ts', '**/c++/**', false],
    ['src/a(1)/x.ts', '**/a(1)/**', true],
    ['src/a1/x.ts', '**/a(1)/**', false],
    ['src/$tmp/x.ts', '**/$tmp/**', true],
    ['src/x|y/a.ts', '**/x|y/**', true],
    ['src/x/a.ts', '**/x|y/**', false],
    ['lib\\gen\\x.ts', '**\\gen\\**', true],
    ['src/generator.ts', '**\\gen\\**', false],
  ])(
    'should take regular expression characters in %s literally for %s (%s)',
    (relativePath, pattern, expected) => {
      expect(agent.matchesExcludePattern(relativePath, pattern)).toBe(expected);
    }
  );
});
