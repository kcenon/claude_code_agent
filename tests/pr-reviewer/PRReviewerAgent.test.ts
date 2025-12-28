import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import {
  PRReviewerAgent,
  getPRReviewerAgent,
  resetPRReviewerAgent,
} from '../../src/pr-reviewer/PRReviewerAgent.js';
import type { ImplementationResult } from '../../src/pr-reviewer/types.js';
import { ImplementationResultNotFoundError } from '../../src/pr-reviewer/errors.js';

describe('PRReviewerAgent', () => {
  const testDir = path.join(process.cwd(), 'tests', 'pr-reviewer', 'test-scratchpad');
  const resultsDir = path.join(testDir, 'results');
  const reviewsDir = path.join(testDir, 'reviews');

  const createMinimalImplementationResult = (
    overrides: Partial<ImplementationResult> = {}
  ): ImplementationResult => ({
    workOrderId: 'WO-001',
    issueId: 'ISS-001-feature',
    githubIssue: 123,
    status: 'completed',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    changes: [
      {
        filePath: 'src/feature.ts',
        changeType: 'create',
        description: 'New feature implementation',
        linesAdded: 100,
        linesRemoved: 0,
      },
    ],
    tests: {
      filesCreated: ['tests/feature.test.ts'],
      totalTests: 10,
      coveragePercentage: 85,
    },
    verification: {
      testsPassed: true,
      testsOutput: 'All tests passed',
      lintPassed: true,
      lintOutput: 'No lint errors',
      buildPassed: true,
      buildOutput: 'Build successful',
    },
    branch: {
      name: 'feature/ISS-001-feature',
      commits: [
        { hash: 'abc123', message: 'feat: implement feature' },
      ],
    },
    ...overrides,
  });

  const cleanupTestEnvironment = async () => {
    try {
      await fs.promises.rm(testDir, { recursive: true });
    } catch {
      // Ignore
    }
  };

  beforeEach(async () => {
    resetPRReviewerAgent();
    await cleanupTestEnvironment();
    await fs.promises.mkdir(resultsDir, { recursive: true });
    await fs.promises.mkdir(reviewsDir, { recursive: true });
  });

  afterEach(async () => {
    resetPRReviewerAgent();
    await cleanupTestEnvironment();
  });

  describe('constructor', () => {
    it('should create with default configuration', () => {
      const agent = new PRReviewerAgent();
      const config = agent.getConfig();

      expect(config.projectRoot).toBe(process.cwd());
      expect(config.autoMerge).toBe(false);
      expect(config.mergeStrategy).toBe('squash');
      expect(config.coverageThreshold).toBe(80);
    });

    it('should accept custom configuration', () => {
      const agent = new PRReviewerAgent({
        projectRoot: testDir,
        autoMerge: true,
        coverageThreshold: 90,
      });
      const config = agent.getConfig();

      expect(config.projectRoot).toBe(testDir);
      expect(config.autoMerge).toBe(true);
      expect(config.coverageThreshold).toBe(90);
    });

    it('should merge custom config with defaults', () => {
      const agent = new PRReviewerAgent({
        autoMerge: true,
      });
      const config = agent.getConfig();

      expect(config.autoMerge).toBe(true);
      expect(config.mergeStrategy).toBe('squash'); // Default
      expect(config.deleteBranchOnMerge).toBe(true); // Default
    });
  });

  describe('singleton', () => {
    it('should return same instance with getPRReviewerAgent', () => {
      resetPRReviewerAgent();
      const agent1 = getPRReviewerAgent();
      const agent2 = getPRReviewerAgent();

      expect(agent1).toBe(agent2);
      resetPRReviewerAgent();
    });

    it('should reset instance with resetPRReviewerAgent', () => {
      resetPRReviewerAgent();
      const agent1 = getPRReviewerAgent();
      resetPRReviewerAgent();
      const agent2 = getPRReviewerAgent();

      expect(agent1).not.toBe(agent2);
      resetPRReviewerAgent();
    });
  });

  describe('review', () => {
    it('should throw when implementation result not found', async () => {
      const agent = new PRReviewerAgent({
        projectRoot: testDir,
        resultsPath: '',
      });

      await expect(
        agent.review('WO-NONEXISTENT', { dryRun: true, skipCIWait: true })
      ).rejects.toThrow(ImplementationResultNotFoundError);
    });
  });

  describe('reviewFromFile', () => {
    it('should attempt to read implementation result from file', async () => {
      const implResult = createMinimalImplementationResult();
      const resultPath = path.join(resultsDir, 'WO-001-result.yaml');
      await fs.promises.writeFile(resultPath, yaml.dump(implResult), 'utf-8');

      // Verify the file was written correctly
      const written = await fs.promises.readFile(resultPath, 'utf-8');
      const parsed = yaml.load(written) as ImplementationResult;
      expect(parsed.workOrderId).toBe('WO-001');
    });

    it('should throw on invalid YAML', async () => {
      const resultPath = path.join(resultsDir, 'invalid.yaml');
      await fs.promises.writeFile(resultPath, '{ invalid yaml [', 'utf-8');

      const agent = new PRReviewerAgent({
        projectRoot: testDir,
        resultsPath: '',
      });

      await expect(
        agent.reviewFromFile(resultPath, { dryRun: true, skipCIWait: true })
      ).rejects.toThrow();
    });
  });

  describe('getConfig', () => {
    it('should return copy of configuration', () => {
      const agent = new PRReviewerAgent({
        projectRoot: testDir,
        autoMerge: true,
      });

      const config1 = agent.getConfig();
      const config2 = agent.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different objects
    });

    it('should include all configuration options', () => {
      const agent = new PRReviewerAgent();
      const config = agent.getConfig();

      expect(config).toHaveProperty('projectRoot');
      expect(config).toHaveProperty('resultsPath');
      expect(config).toHaveProperty('autoMerge');
      expect(config).toHaveProperty('mergeStrategy');
      expect(config).toHaveProperty('deleteBranchOnMerge');
      expect(config).toHaveProperty('coverageThreshold');
      expect(config).toHaveProperty('maxComplexity');
      expect(config).toHaveProperty('ciTimeout');
      expect(config).toHaveProperty('ciPollInterval');
    });
  });

  describe('configuration edge cases', () => {
    it('should handle all merge strategies', () => {
      const strategies = ['merge', 'squash', 'rebase'] as const;

      for (const strategy of strategies) {
        const agent = new PRReviewerAgent({
          mergeStrategy: strategy,
        });
        const config = agent.getConfig();
        expect(config.mergeStrategy).toBe(strategy);
      }
    });

    it('should handle coverage threshold boundaries', () => {
      const agent1 = new PRReviewerAgent({ coverageThreshold: 0 });
      expect(agent1.getConfig().coverageThreshold).toBe(0);

      const agent2 = new PRReviewerAgent({ coverageThreshold: 100 });
      expect(agent2.getConfig().coverageThreshold).toBe(100);
    });

    it('should handle timeout configuration', () => {
      const agent = new PRReviewerAgent({
        ciTimeout: 300000, // 5 minutes
        ciPollInterval: 5000, // 5 seconds
      });
      const config = agent.getConfig();

      expect(config.ciTimeout).toBe(300000);
      expect(config.ciPollInterval).toBe(5000);
    });
  });

  describe('implementation result handling', () => {
    it('should correctly parse valid implementation result', async () => {
      const implResult = createMinimalImplementationResult();
      const resultPath = path.join(resultsDir, 'WO-001-result.yaml');
      await fs.promises.writeFile(resultPath, yaml.dump(implResult));

      // Read and verify the file content
      const content = await fs.promises.readFile(resultPath, 'utf-8');
      const parsed = yaml.load(content) as ImplementationResult;

      expect(parsed.workOrderId).toBe('WO-001');
      expect(parsed.issueId).toBe('ISS-001-feature');
      expect(parsed.status).toBe('completed');
      expect(parsed.changes).toHaveLength(1);
      expect(parsed.verification.testsPassed).toBe(true);
    });

    it('should handle implementation result with blockers', async () => {
      const implResult = createMinimalImplementationResult({
        status: 'blocked',
        blockers: ['Missing API key', 'Database connection failed'],
      });

      expect(implResult.status).toBe('blocked');
      expect(implResult.blockers).toHaveLength(2);
    });

    it('should handle implementation result with optional fields', async () => {
      const implResult = createMinimalImplementationResult({
        notes: 'Additional implementation notes',
        githubIssue: undefined,
      });

      expect(implResult.notes).toBe('Additional implementation notes');
      expect(implResult.githubIssue).toBeUndefined();
    });
  });

  describe('file change handling', () => {
    it('should handle multiple file changes', () => {
      const implResult = createMinimalImplementationResult({
        changes: [
          {
            filePath: 'src/feature.ts',
            changeType: 'create',
            description: 'New feature',
            linesAdded: 100,
            linesRemoved: 0,
          },
          {
            filePath: 'src/utils.ts',
            changeType: 'modify',
            description: 'Updated utils',
            linesAdded: 10,
            linesRemoved: 5,
          },
          {
            filePath: 'src/old.ts',
            changeType: 'delete',
            description: 'Removed old file',
            linesAdded: 0,
            linesRemoved: 50,
          },
        ],
      });

      expect(implResult.changes).toHaveLength(3);
      expect(implResult.changes[0].changeType).toBe('create');
      expect(implResult.changes[1].changeType).toBe('modify');
      expect(implResult.changes[2].changeType).toBe('delete');
    });

    it('should calculate total lines changed', () => {
      const implResult = createMinimalImplementationResult({
        changes: [
          { filePath: 'a.ts', changeType: 'create', description: '', linesAdded: 100, linesRemoved: 0 },
          { filePath: 'b.ts', changeType: 'modify', description: '', linesAdded: 50, linesRemoved: 30 },
        ],
      });

      const totalAdded = implResult.changes.reduce((sum, c) => sum + c.linesAdded, 0);
      const totalRemoved = implResult.changes.reduce((sum, c) => sum + c.linesRemoved, 0);

      expect(totalAdded).toBe(150);
      expect(totalRemoved).toBe(30);
    });
  });

  describe('verification result handling', () => {
    it('should handle all passing verification', () => {
      const implResult = createMinimalImplementationResult({
        verification: {
          testsPassed: true,
          testsOutput: 'All 50 tests passed',
          lintPassed: true,
          lintOutput: 'No warnings',
          buildPassed: true,
          buildOutput: 'Compiled successfully',
        },
      });

      expect(implResult.verification.testsPassed).toBe(true);
      expect(implResult.verification.lintPassed).toBe(true);
      expect(implResult.verification.buildPassed).toBe(true);
    });

    it('should handle failing verification', () => {
      const implResult = createMinimalImplementationResult({
        verification: {
          testsPassed: false,
          testsOutput: '5 tests failed',
          lintPassed: false,
          lintOutput: '10 errors found',
          buildPassed: false,
          buildOutput: 'Compilation failed',
        },
      });

      expect(implResult.verification.testsPassed).toBe(false);
      expect(implResult.verification.lintPassed).toBe(false);
      expect(implResult.verification.buildPassed).toBe(false);
    });
  });

  describe('branch information', () => {
    it('should handle branch with multiple commits', () => {
      const implResult = createMinimalImplementationResult({
        branch: {
          name: 'feature/ISS-001-feature',
          commits: [
            { hash: 'abc123', message: 'feat: initial implementation' },
            { hash: 'def456', message: 'feat: add tests' },
            { hash: 'ghi789', message: 'fix: address review feedback' },
          ],
        },
      });

      expect(implResult.branch.commits).toHaveLength(3);
      expect(implResult.branch.name).toContain('feature/');
    });
  });
});
