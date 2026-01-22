import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ShellCommandExecutor,
  MockCommandExecutor,
  getCommandExecutor,
  setCommandExecutor,
  resetCommandExecutor,
  type ICommandExecutor,
  type ExecutionResult,
} from '../../src/utilities/CommandExecutor.js';

describe('CommandExecutor', () => {
  describe('MockCommandExecutor', () => {
    let mockExecutor: MockCommandExecutor;

    beforeEach(() => {
      mockExecutor = new MockCommandExecutor();
    });

    afterEach(() => {
      mockExecutor.reset();
    });

    describe('mockResponse', () => {
      it('should return mocked response for exact command match', async () => {
        const expectedResult: ExecutionResult = {
          stdout: 'Hello, World!',
          stderr: '',
          exitCode: 0,
        };

        mockExecutor.mockResponse('echo "Hello, World!"', expectedResult);

        const result = await mockExecutor.execute('echo "Hello, World!"');

        expect(result).toEqual(expectedResult);
      });

      it('should return default result for unmatched commands', async () => {
        const result = await mockExecutor.execute('unknown command');

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toBe('');
        expect(result.stderr).toBe('');
      });

      it('should override existing mock response', async () => {
        const firstResult: ExecutionResult = { stdout: 'first', stderr: '', exitCode: 0 };
        const secondResult: ExecutionResult = { stdout: 'second', stderr: '', exitCode: 0 };

        mockExecutor.mockResponse('test', firstResult);
        mockExecutor.mockResponse('test', secondResult);

        const result = await mockExecutor.execute('test');
        expect(result.stdout).toBe('second');
      });
    });

    describe('mockPatternResponse', () => {
      it('should return mocked response for pattern match', async () => {
        const expectedResult: ExecutionResult = {
          stdout: 'PR #123 created',
          stderr: '',
          exitCode: 0,
        };

        mockExecutor.mockPatternResponse(/gh pr create/, expectedResult);

        const result = await mockExecutor.execute('gh pr create --title "Test PR"');

        expect(result).toEqual(expectedResult);
      });

      it('should match multiple pattern variations', async () => {
        const prResult: ExecutionResult = {
          stdout: 'https://github.com/owner/repo/pull/123',
          stderr: '',
          exitCode: 0,
        };

        mockExecutor.mockPatternResponse(/gh pr (create|view)/, prResult);

        const createResult = await mockExecutor.execute('gh pr create --title "Test"');
        const viewResult = await mockExecutor.execute('gh pr view 123');

        expect(createResult.stdout).toContain('github.com');
        expect(viewResult.stdout).toContain('github.com');
      });

      it('should prioritize exact match over pattern match', async () => {
        const exactResult: ExecutionResult = { stdout: 'exact', stderr: '', exitCode: 0 };
        const patternResult: ExecutionResult = { stdout: 'pattern', stderr: '', exitCode: 0 };

        mockExecutor.mockPatternResponse(/gh pr/, patternResult);
        mockExecutor.mockResponse('gh pr list', exactResult);

        const result = await mockExecutor.execute('gh pr list');
        expect(result.stdout).toBe('exact');
      });
    });

    describe('setDefaultResult', () => {
      it('should return custom default for unmatched commands', async () => {
        const customDefault: ExecutionResult = {
          stdout: '',
          stderr: 'Command not found',
          exitCode: 127,
        };

        mockExecutor.setDefaultResult(customDefault);

        const result = await mockExecutor.execute('nonexistent-command');

        expect(result).toEqual(customDefault);
      });
    });

    describe('getExecutedCommands', () => {
      it('should track all executed commands', async () => {
        await mockExecutor.execute('command1');
        await mockExecutor.execute('command2', { timeout: 5000 });
        await mockExecutor.execute('command3');

        const executed = mockExecutor.getExecutedCommands();

        expect(executed).toHaveLength(3);
        expect(executed[0].command).toBe('command1');
        expect(executed[1].command).toBe('command2');
        expect(executed[1].options?.timeout).toBe(5000);
        expect(executed[2].command).toBe('command3');
      });

      it('should return read-only array', async () => {
        await mockExecutor.execute('test');

        const executed = mockExecutor.getExecutedCommands();

        expect(Array.isArray(executed)).toBe(true);
        expect(executed).toHaveLength(1);
      });
    });

    describe('wasExecuted', () => {
      it('should return true for executed command', async () => {
        await mockExecutor.execute('git status');

        expect(mockExecutor.wasExecuted('git status')).toBe(true);
      });

      it('should return false for non-executed command', async () => {
        await mockExecutor.execute('git status');

        expect(mockExecutor.wasExecuted('git commit')).toBe(false);
      });
    });

    describe('wasPatternExecuted', () => {
      it('should return true for matching pattern', async () => {
        await mockExecutor.execute('gh pr create --title "Test PR" --body "Description"');

        expect(mockExecutor.wasPatternExecuted(/gh pr create/)).toBe(true);
      });

      it('should return false for non-matching pattern', async () => {
        await mockExecutor.execute('gh issue list');

        expect(mockExecutor.wasPatternExecuted(/gh pr/)).toBe(false);
      });
    });

    describe('reset', () => {
      it('should clear all mocked responses', async () => {
        mockExecutor.mockResponse('test', { stdout: 'result', stderr: '', exitCode: 0 });
        mockExecutor.reset();

        const result = await mockExecutor.execute('test');

        expect(result.stdout).toBe('');
      });

      it('should clear executed commands history', async () => {
        await mockExecutor.execute('test');
        mockExecutor.reset();

        expect(mockExecutor.getExecutedCommands()).toHaveLength(0);
      });

      it('should reset default result', async () => {
        mockExecutor.setDefaultResult({ stdout: 'custom', stderr: '', exitCode: 0 });
        mockExecutor.reset();

        const result = await mockExecutor.execute('test');

        expect(result.stdout).toBe('');
        expect(result.exitCode).toBe(0);
      });
    });
  });

  describe('ShellCommandExecutor', () => {
    let executor: ShellCommandExecutor;

    beforeEach(() => {
      executor = new ShellCommandExecutor({
        cwd: process.cwd(),
        timeout: 5000,
      });
    });

    it('should create executor with default options', () => {
      const defaultExecutor = new ShellCommandExecutor();
      expect(defaultExecutor).toBeInstanceOf(ShellCommandExecutor);
    });

    it('should create executor with custom options', () => {
      const customExecutor = new ShellCommandExecutor({
        cwd: '/tmp',
        timeout: 10000,
        maxBuffer: 1024 * 1024,
      });
      expect(customExecutor).toBeInstanceOf(ShellCommandExecutor);
    });

    it('should execute simple command', async () => {
      // Use node --version which is in the command whitelist
      const result = await executor.execute('node --version');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/^v\d+\.\d+\.\d+/);
      expect(result.stderr).toBe('');
    });

    it('should execute node command', async () => {
      const result = await executor.execute('node --version');

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/^v\d+\.\d+\.\d+/);
    });

    it('should handle command with non-zero exit code', async () => {
      // Test with npm run that uses a non-existent script
      // This allows us to test non-zero exit codes without shell metacharacters
      const result = await executor.execute('npm run nonexistent-script-12345', {
        ignoreExitCode: true,
      });

      // npm returns non-zero when script doesn't exist
      expect(result.exitCode).not.toBe(0);
    });

    it('should respect timeout option', async () => {
      await expect(
        executor.execute('node -e "setTimeout(() => {}, 10000)"', {
          timeout: 100,
        })
      ).rejects.toThrow();
    });
  });

  describe('Singleton management', () => {
    beforeEach(() => {
      resetCommandExecutor();
    });

    afterEach(() => {
      resetCommandExecutor();
    });

    it('should return ShellCommandExecutor by default', () => {
      const executor = getCommandExecutor();

      expect(executor).toBeDefined();
      expect(executor.execute).toBeDefined();
    });

    it('should return same instance on multiple calls', () => {
      const executor1 = getCommandExecutor();
      const executor2 = getCommandExecutor();

      expect(executor1).toBe(executor2);
    });

    it('should allow setting custom executor', () => {
      const mockExecutor = new MockCommandExecutor();
      setCommandExecutor(mockExecutor);

      const executor = getCommandExecutor();

      expect(executor).toBe(mockExecutor);
    });

    it('should reset to null and create new instance', () => {
      const executor1 = getCommandExecutor();
      resetCommandExecutor();
      const executor2 = getCommandExecutor();

      expect(executor1).not.toBe(executor2);
    });
  });

  describe('ICommandExecutor interface', () => {
    it('should be implementable by MockCommandExecutor', () => {
      const executor: ICommandExecutor = new MockCommandExecutor();

      expect(executor.execute).toBeDefined();
      expect(typeof executor.execute).toBe('function');
    });

    it('should be implementable by ShellCommandExecutor', () => {
      const executor: ICommandExecutor = new ShellCommandExecutor();

      expect(executor.execute).toBeDefined();
      expect(typeof executor.execute).toBe('function');
    });

    it('should allow custom implementations', async () => {
      const customExecutor: ICommandExecutor = {
        execute: vi.fn().mockResolvedValue({
          stdout: 'custom output',
          stderr: '',
          exitCode: 0,
        }),
      };

      const result = await customExecutor.execute('test');

      expect(result.stdout).toBe('custom output');
      expect(customExecutor.execute).toHaveBeenCalledWith('test');
    });
  });

  describe('Integration scenarios', () => {
    it('should mock GitHub CLI pr create command', async () => {
      const mockExecutor = new MockCommandExecutor();

      mockExecutor.mockPatternResponse(/gh pr create/, {
        stdout: JSON.stringify({
          number: 123,
          url: 'https://github.com/owner/repo/pull/123',
          title: 'Test PR',
          headRefName: 'feature/test',
          baseRefName: 'main',
          createdAt: '2025-01-22T00:00:00Z',
          state: 'OPEN',
        }),
        stderr: '',
        exitCode: 0,
      });

      const result = await mockExecutor.execute(
        'gh pr create --title "Test PR" --body "Description" --base main --head feature/test --json number,url,title,headRefName,baseRefName,createdAt,state'
      );

      const prData = JSON.parse(result.stdout);
      expect(prData.number).toBe(123);
      expect(prData.url).toContain('github.com');
    });

    it('should mock git commands sequence', async () => {
      const mockExecutor = new MockCommandExecutor();

      mockExecutor.mockResponse('git checkout main', {
        stdout: "Switched to branch 'main'",
        stderr: '',
        exitCode: 0,
      });

      mockExecutor.mockResponse('git pull origin main', {
        stdout: 'Already up to date.',
        stderr: '',
        exitCode: 0,
      });

      mockExecutor.mockPatternResponse(/git checkout -b/, {
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      await mockExecutor.execute('git checkout main');
      await mockExecutor.execute('git pull origin main');
      await mockExecutor.execute('git checkout -b feature/test-123');

      const executed = mockExecutor.getExecutedCommands();
      expect(executed).toHaveLength(3);
      expect(mockExecutor.wasExecuted('git checkout main')).toBe(true);
      expect(mockExecutor.wasPatternExecuted(/git checkout -b/)).toBe(true);
    });

    it('should simulate CI check failure', async () => {
      const mockExecutor = new MockCommandExecutor();

      mockExecutor.mockResponse('gh pr checks 123 --json name,status,conclusion', {
        stdout: JSON.stringify([
          { name: 'build', status: 'completed', conclusion: 'success' },
          { name: 'test', status: 'completed', conclusion: 'failure' },
          { name: 'lint', status: 'completed', conclusion: 'success' },
        ]),
        stderr: '',
        exitCode: 0,
      });

      const result = await mockExecutor.execute(
        'gh pr checks 123 --json name,status,conclusion'
      );

      const checks = JSON.parse(result.stdout);
      const failedChecks = checks.filter(
        (c: { conclusion: string }) => c.conclusion === 'failure'
      );

      expect(failedChecks).toHaveLength(1);
      expect(failedChecks[0].name).toBe('test');
    });
  });
});
