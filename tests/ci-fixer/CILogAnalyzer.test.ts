import { describe, it, expect, beforeEach } from 'vitest';
import { CILogAnalyzer, resetCILogAnalyzer } from '../../src/ci-fixer/CILogAnalyzer.js';

describe('CILogAnalyzer', () => {
  let analyzer: CILogAnalyzer;

  beforeEach(() => {
    resetCILogAnalyzer();
    analyzer = new CILogAnalyzer();
  });

  describe('analyze', () => {
    it('should return empty result for empty logs', () => {
      const result = analyzer.analyze('');
      expect(result.totalFailures).toBe(0);
      expect(result.identifiedCauses).toHaveLength(0);
      expect(result.unidentifiedCauses).toHaveLength(0);
    });

    it('should detect TypeScript errors', () => {
      const logs = `
src/index.ts:10:5 - error TS2322: Type 'string' is not assignable to type 'number'.
src/utils.ts:25:10 - error TS2339: Property 'foo' does not exist on type 'Bar'.
      `;
      const result = analyzer.analyze(logs);
      expect(result.totalFailures).toBeGreaterThan(0);
      const typeErrors = result.identifiedCauses.filter((c) => c.category === 'type');
      expect(typeErrors.length).toBeGreaterThan(0);
    });

    it('should detect ESLint errors', () => {
      const logs = `
/project/src/index.ts
  10:5  error  Unexpected console statement  no-console
  15:1  error  Missing return type on function  @typescript-eslint/explicit-function-return-type

✖ 2 problems (2 errors, 0 warnings)
      `;
      const result = analyzer.analyze(logs);
      const lintErrors = result.identifiedCauses.filter((c) => c.category === 'lint');
      expect(lintErrors.length).toBeGreaterThan(0);
    });

    it('should detect Jest test failures', () => {
      const logs = `
 FAIL  src/utils.test.ts
  ● Test suite failed to run

    TypeError: Cannot read property 'foo' of undefined

 FAIL  src/index.test.ts
  ● should return correct value
      `;
      const result = analyzer.analyze(logs);
      const testErrors = result.identifiedCauses.filter((c) => c.category === 'test');
      expect(testErrors.length).toBeGreaterThan(0);
    });

    it('should detect build errors', () => {
      const logs = `
Module not found: Error: Can't resolve './missing-module'
Cannot resolve 'lodash' in '/project/src'
      `;
      const result = analyzer.analyze(logs);
      const buildErrors = result.identifiedCauses.filter((c) => c.category === 'build');
      expect(buildErrors.length).toBeGreaterThan(0);
    });

    it('should detect security vulnerabilities', () => {
      const logs = `
npm audit found 3 critical vulnerabilities
1 high vulnerability detected in dependencies
      `;
      const result = analyzer.analyze(logs);
      const securityErrors = result.identifiedCauses.filter((c) => c.category === 'security');
      expect(securityErrors.length).toBeGreaterThan(0);
      // Security errors should not be auto-fixable
      securityErrors.forEach((e) => {
        expect(e.autoFixable).toBe(false);
      });
    });

    it('should detect dependency errors', () => {
      const logs = `
npm WARN peer dep missing: react@^18.0.0, required by some-package@1.0.0
      `;
      const result = analyzer.analyze(logs);
      const depErrors = result.identifiedCauses.filter((c) => c.category === 'dependency');
      expect(depErrors.length).toBeGreaterThan(0);
    });

    it('should group failures by category', () => {
      const logs = `
src/index.ts:10:5 - error TS2322: Type error
FAIL src/index.test.ts
npm audit found 1 critical vulnerability
      `;
      const result = analyzer.analyze(logs);
      expect(result.byCategory.size).toBeGreaterThan(0);
    });

    it(
      'should truncate very long logs',
      () => {
        const longLogs = 'a'.repeat(200000);
        const result = analyzer.analyze(longLogs);
        expect(result.rawLogs.length).toBeLessThan(150000);
        expect(result.rawLogs).toContain('TRUNCATED');
      },
      30000
    );

    it('should find unidentified causes with error keywords', () => {
      const logs = `
Some random error message that doesn't match patterns
CRITICAL: Unknown failure occurred
      `;
      const result = analyzer.analyze(logs);
      expect(result.unidentifiedCauses.length).toBeGreaterThan(0);
    });
  });

  describe('parseTypeScriptErrors', () => {
    it('should parse TypeScript errors with location', () => {
      const output = `
src/index.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.
src/utils.ts(25,10): error TS2339: Property 'foo' does not exist on type 'Bar'.
      `;
      const errors = analyzer.parseTypeScriptErrors(output);
      expect(errors).toHaveLength(2);
      expect(errors[0]?.file).toBe('src/index.ts');
      expect(errors[0]?.line).toBe(10);
      expect(errors[0]?.column).toBe(5);
      expect(errors[0]?.category).toBe('type');
      expect(errors[0]?.autoFixable).toBe(true);
    });
  });

  describe('parseEslintErrors', () => {
    it('should parse ESLint output with file context', () => {
      const output = `
/project/src/index.ts
  10:5  error  Unexpected console statement  no-console
  15:1  error  Missing return type  @typescript-eslint/explicit-function-return-type

/project/src/utils.ts
  20:10  warning  Prefer const  prefer-const
      `;
      const errors = analyzer.parseEslintErrors(output);
      expect(errors.length).toBeGreaterThan(0);
      errors.forEach((e) => {
        expect(e.category).toBe('lint');
        expect(e.autoFixable).toBe(true);
      });
    });
  });

  describe('parseTestErrors', () => {
    it('should parse Jest test failures', () => {
      const output = `
 FAIL  src/utils.test.ts
  ● Test suite failed to run

 FAIL  src/index.test.ts
  ● should return correct value

    expect(received).toBe(expected)
      `;
      const errors = analyzer.parseTestErrors(output);
      expect(errors.length).toBeGreaterThan(0);
      errors.forEach((e) => {
        expect(e.category).toBe('test');
        expect(e.autoFixable).toBe(true);
      });
    });
  });

  describe('custom patterns', () => {
    it('should support custom patterns', () => {
      const customAnalyzer = new CILogAnalyzer({
        customPatterns: [
          {
            name: 'custom-error',
            pattern: /CUSTOM_ERROR:\s*(.+)/g,
            category: 'unknown',
            autoFixable: false,
            extractMessage: (match) => match[1] ?? 'Custom error',
          },
        ],
      });

      const logs = 'CUSTOM_ERROR: Something went wrong';
      const result = customAnalyzer.analyze(logs);
      expect(result.identifiedCauses.length).toBeGreaterThan(0);
    });
  });
});
