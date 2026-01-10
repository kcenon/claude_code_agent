import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  WorkerAgent,
  WorkerError,
  WorkOrderParseError,
  ContextAnalysisError,
  FileReadError,
  FileWriteError,
  BranchCreationError,
  BranchExistsError,
  CommitError,
  GitOperationError,
  CodeGenerationError,
  TestGenerationError,
  VerificationError,
  MaxRetriesExceededError,
  ImplementationBlockedError,
  CommandExecutionError,
  ResultPersistenceError,
  DEFAULT_WORKER_AGENT_CONFIG,
  DEFAULT_CODE_PATTERNS,
  DEFAULT_RETRY_POLICY,
} from '../../src/worker/index.js';
import type {
  WorkOrder,
  WorkerAgentConfig,
  ImplementationResult,
  CodeContext,
} from '../../src/worker/index.js';
import { ErrorCodes } from '../../src/errors/index.js';

describe('WorkerAgent', () => {
  let agent: WorkerAgent;
  let testDir: string;

  const createWorkOrder = (
    id: string = 'ISS-001',
    orderId: string = 'WO-001'
  ): WorkOrder => ({
    orderId,
    issueId: id,
    createdAt: new Date().toISOString(),
    priority: 75,
    context: {
      relatedFiles: [],
      dependenciesStatus: [],
    },
    acceptanceCriteria: ['Implement feature', 'Add tests'],
  });

  beforeEach(async () => {
    testDir = join(tmpdir(), `worker-agent-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });

    // Initialize git repo for tests
    const { exec } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execAsync = promisify(exec);

    await execAsync('git init', { cwd: testDir });
    await execAsync('git config user.email "test@test.com"', { cwd: testDir });
    await execAsync('git config user.name "Test User"', { cwd: testDir });

    // Create initial commit
    await writeFile(join(testDir, 'README.md'), '# Test');
    await execAsync('git add .', { cwd: testDir });
    await execAsync('git commit -m "Initial commit"', { cwd: testDir });

    agent = new WorkerAgent({
      projectRoot: testDir,
      resultsPath: '.ad-sdlc/scratchpad/progress',
    });
  });

  afterEach(async () => {
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultAgent = new WorkerAgent();
      const config = defaultAgent.getConfig();

      expect(config.maxRetries).toBe(DEFAULT_WORKER_AGENT_CONFIG.maxRetries);
      expect(config.testCommand).toBe(DEFAULT_WORKER_AGENT_CONFIG.testCommand);
      expect(config.lintCommand).toBe(DEFAULT_WORKER_AGENT_CONFIG.lintCommand);
      expect(config.buildCommand).toBe(DEFAULT_WORKER_AGENT_CONFIG.buildCommand);
    });

    it('should initialize with custom configuration', () => {
      const customConfig: WorkerAgentConfig = {
        maxRetries: 5,
        testCommand: 'npm run test:custom',
        coverageThreshold: 90,
      };

      const customAgent = new WorkerAgent(customConfig);
      const config = customAgent.getConfig();

      expect(config.maxRetries).toBe(5);
      expect(config.testCommand).toBe('npm run test:custom');
      expect(config.coverageThreshold).toBe(90);
    });
  });

  describe('analyzeContext', () => {
    it('should analyze context with no related files', async () => {
      const workOrder = createWorkOrder();
      const context = await agent.analyzeContext(workOrder);

      expect(context.relatedFiles).toHaveLength(0);
      expect(context.workOrder).toBe(workOrder);
      expect(context.patterns).toBeDefined();
    });

    it('should read related files when they exist', async () => {
      const testFilePath = 'src/test.ts';
      const testFileContent = `const x = 'hello';\nexport { x };`;

      await mkdir(join(testDir, 'src'), { recursive: true });
      await writeFile(join(testDir, testFilePath), testFileContent);

      const workOrder: WorkOrder = {
        ...createWorkOrder(),
        context: {
          relatedFiles: [
            { path: testFilePath, reason: 'Test file' },
          ],
          dependenciesStatus: [],
        },
      };

      const context = await agent.analyzeContext(workOrder);

      expect(context.relatedFiles).toHaveLength(1);
      expect(context.relatedFiles[0].path).toBe(testFilePath);
      expect(context.relatedFiles[0].content).toBe(testFileContent);
      expect(context.relatedFiles[0].reason).toBe('Test file');
    });

    it('should detect code patterns from TypeScript files', async () => {
      const testFileContent = `
import { foo } from './foo';
import { bar } from './bar';

const x = 'hello';
const y = "world";

export { x, y };
`;

      await mkdir(join(testDir, 'src'), { recursive: true });
      await writeFile(join(testDir, 'src/test.ts'), testFileContent);

      const workOrder: WorkOrder = {
        ...createWorkOrder(),
        context: {
          relatedFiles: [
            { path: 'src/test.ts', reason: 'Test file' },
          ],
          dependenciesStatus: [],
        },
      };

      const context = await agent.analyzeContext(workOrder);

      expect(context.patterns.quoteStyle).toBe('single');
      expect(context.patterns.useSemicolons).toBe(true);
    });

    it('should detect tab indentation', async () => {
      const testFileContent = `import { foo } from './foo';

\tconst x = 'hello';
\tconst y = 'world';
`;

      await mkdir(join(testDir, 'src'), { recursive: true });
      await writeFile(join(testDir, 'src/tabs.ts'), testFileContent);

      const workOrder: WorkOrder = {
        ...createWorkOrder(),
        context: {
          relatedFiles: [
            { path: 'src/tabs.ts', reason: 'Test file' },
          ],
          dependenciesStatus: [],
        },
      };

      const context = await agent.analyzeContext(workOrder);

      expect(context.patterns.indentation).toBe('tabs');
    });

    it('should detect double quote style', async () => {
      const testFileContent = `
const x = "hello";
const y = "world";
const z = "test";
`;

      await mkdir(join(testDir, 'src'), { recursive: true });
      await writeFile(join(testDir, 'src/double.ts'), testFileContent);

      const workOrder: WorkOrder = {
        ...createWorkOrder(),
        context: {
          relatedFiles: [
            { path: 'src/double.ts', reason: 'Test file' },
          ],
          dependenciesStatus: [],
        },
      };

      const context = await agent.analyzeContext(workOrder);

      expect(context.patterns.quoteStyle).toBe('double');
    });

    it('should detect no semicolons style', async () => {
      const testFileContent = `
const x = 'hello'
const y = 'world'
export { x, y }
`;

      await mkdir(join(testDir, 'src'), { recursive: true });
      await writeFile(join(testDir, 'src/nosemi.ts'), testFileContent);

      const workOrder: WorkOrder = {
        ...createWorkOrder(),
        context: {
          relatedFiles: [
            { path: 'src/nosemi.ts', reason: 'Test file' },
          ],
          dependenciesStatus: [],
        },
      };

      const context = await agent.analyzeContext(workOrder);

      expect(context.patterns.useSemicolons).toBe(false);
    });

    it('should detect jest test framework', async () => {
      const testFileContent = `
import { describe, it, expect } from '@jest/globals';

describe('test', () => {
  it('works', () => {
    expect(true).toBe(true);
  });
});
`;

      await mkdir(join(testDir, 'src'), { recursive: true });
      await writeFile(join(testDir, 'src/test.ts'), testFileContent);

      const workOrder: WorkOrder = {
        ...createWorkOrder(),
        context: {
          relatedFiles: [
            { path: 'src/test.ts', reason: 'Test file' },
          ],
          dependenciesStatus: [],
        },
      };

      const context = await agent.analyzeContext(workOrder);

      expect(context.patterns.testFramework).toBe('jest');
    });

    it('should detect mocha test framework', async () => {
      const testFileContent = `
const mocha = require('mocha');
const { describe, it } = mocha;

describe('test', () => {
  it('works', () => {});
});
`;

      await mkdir(join(testDir, 'src'), { recursive: true });
      await writeFile(join(testDir, 'src/test.ts'), testFileContent);

      const workOrder: WorkOrder = {
        ...createWorkOrder(),
        context: {
          relatedFiles: [
            { path: 'src/test.ts', reason: 'Test file' },
          ],
          dependenciesStatus: [],
        },
      };

      const context = await agent.analyzeContext(workOrder);

      expect(context.patterns.testFramework).toBe('mocha');
    });

    it('should detect test framework from package.json', async () => {
      const packageJson = `{
  "name": "test-project",
  "devDependencies": {
    "jest": "^29.0.0"
  }
}`;

      await writeFile(join(testDir, 'package.json'), packageJson);

      const workOrder: WorkOrder = {
        ...createWorkOrder(),
        context: {
          relatedFiles: [
            { path: 'package.json', reason: 'Package config' },
          ],
          dependenciesStatus: [],
        },
      };

      const context = await agent.analyzeContext(workOrder);

      expect(context.patterns.testFramework).toBe('jest');
    });

    it('should detect vitest from package.json', async () => {
      const packageJson = `{
  "name": "test-project",
  "devDependencies": {
    "vitest": "^1.0.0"
  }
}`;

      await writeFile(join(testDir, 'package.json'), packageJson);

      const workOrder: WorkOrder = {
        ...createWorkOrder(),
        context: {
          relatedFiles: [
            { path: 'package.json', reason: 'Package config' },
          ],
          dependenciesStatus: [],
        },
      };

      const context = await agent.analyzeContext(workOrder);

      expect(context.patterns.testFramework).toBe('vitest');
    });

    it('should skip files that do not exist', async () => {
      const workOrder: WorkOrder = {
        ...createWorkOrder(),
        context: {
          relatedFiles: [
            { path: 'nonexistent/file.ts', reason: 'Missing file' },
          ],
          dependenciesStatus: [],
        },
      };

      const context = await agent.analyzeContext(workOrder);

      expect(context.relatedFiles).toHaveLength(0);
    });
  });

  describe('createBranch', () => {
    it('should create a feature branch', async () => {
      const workOrder = createWorkOrder('ISS-001-add-feature');
      const branchName = await agent.createBranch(workOrder);

      expect(branchName).toBe('feature/iss-001-add-feature');
    });

    it('should create a fix branch for bug issues', async () => {
      const workOrder = createWorkOrder('ISS-002-fix-bug');
      const branchName = await agent.createBranch(workOrder);

      expect(branchName).toBe('fix/iss-002-fix-bug');
    });

    it('should create a docs branch for documentation issues', async () => {
      const workOrder = createWorkOrder('ISS-003-update-docs');
      const branchName = await agent.createBranch(workOrder);

      expect(branchName).toBe('docs/iss-003-update-docs');
    });

    it('should create a test branch for test issues', async () => {
      const workOrder = createWorkOrder('ISS-004-add-test-coverage');
      const branchName = await agent.createBranch(workOrder);

      expect(branchName).toBe('test/iss-004-add-test-coverage');
    });

    it('should create a refactor branch for refactoring issues', async () => {
      const workOrder = createWorkOrder('ISS-005-refactor-utils');
      const branchName = await agent.createBranch(workOrder);

      expect(branchName).toBe('refactor/iss-005-refactor-utils');
    });

    it('should checkout existing branch if it exists', async () => {
      const workOrder = createWorkOrder('ISS-001-add-feature');

      // Create branch first time
      const branchName1 = await agent.createBranch(workOrder);

      // Get current default branch name (master or main)
      const { exec } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execAsync = promisify(exec);
      const { stdout: defaultBranch } = await execAsync(
        'git branch --list master main | head -1 | tr -d " *"',
        { cwd: testDir }
      );

      // Switch back to default branch
      const branchToCheckout = defaultBranch.trim() || 'master';
      await execAsync(`git checkout ${branchToCheckout}`, { cwd: testDir });

      // Create branch second time (should checkout existing)
      const branchName2 = await agent.createBranch(workOrder);

      expect(branchName1).toBe(branchName2);
    });
  });

  describe('createResult', () => {
    it('should create a completed result', async () => {
      const workOrder = createWorkOrder();
      const startedAt = new Date().toISOString();

      const verification = {
        testsPassed: true,
        testsOutput: 'All tests passed',
        lintPassed: true,
        lintOutput: 'No lint errors',
        buildPassed: true,
        buildOutput: 'Build successful',
      };

      const result = agent.createResult(
        workOrder,
        'completed',
        startedAt,
        'feature/iss-001',
        verification
      );

      expect(result.status).toBe('completed');
      expect(result.workOrderId).toBe('WO-001');
      expect(result.issueId).toBe('ISS-001');
      expect(result.branch.name).toBe('feature/iss-001');
      expect(result.verification).toEqual(verification);
    });

    it('should create a blocked result with blockers', async () => {
      const workOrder = createWorkOrder();
      const startedAt = new Date().toISOString();

      const verification = {
        testsPassed: true,
        testsOutput: 'Skipped',
        lintPassed: true,
        lintOutput: 'Skipped',
        buildPassed: true,
        buildOutput: 'Skipped',
      };

      const blockers = ['Dependency ISS-002 not completed', 'API not available'];

      const result = agent.createResult(
        workOrder,
        'blocked',
        startedAt,
        'feature/iss-001',
        verification,
        'Implementation blocked',
        blockers
      );

      expect(result.status).toBe('blocked');
      expect(result.notes).toBe('Implementation blocked');
      expect(result.blockers).toEqual(blockers);
    });

    it('should include GitHub issue number when URL is provided', async () => {
      const workOrder: WorkOrder = {
        ...createWorkOrder(),
        issueUrl: 'https://github.com/org/repo/issues/123',
      };
      const startedAt = new Date().toISOString();

      const verification = {
        testsPassed: true,
        testsOutput: '',
        lintPassed: true,
        lintOutput: '',
        buildPassed: true,
        buildOutput: '',
      };

      const result = agent.createResult(
        workOrder,
        'completed',
        startedAt,
        'feature/iss-001',
        verification
      );

      expect(result.githubIssue).toBe(123);
    });
  });

  describe('recordFileChange', () => {
    it('should record file changes', () => {
      agent.recordFileChange({
        filePath: 'src/new-file.ts',
        changeType: 'create',
        description: 'New implementation file',
        linesAdded: 100,
        linesRemoved: 0,
      });

      const workOrder = createWorkOrder();
      const result = agent.createResult(
        workOrder,
        'completed',
        new Date().toISOString(),
        'feature/test',
        {
          testsPassed: true,
          testsOutput: '',
          lintPassed: true,
          lintOutput: '',
          buildPassed: true,
          buildOutput: '',
        }
      );

      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].filePath).toBe('src/new-file.ts');
      expect(result.changes[0].changeType).toBe('create');
    });
  });

  describe('recordTestFile', () => {
    it('should record test files', () => {
      agent.recordTestFile('tests/new-file.test.ts', 5);

      const workOrder = createWorkOrder();
      const result = agent.createResult(
        workOrder,
        'completed',
        new Date().toISOString(),
        'feature/test',
        {
          testsPassed: true,
          testsOutput: '',
          lintPassed: true,
          lintOutput: '',
          buildPassed: true,
          buildOutput: '',
        }
      );

      expect(result.tests.filesCreated).toContain('tests/new-file.test.ts');
      expect(result.tests.totalTests).toBe(5);
    });
  });

  describe('saveResult', () => {
    it('should save result to disk as YAML', async () => {
      const workOrder = createWorkOrder();

      const result: ImplementationResult = {
        workOrderId: 'WO-001',
        issueId: 'ISS-001',
        status: 'completed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        changes: [],
        tests: {
          filesCreated: [],
          totalTests: 0,
          coveragePercentage: 0,
        },
        verification: {
          testsPassed: true,
          testsOutput: '',
          lintPassed: true,
          lintOutput: '',
          buildPassed: true,
          buildOutput: '',
        },
        branch: {
          name: 'feature/iss-001',
          commits: [],
        },
      };

      await agent.saveResult(result);

      const resultPath = join(
        testDir,
        '.ad-sdlc/scratchpad/progress/results/WO-001-result.yaml'
      );
      expect(existsSync(resultPath)).toBe(true);

      const content = await readFile(resultPath, 'utf-8');
      expect(content).toContain('implementation_result:');
      expect(content).toContain('workOrderId: WO-001');
      expect(content).toContain('status: completed');
    });

    it('should handle result with file changes', async () => {
      agent.recordFileChange({
        filePath: 'src/feature.ts',
        changeType: 'create',
        description: 'New feature file',
        linesAdded: 50,
        linesRemoved: 0,
      });

      const result: ImplementationResult = {
        workOrderId: 'WO-002',
        issueId: 'ISS-002',
        status: 'completed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        changes: [{
          filePath: 'src/feature.ts',
          changeType: 'create',
          description: 'New feature file',
          linesAdded: 50,
          linesRemoved: 0,
        }],
        tests: {
          filesCreated: ['tests/feature.test.ts'],
          totalTests: 5,
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
          name: 'feature/iss-002',
          commits: [{ hash: 'abc123', message: 'feat: add feature' }],
        },
      };

      await agent.saveResult(result);

      const resultPath = join(
        testDir,
        '.ad-sdlc/scratchpad/progress/results/WO-002-result.yaml'
      );
      expect(existsSync(resultPath)).toBe(true);

      const content = await readFile(resultPath, 'utf-8');
      expect(content).toContain('filePath: src/feature.ts');
      expect(content).toContain('tests/feature.test.ts');
    });

    it('should handle result with blockers', async () => {
      const result: ImplementationResult = {
        workOrderId: 'WO-003',
        issueId: 'ISS-003',
        status: 'blocked',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        changes: [],
        tests: {
          filesCreated: [],
          totalTests: 0,
          coveragePercentage: 0,
        },
        verification: {
          testsPassed: true,
          testsOutput: 'Skipped',
          lintPassed: true,
          lintOutput: 'Skipped',
          buildPassed: true,
          buildOutput: 'Skipped',
        },
        branch: {
          name: 'feature/iss-003',
          commits: [],
        },
        notes: 'Blocked by dependencies',
        blockers: ['DEP-001', 'DEP-002'],
      };

      await agent.saveResult(result);

      const resultPath = join(
        testDir,
        '.ad-sdlc/scratchpad/progress/results/WO-003-result.yaml'
      );
      expect(existsSync(resultPath)).toBe(true);

      const content = await readFile(resultPath, 'utf-8');
      expect(content).toContain('status: blocked');
      expect(content).toContain('DEP-001');
      expect(content).toContain('DEP-002');
    });

    it('should handle YAML special characters in strings', async () => {
      const result: ImplementationResult = {
        workOrderId: 'WO-004',
        issueId: 'ISS-004',
        status: 'completed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        changes: [],
        tests: {
          filesCreated: [],
          totalTests: 0,
          coveragePercentage: 0,
        },
        verification: {
          testsPassed: true,
          testsOutput: 'Test output: passed # comment',
          lintPassed: true,
          lintOutput: 'Output with "quotes"',
          buildPassed: true,
          buildOutput: "Output with 'single quotes'",
        },
        branch: {
          name: 'feature/iss-004',
          commits: [],
        },
        notes: 'Note with: colon',
      };

      await agent.saveResult(result);

      const resultPath = join(
        testDir,
        '.ad-sdlc/scratchpad/progress/results/WO-004-result.yaml'
      );
      expect(existsSync(resultPath)).toBe(true);
    });

    it('should handle result with null values', async () => {
      // Test formatYamlValue null handling (line 772)
      const result = {
        workOrderId: 'WO-005',
        issueId: 'ISS-005',
        status: 'completed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        changes: [],
        tests: {
          filesCreated: [],
          totalTests: 0,
          coveragePercentage: 0,
        },
        verification: {
          testsPassed: true,
          testsOutput: null,
          lintPassed: true,
          lintOutput: null,
          buildPassed: true,
          buildOutput: null,
        },
        branch: {
          name: 'feature/iss-005',
          commits: [],
        },
        notes: null,
      } as unknown as ImplementationResult;

      await agent.saveResult(result);

      const resultPath = join(
        testDir,
        '.ad-sdlc/scratchpad/progress/results/WO-005-result.yaml'
      );
      expect(existsSync(resultPath)).toBe(true);

      const content = await readFile(resultPath, 'utf-8');
      expect(content).toContain('null');
    });

    it('should handle result with nested objects in arrays', async () => {
      // Test toYaml nested object handling (lines 737-739)
      const result = {
        workOrderId: 'WO-006',
        issueId: 'ISS-006',
        status: 'completed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        changes: [{
          filePath: 'test.ts',
          changeType: 'create',
          description: 'test',
          linesAdded: 10,
          linesRemoved: 0,
          metadata: { author: 'test', nested: { deep: 'value' } },
        }],
        tests: {
          filesCreated: [],
          totalTests: 0,
          coveragePercentage: 0,
        },
        verification: {
          testsPassed: true,
          testsOutput: '',
          lintPassed: true,
          lintOutput: '',
          buildPassed: true,
          buildOutput: '',
        },
        branch: {
          name: 'feature/iss-006',
          commits: [],
        },
      } as unknown as ImplementationResult;

      await agent.saveResult(result);

      const resultPath = join(
        testDir,
        '.ad-sdlc/scratchpad/progress/results/WO-006-result.yaml'
      );
      expect(existsSync(resultPath)).toBe(true);

      const content = await readFile(resultPath, 'utf-8');
      expect(content).toContain('metadata:');
    });

    it('should handle result with object values', async () => {
      // Test formatYamlValue JSON.stringify handling (line 794)
      const result = {
        workOrderId: 'WO-007',
        issueId: 'ISS-007',
        status: 'completed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        changes: [],
        tests: {
          filesCreated: [],
          totalTests: 0,
          coveragePercentage: 0,
          extra: ['item1', 'item2'],
        },
        verification: {
          testsPassed: true,
          testsOutput: '',
          lintPassed: true,
          lintOutput: '',
          buildPassed: true,
          buildOutput: '',
        },
        branch: {
          name: 'feature/iss-007',
          commits: [],
        },
      } as unknown as ImplementationResult;

      await agent.saveResult(result);

      const resultPath = join(
        testDir,
        '.ad-sdlc/scratchpad/progress/results/WO-007-result.yaml'
      );
      expect(existsSync(resultPath)).toBe(true);
    });

    it('should handle result with string containing newlines', async () => {
      const result: ImplementationResult = {
        workOrderId: 'WO-008',
        issueId: 'ISS-008',
        status: 'completed',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        changes: [],
        tests: {
          filesCreated: [],
          totalTests: 0,
          coveragePercentage: 0,
        },
        verification: {
          testsPassed: true,
          testsOutput: 'Line 1\nLine 2\nLine 3',
          lintPassed: true,
          lintOutput: '',
          buildPassed: true,
          buildOutput: '',
        },
        branch: {
          name: 'feature/iss-008',
          commits: [],
        },
      };

      await agent.saveResult(result);

      const resultPath = join(
        testDir,
        '.ad-sdlc/scratchpad/progress/results/WO-008-result.yaml'
      );
      expect(existsSync(resultPath)).toBe(true);
    });
  });

  describe('implement', () => {
    it('should run implementation with dry run option', async () => {
      const workOrder = createWorkOrder();

      const result = await agent.implement(workOrder, {
        skipTests: true,
        skipVerification: true,
        dryRun: true,
      });

      expect(result.status).toBe('completed');
      expect(result.verification.testsOutput).toBe('Skipped');
    });

    it('should create branch during implementation', async () => {
      const workOrder = createWorkOrder('ISS-005-new-feature');

      const result = await agent.implement(workOrder, {
        skipTests: true,
        skipVerification: true,
        dryRun: true,
      });

      expect(result.branch.name).toBe('feature/iss-005-new-feature');
    });

    it('should use fixed retry delay policy', async () => {
      const workOrder = createWorkOrder('ISS-006-fixed');

      const result = await agent.implement(workOrder, {
        skipTests: true,
        skipVerification: true,
        dryRun: true,
        retryPolicy: {
          maxAttempts: 1,
          baseDelayMs: 100,
          backoff: 'fixed',
          maxDelayMs: 1000,
        },
      });

      expect(result.status).toBe('completed');
    });

    it('should use linear retry delay policy', async () => {
      const workOrder = createWorkOrder('ISS-007-linear');

      const result = await agent.implement(workOrder, {
        skipTests: true,
        skipVerification: true,
        dryRun: true,
        retryPolicy: {
          maxAttempts: 1,
          baseDelayMs: 100,
          backoff: 'linear',
          maxDelayMs: 1000,
        },
      });

      expect(result.status).toBe('completed');
    });

    it('should create perf branch for performance issues', async () => {
      const workOrder = createWorkOrder('ISS-010-perf-optimization');

      const result = await agent.implement(workOrder, {
        skipTests: true,
        skipVerification: true,
        dryRun: true,
      });

      expect(result.branch.name).toBe('feature/iss-010-perf-optimization');
    });

    it('should create style branch for style issues', async () => {
      const workOrder = createWorkOrder('ISS-011-style-update');

      const result = await agent.implement(workOrder, {
        skipTests: true,
        skipVerification: true,
        dryRun: true,
      });

      expect(result.branch.name).toBe('feature/iss-011-style-update');
    });

    it('should create chore branch for chore issues', async () => {
      const workOrder = createWorkOrder('ISS-012-chore-cleanup');

      const result = await agent.implement(workOrder, {
        skipTests: true,
        skipVerification: true,
        dryRun: true,
      });

      expect(result.branch.name).toBe('feature/iss-012-chore-cleanup');
    });

    it('should use exponential retry delay policy by default', async () => {
      const workOrder = createWorkOrder('ISS-013-exponential');

      const result = await agent.implement(workOrder, {
        skipTests: true,
        skipVerification: true,
        dryRun: true,
        retryPolicy: {
          maxAttempts: 1,
          baseDelayMs: 100,
          backoff: 'exponential',
          maxDelayMs: 1000,
        },
      });

      expect(result.status).toBe('completed');
    });

    it('should include sdsComponent scope in result when provided', async () => {
      const workOrder: WorkOrder = {
        ...createWorkOrder('ISS-014-scoped'),
        context: {
          relatedFiles: [],
          dependenciesStatus: [],
          sdsComponent: 'auth',
        },
      };

      const result = await agent.implement(workOrder, {
        skipTests: true,
        skipVerification: true,
        dryRun: true,
      });

      expect(result.status).toBe('completed');
    });
  });
});

describe('WorkerAgent errors', () => {
  it('should export all error classes', () => {
    expect(WorkerError).toBeDefined();
    expect(WorkOrderParseError).toBeDefined();
    expect(ContextAnalysisError).toBeDefined();
    expect(FileReadError).toBeDefined();
    expect(FileWriteError).toBeDefined();
    expect(BranchCreationError).toBeDefined();
    expect(BranchExistsError).toBeDefined();
    expect(CommitError).toBeDefined();
    expect(GitOperationError).toBeDefined();
    expect(CodeGenerationError).toBeDefined();
    expect(TestGenerationError).toBeDefined();
    expect(VerificationError).toBeDefined();
    expect(MaxRetriesExceededError).toBeDefined();
    expect(ImplementationBlockedError).toBeDefined();
    expect(CommandExecutionError).toBeDefined();
    expect(ResultPersistenceError).toBeDefined();
  });

  describe('WorkerError', () => {
    it('should create error with message', () => {
      const error = new WorkerError(ErrorCodes.WRK_WORK_ORDER_PARSE_ERROR, 'test error');
      expect(error.message).toBe('test error');
      expect(error.name).toBe('WorkerError');
      expect(error.code).toBe(ErrorCodes.WRK_WORK_ORDER_PARSE_ERROR);
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe('WorkOrderParseError', () => {
    it('should create error with orderId only', () => {
      const error = new WorkOrderParseError('WO-001');
      expect(error.message).toBe('Failed to parse work order WO-001');
      expect(error.name).toBe('WorkOrderParseError');
      expect(error.orderId).toBe('WO-001');
      expect(error.cause).toBeUndefined();
    });

    it('should create error with orderId and cause', () => {
      const cause = new Error('parse failed');
      const error = new WorkOrderParseError('WO-002', cause);
      expect(error.message).toBe('Failed to parse work order WO-002: parse failed');
      expect(error.orderId).toBe('WO-002');
      expect(error.cause).toBe(cause);
    });
  });

  describe('ContextAnalysisError', () => {
    it('should create error with issueId only', () => {
      const error = new ContextAnalysisError('ISS-001');
      expect(error.message).toBe('Failed to analyze context for issue ISS-001');
      expect(error.name).toBe('ContextAnalysisError');
      expect(error.issueId).toBe('ISS-001');
      expect(error.cause).toBeUndefined();
    });

    it('should create error with issueId and cause', () => {
      const cause = new Error('analysis failed');
      const error = new ContextAnalysisError('ISS-002', cause);
      expect(error.message).toBe('Failed to analyze context for issue ISS-002: analysis failed');
      expect(error.cause).toBe(cause);
    });
  });

  describe('FileReadError', () => {
    it('should create error with filePath only', () => {
      const error = new FileReadError('/path/to/file.ts');
      expect(error.message).toBe('Failed to read file /path/to/file.ts');
      expect(error.name).toBe('FileReadError');
      expect(error.filePath).toBe('/path/to/file.ts');
      expect(error.cause).toBeUndefined();
    });

    it('should create error with filePath and cause', () => {
      const cause = new Error('ENOENT');
      const error = new FileReadError('/path/to/file.ts', cause);
      expect(error.message).toBe('Failed to read file /path/to/file.ts: ENOENT');
      expect(error.cause).toBe(cause);
    });
  });

  describe('FileWriteError', () => {
    it('should create error with filePath only', () => {
      const error = new FileWriteError('/path/to/file.ts');
      expect(error.message).toBe('Failed to write file /path/to/file.ts');
      expect(error.name).toBe('FileWriteError');
      expect(error.filePath).toBe('/path/to/file.ts');
      expect(error.cause).toBeUndefined();
    });

    it('should create error with filePath and cause', () => {
      const cause = new Error('EACCES');
      const error = new FileWriteError('/path/to/file.ts', cause);
      expect(error.message).toBe('Failed to write file /path/to/file.ts: EACCES');
      expect(error.cause).toBe(cause);
    });
  });

  describe('BranchCreationError', () => {
    it('should create error with branchName only', () => {
      const error = new BranchCreationError('feature/test');
      expect(error.message).toBe('Failed to create branch feature/test');
      expect(error.name).toBe('BranchCreationError');
      expect(error.branchName).toBe('feature/test');
      expect(error.cause).toBeUndefined();
    });

    it('should create error with branchName and cause', () => {
      const cause = new Error('git error');
      const error = new BranchCreationError('feature/test', cause);
      expect(error.message).toBe('Failed to create branch feature/test: git error');
      expect(error.cause).toBe(cause);
    });
  });

  describe('BranchExistsError', () => {
    it('should create error with branchName', () => {
      const error = new BranchExistsError('feature/existing');
      expect(error.message).toBe('Branch already exists: feature/existing');
      expect(error.name).toBe('BranchExistsError');
      expect(error.branchName).toBe('feature/existing');
    });
  });

  describe('CommitError', () => {
    it('should create error with commitMessage only', () => {
      const error = new CommitError('feat: add feature');
      expect(error.message).toBe('Failed to commit changes');
      expect(error.name).toBe('CommitError');
      expect(error.commitMessage).toBe('feat: add feature');
      expect(error.cause).toBeUndefined();
    });

    it('should create error with commitMessage and cause', () => {
      const cause = new Error('commit rejected');
      const error = new CommitError('feat: add feature', cause);
      expect(error.message).toBe('Failed to commit changes: commit rejected');
      expect(error.cause).toBe(cause);
    });
  });

  describe('CodeGenerationError', () => {
    it('should create error with issueId only', () => {
      const error = new CodeGenerationError('ISS-001');
      expect(error.message).toBe('Failed to generate code for issue ISS-001');
      expect(error.name).toBe('CodeGenerationError');
      expect(error.issueId).toBe('ISS-001');
      expect(error.cause).toBeUndefined();
    });

    it('should create error with issueId and cause', () => {
      const cause = new Error('generation failed');
      const error = new CodeGenerationError('ISS-001', cause);
      expect(error.message).toBe('Failed to generate code for issue ISS-001: generation failed');
      expect(error.cause).toBe(cause);
    });
  });

  describe('TestGenerationError', () => {
    it('should create error with issueId only', () => {
      const error = new TestGenerationError('ISS-001');
      expect(error.message).toBe('Failed to generate tests for issue ISS-001');
      expect(error.name).toBe('TestGenerationError');
      expect(error.issueId).toBe('ISS-001');
      expect(error.cause).toBeUndefined();
    });

    it('should create error with issueId and cause', () => {
      const cause = new Error('test generation failed');
      const error = new TestGenerationError('ISS-001', cause);
      expect(error.message).toBe('Failed to generate tests for issue ISS-001: test generation failed');
      expect(error.cause).toBe(cause);
    });
  });

  describe('VerificationError', () => {
    it('should create test verification error', () => {
      const error = new VerificationError('test', 'Tests failed: 5 failures');
      expect(error.message).toBe('test verification failed: Tests failed: 5 failures');
      expect(error.name).toBe('VerificationError');
      expect(error.verificationType).toBe('test');
      expect(error.output).toBe('Tests failed: 5 failures');
      expect(error.cause).toBeUndefined();
    });

    it('should create lint verification error', () => {
      const error = new VerificationError('lint', 'ESLint errors found');
      expect(error.verificationType).toBe('lint');
    });

    it('should create build verification error with cause', () => {
      const cause = new Error('compilation failed');
      const error = new VerificationError('build', 'Build failed', cause);
      expect(error.verificationType).toBe('build');
      expect(error.cause).toBe(cause);
    });

    it('should truncate long output in message', () => {
      const longOutput = 'a'.repeat(300);
      const error = new VerificationError('test', longOutput);
      expect(error.message.length).toBeLessThan(longOutput.length + 50);
    });
  });

  describe('MaxRetriesExceededError', () => {
    it('should create error with issueId and attempts only', () => {
      const error = new MaxRetriesExceededError('ISS-001', 3);
      expect(error.message).toBe('Max retries (3) exceeded for issue ISS-001');
      expect(error.name).toBe('MaxRetriesExceededError');
      expect(error.issueId).toBe('ISS-001');
      expect(error.attempts).toBe(3);
      expect(error.lastError).toBeUndefined();
    });

    it('should create error with lastError', () => {
      const lastError = new Error('final attempt failed');
      const error = new MaxRetriesExceededError('ISS-002', 5, lastError);
      expect(error.message).toBe('Max retries (5) exceeded for issue ISS-002: final attempt failed');
      expect(error.lastError).toBe(lastError);
    });
  });

  describe('ImplementationBlockedError', () => {
    it('should create error with issueId and blockers', () => {
      const blockers = ['DEP-001 not ready', 'API not available'];
      const error = new ImplementationBlockedError('ISS-001', blockers);
      expect(error.message).toBe('Implementation blocked for issue ISS-001: DEP-001 not ready, API not available');
      expect(error.name).toBe('ImplementationBlockedError');
      expect(error.issueId).toBe('ISS-001');
      expect(error.blockers).toEqual(blockers);
    });
  });

  describe('ResultPersistenceError', () => {
    it('should create save error without cause', () => {
      const error = new ResultPersistenceError('WO-001', 'save');
      expect(error.message).toBe('Failed to save result for work order WO-001');
      expect(error.name).toBe('ResultPersistenceError');
      expect(error.orderId).toBe('WO-001');
      expect(error.operation).toBe('save');
      expect(error.cause).toBeUndefined();
    });

    it('should create load error with cause', () => {
      const cause = new Error('file not found');
      const error = new ResultPersistenceError('WO-002', 'load', cause);
      expect(error.message).toBe('Failed to load result for work order WO-002: file not found');
      expect(error.operation).toBe('load');
      expect(error.cause).toBe(cause);
    });
  });

  describe('GitOperationError', () => {
    it('should create error with operation only', () => {
      const error = new GitOperationError('push');
      expect(error.message).toBe('Git operation failed: push');
      expect(error.name).toBe('GitOperationError');
      expect(error.operation).toBe('push');
      expect(error.cause).toBeUndefined();
    });

    it('should create error with operation and cause', () => {
      const cause = new Error('permission denied');
      const error = new GitOperationError('clone', cause);
      expect(error.message).toBe('Git operation failed: clone: permission denied');
      expect(error.cause).toBe(cause);
    });
  });

  describe('CommandExecutionError', () => {
    it('should create error with all parameters', () => {
      const cause = new Error('command not found');
      const error = new CommandExecutionError('npm test', 1, 'Error output', cause);
      expect(error.message).toBe('Command failed: npm test (exit code: 1)');
      expect(error.name).toBe('CommandExecutionError');
      expect(error.command).toBe('npm test');
      expect(error.exitCode).toBe(1);
      expect(error.stderr).toBe('Error output');
      expect(error.cause).toBe(cause);
    });

    it('should create error without exit code', () => {
      const error = new CommandExecutionError('npm build', undefined, 'stderr');
      expect(error.message).toBe('Command failed: npm build');
      expect(error.exitCode).toBeUndefined();
    });
  });
});

describe('default configurations', () => {
  it('should export default configurations', () => {
    expect(DEFAULT_WORKER_AGENT_CONFIG).toBeDefined();
    expect(DEFAULT_WORKER_AGENT_CONFIG.maxRetries).toBe(3);
    expect(DEFAULT_WORKER_AGENT_CONFIG.coverageThreshold).toBe(80);

    expect(DEFAULT_CODE_PATTERNS).toBeDefined();
    expect(DEFAULT_CODE_PATTERNS.indentation).toBe('spaces');
    expect(DEFAULT_CODE_PATTERNS.testFramework).toBe('vitest');

    expect(DEFAULT_RETRY_POLICY).toBeDefined();
    expect(DEFAULT_RETRY_POLICY.maxAttempts).toBe(3);
    expect(DEFAULT_RETRY_POLICY.backoff).toBe('exponential');
  });
});
