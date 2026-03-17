/**
 * Tests for RepoDetector module
 *
 * Tests repository detection logic, session management,
 * error handling, and detection mode determination.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// Mock the security module before importing RepoDetector
const mockExecGitSync = vi.fn();
const mockExecGhSync = vi.fn();
const mockParseCommandString = vi.fn((cmd: string) => {
  const parts = cmd.split(/\s+/);
  return { command: parts[0], args: parts.slice(1) };
});

vi.mock('../../src/security/index.js', () => ({
  getCommandSanitizer: () => ({
    parseCommandString: mockParseCommandString,
    execGitSync: mockExecGitSync,
    execGhSync: mockExecGhSync,
  }),
}));

// Mock the logging module
vi.mock('../../src/logging/index.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  }),
}));

import {
  RepoDetector,
  getRepoDetector,
  resetRepoDetector,
  REPO_DETECTOR_AGENT_ID,
} from '../../src/repo-detector/RepoDetector.js';

import {
  RepoDetectorError,
  ProjectNotFoundError,
  NoActiveSessionError,
  InvalidSessionStateError,
  GitCommandError,
  GitCommandTimeoutError,
  GitHubAuthenticationError,
  GitHubCommandError,
  GitHubNotAccessibleError,
  OutputWriteError,
  DetectionTimeoutError,
} from '../../src/repo-detector/errors.js';

import {
  DEFAULT_REPO_DETECTOR_CONFIG,
  DEFAULT_TIMEOUT_CONFIG,
  DEFAULT_GITHUB_CONFIG,
  DEFAULT_DETECTION_CONFIG,
} from '../../src/repo-detector/types.js';

describe('RepoDetector', () => {
  let tempDir: string;
  let detector: RepoDetector;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'repo-detector-test-'));

    resetRepoDetector();
    vi.clearAllMocks();

    detector = new RepoDetector();
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
    resetRepoDetector();
  });

  /**
   * Helper to create a .git directory inside tempDir
   */
  function createGitDir(): void {
    fs.mkdirSync(path.join(tempDir, '.git'), { recursive: true });
  }

  /**
   * Helper to set up standard git mock for an initialized repo with commits
   */
  function setupGitMockWithCommits(
    options: {
      branch?: string;
      clean?: boolean;
      remoteUrl?: string | null;
    } = {}
  ): void {
    const { branch = 'main', clean = true, remoteUrl = null } = options;

    mockExecGitSync.mockImplementation((args: string[]) => {
      if (args.includes('HEAD') && args.includes('rev-parse') && !args.includes('--abbrev-ref')) {
        return { success: true, stdout: 'abc123', stderr: '' };
      }
      if (args.includes('--abbrev-ref')) {
        return { success: true, stdout: `${branch}\n`, stderr: '' };
      }
      if (args.includes('--porcelain')) {
        const output = clean ? '' : 'M  src/file.ts\n?? new-file.ts\n';
        return { success: true, stdout: output, stderr: '' };
      }
      if (args.includes('get-url')) {
        if (remoteUrl) {
          return { success: true, stdout: `${remoteUrl}\n`, stderr: '' };
        }
        return { success: false, stdout: '', stderr: 'fatal: No such remote' };
      }
      return { success: false, stdout: '', stderr: '' };
    });
  }

  describe('Constructor and Configuration', () => {
    it('should create instance with default configuration', () => {
      const instance = new RepoDetector();
      expect(instance).toBeInstanceOf(RepoDetector);
      expect(instance.agentId).toBe(REPO_DETECTOR_AGENT_ID);
      expect(instance.name).toBe('Repository Detector Agent');
    });

    it('should merge custom configuration with defaults', () => {
      const customConfig = {
        scratchpadBasePath: 'custom/scratchpad',
        timeouts: { gitCommandMs: 3000, ghCommandMs: 8000 },
      };
      const instance = new RepoDetector(customConfig);
      expect(instance).toBeInstanceOf(RepoDetector);
    });

    it('should handle partial timeout overrides', () => {
      const instance = new RepoDetector({
        timeouts: { gitCommandMs: 2000, ghCommandMs: DEFAULT_TIMEOUT_CONFIG.ghCommandMs },
      });
      expect(instance).toBeInstanceOf(RepoDetector);
    });

    it('should handle partial github config overrides', () => {
      const instance = new RepoDetector({ github: { checkAuthentication: false } });
      expect(instance).toBeInstanceOf(RepoDetector);
    });

    it('should handle partial detection config overrides', () => {
      const instance = new RepoDetector({
        detection: { requireCommits: true, requireCleanState: true },
      });
      expect(instance).toBeInstanceOf(RepoDetector);
    });
  });

  describe('Agent ID', () => {
    it('should have the correct agent ID constant', () => {
      expect(REPO_DETECTOR_AGENT_ID).toBe('repo-detector-agent');
    });
  });

  describe('Initialize and Dispose', () => {
    it('should initialize successfully', async () => {
      await expect(detector.initialize()).resolves.toBeUndefined();
    });

    it('should be idempotent on multiple initialize calls', async () => {
      await detector.initialize();
      await expect(detector.initialize()).resolves.toBeUndefined();
    });

    it('should dispose and clear session', async () => {
      detector.startSession('test-project', tempDir);
      expect(detector.getSession()).not.toBeNull();

      await detector.dispose();
      expect(detector.getSession()).toBeNull();
    });

    it('should allow re-initialization after dispose', async () => {
      await detector.initialize();
      await detector.dispose();
      await expect(detector.initialize()).resolves.toBeUndefined();
    });
  });

  describe('Singleton Pattern', () => {
    it('should return same instance from getRepoDetector', () => {
      const instance1 = getRepoDetector();
      const instance2 = getRepoDetector();
      expect(instance1).toBe(instance2);
    });

    it('should reset singleton with resetRepoDetector', () => {
      const instance1 = getRepoDetector();
      resetRepoDetector();
      const instance2 = getRepoDetector();
      expect(instance1).not.toBe(instance2);
    });

    it('should accept config on first getRepoDetector call', () => {
      resetRepoDetector();
      const instance = getRepoDetector({ scratchpadBasePath: 'custom' });
      expect(instance).toBeInstanceOf(RepoDetector);
    });
  });

  describe('Session Management', () => {
    it('should start a new session', () => {
      const session = detector.startSession('test-project', tempDir);

      expect(session).toBeDefined();
      expect(session.sessionId).toBeDefined();
      expect(session.projectId).toBe('test-project');
      expect(session.status).toBe('detecting');
      expect(session.rootPath).toBe(tempDir);
      expect(session.result).toBeNull();
      expect(session.errors).toEqual([]);
      expect(session.startedAt).toBeDefined();
      expect(session.updatedAt).toBeDefined();
    });

    it('should return session via getSession', () => {
      detector.startSession('test-project', tempDir);
      const session = detector.getSession();

      expect(session).not.toBeNull();
      expect(session?.projectId).toBe('test-project');
    });

    it('should return null when no session exists', () => {
      expect(detector.getSession()).toBeNull();
    });

    it('should replace existing session when starting a new one', () => {
      const session1 = detector.startSession('project-1', tempDir);
      const session2 = detector.startSession('project-2', tempDir);

      expect(session1.sessionId).not.toBe(session2.sessionId);
      expect(detector.getSession()?.projectId).toBe('project-2');
    });
  });

  describe('Detection - No Git Repository', () => {
    it('should detect new mode for directory without .git', async () => {
      detector.startSession('test-project', tempDir);
      mockExecGitSync.mockReturnValue({ success: false, stdout: '', stderr: 'not a git repo' });

      const result = await detector.detect();

      expect(result.mode).toBe('new');
      expect(result.confidence).toBe(1.0);
      expect(result.gitStatus.initialized).toBe(false);
      expect(result.gitStatus.hasCommits).toBe(false);
      expect(result.gitStatus.currentBranch).toBeNull();
      expect(result.gitStatus.isClean).toBe(true);
      expect(result.remoteStatus.configured).toBe(false);
      expect(result.recommendation.skipRepoSetup).toBe(false);
      expect(result.recommendation.reason).toContain('No Git repository found');
    });
  });

  describe('Detection - Git Initialized Without Commits', () => {
    it('should detect existing mode with low confidence for git without commits', async () => {
      createGitDir();
      detector.startSession('test-project', tempDir);

      mockExecGitSync.mockImplementation((args: string[]) => {
        if (args.includes('HEAD') && args.includes('rev-parse')) {
          return { success: false, stdout: '', stderr: 'fatal: bad default revision' };
        }
        if (args.includes('--abbrev-ref')) {
          return { success: false, stdout: '', stderr: 'fatal' };
        }
        if (args.includes('--porcelain')) {
          return { success: true, stdout: '', stderr: '' };
        }
        if (args.includes('get-url')) {
          return { success: false, stdout: '', stderr: 'fatal: No such remote' };
        }
        return { success: false, stdout: '', stderr: '' };
      });

      const result = await detector.detect();

      expect(result.mode).toBe('existing');
      expect(result.confidence).toBe(0.7);
      expect(result.gitStatus.initialized).toBe(true);
      expect(result.gitStatus.hasCommits).toBe(false);
      expect(result.recommendation.skipRepoSetup).toBe(false);
      expect(result.recommendation.reason).toContain('no commits found');
    });
  });

  describe('Detection - Git With Commits But No Remote', () => {
    it('should detect existing mode for git with commits but no remote', async () => {
      createGitDir();
      detector.startSession('test-project', tempDir);
      setupGitMockWithCommits();

      const result = await detector.detect();

      expect(result.mode).toBe('existing');
      expect(result.confidence).toBe(0.8);
      expect(result.gitStatus.initialized).toBe(true);
      expect(result.gitStatus.hasCommits).toBe(true);
      expect(result.gitStatus.currentBranch).toBe('main');
      expect(result.gitStatus.isClean).toBe(true);
      expect(result.remoteStatus.configured).toBe(false);
      expect(result.recommendation.skipRepoSetup).toBe(false);
      expect(result.recommendation.reason).toContain('no remote configured');
    });
  });

  describe('Detection - Non-GitHub Remote', () => {
    it('should detect existing mode for GitLab remote', async () => {
      createGitDir();
      detector.startSession('test-project', tempDir);
      setupGitMockWithCommits({ remoteUrl: 'https://gitlab.com/owner/repo.git' });

      const result = await detector.detect();

      expect(result.mode).toBe('existing');
      expect(result.confidence).toBe(0.85);
      expect(result.remoteStatus.configured).toBe(true);
      expect(result.remoteStatus.remoteType).toBe('gitlab');
      expect(result.recommendation.skipRepoSetup).toBe(true);
      expect(result.recommendation.reason).toContain('Non-GitHub remote');
    });

    it('should detect Bitbucket remote type', async () => {
      createGitDir();
      detector.startSession('test-project', tempDir);
      setupGitMockWithCommits({ remoteUrl: 'https://bitbucket.org/owner/repo.git' });

      const result = await detector.detect();

      expect(result.remoteStatus.remoteType).toBe('bitbucket');
      expect(result.recommendation.skipRepoSetup).toBe(true);
    });

    it('should detect other remote type for unknown hosts', async () => {
      createGitDir();
      detector.startSession('test-project', tempDir);
      setupGitMockWithCommits({ remoteUrl: 'https://selfhosted.example.com/owner/repo.git' });

      const result = await detector.detect();

      expect(result.remoteStatus.remoteType).toBe('other');
    });
  });

  describe('Detection - GitHub Remote With gh CLI', () => {
    it('should detect existing accessible GitHub repo via gh CLI', async () => {
      createGitDir();
      detector.startSession('test-project', tempDir);
      setupGitMockWithCommits({ remoteUrl: 'https://github.com/owner/my-repo.git' });

      mockExecGhSync.mockReturnValue({
        success: true,
        stdout: JSON.stringify({
          name: 'my-repo',
          owner: { login: 'owner' },
          isPrivate: false,
          defaultBranchRef: { name: 'main' },
          url: 'https://github.com/owner/my-repo',
        }),
        stderr: '',
      });

      const result = await detector.detect();

      expect(result.mode).toBe('existing');
      expect(result.confidence).toBe(1.0);
      expect(result.githubStatus.exists).toBe(true);
      expect(result.githubStatus.accessible).toBe(true);
      expect(result.githubStatus.owner).toBe('owner');
      expect(result.githubStatus.name).toBe('my-repo');
      expect(result.githubStatus.visibility).toBe('public');
      expect(result.githubStatus.defaultBranch).toBe('main');
      expect(result.recommendation.skipRepoSetup).toBe(true);
    });

    it('should detect private GitHub repo', async () => {
      createGitDir();
      detector.startSession('test-project', tempDir);
      setupGitMockWithCommits({ remoteUrl: 'https://github.com/owner/private-repo.git' });

      mockExecGhSync.mockReturnValue({
        success: true,
        stdout: JSON.stringify({
          name: 'private-repo',
          owner: { login: 'owner' },
          isPrivate: true,
          defaultBranchRef: { name: 'main' },
          url: 'https://github.com/owner/private-repo',
        }),
        stderr: '',
      });

      const result = await detector.detect();

      expect(result.githubStatus.visibility).toBe('private');
    });
  });

  describe('Detection - GitHub Remote Without gh CLI Access', () => {
    it('should fallback to URL parsing when gh CLI fails', async () => {
      createGitDir();
      detector.startSession('test-project', tempDir);
      setupGitMockWithCommits({ remoteUrl: 'https://github.com/owner/my-repo.git' });

      mockExecGhSync.mockReturnValue({
        success: false,
        stdout: '',
        stderr: 'gh: not authenticated',
      });

      const result = await detector.detect();

      expect(result.mode).toBe('existing');
      expect(result.confidence).toBe(0.9);
      expect(result.githubStatus.exists).toBe(true);
      expect(result.githubStatus.accessible).toBe(false);
      expect(result.githubStatus.owner).toBe('owner');
      expect(result.githubStatus.name).toBe('my-repo');
      expect(result.githubStatus.url).toBe('https://github.com/owner/my-repo');
      expect(result.recommendation.skipRepoSetup).toBe(true);
      expect(result.recommendation.reason).toContain('Verify accessibility');
    });

    it('should parse SSH GitHub URLs', async () => {
      createGitDir();
      detector.startSession('test-project', tempDir);
      setupGitMockWithCommits({ remoteUrl: 'git@github.com:owner/my-repo.git' });

      mockExecGhSync.mockReturnValue({
        success: false,
        stdout: '',
        stderr: 'error',
      });

      const result = await detector.detect();

      expect(result.githubStatus.exists).toBe(true);
      expect(result.githubStatus.owner).toBe('owner');
      expect(result.githubStatus.name).toBe('my-repo');
    });
  });

  describe('Detection - Dirty Working Directory', () => {
    it('should detect dirty working directory', async () => {
      createGitDir();
      detector.startSession('test-project', tempDir);
      setupGitMockWithCommits({ branch: 'feature-branch', clean: false });

      const result = await detector.detect();

      expect(result.gitStatus.isClean).toBe(false);
      expect(result.gitStatus.currentBranch).toBe('feature-branch');
    });
  });

  describe('Detection - Error Handling', () => {
    it('should reject when no active session', async () => {
      await expect(detector.detect()).rejects.toThrow(NoActiveSessionError);
    });

    it('should reject when session is not in detecting state', async () => {
      createGitDir();
      detector.startSession('test-project', tempDir);
      mockExecGitSync.mockReturnValue({ success: false, stdout: '', stderr: '' });

      await detector.detect();
      await expect(detector.detect()).rejects.toThrow(InvalidSessionStateError);
    });

    it('should reject when project path does not exist', async () => {
      const nonExistentPath = path.join(tempDir, 'non-existent');
      detector.startSession('test-project', nonExistentPath);

      await expect(detector.detect()).rejects.toThrow(ProjectNotFoundError);
    });

    it('should set session status to failed on error', async () => {
      const nonExistentPath = path.join(tempDir, 'non-existent');
      detector.startSession('test-project', nonExistentPath);

      try {
        await detector.detect();
      } catch {
        // Expected
      }

      const session = detector.getSession();
      expect(session?.status).toBe('failed');
      expect(session?.errors.length).toBeGreaterThan(0);
    });

    it('should handle non-Error throw values', async () => {
      const nonExistentPath = path.join(tempDir, 'non-existent');
      detector.startSession('test-project', nonExistentPath);

      await expect(detector.detect()).rejects.toBeInstanceOf(Error);
    });
  });

  describe('Detection - Save Result', () => {
    it('should save result to scratchpad on success', async () => {
      detector.startSession('test-project', tempDir);
      mockExecGitSync.mockReturnValue({ success: false, stdout: '', stderr: '' });

      await detector.detect();

      // Verify scratchpad file was created
      const expectedDir = path.join(tempDir, '.ad-sdlc/scratchpad/repo/test-project');
      const expectedFile = path.join(expectedDir, 'github_repo.yaml');
      expect(fs.existsSync(expectedFile)).toBe(true);

      const content = fs.readFileSync(expectedFile, 'utf-8');
      expect(content).toContain('repository_detection');
      expect(content).toContain('mode: new');
    });

    it('should throw OutputWriteError when save path is invalid', async () => {
      // Use a config with a scratchpad path containing a null byte (always fails mkdirSync)
      const badDetector = new RepoDetector({
        scratchpadBasePath: 'path\x00with-null',
      });
      badDetector.startSession('test-project', tempDir);
      mockExecGitSync.mockReturnValue({ success: false, stdout: '', stderr: '' });

      await expect(badDetector.detect()).rejects.toThrow(OutputWriteError);
    });
  });

  describe('Detection - Session Updates', () => {
    it('should update session to completed on success', async () => {
      detector.startSession('test-project', tempDir);
      mockExecGitSync.mockReturnValue({ success: false, stdout: '', stderr: '' });

      await detector.detect();

      const session = detector.getSession();
      expect(session?.status).toBe('completed');
      expect(session?.result).not.toBeNull();
      expect(session?.result?.detectedAt).toBeDefined();
    });
  });

  describe('Detection - Git Command Exception Handling', () => {
    it('should handle git rev-parse throwing exception', async () => {
      createGitDir();
      detector.startSession('test-project', tempDir);

      mockExecGitSync.mockImplementation((args: string[]) => {
        if (args.includes('HEAD') && args.includes('rev-parse') && !args.includes('--abbrev-ref')) {
          throw new Error('git process error');
        }
        if (args.includes('--abbrev-ref')) {
          throw new Error('git process error');
        }
        if (args.includes('--porcelain')) {
          throw new Error('git process error');
        }
        if (args.includes('get-url')) {
          return { success: false, stdout: '', stderr: '' };
        }
        return { success: false, stdout: '', stderr: '' };
      });

      const result = await detector.detect();

      expect(result.gitStatus.initialized).toBe(true);
      expect(result.gitStatus.hasCommits).toBe(false);
      expect(result.gitStatus.currentBranch).toBeNull();
      expect(result.gitStatus.isClean).toBe(true);
    });

    it('should handle remote get-url throwing exception', async () => {
      createGitDir();
      detector.startSession('test-project', tempDir);

      mockExecGitSync.mockImplementation((args: string[]) => {
        if (args.includes('HEAD') && args.includes('rev-parse') && !args.includes('--abbrev-ref')) {
          return { success: true, stdout: 'abc123', stderr: '' };
        }
        if (args.includes('--abbrev-ref')) {
          return { success: true, stdout: 'main\n', stderr: '' };
        }
        if (args.includes('--porcelain')) {
          return { success: true, stdout: '', stderr: '' };
        }
        if (args.includes('get-url')) {
          throw new Error('remote error');
        }
        return { success: false, stdout: '', stderr: '' };
      });

      const result = await detector.detect();

      expect(result.remoteStatus.configured).toBe(false);
      expect(result.remoteStatus.originUrl).toBeNull();
    });
  });
});

