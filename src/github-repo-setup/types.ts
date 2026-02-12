/**
 * GitHub Repo Setup Agent module type definitions
 *
 * Defines types for GitHub repository creation and initialization.
 * Based on SDS-001 CMP-027 specification (Section 3.27).
 */

/**
 * Repository visibility
 */
export type RepoVisibility = 'public' | 'private';

/**
 * Setup session status
 */
export type SetupStatus = 'pending' | 'creating' | 'completed' | 'failed';

/**
 * Repository setup options (SDS-001 Section 3.27)
 */
export interface RepoSetupOptions {
  /** License type (MIT, Apache-2.0, etc.) */
  readonly license: string;
  /** Programming language for .gitignore template */
  readonly language: string;
  /** Whether to create initial README from project metadata */
  readonly generateReadme: boolean;
  /** GitHub visibility (public/private) */
  readonly visibility: RepoVisibility;
}

/**
 * Repository setup result (SDS-001 Section 3.27)
 */
export interface RepoSetupResult {
  /** Full repository URL */
  readonly repoUrl: string;
  /** Owner/repo format */
  readonly repoFullName: string;
  /** Default branch name */
  readonly defaultBranch: string;
  /** Initial commit SHA */
  readonly initialCommitSha: string;
}

/**
 * Repository setup session
 */
export interface RepoSetupSession {
  /** Session identifier */
  readonly sessionId: string;
  /** Project name */
  readonly projectName: string;
  /** Session status */
  readonly status: SetupStatus;
  /** Project root path (where repo will be created) */
  readonly rootPath: string;
  /** Setup result (if completed) */
  readonly result: RepoSetupResult | null;
  /** Session start time */
  readonly startedAt: string;
  /** Session last update time */
  readonly updatedAt: string;
  /** Any errors during setup */
  readonly errors: readonly string[];
}

/**
 * Agent configuration
 */
export interface RepoSetupConfig {
  /** Base path for scratchpad output */
  readonly scratchpadBasePath?: string;
  /** Timeout for gh CLI commands (ms) */
  readonly ghCommandTimeoutMs?: number;
  /** Timeout for git commands (ms) */
  readonly gitCommandTimeoutMs?: number;
  /** Default branch name */
  readonly defaultBranch?: string;
}

/**
 * Default configuration
 */
export const DEFAULT_REPO_SETUP_CONFIG: Required<RepoSetupConfig> = {
  scratchpadBasePath: '.ad-sdlc/scratchpad',
  ghCommandTimeoutMs: 30_000,
  gitCommandTimeoutMs: 10_000,
  defaultBranch: 'main',
};

/**
 * Supported license templates
 */
export const SUPPORTED_LICENSES = [
  'MIT',
  'Apache-2.0',
  'GPL-3.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  'MPL-2.0',
  'Unlicense',
] as const;

/**
 * Language to .gitignore template mapping
 */
export const GITIGNORE_TEMPLATES: Readonly<Record<string, string>> = {
  typescript: 'Node',
  javascript: 'Node',
  python: 'Python',
  java: 'Java',
  go: 'Go',
  rust: 'Rust',
  'c++': 'C++',
  c: 'C',
  ruby: 'Ruby',
  swift: 'Swift',
  kotlin: 'Kotlin',
};
