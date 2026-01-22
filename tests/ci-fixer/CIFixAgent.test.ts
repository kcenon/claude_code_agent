/**
 * CIFixAgent Unit Tests
 *
 * Tests for CIFixAgent using MockCommandExecutor for dependency injection.
 * This allows testing the agent's logic without actually executing shell commands.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  CIFixAgent,
  resetCIFixAgent,
} from '../../src/ci-fixer/CIFixAgent.js';
import { MockCommandExecutor } from '../../src/utilities/CommandExecutor.js';

describe('CIFixAgent', () => {
  let mockExecutor: MockCommandExecutor;
  let agent: CIFixAgent;

  beforeEach(() => {
    mockExecutor = new MockCommandExecutor();
    agent = new CIFixAgent(
      {
        projectRoot: '/test/project',
        maxFixAttempts: 3,
      },
      mockExecutor
    );
  });

  afterEach(() => {
    mockExecutor.reset();
    resetCIFixAgent();
  });

  describe('constructor', () => {
    it('should create agent with default config', () => {
      const defaultAgent = new CIFixAgent();
      expect(defaultAgent).toBeInstanceOf(CIFixAgent);
      expect(defaultAgent.agentId).toBe('ci-fix-agent');
      expect(defaultAgent.name).toBe('CI Fix Agent');
    });

    it('should create agent with custom config', () => {
      const customAgent = new CIFixAgent({
        projectRoot: '/custom/path',
        maxFixAttempts: 5,
        enableLintFix: true,
        enableTypeFix: false,
      });

      const config = customAgent.getConfig();
      expect(config.projectRoot).toBe('/custom/path');
      expect(config.maxFixAttempts).toBe(5);
      expect(config.enableLintFix).toBe(true);
      expect(config.enableTypeFix).toBe(false);
    });

    it('should accept custom command executor', () => {
      const executor = new MockCommandExecutor();
      const agentWithExecutor = new CIFixAgent({}, executor);
      expect(agentWithExecutor).toBeInstanceOf(CIFixAgent);
    });
  });

  describe('IAgent interface', () => {
    it('should implement initialize method', async () => {
      await expect(agent.initialize()).resolves.toBeUndefined();
    });

    it('should implement dispose method', async () => {
      await agent.initialize();
      await expect(agent.dispose()).resolves.toBeUndefined();
    });

    it('should be idempotent for multiple initialize calls', async () => {
      await agent.initialize();
      await agent.initialize();
      await agent.initialize();
    });
  });

  describe('GitHub CLI integration', () => {
    it('should get PR info with mock executor', async () => {
      const prInfo = {
        headRefName: 'feature/test',
        state: 'OPEN',
      };

      mockExecutor.mockPatternResponse(/gh pr view/, {
        stdout: JSON.stringify(prInfo),
        stderr: '',
        exitCode: 0,
      });

      const getPRInfo = (agent as any).getPRInfo.bind(agent);
      const result = await getPRInfo(123);

      expect(result.branch).toBe('feature/test');
      expect(result.state).toBe('OPEN');
      expect(mockExecutor.wasPatternExecuted(/gh pr view/)).toBe(true);
    });

    it('should get failed checks with mock executor', async () => {
      const checks = [
        { name: 'build', status: 'completed', conclusion: 'success' },
        { name: 'test', status: 'completed', conclusion: 'failure', detailsUrl: 'https://example.com/log' },
        { name: 'lint', status: 'completed', conclusion: 'error' },
      ];

      mockExecutor.mockPatternResponse(/gh pr checks/, {
        stdout: JSON.stringify(checks),
        stderr: '',
        exitCode: 0,
      });

      const getFailedChecks = (agent as any).getFailedChecks.bind(agent);
      const result = await getFailedChecks(123);

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('test');
      expect(result[0].status).toBe('failed');
      expect(result[1].name).toBe('lint');
    });

    it('should get changed files with mock executor', async () => {
      mockExecutor.mockPatternResponse(/gh pr view.*--json files/, {
        stdout: 'src/index.ts\nsrc/utils.ts\ntest/index.test.ts',
        stderr: '',
        exitCode: 0,
      });

      const getChangedFiles = (agent as any).getChangedFiles.bind(agent);
      const result = await getChangedFiles(123);

      expect(result).toHaveLength(3);
      expect(result).toContain('src/index.ts');
      expect(result).toContain('test/index.test.ts');
    });

    it('should get repository name', async () => {
      mockExecutor.mockPatternResponse(/gh repo view/, {
        stdout: 'owner/repo-name',
        stderr: '',
        exitCode: 0,
      });

      const getRepoName = (agent as any).getRepoName.bind(agent);
      const result = await getRepoName();

      expect(result).toBe('owner/repo-name');
    });
  });

  describe('command execution tracking', () => {
    it('should track executed commands', async () => {
      mockExecutor.setDefaultResult({
        stdout: '{}',
        stderr: '',
        exitCode: 0,
      });

      const executeCommand = (agent as any).executeCommand.bind(agent);
      await executeCommand('gh pr view 123');
      await executeCommand('git checkout feature-branch');
      await executeCommand('git add -A');

      const executedCommands = mockExecutor.getExecutedCommands();
      expect(executedCommands).toHaveLength(3);
      expect(executedCommands[0].command).toBe('gh pr view 123');
      expect(executedCommands[1].command).toBe('git checkout feature-branch');
      expect(executedCommands[2].command).toBe('git add -A');
    });

    it('should pass correct options to executor', async () => {
      mockExecutor.setDefaultResult({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const executeCommand = (agent as any).executeCommand.bind(agent);
      await executeCommand('test command');

      const executedCommands = mockExecutor.getExecutedCommands();
      expect(executedCommands).toHaveLength(1);
      expect(executedCommands[0].options?.cwd).toBe('/test/project');
      expect(executedCommands[0].options?.timeout).toBe(120000);
      expect(executedCommands[0].options?.ignoreExitCode).toBe(true);
    });
  });

  describe('configuration', () => {
    it('should return full configuration', () => {
      const config = agent.getConfig();

      expect(config.projectRoot).toBe('/test/project');
      expect(config.maxFixAttempts).toBe(3);
      expect(config.enableLintFix).toBeDefined();
      expect(config.enableTypeFix).toBeDefined();
      expect(config.enableTestFix).toBeDefined();
      expect(config.enableBuildFix).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle command execution failure gracefully', async () => {
      mockExecutor.setDefaultResult({
        stdout: '',
        stderr: 'Command failed',
        exitCode: 1,
      });

      const executeCommand = (agent as any).executeCommand.bind(agent);
      const result = await executeCommand('failing-command');

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe('Command failed');
    });
  });

  describe('CI log fetching', () => {
    it('should fetch CI logs with mock executor', async () => {
      mockExecutor.mockPatternResponse(/gh run view.*--log-failed/, {
        stdout: 'Error: test failed\nExpected true but got false',
        stderr: '',
        exitCode: 0,
      });

      const fetchCILogs = (agent as any).fetchCILogs.bind(agent);
      const result = await fetchCILogs(12345);

      expect(result).toContain('Error: test failed');
      expect(mockExecutor.wasPatternExecuted(/gh run view/)).toBe(true);
    });

    it('should fetch workflow logs with mock executor', async () => {
      mockExecutor.mockPatternResponse(/gh pr checks.*--json/, {
        stdout: JSON.stringify([
          { name: 'build', status: 'completed', conclusion: 'failure' },
        ]),
        stderr: '',
        exitCode: 0,
      });

      const fetchWorkflowLogs = (agent as any).fetchWorkflowLogs.bind(agent);
      const result = await fetchWorkflowLogs(123);

      expect(result).toContain('build');
    });
  });

  describe('git operations', () => {
    it('should handle git checkout with mock executor', async () => {
      mockExecutor.mockPatternResponse(/git checkout/, {
        stdout: "Switched to branch 'feature-branch'",
        stderr: '',
        exitCode: 0,
      });

      const executeCommand = (agent as any).executeCommand.bind(agent);
      const result = await executeCommand('git checkout feature-branch');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain("Switched to branch");
    });

    it('should handle git add with mock executor', async () => {
      mockExecutor.mockResponse('git add -A', {
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const executeCommand = (agent as any).executeCommand.bind(agent);
      const result = await executeCommand('git add -A');

      expect(result.exitCode).toBe(0);
      expect(mockExecutor.wasExecuted('git add -A')).toBe(true);
    });

    it('should handle git status with mock executor', async () => {
      mockExecutor.mockResponse('git status --porcelain', {
        stdout: ' M src/index.ts\n?? new-file.ts',
        stderr: '',
        exitCode: 0,
      });

      const executeCommand = (agent as any).executeCommand.bind(agent);
      const result = await executeCommand('git status --porcelain');

      expect(result.stdout).toContain('M src/index.ts');
      expect(result.stdout).toContain('new-file.ts');
    });

    it('should handle git push with mock executor', async () => {
      mockExecutor.mockPatternResponse(/git push origin/, {
        stdout: '',
        stderr: 'To github.com:owner/repo.git\n   abc123..def456  feature -> feature',
        exitCode: 0,
      });

      const executeCommand = (agent as any).executeCommand.bind(agent);
      const result = await executeCommand('git push origin feature');

      expect(result.exitCode).toBe(0);
    });
  });

  describe('mock executor patterns', () => {
    it('should match exact commands', async () => {
      mockExecutor.mockResponse('exact-command', {
        stdout: 'exact match response',
        stderr: '',
        exitCode: 0,
      });

      const executeCommand = (agent as any).executeCommand.bind(agent);
      const result = await executeCommand('exact-command');

      expect(result.stdout).toBe('exact match response');
    });

    it('should match pattern commands', async () => {
      mockExecutor.mockPatternResponse(/gh (pr|issue|run)/, {
        stdout: 'pattern match response',
        stderr: '',
        exitCode: 0,
      });

      const executeCommand = (agent as any).executeCommand.bind(agent);

      const result1 = await executeCommand('gh pr view 123');
      expect(result1.stdout).toBe('pattern match response');

      const result2 = await executeCommand('gh issue list');
      expect(result2.stdout).toBe('pattern match response');

      const result3 = await executeCommand('gh run view 456');
      expect(result3.stdout).toBe('pattern match response');
    });
  });
});