describe('RepoDetector Errors', () => {
  describe('RepoDetectorError', () => {
    it('should create base error with code and details', () => {
      const error = new RepoDetectorError('Test error', 'TEST_CODE', { key: 'value' });

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.details).toEqual({ key: 'value' });
      expect(error.name).toBe('RepoDetectorError');
    });

    it('should create error without details', () => {
      const error = new RepoDetectorError('Test', 'CODE');
      expect(error.details).toBeUndefined();
    });
  });

  describe('ProjectNotFoundError', () => {
    it('should include path in message', () => {
      const error = new ProjectNotFoundError('/path/to/project');

      expect(error.message).toContain('/path/to/project');
      expect(error.code).toBe('PROJECT_NOT_FOUND');
      expect(error.name).toBe('ProjectNotFoundError');
      expect(error.details).toEqual({ path: '/path/to/project' });
    });
  });

  describe('NoActiveSessionError', () => {
    it('should have descriptive message', () => {
      const error = new NoActiveSessionError();

      expect(error.message).toContain('No active detection session');
      expect(error.code).toBe('NO_ACTIVE_SESSION');
      expect(error.name).toBe('NoActiveSessionError');
    });
  });

  describe('InvalidSessionStateError', () => {
    it('should include current and required status', () => {
      const error = new InvalidSessionStateError('completed', 'detecting');

      expect(error.message).toContain('completed');
      expect(error.message).toContain('detecting');
      expect(error.code).toBe('INVALID_SESSION_STATE');
      expect(error.name).toBe('InvalidSessionStateError');
      expect(error.details).toEqual({ currentStatus: 'completed', requiredStatus: 'detecting' });
    });
  });

  describe('GitCommandError', () => {
    it('should include command and message', () => {
      const error = new GitCommandError('git status', 'failed', 128);

      expect(error.message).toContain('git status');
      expect(error.message).toContain('failed');
      expect(error.code).toBe('GIT_COMMAND_ERROR');
      expect(error.name).toBe('GitCommandError');
      expect(error.details).toEqual({ command: 'git status', exitCode: 128 });
    });

    it('should work without exit code', () => {
      const error = new GitCommandError('git status', 'failed');
      expect(error.details).toEqual({ command: 'git status', exitCode: undefined });
    });
  });

  describe('GitCommandTimeoutError', () => {
    it('should include command and timeout', () => {
      const error = new GitCommandTimeoutError('git fetch', 5000);

      expect(error.message).toContain('git fetch');
      expect(error.message).toContain('5000');
      expect(error.code).toBe('GIT_COMMAND_TIMEOUT');
      expect(error.name).toBe('GitCommandTimeoutError');
    });
  });

  describe('GitHubAuthenticationError', () => {
    it('should have auth-related message', () => {
      const error = new GitHubAuthenticationError();

      expect(error.message).toContain('not authenticated');
      expect(error.code).toBe('GITHUB_AUTH_ERROR');
      expect(error.name).toBe('GitHubAuthenticationError');
    });
  });

  describe('GitHubCommandError', () => {
    it('should include command details', () => {
      const error = new GitHubCommandError('gh repo view', 'failed to query');

      expect(error.message).toContain('gh repo view');
      expect(error.code).toBe('GITHUB_COMMAND_ERROR');
      expect(error.name).toBe('GitHubCommandError');
    });
  });

  describe('GitHubNotAccessibleError', () => {
    it('should include repo URL and reason', () => {
      const error = new GitHubNotAccessibleError('https://github.com/owner/repo', 'Not authorized');

      expect(error.message).toContain('https://github.com/owner/repo');
      expect(error.message).toContain('Not authorized');
      expect(error.code).toBe('GITHUB_NOT_ACCESSIBLE');
      expect(error.name).toBe('GitHubNotAccessibleError');
    });

    it('should work without reason', () => {
      const error = new GitHubNotAccessibleError('https://github.com/owner/repo');

      expect(error.message).toContain('https://github.com/owner/repo');
      expect(error.message).not.toContain(' - ');
    });

    it('should handle empty string reason', () => {
      const error = new GitHubNotAccessibleError('https://github.com/owner/repo', '');
      expect(error.message).not.toContain(' - ');
    });
  });

  describe('OutputWriteError', () => {
    it('should include path and cause', () => {
      const cause = new Error('Permission denied');
      const error = new OutputWriteError('/output/path', cause);

      expect(error.message).toContain('/output/path');
      expect(error.code).toBe('OUTPUT_WRITE_ERROR');
      expect(error.name).toBe('OutputWriteError');
      expect(error.details).toEqual({ path: '/output/path', cause });
    });

    it('should work without cause', () => {
      const error = new OutputWriteError('/output/path');
      expect(error.message).toContain('/output/path');
    });
  });

  describe('DetectionTimeoutError', () => {
    it('should include timeout value', () => {
      const error = new DetectionTimeoutError(30000);

      expect(error.message).toContain('30000');
      expect(error.code).toBe('DETECTION_TIMEOUT');
      expect(error.name).toBe('DetectionTimeoutError');
    });
  });
});

