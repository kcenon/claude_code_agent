/**
 * GitHub Repo Setup Agent
 *
 * Creates and initializes a new public GitHub repository based on
 * project metadata. Generates README, selects license, creates
 * .gitignore, and performs initial commit using the `gh` CLI.
 *
 * Implements SDS-001 CMP-027 (Section 3.27).
 * Implements IAgent interface for unified agent instantiation through AgentFactory.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { randomUUID } from 'crypto';
import type { IAgent } from '../agents/types.js';
import { getCommandSanitizer } from '../security/index.js';

import type {
  RepoSetupConfig,
  RepoSetupOptions,
  RepoSetupResult,
  RepoSetupSession,
} from './types.js';

import { DEFAULT_REPO_SETUP_CONFIG, GITIGNORE_TEMPLATES } from './types.js';

import {
  GhAuthenticationError,
  GitInitError,
  NoActiveSetupSessionError,
  RepoAlreadyExistsError,
  RepoCreationError,
  SetupOutputWriteError,
} from './errors.js';

/**
 * Agent ID for GitHubRepoSetupAgent used in AgentFactory
 */
export const GITHUB_REPO_SETUP_AGENT_ID = 'github-repo-setup-agent';

/**
 * GitHub Repo Setup Agent
 *
 * Creates and initializes GitHub repositories for new projects.
 * Sits in the Greenfield pipeline between repo-detector and sds-writer.
 */
export class GitHubRepoSetupAgent implements IAgent {
  public readonly agentId = GITHUB_REPO_SETUP_AGENT_ID;
  public readonly name = 'GitHub Repo Setup Agent';

  private readonly config: Required<RepoSetupConfig>;
  private session: RepoSetupSession | null = null;
  private initialized = false;

  constructor(config: RepoSetupConfig = {}) {
    this.config = {
      ...DEFAULT_REPO_SETUP_CONFIG,
      ...config,
    };
  }

  public async initialize(): Promise<void> {
    if (this.initialized) return;
    await Promise.resolve();
    this.initialized = true;
  }

  public async dispose(): Promise<void> {
    await Promise.resolve();
    this.session = null;
    this.initialized = false;
  }

