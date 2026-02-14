/**
 * Repository Detector - Repository Detection Logic
 *
 * Automatically determines whether the project uses an existing GitHub
 * repository or requires a new one.
 *
 * Implements IAgent interface for unified agent instantiation through AgentFactory.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { randomUUID } from 'crypto';
import type { IAgent } from '../agents/types.js';
import { getCommandSanitizer } from '../security/index.js';
import { tryJsonParse } from '../utils/SafeJsonParser.js';
import { GitHubRepoInfoSchema } from '../schemas/github.js';

import type {
  RepoDetectorConfig,
  RepoDetectionSession,
  RepoDetectionResult,
  GitStatus,
  RemoteStatus,
  GitHubStatus,
  DetectionRecommendation,
  RepositoryMode,
  RemoteType,
  RepositoryVisibility,
  DetectionStats,
} from './types.js';

import { DEFAULT_REPO_DETECTOR_CONFIG } from './types.js';

import {
  ProjectNotFoundError,
  NoActiveSessionError,
  InvalidSessionStateError,
  OutputWriteError,
} from './errors.js';

/**
 * Agent ID for RepoDetector used in AgentFactory
 */
export const REPO_DETECTOR_AGENT_ID = 'repo-detector-agent';

/**
 * Repository Detector Agent
 *
 * Analyzes project Git and GitHub state to determine repository mode.
 *
 * Implements IAgent interface for unified agent instantiation through AgentFactory.
 */
export class RepoDetector implements IAgent {
  public readonly agentId = REPO_DETECTOR_AGENT_ID;
  public readonly name = 'Repository Detector Agent';

  private readonly config: Required<RepoDetectorConfig>;
  private session: RepoDetectionSession | null = null;
  private initialized = false;

  constructor(config: RepoDetectorConfig = {}) {
    this.config = {
      ...DEFAULT_REPO_DETECTOR_CONFIG,
      ...config,
      timeouts: {
        ...DEFAULT_REPO_DETECTOR_CONFIG.timeouts,
        ...config.timeouts,
      },
      github: {
        ...DEFAULT_REPO_DETECTOR_CONFIG.github,
        ...config.github,
      },
      detection: {
        ...DEFAULT_REPO_DETECTOR_CONFIG.detection,
        ...config.detection,
      },
    };
  }

  /**
   * Initialize the repository detector agent
   * @returns Promise that resolves when initialization is complete
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;
    await Promise.resolve();
    this.initialized = true;
  }

  /**
   * Dispose of the repository detector agent and cleanup resources
   * @returns Promise that resolves when disposal is complete
   */
  public async dispose(): Promise<void> {
    await Promise.resolve();
    this.session = null;
    this.initialized = false;
  }

  /**
   * Start a new detection session
   * @param projectId - The unique identifier for the project
   * @param rootPath - The absolute path to the project root directory
   * @returns The newly created detection session
   */
  public startSession(projectId: string, rootPath: string): RepoDetectionSession {
    const now = new Date().toISOString();

    this.session = {
      sessionId: randomUUID(),
      projectId,
      status: 'detecting',
      rootPath,
      result: null,
      startedAt: now,
      updatedAt: now,
      errors: [],
    };

    return this.session;
  }

  /**
   * Get current session
   * @returns The current detection session or null if no session is active
   */
  public getSession(): RepoDetectionSession | null {
    return this.session;
  }

