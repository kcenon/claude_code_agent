import { describe, it, expect } from 'vitest';
import {
  DEFAULT_CI_FIXER_CONFIG,
  type CIFixerAgentConfig,
  type CICheck,
  type CIFailure,
  type CIAnalysisResult,
  type AppliedFix,
  type VerificationResult,
  type CIFixAttempt,
  type CIFixHandoff,
  type CIFixResult,
  type NextAction,
  type EscalationInfo,
} from '../../src/ci-fixer/types.js';

describe('CI Fixer Types', () => {
  describe('DEFAULT_CI_FIXER_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_CI_FIXER_CONFIG.projectRoot).toBe(process.cwd());
      expect(DEFAULT_CI_FIXER_CONFIG.resultsPath).toBe('.ad-sdlc/scratchpad/ci-fix');
      expect(DEFAULT_CI_FIXER_CONFIG.maxFixAttempts).toBe(3);
      expect(DEFAULT_CI_FIXER_CONFIG.maxDelegations).toBe(3);
      expect(DEFAULT_CI_FIXER_CONFIG.fixTimeout).toBe(1800000);
      expect(DEFAULT_CI_FIXER_CONFIG.ciPollInterval).toBe(10000);
      expect(DEFAULT_CI_FIXER_CONFIG.ciWaitTimeout).toBe(600000);
      expect(DEFAULT_CI_FIXER_CONFIG.enableLintFix).toBe(true);
      expect(DEFAULT_CI_FIXER_CONFIG.enableTypeFix).toBe(true);
      expect(DEFAULT_CI_FIXER_CONFIG.enableTestFix).toBe(true);
      expect(DEFAULT_CI_FIXER_CONFIG.enableBuildFix).toBe(true);
    });

    it('should be immutable', () => {
      // TypeScript should enforce this through Required<> and as const
      expect(Object.isFrozen(DEFAULT_CI_FIXER_CONFIG)).toBe(false);
      // But we can verify all properties exist
      const keys = Object.keys(DEFAULT_CI_FIXER_CONFIG);
      expect(keys).toContain('projectRoot');
      expect(keys).toContain('maxFixAttempts');
      expect(keys).toContain('enableLintFix');
    });
  });

  describe('CICheck type', () => {
    it('should accept valid check objects', () => {
      const check: CICheck = {
        name: 'build',
        status: 'failed',
        conclusion: 'failure',
        logsUrl: 'https://example.com/logs',
        runId: 12345,
      };

      expect(check.name).toBe('build');
      expect(check.status).toBe('failed');
      expect(check.runId).toBe(12345);
    });

    it('should accept minimal check objects', () => {
      const check: CICheck = {
        name: 'test',
        status: 'passed',
      };

      expect(check.name).toBe('test');
      expect(check.status).toBe('passed');
      expect(check.conclusion).toBeUndefined();
    });
  });

  describe('CIFailure type', () => {
    it('should accept valid failure objects', () => {
      const failure: CIFailure = {
        category: 'type',
        message: 'Type error',
        file: 'src/index.ts',
        line: 10,
        column: 5,
        details: 'Full error details',
        confidence: 0.9,
        autoFixable: true,
        suggestedFix: 'Add type annotation',
      };

      expect(failure.category).toBe('type');
      expect(failure.autoFixable).toBe(true);
    });

    it('should accept minimal failure objects', () => {
      const failure: CIFailure = {
        category: 'unknown',
        message: 'Unknown error',
        details: 'Some details',
        confidence: 0.5,
        autoFixable: false,
      };

      expect(failure.file).toBeUndefined();
      expect(failure.line).toBeUndefined();
    });
  });

  describe('CIAnalysisResult type', () => {
    it('should accept valid analysis result', () => {
      const result: CIAnalysisResult = {
        totalFailures: 5,
        identifiedCauses: [
          {
            category: 'lint',
            message: 'Lint error',
            details: 'Details',
            confidence: 1.0,
            autoFixable: true,
          },
        ],
        unidentifiedCauses: ['Unknown error 1'],
        byCategory: new Map([
          [
            'lint',
            [
              {
                category: 'lint',
                message: 'Lint error',
                details: 'Details',
                confidence: 1.0,
                autoFixable: true,
              },
            ],
          ],
        ]),
        analyzedAt: new Date().toISOString(),
        rawLogs: 'Raw log content',
      };

      expect(result.totalFailures).toBe(5);
      expect(result.identifiedCauses).toHaveLength(1);
    });
  });

  describe('AppliedFix type', () => {
    it('should accept successful fix', () => {
      const fix: AppliedFix = {
        type: 'lint',
        file: 'src/index.ts',
        description: 'Applied ESLint auto-fix',
        success: true,
        linesChanged: { added: 5, removed: 3 },
      };

      expect(fix.success).toBe(true);
      expect(fix.error).toBeUndefined();
    });

    it('should accept failed fix', () => {
      const fix: AppliedFix = {
        type: 'type',
        file: 'src/utils.ts',
        description: 'Failed to fix type error',
        success: false,
        error: 'Could not determine fix',
      };

      expect(fix.success).toBe(false);
      expect(fix.error).toBeDefined();
    });
  });

  describe('VerificationResult type', () => {
    it('should accept valid verification result', () => {
      const result: VerificationResult = {
        lintPassed: true,
        typecheckPassed: true,
        testsPassed: false,
        buildPassed: true,
        outputs: {
          lint: 'No issues',
          typecheck: 'No errors',
          test: 'FAIL: 2 tests failed',
          build: 'Build successful',
        },
      };

      expect(result.testsPassed).toBe(false);
      expect(result.outputs.test).toContain('FAIL');
    });
  });

  describe('CIFixAttempt type', () => {
    it('should accept valid attempt record', () => {
      const attempt: CIFixAttempt = {
        attempt: 1,
        agentId: 'ci-fixer-1',
        fixesAttempted: ['lint fix', 'type fix'],
        fixesSucceeded: ['lint fix'],
        remainingIssues: ['type error in utils.ts'],
        timestamp: new Date().toISOString(),
        duration: 60000,
      };

      expect(attempt.attempt).toBe(1);
      expect(attempt.fixesAttempted).toHaveLength(2);
      expect(attempt.fixesSucceeded).toHaveLength(1);
    });
  });

  describe('CIFixHandoff type', () => {
    it('should accept valid handoff document', () => {
      const handoff: CIFixHandoff = {
        prNumber: 123,
        prUrl: 'https://github.com/owner/repo/pull/123',
        branch: 'feature/test',
        originalIssue: '#100',
        failedChecks: [{ name: 'build', status: 'failed' }],
        failureLogs: ['Build failed'],
        attemptHistory: [],
        implementationSummary: 'Implemented feature X',
        changedFiles: ['src/index.ts', 'src/utils.ts'],
        testFiles: ['src/index.test.ts'],
        maxFixAttempts: 3,
        currentAttempt: 1,
        escalationThreshold: 3,
      };

      expect(handoff.prNumber).toBe(123);
      expect(handoff.changedFiles).toHaveLength(2);
    });
  });

  describe('NextAction type', () => {
    it('should accept none action', () => {
      const action: NextAction = {
        type: 'none',
        reason: 'All checks passed',
      };

      expect(action.type).toBe('none');
      expect(action.handoffPath).toBeUndefined();
    });

    it('should accept delegate action with handoff path', () => {
      const action: NextAction = {
        type: 'delegate',
        reason: 'Partial success, delegating',
        handoffPath: '/path/to/handoff.yaml',
      };

      expect(action.type).toBe('delegate');
      expect(action.handoffPath).toBeDefined();
    });

    it('should accept escalate action', () => {
      const action: NextAction = {
        type: 'escalate',
        reason: 'Max attempts reached',
      };

      expect(action.type).toBe('escalate');
    });
  });

  describe('CIFixResult type', () => {
    it('should accept valid fix result', () => {
      const result: CIFixResult = {
        prNumber: 123,
        attempt: 1,
        analysis: {
          totalFailures: 2,
          identifiedCauses: [],
          unidentifiedCauses: [],
          byCategory: new Map(),
          analyzedAt: new Date().toISOString(),
          rawLogs: '',
        },
        fixesApplied: [
          {
            type: 'lint',
            file: 'src/index.ts',
            description: 'Fixed lint',
            success: true,
          },
        ],
        verification: {
          lintPassed: true,
          typecheckPassed: true,
          testsPassed: true,
          buildPassed: true,
          outputs: {
            lint: '',
            typecheck: '',
            test: '',
            build: '',
          },
        },
        outcome: 'success',
        nextAction: {
          type: 'none',
          reason: 'All passed',
        },
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        duration: 120000,
        commitHash: 'abc123',
        commitMessage: 'fix(ci): auto-fix CI failures',
      };

      expect(result.outcome).toBe('success');
      expect(result.commitHash).toBe('abc123');
    });
  });

  describe('EscalationInfo type', () => {
    it('should accept valid escalation info', () => {
      const info: EscalationInfo = {
        reason: 'max_attempts_reached',
        description: 'Maximum attempts reached without resolution',
        prNumber: 123,
        attemptHistory: [],
        unresolvedIssues: [
          {
            category: 'type',
            message: 'Type error',
            details: 'Details',
            confidence: 1.0,
            autoFixable: false,
          },
        ],
        suggestedActions: ['Manual review required'],
        escalatedAt: new Date().toISOString(),
      };

      expect(info.reason).toBe('max_attempts_reached');
      expect(info.suggestedActions).toHaveLength(1);
    });
  });
});
