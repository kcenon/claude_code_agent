/**
 * Glob segment matching of RegressionTesterAgent (kcenon/claude_code_agent#973).
 */

import { describe, it, expect } from 'vitest';
import { RegressionTesterAgent } from '../../src/regression-tester/index.js';

type SegmentMatcher = { matchesPattern(name: string, pattern: string): boolean };

const agent = new RegressionTesterAgent() as unknown as SegmentMatcher;

describe('RegressionTesterAgent glob segments', () => {
  it.each([
    ['anything.ts', '', true],
    ['anything.ts', '*', true],
    ['foo.test.ts', '*.test.ts', true],
    ['foo.test.js', '*.test.ts', false],
    ['footest.ts', '*.test.ts', false],
    ['a.spec.tsx', '*.spec.ts?', true],
    ['a.spec.ts', '*.spec.ts?', false],
    ['test_user.py', 'test_*.py', true],
    ['a.test.js', '*.test.[jt]s', true],
    ['a.test.ms', '*.test.[jt]s', false],
  ])('should match %s against %s as %s', (name, pattern, expected) => {
    expect(agent.matchesPattern(name, pattern)).toBe(expected);
  });

  it.each([
    ['c++.test.ts', 'c++*.ts', true],
    ['ccc.test.ts', 'c++*.ts', false],
    ['a(1).test.ts', 'a(1)*.ts', true],
    ['a1.test.ts', 'a(1)*.ts', false],
    ['$x.test.ts', '$x*.ts', true],
    ['x|y.test.ts', 'x|y*.ts', true],
    ['x', 'x|y*.ts', false],
    ['dir\\a.ts', 'dir\\*.ts', true],
  ])(
    'should take regular expression characters in %s literally for %s (%s)',
    (name, pattern, expected) => {
      expect(agent.matchesPattern(name, pattern)).toBe(expected);
    }
  );
});
