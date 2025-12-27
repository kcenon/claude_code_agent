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