  /**
   * Start a new setup session
   */
  public startSession(projectName: string, rootPath: string): RepoSetupSession {
    const now = new Date().toISOString();

    this.session = {
      sessionId: randomUUID(),
      projectName,
      status: 'pending',
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
   */
  public getSession(): RepoSetupSession | null {
    return this.session;
  }

  /**
   * Create and initialize a GitHub repository
   *
   * Implements the IGitHubRepoSetupAgent.createRepository interface
   * from SDS-001 Section 3.27.
   */
  public async createRepository(
    projectName: string,
    description: string,
    options: RepoSetupOptions
  ): Promise<RepoSetupResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const session = this.session ?? this.startSession(projectName, process.cwd());

    this.session = { ...session, status: 'creating' };

    try {
      // Step 1: Verify gh CLI authentication
      this.verifyGhAuth();

      // Step 2: Create GitHub repository
      const repoFullName = this.createGhRepo(projectName, description, options);

      // Step 3: Clone the repository locally
      const repoDir = path.resolve(session.rootPath, projectName);
      this.cloneRepo(repoFullName, repoDir);

      // Step 4: Generate initial files
      if (options.generateReadme) {
        this.generateReadme(repoDir, projectName, description);
      }
      this.generateGitignore(repoDir, options.language);

      // Step 5: Initial commit and push
      const commitSha = this.initialCommitAndPush(repoDir);

      // Step 6: Get default branch
      const defaultBranch = this.getDefaultBranch(repoDir);

      const result: RepoSetupResult = {
        repoUrl: `https://github.com/${repoFullName}`,
        repoFullName,
        defaultBranch,
        initialCommitSha: commitSha,
      };

      // Update session
      this.session = {
        ...this.session,
        status: 'completed',
        result,
        updatedAt: new Date().toISOString(),
      };

      // Save result to scratchpad
      this.saveResult(session.rootPath, projectName, result);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.session = {
        ...this.session,
        status: 'failed',
        updatedAt: new Date().toISOString(),
        errors: [...this.session.errors, errorMessage],
      };

      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Private: GitHub Operations
  // ---------------------------------------------------------------------------

  /**
   * Verify that gh CLI is authenticated
   */
  private verifyGhAuth(): void {
    const result = this.runGhCommand(process.cwd(), 'auth status');
    if (!result.success) {
      throw new GhAuthenticationError();
    }
  }

  /**
   * Create a GitHub repository using gh CLI
   */
  private createGhRepo(
    projectName: string,
    description: string,
    options: RepoSetupOptions
  ): string {
    const args = [
      'repo',
      'create',
      projectName,
      `--${options.visibility}`,
      '--description',
      description,
    ];

    if (options.license) {
      args.push('--license', options.license);
    }

    const gitignoreTemplate = GITIGNORE_TEMPLATES[options.language.toLowerCase()];
    if (gitignoreTemplate !== undefined && gitignoreTemplate !== '') {
      args.push('--gitignore', gitignoreTemplate);
    }

    const result = this.runGhCommandWithArgs(process.cwd(), args);

    if (!result.success) {
      const errorMsg = result.error ?? 'Unknown error';
      if (errorMsg.includes('already exists')) {
        // Extract the full name from gh output or construct it
        const owner = this.getGhUser();
        throw new RepoAlreadyExistsError(`${owner}/${projectName}`);
      }
      throw new RepoCreationError(projectName, errorMsg);
    }

    // Parse the repository URL from output to extract full name
    const urlMatch = result.output.match(/github\.com\/([^/\s]+\/[^/\s]+)/);
    if (urlMatch && typeof urlMatch[1] === 'string') {
      return urlMatch[1].replace(/\.git$/, '');
    }

    // Fallback: construct from current user
    const owner = this.getGhUser();
    return `${owner}/${projectName}`;
  }

  /**
   * Clone the newly created repository
   */
  private cloneRepo(repoFullName: string, targetDir: string): void {
    const result = this.runGhCommandWithArgs(process.cwd(), [
      'repo',
      'clone',
      repoFullName,
      targetDir,
    ]);

    if (!result.success) {
      throw new RepoCreationError(repoFullName, `Clone failed: ${result.error ?? 'Unknown error'}`);
    }
  }

  /**
   * Get the authenticated GitHub user
   */
  private getGhUser(): string {
    const result = this.runGhCommandWithArgs(process.cwd(), ['api', 'user', '--jq', '.login']);

    if (result.success && result.output.trim()) {
      return result.output.trim();
    }

    return 'unknown';
  }

  // ---------------------------------------------------------------------------
  // Private: File Generation
  // ---------------------------------------------------------------------------

  /**
   * Generate README.md from project metadata
   */
  private generateReadme(repoDir: string, projectName: string, description: string): void {
    const readmePath = path.join(repoDir, 'README.md');

    // Only generate if not already created by gh repo create
    if (fs.existsSync(readmePath)) {
      return;
    }

    const content = [
      `# ${projectName}`,
      '',
      description,
      '',
      '## Getting Started',
      '',
      'This project was initialized with [AD-SDLC](https://github.com/kcenon/claude_code_agent).',
      '',
      '## License',
      '',
      'See [LICENSE](LICENSE) for details.',
      '',
    ].join('\n');

    fs.writeFileSync(readmePath, content, 'utf-8');
  }

  /**
   * Generate .gitignore based on language
   */
  private generateGitignore(repoDir: string, language: string): void {
    const gitignorePath = path.join(repoDir, '.gitignore');

    // Only generate if not already created by gh repo create
    if (fs.existsSync(gitignorePath)) {
      // Append AD-SDLC specific entries
      const existing = fs.readFileSync(gitignorePath, 'utf-8');
      if (!existing.includes('.ad-sdlc/scratchpad')) {
        const adsdlcEntries = ['', '# AD-SDLC', '.ad-sdlc/scratchpad/', '.ad-sdlc/logs/', ''].join(
          '\n'
        );
        fs.appendFileSync(gitignorePath, adsdlcEntries, 'utf-8');
      }
      return;
    }

    // Generate from scratch
    const entries = this.getGitignoreEntries(language);
    fs.writeFileSync(gitignorePath, entries.join('\n') + '\n', 'utf-8');
  }

  /**
   * Get .gitignore entries for a language
   */
  private getGitignoreEntries(language: string): string[] {
    const base = [
      '# Dependencies',
      'node_modules/',
      '',
      '# Build outputs',
      'dist/',
      'build/',
      '',
      '# IDE',
      '.idea/',
      '.vscode/',
      '*.swp',
      '*.swo',
      '',
      '# OS files',
      '.DS_Store',
      'Thumbs.db',
      '',
      '# Environment',
      '.env',
      '.env.local',
      '.env.*.local',
      '',
      '# AD-SDLC',
      '.ad-sdlc/scratchpad/',
      '.ad-sdlc/logs/',
    ];

    const languageEntries: Record<string, string[]> = {
      typescript: ['*.js.map', '*.d.ts', 'coverage/', '.tsbuildinfo'],
      javascript: ['coverage/'],
      python: ['__pycache__/', '*.pyc', '.venv/', 'venv/', '*.egg-info/'],
      java: ['*.class', 'target/', '*.jar'],
      go: ['vendor/'],
      rust: ['target/', 'Cargo.lock'],
    };

    const extra = languageEntries[language.toLowerCase()] ?? [];
    if (extra.length > 0) {
      base.push('', `# ${language}`, ...extra);
    }

    return base;
  }

  // ---------------------------------------------------------------------------
  // Private: Git Operations
  // ---------------------------------------------------------------------------

  /**
   * Perform initial commit and push
   */
  private initialCommitAndPush(repoDir: string): string {
    // Stage all files
    const addResult = this.runGitCommand(repoDir, 'add -A');
    if (!addResult.success) {
      throw new GitInitError('git add -A', addResult.error ?? 'Unknown error');
    }

    // Check if there are changes to commit
    const statusResult = this.runGitCommand(repoDir, 'status --porcelain');
    if (statusResult.success && statusResult.output.trim() === '') {
      // No changes to commit — get current HEAD sha
      const headResult = this.runGitCommand(repoDir, 'rev-parse HEAD');
      return headResult.success ? headResult.output.trim() : '';
    }

    // Commit
    const commitResult = this.runGitCommand(
      repoDir,
      'commit -m "chore: initialize project with AD-SDLC"'
    );
    if (!commitResult.success) {
      throw new GitInitError('git commit', commitResult.error ?? 'Unknown error');
    }

    // Get commit SHA
    const shaResult = this.runGitCommand(repoDir, 'rev-parse HEAD');
    const sha = shaResult.success ? shaResult.output.trim() : '';

    // Push
    const pushResult = this.runGitCommand(repoDir, `push -u origin ${this.config.defaultBranch}`);
    if (!pushResult.success) {
      throw new GitInitError('git push', pushResult.error ?? 'Unknown error');
    }

    return sha;
  }

  /**
   * Get the default branch name from the repository
   */
  private getDefaultBranch(repoDir: string): string {
    const result = this.runGitCommand(repoDir, 'rev-parse --abbrev-ref HEAD');
    if (result.success && result.output.trim()) {
      return result.output.trim();
    }
    return this.config.defaultBranch;
  }

  // ---------------------------------------------------------------------------
  // Private: Command Execution
  // ---------------------------------------------------------------------------

  /**
   * Run a git command using CommandSanitizer
   */
  private runGitCommand(
    cwd: string,
    command: string
  ): { success: boolean; output: string; error?: string } {
    const sanitizer = getCommandSanitizer();
    const parsed = sanitizer.parseCommandString(`git ${command}`);
    const args = parsed.args;

    const result = sanitizer.execGitSync(args, {
      cwd,
      timeout: this.config.gitCommandTimeoutMs,
    });

    return {
      success: result.success,
      output: result.stdout,
      ...(result.success ? {} : { error: result.stderr }),
    };
  }

  /**
   * Run a gh command using a string
   */
  private runGhCommand(
    cwd: string,
    command: string
  ): { success: boolean; output: string; error?: string } {
    const sanitizer = getCommandSanitizer();
    const parsed = sanitizer.parseCommandString(`gh ${command}`);
    const args = parsed.args;

    const result = sanitizer.execGhSync(args, {
      cwd,
      timeout: this.config.ghCommandTimeoutMs,
    });

    return {
      success: result.success,
      output: result.stdout,
      ...(result.success ? {} : { error: result.stderr }),
    };
  }

  /**
   * Run a gh command with pre-parsed arguments
   */
  private runGhCommandWithArgs(
    cwd: string,
    args: string[]
  ): { success: boolean; output: string; error?: string } {
    const sanitizer = getCommandSanitizer();

    const result = sanitizer.execGhSync(args, {
      cwd,
      timeout: this.config.ghCommandTimeoutMs,
    });

    return {
      success: result.success,
      output: result.stdout,
      ...(result.success ? {} : { error: result.stderr }),
    };
  }

  // ---------------------------------------------------------------------------
  // Private: State Persistence
  // ---------------------------------------------------------------------------

  /**
   * Save setup result to scratchpad
   */
  private saveResult(rootPath: string, projectName: string, result: RepoSetupResult): void {
    const scratchpadPath = path.join(rootPath, this.config.scratchpadBasePath, 'repo', projectName);

    try {
      fs.mkdirSync(scratchpadPath, { recursive: true });

      const outputPath = path.join(scratchpadPath, 'repo_setup.yaml');
      const yamlContent = yaml.dump({
        repository_setup: {
          repo_url: result.repoUrl,
          repo_full_name: result.repoFullName,
          default_branch: result.defaultBranch,
          initial_commit_sha: result.initialCommitSha,
          created_at: new Date().toISOString(),
        },
      });

      fs.writeFileSync(outputPath, yamlContent, 'utf-8');
    } catch (error) {
      throw new SetupOutputWriteError(
        scratchpadPath,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Ensure session exists
   */
  private ensureSession(): RepoSetupSession {
    if (!this.session) {
      throw new NoActiveSetupSessionError();
    }
    return this.session;
  }
}

// ---------------------------------------------------------------------------
// Singleton management
// ---------------------------------------------------------------------------

let instance: GitHubRepoSetupAgent | null = null;

/**
 * Get the singleton GitHub Repo Setup Agent instance
 */
export function getGitHubRepoSetupAgent(config?: RepoSetupConfig): GitHubRepoSetupAgent {
  if (instance === null) {
    instance = new GitHubRepoSetupAgent(config);
  }
  return instance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetGitHubRepoSetupAgent(): void {
  instance = null;
}
