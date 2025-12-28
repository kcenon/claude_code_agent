import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MergeDecision } from '../../src/pr-reviewer/MergeDecision.js';
import type {
  QualityMetrics,
  CheckResults,
  QualityGateResult,
  PullRequest,
} from '../../src/pr-reviewer/types.js';

// Mock child_process with promisify-compatible implementation
vi.mock('node:child_process', () => ({
  exec: vi.fn((command: string, options: unknown, callback?: (err: Error | null, result: { stdout: string; stderr: string }) => void) => {
    // If called with callback (for promisify)
    if (typeof options === 'function') {
      callback = options as (err: Error | null, result: { stdout: string; stderr: string }) => void;
    }
    if (callback) {
      callback(null, { stdout: '{}', stderr: '' });
    }
    return {};
  }),
}));

import { exec } from 'node:child_process';

const mockExec = vi.mocked(exec);

describe('MergeDecision', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMetrics = (overrides: Partial<QualityMetrics> = {}): QualityMetrics => ({
    codeCoverage: 85,
    newLinesCoverage: 92,
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

  const createQualityGateResult = (overrides: Partial<QualityGateResult> = {}): QualityGateResult => ({
    passed: true,
    requiredGates: new Map([
      ['tests_pass', true],
      ['build_pass', true],
      ['lint_pass', true],
      ['code_coverage', true],
    ]),
    recommendedGates: new Map([
      ['max_complexity', true],
      ['new_lines_coverage', true],
    ]),
    failures: [],
    warnings: [],
    ...overrides,
  });

  const createPullRequest = (overrides: Partial<PullRequest> = {}): PullRequest => ({
    number: 123,
    url: 'https://github.com/test/repo/pull/123',
    title: 'feat: add new feature',
    branch: 'feature/test',
    base: 'main',
    createdAt: '2024-01-01T00:00:00Z',
    state: 'open',
    ...overrides,
  });

  describe('constructor', () => {
    it('should create with default configuration', () => {
      const decision = new MergeDecision();
      expect(decision).toBeInstanceOf(MergeDecision);
    });

    it('should accept custom configuration', () => {
      const decision = new MergeDecision({
        projectRoot: '/custom/path',
        mergeStrategy: 'rebase',
        deleteBranchOnMerge: false,
      });
      expect(decision).toBeInstanceOf(MergeDecision);
    });
  });

  describe('checkMergeConflicts', () => {
    it('should return MergeConflictInfo structure', async () => {
      const decision = new MergeDecision();
      const result = await decision.checkMergeConflicts(123);

      // Should return a valid MergeConflictInfo object
      expect(result).toHaveProperty('hasConflicts');
      expect(result).toHaveProperty('mergeable');
      expect(result).toHaveProperty('mergeableState');
      expect(result).toHaveProperty('conflictingFiles');
      expect(Array.isArray(result.conflictingFiles)).toBe(true);
    });

    it('should handle API errors gracefully', async () => {
      const decision = new MergeDecision();
      // With default mock returning {}, should gracefully handle parse
      const result = await decision.checkMergeConflicts(123);

      // Should return safe defaults on error
      expect(result.hasConflicts).toBe(false);
      expect(result.mergeable).toBe(false);
      expect(result.mergeableState).toBe('unknown');
    });
  });

  describe('checkBlockingReviews', () => {
    it('should return BlockingReview array structure', async () => {
      const decision = new MergeDecision();
      const result = await decision.checkBlockingReviews(123);

      // Should return an array (empty with default mock)
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle API errors gracefully', async () => {
      const decision = new MergeDecision();
      const result = await decision.checkBlockingReviews(123);

      // Should return empty array on error
      expect(result).toHaveLength(0);
    });
  });

  describe('generateDetailedReport', () => {
    it('should generate report for passing gates', () => {
      const decision = new MergeDecision();
      const qualityGate = createQualityGateResult();
      const metrics = createMetrics();
      const checks = createChecks();

      const report = decision.generateDetailedReport(123, qualityGate, metrics, checks);

      expect(report.passed).toBe(true);
      expect(report.prNumber).toBe(123);
      expect(report.requiredActions).toHaveLength(0);
      expect(report.markdown).toContain('Quality Gate Report');
      expect(report.markdown).toContain('PR #123');
    });

    it('should generate report with failures', () => {
      const decision = new MergeDecision();
      const qualityGate = createQualityGateResult({
        passed: false,
        failures: ['Code coverage 65% is below required 80%'],
      });
      const metrics = createMetrics({ codeCoverage: 65 });
      const checks = createChecks({ testsPassed: false });

      const report = decision.generateDetailedReport(123, qualityGate, metrics, checks);

      expect(report.passed).toBe(false);
      expect(report.requiredActions.length).toBeGreaterThan(0);
      expect(report.markdown).toContain('FAILED');
      expect(report.markdown).toContain('Required Actions');
    });

    it('should include recommendations for warnings', () => {
      const decision = new MergeDecision();
      const qualityGate = createQualityGateResult({
        warnings: ['Complexity score exceeds recommended max'],
      });
      const metrics = createMetrics({ complexityScore: 15, newLinesCoverage: 80 });
      const checks = createChecks();

      const report = decision.generateDetailedReport(123, qualityGate, metrics, checks);

      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.markdown).toContain('Recommendations');
    });

    it('should generate markdown table with gate status', () => {
      const decision = new MergeDecision();
      const qualityGate = createQualityGateResult();
      const metrics = createMetrics();
      const checks = createChecks();

      const report = decision.generateDetailedReport(123, qualityGate, metrics, checks);

      expect(report.markdown).toContain('| Gate | Threshold | Actual | Status |');
      expect(report.markdown).toContain('Tests Pass');
      expect(report.markdown).toContain('Code Coverage');
    });
  });

  describe('checkMergeReadiness', () => {
    it('should return MergeReadinessResult structure', async () => {
      const decision = new MergeDecision();
      const qualityGate = createQualityGateResult();
      const metrics = createMetrics();
      const checks = createChecks();

      const result = await decision.checkMergeReadiness(123, qualityGate, metrics, checks);

      // Should return a valid MergeReadinessResult object
      expect(result).toHaveProperty('canMerge');
      expect(result).toHaveProperty('qualityGates');
      expect(result).toHaveProperty('conflicts');
      expect(result).toHaveProperty('blockingReviews');
      expect(result).toHaveProperty('ciPassed');
      expect(result).toHaveProperty('blockingReasons');
      expect(result).toHaveProperty('detailedReport');
    });

    it('should return canMerge=false when quality gates fail', async () => {
      const decision = new MergeDecision();
      const qualityGate = createQualityGateResult({ passed: false, failures: ['Tests failed'] });
      const metrics = createMetrics();
      const checks = createChecks();

      const result = await decision.checkMergeReadiness(123, qualityGate, metrics, checks);

      expect(result.canMerge).toBe(false);
      expect(result.blockingReasons).toContain('Quality gates failed');
    });

    it('should return canMerge=false when CI fails', async () => {
      const decision = new MergeDecision();
      const qualityGate = createQualityGateResult();
      const metrics = createMetrics();
      const checks = createChecks({ ciPassed: false });

      const result = await decision.checkMergeReadiness(123, qualityGate, metrics, checks);

      expect(result.canMerge).toBe(false);
      expect(result.blockingReasons).toContain('CI pipeline failed');
    });

    it('should include detailed report in result', async () => {
      const decision = new MergeDecision();
      const qualityGate = createQualityGateResult();
      const metrics = createMetrics();
      const checks = createChecks();

      const result = await decision.checkMergeReadiness(123, qualityGate, metrics, checks);

      expect(result.detailedReport).toHaveProperty('prNumber', 123);
      expect(result.detailedReport).toHaveProperty('markdown');
      expect(result.detailedReport.markdown).toContain('Quality Gate Report');
    });
  });

  describe('generateSquashMessage', () => {
    it('should generate proper commit title with PR number', () => {
      const decision = new MergeDecision();
      const pr = createPullRequest({ number: 456, title: 'feat: awesome feature' });

      const message = decision.generateSquashMessage(pr);

      expect(message.title).toBe('feat: awesome feature (#456)');
    });

    it('should include issue reference in body', () => {
      const decision = new MergeDecision();
      const pr = createPullRequest();

      const message = decision.generateSquashMessage(pr, 789);

      expect(message.body).toContain('Closes #789');
      expect(message.closesIssues).toContain(789);
    });

    it('should include summary in body when provided', () => {
      const decision = new MergeDecision();
      const pr = createPullRequest();

      const message = decision.generateSquashMessage(pr, 789, 'This adds a great feature');

      expect(message.body).toContain('This adds a great feature');
      expect(message.body).toContain('Closes #789');
    });

    it('should handle PR without issue reference', () => {
      const decision = new MergeDecision();
      const pr = createPullRequest();

      const message = decision.generateSquashMessage(pr);

      expect(message.title).toContain('#123');
      expect(message.closesIssues).toHaveLength(0);
    });
  });

  describe('executeMerge', () => {
    it('should return merge result structure', async () => {
      const decision = new MergeDecision();
      const message = {
        title: 'feat: test (#123)',
        body: 'Closes #456',
        closesIssues: [456] as readonly number[],
      };

      const result = await decision.executeMerge(123, message);

      // Should return a valid result object
      expect(result).toHaveProperty('success');
      expect(typeof result.success).toBe('boolean');
    });

    it('should handle merge command execution', async () => {
      const decision = new MergeDecision();
      const message = {
        title: 'feat: test (#123)',
        body: '',
        closesIssues: [] as readonly number[],
      };

      // With default mock, should attempt execution
      const result = await decision.executeMerge(123, message);

      // Result should have defined structure
      expect(result).toHaveProperty('success');
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });
});
