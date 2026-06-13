/**
 * Tests for gh pr create --json removal (issue #867)
 *
 * Verifies that:
 * - gh pr create is invoked without --json
 * - the PR URL is captured from stdout of pr create
 * - a follow-up gh pr view fetches structured data (number, state, baseRefName, etc.)
 *
 * Covers both PRCreator.createPR and PRReviewerAgent.createPullRequest.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PRCreator } from '../../src/pr-reviewer/PRCreator.js';
import { PRReviewerAgent, resetPRReviewerAgent } from '../../src/pr-reviewer/PRReviewerAgent.js';
import { MockCommandExecutor } from '../../src/utilities/CommandExecutor.js';
import type { ImplementationResult } from '../../src/pr-reviewer/types.js';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const PR_URL = 'https://github.com/owner/repo/pull/99';

const PR_VIEW_DATA = {
  number: 99,
  url: PR_URL,
  title: 'feat: implement feature',
  headRefName: 'feature/ISS-001-feature',
  baseRefName: 'main',
  createdAt: '2026-01-01T00:00:00Z',
  state: 'OPEN',
};

function makeImplResult(overrides: Partial<ImplementationResult> = {}): ImplementationResult {
  return {
    workOrderId: 'WO-001',
    issueId: 'ISS-001-feature',
    githubIssue: 1,
    status: 'completed',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    changes: [
      {
        filePath: 'src/feature.ts',
        changeType: 'create',
        description: 'New feature',
        linesAdded: 50,
        linesRemoved: 0,
      },
    ],
    tests: {
      filesCreated: ['tests/feature.test.ts'],
      totalTests: 5,
      coveragePercentage: 80,
    },
    verification: {
      testsPassed: true,
      testsOutput: 'OK',
      lintPassed: true,
      lintOutput: 'clean',
      buildPassed: true,
      buildOutput: 'success',
    },
    branch: {
      name: 'feature/ISS-001-feature',
      commits: [{ hash: 'abc123', message: 'feat: implement feature' }],
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// PRCreator tests
// ---------------------------------------------------------------------------

describe('PRCreator.createPR (issue #867)', () => {
  let creator: PRCreator;

  beforeEach(() => {
    creator = new PRCreator({ baseBranch: 'main' });
  });

  it('should NOT include --json in gh pr create argv', async () => {
    const calls: Array<string | string[]> = [];
    const mockExecute = vi.fn().mockImplementation((cmd: string | string[]) => {
      calls.push(cmd);
      if (Array.isArray(cmd) && cmd.includes('create')) {
        return Promise.resolve({ stdout: PR_URL + '\n', stderr: '', exitCode: 0 });
      }
      // follow-up pr view
      return Promise.resolve({
        stdout: JSON.stringify(PR_VIEW_DATA),
        stderr: '',
        exitCode: 0,
      });
    });

    (creator as unknown as { executeCommand: typeof mockExecute }).executeCommand = mockExecute;

    const createPR = (
      creator as unknown as {
        createPR: (opts: {
          title: string;
          body: string;
          base: string;
          head: string;
        }) => Promise<unknown>;
      }
    ).createPR.bind(creator);

    await createPR({
      title: 'feat: implement feature',
      body: 'body text',
      base: 'main',
      head: 'feature/ISS-001-feature',
    });

    // Find the pr create call
    const createCall = calls.find(
      (c) => Array.isArray(c) && c.includes('create') && c.includes('pr')
    ) as string[] | undefined;

    expect(createCall).toBeDefined();
    expect(createCall).not.toContain('--json');
  });

  it('should parse PR URL from stdout of gh pr create', async () => {
    const capturedCreateArgs: string[][] = [];
    const capturedViewArgs: string[][] = [];

    const mockExecute = vi.fn().mockImplementation((cmd: string | string[]) => {
      if (!Array.isArray(cmd)) return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 });

      if (cmd.includes('create')) {
        capturedCreateArgs.push(cmd);
        return Promise.resolve({ stdout: PR_URL + '\n', stderr: '', exitCode: 0 });
      }
      if (cmd.includes('view')) {
        capturedViewArgs.push(cmd);
        return Promise.resolve({
          stdout: JSON.stringify(PR_VIEW_DATA),
          stderr: '',
          exitCode: 0,
        });
      }
      return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 });
    });

    (creator as unknown as { executeCommand: typeof mockExecute }).executeCommand = mockExecute;

    const createPR = (
      creator as unknown as {
        createPR: (opts: {
          title: string;
          body: string;
          base: string;
          head: string;
        }) => Promise<unknown>;
      }
    ).createPR.bind(creator);

    await createPR({
      title: 'feat: implement feature',
      body: 'body text',
      base: 'main',
      head: 'feature/ISS-001-feature',
    });

    // The pr view call must include the URL from pr create stdout
    expect(capturedViewArgs).toHaveLength(1);
    expect(capturedViewArgs[0]).toContain(PR_URL);
    expect(capturedViewArgs[0]).toContain('--json');
  });

  it('should populate number, state, and baseRefName from follow-up pr view', async () => {
    const mockExecute = vi.fn().mockImplementation((cmd: string | string[]) => {
      if (!Array.isArray(cmd)) return Promise.resolve({ stdout: '', stderr: '', exitCode: 0 });
      if (cmd.includes('create')) {
        return Promise.resolve({ stdout: PR_URL + '\n', stderr: '', exitCode: 0 });
      }
      return Promise.resolve({
        stdout: JSON.stringify(PR_VIEW_DATA),
        stderr: '',
        exitCode: 0,
      });
    });

    (creator as unknown as { executeCommand: typeof mockExecute }).executeCommand = mockExecute;

    const createPR = (
      creator as unknown as {
        createPR: (opts: {
          title: string;
          body: string;
          base: string;
          head: string;
        }) => Promise<{ number: number; state: string; base: string }>;
      }
    ).createPR.bind(creator);

    const pr = await createPR({
      title: 'feat: implement feature',
      body: 'body text',
      base: 'main',
      head: 'feature/ISS-001-feature',
    });

    expect(pr.number).toBe(99);
    expect(pr.state).toBe('open');
    expect(pr.base).toBe('main');
  });
});

// ---------------------------------------------------------------------------
// PRReviewerAgent tests
// ---------------------------------------------------------------------------

describe('PRReviewerAgent.createPullRequest (issue #867)', () => {
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

  it('should NOT include --json in gh pr create command', async () => {
    // No existing PR
    mockExecutor.mockPatternResponse(/gh pr list/, {
      stdout: '[]',
      stderr: '',
      exitCode: 0,
    });
    // pr create returns URL
    mockExecutor.mockPatternResponse(/gh pr create/, {
      stdout: PR_URL + '\n',
      stderr: '',
      exitCode: 0,
    });
    // pr view returns structured data
    mockExecutor.mockPatternResponse(/gh pr view/, {
      stdout: JSON.stringify(PR_VIEW_DATA),
      stderr: '',
      exitCode: 0,
    });

    const createPullRequest = (
      agent as unknown as {
        createPullRequest: (implResult: ImplementationResult, options: object) => Promise<unknown>;
      }
    ).createPullRequest.bind(agent);

    await createPullRequest(makeImplResult(), {});

    const commands = mockExecutor.getExecutedCommands();
    const createCmd = commands.find((c) => c.command.includes('pr create'));

    expect(createCmd).toBeDefined();
    expect(createCmd?.command).not.toContain('--json');
  });

  it('should issue a follow-up gh pr view with the URL from pr create stdout', async () => {
    mockExecutor.mockPatternResponse(/gh pr list/, {
      stdout: '[]',
      stderr: '',
      exitCode: 0,
    });
    mockExecutor.mockPatternResponse(/gh pr create/, {
      stdout: PR_URL + '\n',
      stderr: '',
      exitCode: 0,
    });
    mockExecutor.mockPatternResponse(/gh pr view/, {
      stdout: JSON.stringify(PR_VIEW_DATA),
      stderr: '',
      exitCode: 0,
    });

    const createPullRequest = (
      agent as unknown as {
        createPullRequest: (implResult: ImplementationResult, options: object) => Promise<unknown>;
      }
    ).createPullRequest.bind(agent);

    await createPullRequest(makeImplResult(), {});

    const commands = mockExecutor.getExecutedCommands();
    const viewCmd = commands.find(
      (c) => c.command.includes('pr view') && c.command.includes(PR_URL)
    );

    expect(viewCmd).toBeDefined();
  });

  it('should return PR with number, state, and baseRefName from follow-up pr view', async () => {
    mockExecutor.mockPatternResponse(/gh pr list/, {
      stdout: '[]',
      stderr: '',
      exitCode: 0,
    });
    mockExecutor.mockPatternResponse(/gh pr create/, {
      stdout: PR_URL + '\n',
      stderr: '',
      exitCode: 0,
    });
    mockExecutor.mockPatternResponse(/gh pr view/, {
      stdout: JSON.stringify(PR_VIEW_DATA),
      stderr: '',
      exitCode: 0,
    });

    const createPullRequest = (
      agent as unknown as {
        createPullRequest: (
          implResult: ImplementationResult,
          options: object
        ) => Promise<{ number: number; state: string; base: string }>;
      }
    ).createPullRequest.bind(agent);

    const pr = await createPullRequest(makeImplResult(), {});

    expect(pr.number).toBe(99);
    expect(pr.state).toBe('open');
    expect(pr.base).toBe('main');
  });
});
