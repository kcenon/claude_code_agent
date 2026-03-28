/**
 * LocalReviewAgent unit tests
 *
 * Tests local code review without GitHub PR creation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { LocalReviewAgent } from '../../src/pr-reviewer/LocalReviewAgent.js';
import type { ImplementationResult } from '../../src/worker/types.js';

// Mock the security module for git command execution
vi.mock('../../src/security/index.js', () => ({
  getCommandSanitizer: () => ({
    execGitSync: vi.fn().mockReturnValue({ success: true, stdout: '', stderr: '' }),
  }),
}));

// Mock the logging module
vi.mock('../../src/logging/index.js', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

function makeImplResult(overrides: Partial<ImplementationResult> = {}): ImplementationResult {
  return {
    workOrderId: 'WO-001',
    issueId: 'ISS-001',
    status: 'completed',
    startedAt: '2025-01-01T00:00:00Z',
    completedAt: '2025-01-01T01:00:00Z',
    changes: [
      {
        filePath: 'src/auth.ts',
        changeType: 'create',
        description: 'New auth module',
        linesAdded: 50,
        linesRemoved: 0,
      },
    ],
    tests: {
      filesCreated: ['src/auth.test.ts'],
      totalTests: 5,
      coveragePercentage: 85,
    },
    verification: {
      testsPassed: true,
      testsOutput: '5 passed',
      lintPassed: true,
      lintOutput: 'No issues',
      buildPassed: true,
      buildOutput: 'Build succeeded',
    },
    branch: {
      name: 'feature/ISS-001-auth',
      commits: [{ hash: 'abc123', message: 'feat(auth): add JWT authentication' }],
    },
    ...overrides,
  };
}

describe('LocalReviewAgent', () => {
  let agent: LocalReviewAgent;
  let tmpDir: string;

  beforeEach(() => {
    agent = new LocalReviewAgent();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'local-review-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('agent identity', () => {
    it('should have correct agentId', () => {
      expect(agent.agentId).toBe('local-reviewer-agent');
    });

    it('should have correct name', () => {
      expect(agent.name).toBe('Local Review Agent');
    });

    it('should implement initialize/dispose', async () => {
      await expect(agent.initialize()).resolves.not.toThrow();
      await expect(agent.dispose()).resolves.not.toThrow();
    });
  });

  describe('reviewLocal', () => {
    it('should return a review result with report path', async () => {
      const result = await agent.reviewLocal(makeImplResult(), {
        outputDir: tmpDir,
        workOrderId: 'WO-001',
      });

      expect(result.workOrderId).toBe('WO-001');
      expect(result.decision).toBeDefined();
      expect(['approve', 'request_changes']).toContain(result.decision);
      expect(result.reportPath).toBe(path.join(tmpDir, 'review_report.json'));
      expect(result.qualityGate).toBeDefined();
      expect(typeof result.qualityGate.passed).toBe('boolean');
    });

    it('should write review_report.json to outputDir', async () => {
      await agent.reviewLocal(makeImplResult(), {
        outputDir: tmpDir,
        workOrderId: 'WO-001',
      });

      const reportPath = path.join(tmpDir, 'review_report.json');
      expect(fs.existsSync(reportPath)).toBe(true);

      const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
      expect(report.schemaVersion).toBe('1.0');
      expect(report.workOrderId).toBe('WO-001');
      expect(report.decision).toBeDefined();
      expect(report.summary).toBeDefined();
    });

    it('should handle empty changes list', async () => {
      const result = await agent.reviewLocal(makeImplResult({ changes: [] }), {
        outputDir: tmpDir,
      });

      expect(result.comments).toHaveLength(0);
      expect(result.reportPath).toBeDefined();
    });

    it('should set mergedLocally to false when autoMerge is disabled', async () => {
      const result = await agent.reviewLocal(makeImplResult(), {
        outputDir: tmpDir,
        autoMerge: false,
      });

      expect(result.mergedLocally).toBe(false);
    });

    it('should create outputDir if it does not exist', async () => {
      const nestedDir = path.join(tmpDir, 'nested', 'output');
      await agent.reviewLocal(makeImplResult(), {
        outputDir: nestedDir,
      });

      expect(fs.existsSync(path.join(nestedDir, 'review_report.json'))).toBe(true);
    });
  });
});