describe('RepoDetector Default Configuration', () => {
  it('should have correct default timeout config', () => {
    expect(DEFAULT_TIMEOUT_CONFIG.gitCommandMs).toBe(5000);
    expect(DEFAULT_TIMEOUT_CONFIG.ghCommandMs).toBe(10000);
  });

  it('should have correct default GitHub config', () => {
    expect(DEFAULT_GITHUB_CONFIG.checkAuthentication).toBe(true);
  });

  it('should have correct default detection config', () => {
    expect(DEFAULT_DETECTION_CONFIG.requireCommits).toBe(false);
    expect(DEFAULT_DETECTION_CONFIG.requireCleanState).toBe(false);
  });

  it('should have correct default combined config', () => {
    expect(DEFAULT_REPO_DETECTOR_CONFIG.scratchpadBasePath).toBe('.ad-sdlc/scratchpad');
    expect(DEFAULT_REPO_DETECTOR_CONFIG.timeouts).toEqual(DEFAULT_TIMEOUT_CONFIG);
    expect(DEFAULT_REPO_DETECTOR_CONFIG.github).toEqual(DEFAULT_GITHUB_CONFIG);
    expect(DEFAULT_REPO_DETECTOR_CONFIG.detection).toEqual(DEFAULT_DETECTION_CONFIG);
  });
});
