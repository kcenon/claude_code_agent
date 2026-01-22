/**
 * PRReviewerAgent Unit Tests
 *
 * Tests for PRReviewerAgent using MockCommandExecutor for dependency injection.
 * This allows testing the agent's logic without actually executing shell commands.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  PRReviewerAgent,
  resetPRReviewerAgent,
} from '../../src/pr-reviewer/PRReviewerAgent.js';
import { MockCommandExecutor } from '../../src/utilities/CommandExecutor.js';

describe('PRReviewerAgent', () => {
  let mockExecutor: MockCommandExecutor;
  let agent: PRReviewerAgent;

  beforeEach(() => {
    mockExecutor = new MockCommandExecutor();
    agent = new PRReviewerAgent(
      {
        projectRoot: '/test/project',
        autoMerge: false,
      },
      mockExecutor
    );
  });

  afterEach(() => {
    mockExecutor.reset();
    resetPRReviewerAgent();
  });

  describe('constructor', () => {
    it('should create agent with default config', () => {
      const defaultAgent = new PRReviewerAgent();
      expect(defaultAgent).toBeInstanceOf(PRReviewerAgent);
      expect(defaultAgent.agentId).toBe('pr-reviewer-agent');
      expect(defaultAgent.name).toBe('PR Reviewer Agent');
    });

    it('should create agent with custom config', () => {
      const customAgent = new PRReviewerAgent({
        projectRoot: '/custom/path',
        autoMerge: true,
        coverageThreshold: 90,
      });

      const config = customAgent.getConfig();
      expect(config.projectRoot).toBe('/custom/path');
      expect(config.autoMerge).toBe(true);
      expect(config.coverageThreshold).toBe(90);
    });

    it('should accept custom command executor', () => {
      const executor = new MockCommandExecutor();
      const agentWithExecutor = new PRReviewerAgent({}, executor);
      expect(agentWithExecutor).toBeInstanceOf(PRReviewerAgent);
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
    it('should find existing PR for branch', async () => {
      const prData = [
        {
          number: 123,
          url: 'https://github.com/owner/repo/pull/123',
          title: 'Test PR',
          headRefName: 'feature/test',
          baseRefName: 'main',
          createdAt: '2025-01-22T00:00:00Z',
          state: 'OPEN',
        },
      ];

      mockExecutor.mockPatternResponse(/gh pr list --head/, {
        stdout: JSON.stringify(prData),
        stderr: '',
        exitCode: 0,
      });

      // Access private method via any cast for testing
      const findExistingPR = (agent as any).findExistingPR.bind(agent);
      const result = await findExistingPR('feature/test');

      expect(result).not.toBeNull();
      expect(result?.number).toBe(123);
      expect(result?.branch).toBe('feature/test');
      expect(mockExecutor.wasPatternExecuted(/gh pr list/)).toBe(true);
    });

    it('should return null when no PR exists', async () => {
      mockExecutor.mockPatternResponse(/gh pr list/, {
        stdout: '[]',
        stderr: '',
        exitCode: 0,
      });

      const findExistingPR = (agent as any).findExistingPR.bind(agent);
      const result = await findExistingPR('non-existent-branch');

      expect(result).toBeNull();
    });

    it('should get PR info with mock executor', async () => {
      const prInfo = {
        number: 456,
        state: 'OPEN',
        url: 'https://github.com/owner/repo/pull/456',
        title: 'Test PR',
        headRefName: 'feature/test',
        baseRefName: 'main',
        createdAt: '2025-01-22T00:00:00Z',
        statusCheckRollup: [
          { name: 'build', status: 'completed', conclusion: 'success' },
          { name: 'test', status: 'completed', conclusion: 'success' },
        ],
        reviews: [],
      };

      mockExecutor.mockPatternResponse(/gh pr view/, {
        stdout: JSON.stringify(prInfo),
        stderr: '',
        exitCode: 0,
      });

      const getPRInfo = (agent as any).getPRInfo.bind(agent);
      const result = await getPRInfo(456);

      expect(result.number).toBe(456);
      expect(result.state).toBe('open');
      expect(result.statusCheckRollup).toHaveLength(2);
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
      await executeCommand('gh pr list');
      await executeCommand('gh pr view 123');
      await executeCommand('git status');

      const executedCommands = mockExecutor.getExecutedCommands();
      expect(executedCommands).toHaveLength(3);
      expect(executedCommands[0].command).toBe('gh pr list');
      expect(executedCommands[1].command).toBe('gh pr view 123');
      expect(executedCommands[2].command).toBe('git status');
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

  describe('circuit breaker', () => {
    it('should expose circuit breaker for monitoring', () => {
      const circuitBreaker = agent.getCircuitBreaker();
      expect(circuitBreaker).toBeDefined();
      expect(circuitBreaker.getStatus().state).toBe('closed');
    });

    it('should allow resetting circuit breaker', () => {
      const circuitBreaker = agent.getCircuitBreaker();

      for (let i = 0; i < 10; i++) {
        circuitBreaker.recordFailure();
      }

      agent.resetCircuitBreaker();
      expect(circuitBreaker.getStatus().state).toBe('closed');
    });
  });

  describe('intelligent poller', () => {
    it('should expose intelligent poller for monitoring', () => {
      const poller = agent.getIntelligentPoller();
      expect(poller).toBeDefined();
    });
  });

  describe('CI fix delegation', () => {
    it('should check if delegation is needed', () => {
      const shouldDelegate = agent.shouldDelegateToCIFixer(123, 3);
      expect(typeof shouldDelegate).toBe('boolean');
    });

    it('should not delegate when retry count is below threshold', () => {
      const result = agent.shouldDelegateToCIFixer(123, 2);
      expect(result).toBe(false);
    });
  });

  describe('configuration', () => {
    it('should return full configuration', () => {
      const config = agent.getConfig();

      expect(config.projectRoot).toBe('/test/project');
      expect(config.autoMerge).toBe(false);
      expect(config.mergeStrategy).toBeDefined();
      expect(config.coverageThreshold).toBeDefined();
      expect(config.ciTimeout).toBeDefined();
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
      mockExecutor.mockPatternResponse(/gh pr (create|list|view)/, {
        stdout: 'pattern match response',
        stderr: '',
        exitCode: 0,
      });

      const executeCommand = (agent as any).executeCommand.bind(agent);

      const result1 = await executeCommand('gh pr create --title "test"');
      expect(result1.stdout).toBe('pattern match response');

      const result2 = await executeCommand('gh pr list');
      expect(result2.stdout).toBe('pattern match response');

      const result3 = await executeCommand('gh pr view 123');
      expect(result3.stdout).toBe('pattern match response');
    });

    it('should prioritize exact match over pattern match', async () => {
      mockExecutor.mockPatternResponse(/gh pr/, {
        stdout: 'pattern response',
        stderr: '',
        exitCode: 0,
      });

      mockExecutor.mockResponse('gh pr list', {
        stdout: 'exact response',
        stderr: '',
        exitCode: 0,
      });

      const executeCommand = (agent as any).executeCommand.bind(agent);

      const result = await executeCommand('gh pr list');
      expect(result.stdout).toBe('exact response');
    });
  });
});