  /**
   * Detect repository mode for the current session
   * @returns Promise resolving to the detection result with repository mode and status
   */
  public detect(): Promise<RepoDetectionResult> {
    try {
      const session = this.ensureSession();

      if (session.status !== 'detecting') {
        return Promise.reject(new InvalidSessionStateError(session.status, 'detecting'));
      }

      const startTime = Date.now();
      const stats: DetectionStats = {
        gitCheckTimeMs: 0,
        remoteCheckTimeMs: 0,
        githubCheckTimeMs: 0,
        totalTimeMs: 0,
      };

      // Validate project path exists
      if (!fs.existsSync(session.rootPath)) {
        throw new ProjectNotFoundError(session.rootPath);
      }

      // Check Git status
      const gitStart = Date.now();
      const gitStatus = this.checkGitStatus(session.rootPath);
      (stats as { gitCheckTimeMs: number }).gitCheckTimeMs = Date.now() - gitStart;

      // Check remote status
      const remoteStart = Date.now();
      const remoteStatus = this.checkRemoteStatus(session.rootPath, gitStatus.initialized);
      (stats as { remoteCheckTimeMs: number }).remoteCheckTimeMs = Date.now() - remoteStart;

      // Check GitHub status
      const githubStart = Date.now();
      const githubStatus = this.checkGitHubStatus(session.rootPath, remoteStatus);
      (stats as { githubCheckTimeMs: number }).githubCheckTimeMs = Date.now() - githubStart;

      // Determine mode and recommendation
      const { mode, confidence, recommendation } = this.determineMode(
        gitStatus,
        remoteStatus,
        githubStatus
      );

      const result: RepoDetectionResult = {
        mode,
        confidence,
        gitStatus,
        remoteStatus,
        githubStatus,
        recommendation,
        detectedAt: new Date().toISOString(),
      };

      // Update session
      this.session = {
        ...session,
        status: 'completed',
        result,
        updatedAt: new Date().toISOString(),
      };

      // Save result to scratchpad
      this.saveResult(session.rootPath, session.projectId, result);

      (stats as { totalTimeMs: number }).totalTimeMs = Date.now() - startTime;

      return Promise.resolve(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (this.session) {
        this.session = {
          ...this.session,
          status: 'failed',
          updatedAt: new Date().toISOString(),
          errors: [...this.session.errors, errorMessage],
        };
      }

      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Check Git initialization status
   * @param rootPath - The absolute path to the project root directory
   * @returns Git status information including initialization state, commits, and branch
   */
  private checkGitStatus(rootPath: string): GitStatus {
    const gitDir = path.join(rootPath, '.git');
    const initialized = fs.existsSync(gitDir);

    if (!initialized) {
      return {
        initialized: false,
        hasCommits: false,
        currentBranch: null,
        isClean: true,
      };
    }

    let hasCommits = false;
    let currentBranch: string | null = null;
    let isClean = true;

    // Check for commits
    try {
      const commitCheck = this.runGitCommand(rootPath, 'rev-parse HEAD');
      hasCommits = commitCheck.success;
    } catch {
      hasCommits = false;
    }

    // Get current branch
    try {
      const branchResult = this.runGitCommand(rootPath, 'rev-parse --abbrev-ref HEAD');
      if (branchResult.success && branchResult.output) {
        currentBranch = branchResult.output.trim();
      }
    } catch {
      currentBranch = null;
    }

    // Check if working directory is clean
    try {
      const statusResult = this.runGitCommand(rootPath, 'status --porcelain');
      if (statusResult.success) {
        isClean = statusResult.output.trim() === '';
      }
    } catch {
      isClean = true;
    }

    return {
      initialized,
      hasCommits,
      currentBranch,
      isClean,
    };
  }

  /**
   * Check remote repository configuration
   * @param rootPath - The absolute path to the project root directory
   * @param gitInitialized - Whether Git is initialized in the project
   * @returns Remote status information including origin URL and remote type
   */
  private checkRemoteStatus(rootPath: string, gitInitialized: boolean): RemoteStatus {
    if (!gitInitialized) {
      return {
        configured: false,
        originUrl: null,
        remoteType: null,
      };
    }

    let originUrl: string | null = null;
    let remoteType: RemoteType = null;

    try {
      const remoteResult = this.runGitCommand(rootPath, 'remote get-url origin');
      if (remoteResult.success && remoteResult.output) {
        originUrl = remoteResult.output.trim();
        remoteType = this.detectRemoteType(originUrl);
      }
    } catch {
      originUrl = null;
    }

    return {
      configured: originUrl !== null,
      originUrl,
      remoteType,
    };
  }

  /**
   * Detect remote type from URL
   * @param url - The remote repository URL
   * @returns The detected remote type (github, gitlab, bitbucket, or other)
   */
  private detectRemoteType(url: string): RemoteType {
    const lowerUrl = url.toLowerCase();

    if (lowerUrl.includes('github.com') || lowerUrl.includes('github:')) {
      return 'github';
    }
    if (lowerUrl.includes('gitlab.com') || lowerUrl.includes('gitlab:')) {
      return 'gitlab';
    }
    if (lowerUrl.includes('bitbucket.org') || lowerUrl.includes('bitbucket:')) {
      return 'bitbucket';
    }

    return 'other';
  }

  /**
   * Check GitHub repository status
   * @param rootPath - The absolute path to the project root directory
   * @param remoteStatus - The remote repository status information
   * @returns GitHub status information including existence, accessibility, and repository details
   */
  private checkGitHubStatus(rootPath: string, remoteStatus: RemoteStatus): GitHubStatus {
    // If not GitHub, return empty status
    if (remoteStatus.remoteType !== 'github') {
      return {
        exists: false,
        accessible: false,
        owner: null,
        name: null,
        url: null,
        visibility: null,
        defaultBranch: null,
      };
    }

    // Try to get repository info using gh CLI
    try {
      const ghResult = this.runGhCommand(
        rootPath,
        'repo view --json nameWithOwner,url,visibility,defaultBranchRef'
      );

      if (ghResult.success && ghResult.output) {
        const repoInfo = tryJsonParse(ghResult.output, GitHubRepoInfoSchema, {
          context: 'gh repo view output',
        });
        if (!repoInfo) {
          throw new Error('Failed to parse repo info');
        }

        const nameWithOwner = `${repoInfo.owner.login}/${repoInfo.name}`;
        const [owner, name] = nameWithOwner.split('/');

        return {
          exists: true,
          accessible: true,
          owner: owner ?? null,
          name: name ?? null,
          url: repoInfo.url ?? null,
          visibility: (repoInfo.isPrivate === true ? 'private' : 'public') as RepositoryVisibility,
          defaultBranch: repoInfo.defaultBranchRef?.name ?? null,
        };
      }
    } catch {
      // gh command failed, try parsing from remote URL
    }

    // Fallback: parse from remote URL
    if (remoteStatus.originUrl !== null && remoteStatus.originUrl !== '') {
      const parsed = this.parseGitHubUrl(remoteStatus.originUrl);
      if (parsed) {
        return {
          exists: true,
          accessible: false,
          owner: parsed.owner,
          name: parsed.name,
          url: `https://github.com/${parsed.owner}/${parsed.name}`,
          visibility: null,
          defaultBranch: null,
        };
      }
    }

    return {
      exists: false,
      accessible: false,
      owner: null,
      name: null,
      url: null,
      visibility: null,
      defaultBranch: null,
    };
  }

  /**
   * Parse GitHub URL to extract owner and name
   * @param url - The GitHub repository URL (HTTPS or SSH format)
   * @returns Object containing owner and repository name, or null if parsing fails
   */
  private parseGitHubUrl(url: string): { owner: string; name: string } | null {
    // Handle HTTPS URLs
    const httpsMatch = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
    if (
      httpsMatch !== null &&
      typeof httpsMatch[1] === 'string' &&
      httpsMatch[1] !== '' &&
      typeof httpsMatch[2] === 'string' &&
      httpsMatch[2] !== ''
    ) {
      return {
        owner: httpsMatch[1],
        name: httpsMatch[2].replace(/\.git$/, ''),
      };
    }

    // Handle SSH URLs
    const sshMatch = url.match(/git@github\.com:([^/]+)\/([^/.]+)/);
    if (
      sshMatch !== null &&
      typeof sshMatch[1] === 'string' &&
      sshMatch[1] !== '' &&
      typeof sshMatch[2] === 'string' &&
      sshMatch[2] !== ''
    ) {
      return {
        owner: sshMatch[1],
        name: sshMatch[2].replace(/\.git$/, ''),
      };
    }

    return null;
  }

  /**
   * Determine repository mode and recommendation
   * @param gitStatus - The Git initialization and commit status
   * @param remoteStatus - The remote repository configuration status
   * @param githubStatus - The GitHub repository existence and accessibility status
   * @returns Object containing repository mode, confidence level, and setup recommendation
   */
  private determineMode(
    gitStatus: GitStatus,
    remoteStatus: RemoteStatus,
    githubStatus: GitHubStatus
  ): { mode: RepositoryMode; confidence: number; recommendation: DetectionRecommendation } {
    // Case 1: GitHub repository exists and is accessible
    if (githubStatus.exists && githubStatus.accessible) {
      return {
        mode: 'existing',
        confidence: 1.0,
        recommendation: {
          skipRepoSetup: true,
          reason: 'Existing GitHub repository detected. Repository information collected.',
        },
      };
    }

    // Case 2: GitHub repository exists but not accessible (parsed from URL)
    if (githubStatus.exists && !githubStatus.accessible) {
      return {
        mode: 'existing',
        confidence: 0.9,
        recommendation: {
          skipRepoSetup: true,
          reason:
            'GitHub repository detected from remote URL. Verify accessibility with `gh auth login`.',
        },
      };
    }

    // Case 3: Remote configured but not GitHub
    if (remoteStatus.configured && remoteStatus.remoteType !== 'github') {
      return {
        mode: 'existing',
        confidence: 0.85,
        recommendation: {
          skipRepoSetup: true,
          reason: `Non-GitHub remote detected (${String(remoteStatus.remoteType)}). Skipping GitHub repository setup.`,
        },
      };
    }

    // Case 4: Git initialized with commits but no remote
    if (gitStatus.initialized && gitStatus.hasCommits && !remoteStatus.configured) {
      return {
        mode: 'existing',
        confidence: 0.8,
        recommendation: {
          skipRepoSetup: false,
          reason:
            'Local Git repository found but no remote configured. Repository setup needed to configure GitHub remote.',
        },
      };
    }

    // Case 5: Git initialized without commits
    if (gitStatus.initialized && !gitStatus.hasCommits) {
      return {
        mode: 'existing',
        confidence: 0.7,
        recommendation: {
          skipRepoSetup: false,
          reason:
            'Git repository initialized but no commits found. Repository setup needed to complete configuration.',
        },
      };
    }

    // Case 6: No Git repository
    return {
      mode: 'new',
      confidence: 1.0,
      recommendation: {
        skipRepoSetup: false,
        reason: 'No Git repository found. New repository creation required.',
      },
    };
  }

  /**
   * Run a Git command with timeout using safe execution
   * Uses execFileSync to bypass shell and prevent command injection
   * @param rootPath - The absolute path to the project root directory
   * @param command - The git command arguments (without 'git' prefix)
   * @returns Object containing execution success status, stdout output, and optional stderr error
   */
  private runGitCommand(
    rootPath: string,
    command: string
  ): { success: boolean; output: string; error?: string } {
    const sanitizer = getCommandSanitizer();
    // Use proper argument parsing to handle quoted strings
    const parsed = sanitizer.parseCommandString(`git ${command}`);
    // Remove 'git' prefix since execGitSync adds it
    const args = parsed.args;

    const result = sanitizer.execGitSync(args, {
      cwd: rootPath,
      timeout: this.config.timeouts.gitCommandMs,
    });

    return {
      success: result.success,
      output: result.stdout,
      ...(result.success ? {} : { error: result.stderr }),
    };
  }

  /**
   * Run a gh CLI command with timeout using safe execution
   * Uses execFileSync to bypass shell and prevent command injection
   * @param rootPath - The absolute path to the project root directory
   * @param command - The gh CLI command arguments (without 'gh' prefix)
   * @returns Object containing execution success status, stdout output, and optional stderr error
   */
  private runGhCommand(
    rootPath: string,
    command: string
  ): { success: boolean; output: string; error?: string } {
    const sanitizer = getCommandSanitizer();
    // Use proper argument parsing to handle quoted strings
    const parsed = sanitizer.parseCommandString(`gh ${command}`);
    // Remove 'gh' prefix since execGhSync adds it
    const args = parsed.args;

    const result = sanitizer.execGhSync(args, {
      cwd: rootPath,
      timeout: this.config.timeouts.ghCommandMs,
    });

    return {
      success: result.success,
      output: result.stdout,
      ...(result.success ? {} : { error: result.stderr }),
    };
  }

  /**
   * Save detection result to scratchpad
   * @param rootPath - The absolute path to the project root directory
   * @param projectId - The unique identifier for the project
   * @param result - The detection result to save
   */
  private saveResult(rootPath: string, projectId: string, result: RepoDetectionResult): void {
    const scratchpadPath = path.join(rootPath, this.config.scratchpadBasePath, 'repo', projectId);

    try {
      // Ensure directory exists
      fs.mkdirSync(scratchpadPath, { recursive: true });

      // Write result
      const outputPath = path.join(scratchpadPath, 'github_repo.yaml');
      const yamlContent = yaml.dump({
        repository_detection: {
          mode: result.mode,
          confidence: result.confidence,
          git_status: {
            initialized: result.gitStatus.initialized,
            has_commits: result.gitStatus.hasCommits,
            current_branch: result.gitStatus.currentBranch,
            is_clean: result.gitStatus.isClean,
          },
          remote_status: {
            configured: result.remoteStatus.configured,
            origin_url: result.remoteStatus.originUrl,
            remote_type: result.remoteStatus.remoteType,
          },
          github_status: {
            exists: result.githubStatus.exists,
            accessible: result.githubStatus.accessible,
            owner: result.githubStatus.owner,
            name: result.githubStatus.name,
            url: result.githubStatus.url,
            visibility: result.githubStatus.visibility,
            default_branch: result.githubStatus.defaultBranch,
          },
          recommendation: {
            skip_repo_setup: result.recommendation.skipRepoSetup,
            reason: result.recommendation.reason,
          },
          detected_at: result.detectedAt,
        },
      });

      fs.writeFileSync(outputPath, yamlContent, 'utf-8');
    } catch (error) {
      throw new OutputWriteError(
        scratchpadPath,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Ensure session exists
   * @returns The current active detection session
   * @throws NoActiveSessionError if no session is active
   */
  private ensureSession(): RepoDetectionSession {
    if (!this.session) {
      throw new NoActiveSessionError();
    }
    return this.session;
  }
}

// Singleton instance
let instance: RepoDetector | null = null;

/**
 * Get the singleton Repository Detector instance
 * @param config - Optional configuration for the repository detector
 * @returns The singleton RepoDetector instance
 */
export function getRepoDetector(config?: RepoDetectorConfig): RepoDetector {
  if (instance === null) {
    instance = new RepoDetector(config);
  }
  return instance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetRepoDetector(): void {
  instance = null;
}
