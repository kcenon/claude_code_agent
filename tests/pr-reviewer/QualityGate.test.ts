import { describe, it, expect } from 'vitest';
import { QualityGate } from '../../src/pr-reviewer/QualityGate.js';
import type {
  QualityMetrics,
  CheckResults,
  ReviewComment,
} from '../../src/pr-reviewer/types.js';

describe('QualityGate', () => {
  const createMetrics = (overrides: Partial<QualityMetrics> = {}): QualityMetrics => ({
    codeCoverage: 85,
    newLinesCoverage: 90,
    complexityScore: 8,
    securityIssues: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
    },
    styleViolations: 0,
    testCount: 50,
    ...overrides,
  });

  const createChecks = (overrides: Partial<CheckResults> = {}): CheckResults => ({
    ciPassed: true,
    testsPassed: true,
    lintPassed: true,
    securityScanPassed: true,
    buildPassed: true,
    ...overrides,
  });

  const createComment = (overrides: Partial<ReviewComment> = {}): ReviewComment => ({
    file: 'src/test.ts',
    line: 10,
    comment: 'Test comment',
    severity: 'minor',
    resolved: false,
    ...overrides,
  });

  describe('constructor', () => {
    it('should create with default configuration', () => {
      const gate = new QualityGate();
      const config = gate.getConfig();
      expect(config.required.testsPass).toBe(true);
      expect(config.required.codeCoverage).toBe(80);
    });

    it('should merge custom configuration with defaults', () => {
      const gate = new QualityGate({
        config: {
          required: {
            codeCoverage: 90,
          },
        },
      });
      const config = gate.getConfig();
      expect(config.required.codeCoverage).toBe(90);
      expect(config.required.testsPass).toBe(true);
    });
  });

  describe('evaluate', () => {
    it('should pass when all required gates are met', () => {
      const gate = new QualityGate();
      const metrics = createMetrics();
      const checks = createChecks();
      const comments: ReviewComment[] = [];

      const result = gate.evaluate(metrics, checks, comments);

      expect(result.passed).toBe(true);
      expect(result.failures).toHaveLength(0);
    });

    it('should fail when tests fail', () => {
      const gate = new QualityGate();
      const metrics = createMetrics();
      const checks = createChecks({ testsPassed: false });
      const comments: ReviewComment[] = [];

      const result = gate.evaluate(metrics, checks, comments);

      expect(result.passed).toBe(false);
      expect(result.failures).toContain('Tests must pass');
    });

    it('should fail when build fails', () => {
      const gate = new QualityGate();
      const metrics = createMetrics();
      const checks = createChecks({ buildPassed: false });
      const comments: ReviewComment[] = [];

      const result = gate.evaluate(metrics, checks, comments);

      expect(result.passed).toBe(false);
      expect(result.failures).toContain('Build must pass');
    });

    it('should fail when lint fails', () => {
      const gate = new QualityGate();
      const metrics = createMetrics();
      const checks = createChecks({ lintPassed: false });
      const comments: ReviewComment[] = [];

      const result = gate.evaluate(metrics, checks, comments);

      expect(result.passed).toBe(false);
      expect(result.failures).toContain('Lint must pass');
    });

    it('should fail when coverage is below threshold', () => {
      const gate = new QualityGate();
      const metrics = createMetrics({ codeCoverage: 70 });
      const checks = createChecks();
      const comments: ReviewComment[] = [];

      const result = gate.evaluate(metrics, checks, comments);

      expect(result.passed).toBe(false);
      expect(result.failures.some(f => f.includes('70%') && f.includes('80%'))).toBe(true);
    });

    it('should fail when critical security issues exist', () => {
      const gate = new QualityGate();
      const metrics = createMetrics({
        securityIssues: { critical: 1, high: 0, medium: 0, low: 0 },
      });
      const checks = createChecks();
      const comments: ReviewComment[] = [];

      const result = gate.evaluate(metrics, checks, comments);

      expect(result.passed).toBe(false);
      expect(result.failures.some(f => f.includes('Critical security'))).toBe(true);
    });

    it('should fail when unresolved critical comments exist', () => {
      const gate = new QualityGate();
      const metrics = createMetrics();
      const checks = createChecks();
      const comments: ReviewComment[] = [
        createComment({ severity: 'critical', resolved: false }),
      ];

      const result = gate.evaluate(metrics, checks, comments);

      expect(result.passed).toBe(false);
      expect(result.failures.some(f => f.includes('Critical review'))).toBe(true);
    });

    it('should not count resolved critical comments', () => {
      const gate = new QualityGate();
      const metrics = createMetrics();
      const checks = createChecks();
      const comments: ReviewComment[] = [
        createComment({ severity: 'critical', resolved: true }),
      ];

      const result = gate.evaluate(metrics, checks, comments);

      expect(result.passed).toBe(true);
      expect(result.requiredGates.get('no_critical_issues')).toBe(true);
    });

    it('should add warnings for recommended gates', () => {
      const gate = new QualityGate();
      const metrics = createMetrics({
        newLinesCoverage: 80, // Below recommended 90
        complexityScore: 15, // Above recommended 10
        styleViolations: 5, // Not zero
      });
      const checks = createChecks();
      const comments: ReviewComment[] = [
        createComment({ severity: 'major', resolved: false }),
      ];

      const result = gate.evaluate(metrics, checks, comments);

      expect(result.passed).toBe(true); // Required gates pass
      expect(result.warnings.length).toBeGreaterThan(0);
      // Warnings may include coverage, complexity, or style violations
      expect(
        result.warnings.some(w =>
          w.includes('80%') ||
          w.includes('complexity') ||
          w.includes('style') ||
          w.includes('major')
        )
      ).toBe(true);
    });

    it('should track gate results in maps', () => {
      const gate = new QualityGate();
      const metrics = createMetrics();
      const checks = createChecks();
      const comments: ReviewComment[] = [];

      const result = gate.evaluate(metrics, checks, comments);

      expect(result.requiredGates.get('tests_pass')).toBe(true);
      expect(result.requiredGates.get('build_pass')).toBe(true);
      expect(result.requiredGates.get('lint_pass')).toBe(true);
      expect(result.requiredGates.get('code_coverage')).toBe(true);
    });

    it('should skip recommendations when disabled', () => {
      const gate = new QualityGate({ includeRecommendations: false });
      const metrics = createMetrics({
        newLinesCoverage: 50,
        complexityScore: 20,
      });
      const checks = createChecks();
      const comments: ReviewComment[] = [];

      const result = gate.evaluate(metrics, checks, comments);

      expect(result.warnings).toHaveLength(0);
      expect(result.recommendedGates.size).toBe(0);
    });
  });

  describe('getSummary', () => {
    it('should return success message when passed', () => {
      const gate = new QualityGate();
      const metrics = createMetrics();
      const checks = createChecks();
      const result = gate.evaluate(metrics, checks, []);

      const summary = gate.getSummary(result);

      expect(summary).toContain('✅');
      expect(summary).toContain('passed');
    });

    it('should return failure message with reasons', () => {
      const gate = new QualityGate();
      const metrics = createMetrics({ codeCoverage: 50 });
      const checks = createChecks({ testsPassed: false });
      const result = gate.evaluate(metrics, checks, []);

      const summary = gate.getSummary(result);

      expect(summary).toContain('❌');
      expect(summary).toContain('Failures');
      expect(summary).toContain('Tests must pass');
    });

    it('should include warnings when present', () => {
      const gate = new QualityGate();
      const metrics = createMetrics({ styleViolations: 5 });
      const checks = createChecks();
      const result = gate.evaluate(metrics, checks, []);

      const summary = gate.getSummary(result);

      expect(summary).toContain('Warnings');
      expect(summary).toContain('⚠️');
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const gate = new QualityGate({
        config: {
          required: { codeCoverage: 95 },
          recommended: { maxComplexity: 5 },
        },
      });

      const config = gate.getConfig();

      expect(config.required.codeCoverage).toBe(95);
      expect(config.recommended.maxComplexity).toBe(5);
    });
  });
});
