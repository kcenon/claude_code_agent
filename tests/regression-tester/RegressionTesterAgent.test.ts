/**
 * Regression Tester Agent tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import {
  RegressionTesterAgent,
  getRegressionTesterAgent,
  resetRegressionTesterAgent,
  NoActiveSessionError,
  NoChangedFilesError,
  InvalidProjectPathError,
  NoTestsFoundError,
  DEFAULT_REGRESSION_TESTER_CONFIG,
  type ChangedFile,
} from '../../src/regression-tester/index.js';

describe('RegressionTesterAgent', () => {
  let tempDir: string;
  let agent: RegressionTesterAgent;

  beforeEach(async () => {
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'regression-tester-test-')
    );

    // Create a basic project structure
    await fs.mkdir(path.join(tempDir, 'src', 'services'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'src', 'controllers'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'tests', 'services'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'tests', 'controllers'), { recursive: true });
    await fs.mkdir(path.join(tempDir, '.ad-sdlc', 'scratchpad', 'analysis', 'test-project'), {
      recursive: true,
    });

    // Create sample source files
    await fs.writeFile(
      path.join(tempDir, 'src', 'services', 'userService.ts'),
      `export class UserService {
  findById(id: string) {
    return { id, name: 'Test User' };
  }
}
`
    );

    await fs.writeFile(
      path.join(tempDir, 'src', 'controllers', 'userController.ts'),
      `import { UserService } from '../services/userService';

export class UserController {
  private userService = new UserService();

  getUser(id: string) {
    return this.userService.findById(id);
  }
}
`
    );

    // Create test files
    await fs.writeFile(
      path.join(tempDir, 'tests', 'services', 'userService.test.ts'),
      `import { UserService } from '../../src/services/userService';

describe('UserService', () => {
  it('should find user by id', () => {
    const service = new UserService();
    const user = service.findById('123');
    expect(user.id).toBe('123');
  });

  it('should return user with name', () => {
    const service = new UserService();
    const user = service.findById('456');
    expect(user.name).toBe('Test User');
  });
});
`
    );

    await fs.writeFile(
      path.join(tempDir, 'tests', 'controllers', 'userController.test.ts'),
      `import { UserController } from '../../src/controllers/userController';

describe('UserController', () => {
  it('should get user', () => {
    const controller = new UserController();
    expect(controller).toBeDefined();
  });
});
`
    );

    // Create package.json
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(
        {
          name: 'test-project',
          version: '1.0.0',
          scripts: {
            test: 'vitest',
          },
          devDependencies: {
            vitest: '^1.0.0',
            typescript: '^5.0.0',
          },
        },
        null,
        2
      )
    );

    // Create dependency graph
    await fs.writeFile(
      path.join(
        tempDir,
        '.ad-sdlc',
        'scratchpad',
        'analysis',
        'test-project',
        'dependency_graph.json'
      ),
      JSON.stringify({
        nodes: [
          { id: 'userService', type: 'internal', path: 'src/services/userService.ts', exports: ['UserService'] },
          { id: 'userController', type: 'internal', path: 'src/controllers/userController.ts', exports: ['UserController'] },
        ],
        edges: [
          { from: 'userController', to: 'userService', type: 'import', weight: 1 },
        ],
      })
    );

    // Create agent with temp directory config
    agent = new RegressionTesterAgent({
      scratchpadBasePath: '.ad-sdlc/scratchpad',
      runTests: false, // Don't actually run tests in unit tests
      collectCoverage: false,
    });
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
    resetRegressionTesterAgent();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultAgent = new RegressionTesterAgent();
      expect(defaultAgent).toBeInstanceOf(RegressionTesterAgent);
    });

    it('should initialize with custom configuration', () => {
      const customAgent = new RegressionTesterAgent({
        runTests: false,
        collectCoverage: false,
        maxTests: 100,
      });
      expect(customAgent).toBeInstanceOf(RegressionTesterAgent);
    });

    it('should have default configuration values', () => {
      expect(DEFAULT_REGRESSION_TESTER_CONFIG.scratchpadBasePath).toBe(
        '.ad-sdlc/scratchpad'
      );
      expect(DEFAULT_REGRESSION_TESTER_CONFIG.runTests).toBe(true);
      expect(DEFAULT_REGRESSION_TESTER_CONFIG.collectCoverage).toBe(true);
      expect(DEFAULT_REGRESSION_TESTER_CONFIG.testTimeout).toBe(30000);
      expect(DEFAULT_REGRESSION_TESTER_CONFIG.coverageThreshold).toBe(80);
    });

    it('should return configuration with getConfig', () => {
      const config = agent.getConfig();
      expect(config.scratchpadBasePath).toBe('.ad-sdlc/scratchpad');
      expect(config.runTests).toBe(false);
      expect(config.collectCoverage).toBe(false);
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance with getRegressionTesterAgent', () => {
      const agent1 = getRegressionTesterAgent();
      const agent2 = getRegressionTesterAgent();
      expect(agent1).toBe(agent2);
    });

    it('should create new instance after reset', () => {
      const agent1 = getRegressionTesterAgent();
      resetRegressionTesterAgent();
      const agent2 = getRegressionTesterAgent();
      expect(agent1).not.toBe(agent2);
    });
  });

  describe('session management', () => {
    it('should start a session with project ID and changed files', async () => {
      const changedFiles: ChangedFile[] = [
        { path: 'src/services/userService.ts', changeType: 'modified', linesChanged: 10 },
      ];

      const session = await agent.startSession('test-project', tempDir, changedFiles);

      expect(session).toBeDefined();
      expect(session.projectId).toBe('test-project');
      expect(session.sessionId).toBeDefined();
      expect(session.status).toBe('mapping');
      expect(session.projectPath).toBe(tempDir);
      expect(session.changedFiles).toHaveLength(1);
      expect(session.report).toBeNull();
    });

    it('should return current session', async () => {
      expect(agent.getCurrentSession()).toBeNull();

      const changedFiles: ChangedFile[] = [
        { path: 'src/services/userService.ts', changeType: 'modified', linesChanged: 10 },
      ];

      await agent.startSession('test-project', tempDir, changedFiles);
      const session = agent.getCurrentSession();

      expect(session).toBeDefined();
      expect(session?.projectId).toBe('test-project');
    });

    it('should throw error for invalid project path', async () => {
      const changedFiles: ChangedFile[] = [
        { path: 'src/services/userService.ts', changeType: 'modified', linesChanged: 10 },
      ];

      await expect(
        agent.startSession('test-project', '/nonexistent/path', changedFiles)
      ).rejects.toThrow(InvalidProjectPathError);
    });

    it('should throw error for empty changed files', async () => {
      await expect(
        agent.startSession('test-project', tempDir, [])
      ).rejects.toThrow(NoChangedFilesError);
    });
  });

  describe('analyze', () => {
    it('should throw error when no session is active', async () => {
      await expect(agent.analyze()).rejects.toThrow(NoActiveSessionError);
    });

    it('should complete analysis for valid project', async () => {
      const changedFiles: ChangedFile[] = [
        { path: 'src/services/userService.ts', changeType: 'modified', linesChanged: 10 },
      ];

      await agent.startSession('test-project', tempDir, changedFiles);
      const result = await agent.analyze();

      expect(result.success).toBe(true);
      expect(result.projectId).toBe('test-project');
      expect(result.report).toBeDefined();
      expect(result.report.projectId).toBe('test-project');
      expect(result.report.changesAnalyzed.filesModified).toBe(1);
      expect(result.stats.filesAnalyzed).toBe(1);
    });

    it('should identify affected tests', async () => {
      const changedFiles: ChangedFile[] = [
        { path: 'src/services/userService.ts', changeType: 'modified', linesChanged: 10 },
      ];

      await agent.startSession('test-project', tempDir, changedFiles);
      const result = await agent.analyze();

      // Should find the userService.test.ts as an affected test
      expect(result.report.affectedTests.length).toBeGreaterThan(0);
    });

    it('should handle project with no tests', async () => {
      // Remove test files
      await fs.rm(path.join(tempDir, 'tests'), { recursive: true, force: true });

      const changedFiles: ChangedFile[] = [
        { path: 'src/services/userService.ts', changeType: 'modified', linesChanged: 10 },
      ];

      await agent.startSession('test-project', tempDir, changedFiles);

      await expect(agent.analyze()).rejects.toThrow(NoTestsFoundError);
    });

    it('should update session status during analysis', async () => {
      const changedFiles: ChangedFile[] = [
        { path: 'src/services/userService.ts', changeType: 'modified', linesChanged: 10 },
      ];

      await agent.startSession('test-project', tempDir, changedFiles);
      await agent.analyze();

      const session = agent.getCurrentSession();
      expect(session?.status).toBe('completed');
    });

    it('should create regression report file', async () => {
      const changedFiles: ChangedFile[] = [
        { path: 'src/services/userService.ts', changeType: 'modified', linesChanged: 10 },
      ];

      await agent.startSession('test-project', tempDir, changedFiles);
      const result = await agent.analyze();

      // Check output file exists
      const outputExists = await fs.access(result.outputPath).then(() => true).catch(() => false);
      expect(outputExists).toBe(true);
    });

    it('should handle multiple changed files', async () => {
      const changedFiles: ChangedFile[] = [
        { path: 'src/services/userService.ts', changeType: 'modified', linesChanged: 10 },
        { path: 'src/controllers/userController.ts', changeType: 'modified', linesChanged: 5 },
      ];

      await agent.startSession('test-project', tempDir, changedFiles);
      const result = await agent.analyze();

      expect(result.report.changesAnalyzed.filesModified).toBe(2);
    });

    it('should categorize changes correctly', async () => {
      const changedFiles: ChangedFile[] = [
        { path: 'src/services/userService.ts', changeType: 'modified', linesChanged: 10 },
        { path: 'src/services/newService.ts', changeType: 'added', linesChanged: 50 },
        { path: 'src/services/oldService.ts', changeType: 'deleted', linesChanged: 0 },
      ];

      await agent.startSession('test-project', tempDir, changedFiles);
      const result = await agent.analyze();

      expect(result.report.changesAnalyzed.filesModified).toBe(1);
      expect(result.report.changesAnalyzed.filesAdded).toBe(1);
      expect(result.report.changesAnalyzed.filesDeleted).toBe(1);
    });
  });

  describe('test mapping', () => {
    it('should create test mappings based on naming convention', async () => {
      const changedFiles: ChangedFile[] = [
        { path: 'src/services/userService.ts', changeType: 'modified', linesChanged: 10 },
      ];

      await agent.startSession('test-project', tempDir, changedFiles);
      const result = await agent.analyze();

      expect(result.report.testMapping.totalTestFiles).toBeGreaterThan(0);
    });

    it('should calculate mapping coverage', async () => {
      const changedFiles: ChangedFile[] = [
        { path: 'src/services/userService.ts', changeType: 'modified', linesChanged: 10 },
      ];

      await agent.startSession('test-project', tempDir, changedFiles);
      const result = await agent.analyze();

      expect(result.report.testMapping.mappingCoverage).toBeGreaterThanOrEqual(0);
      expect(result.report.testMapping.mappingCoverage).toBeLessThanOrEqual(1);
    });
  });

  describe('report generation', () => {
    it('should generate complete report structure', async () => {
      const changedFiles: ChangedFile[] = [
        { path: 'src/services/userService.ts', changeType: 'modified', linesChanged: 10 },
      ];

      await agent.startSession('test-project', tempDir, changedFiles);
      const result = await agent.analyze();

      expect(result.report.analysisDate).toBeDefined();
      expect(result.report.projectId).toBeDefined();
      expect(result.report.changesAnalyzed).toBeDefined();
      expect(result.report.testMapping).toBeDefined();
      expect(result.report.affectedTests).toBeDefined();
      expect(result.report.testExecution).toBeDefined();
      expect(result.report.recommendations).toBeDefined();
      expect(result.report.summary).toBeDefined();
    });

    it('should generate summary with correct status', async () => {
      const changedFiles: ChangedFile[] = [
        { path: 'src/services/userService.ts', changeType: 'modified', linesChanged: 10 },
      ];

      await agent.startSession('test-project', tempDir, changedFiles);
      const result = await agent.analyze();

      expect(['passed', 'failed', 'warning']).toContain(result.report.summary.status);
      expect(result.report.summary.message).toBeDefined();
      expect(result.report.summary.totalIssues).toBeDefined();
      expect(result.report.summary.blockingIssues).toBeDefined();
    });

    it('should include analysis statistics', async () => {
      const changedFiles: ChangedFile[] = [
        { path: 'src/services/userService.ts', changeType: 'modified', linesChanged: 10 },
      ];

      await agent.startSession('test-project', tempDir, changedFiles);
      const result = await agent.analyze();

      expect(result.stats.filesAnalyzed).toBe(1);
      expect(result.stats.testsDiscovered).toBeGreaterThan(0);
      expect(result.stats.mappingsCreated).toBeGreaterThanOrEqual(0);
      expect(result.stats.processingTimeMs).toBeGreaterThan(0);
    });
  });

  describe('test framework detection', () => {
    it('should detect vitest framework', async () => {
      const changedFiles: ChangedFile[] = [
        { path: 'src/services/userService.ts', changeType: 'modified', linesChanged: 10 },
      ];

      await agent.startSession('test-project', tempDir, changedFiles);
      const result = await agent.analyze();

      // Since we have vitest in package.json
      expect(result.success).toBe(true);
    });

    it('should detect jest framework', async () => {
      // Modify package.json to use jest
      await fs.writeFile(
        path.join(tempDir, 'package.json'),
        JSON.stringify({
          name: 'test-project',
          devDependencies: { jest: '^29.0.0' },
        })
      );

      const changedFiles: ChangedFile[] = [
        { path: 'src/services/userService.ts', changeType: 'modified', linesChanged: 10 },
      ];

      await agent.startSession('test-project', tempDir, changedFiles);
      const result = await agent.analyze();

      expect(result.success).toBe(true);
    });
  });

  describe('warnings collection', () => {
    it('should collect warnings during analysis', async () => {
      // Remove dependency graph to trigger warning
      await fs.rm(
        path.join(tempDir, '.ad-sdlc', 'scratchpad', 'analysis', 'test-project', 'dependency_graph.json')
      );

      const changedFiles: ChangedFile[] = [
        { path: 'src/services/userService.ts', changeType: 'modified', linesChanged: 10 },
      ];

      await agent.startSession('test-project', tempDir, changedFiles);
      const result = await agent.analyze();

      expect(result.warnings).toContain(
        'Dependency graph not found. Using naming-based mapping only.'
      );
    });
  });
});
