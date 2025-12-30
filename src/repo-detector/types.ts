/**
 * Repository Detector module type definitions
 *
 * Defines types for repository detection, Git state analysis,
 * and GitHub verification.
 */

/**
 * Repository modes that can be detected
 */
export type RepositoryMode = 'existing' | 'new';

/**
 * Detection session status
 */
export type DetectionStatus = 'detecting' | 'completed' | 'failed';

/**
 * Remote repository types
 */
export type RemoteType = 'github' | 'gitlab' | 'bitbucket' | 'other' | null;

/**
 * Repository visibility
 */
export type RepositoryVisibility = 'public' | 'private' | null;

/**
 * Git initialization status
 */
export interface GitStatus {
  /** Whether .git directory exists */
  readonly initialized: boolean;
  /** Whether repository has any commits */
  readonly hasCommits: boolean;
  /** Current branch name */
  readonly currentBranch: string | null;
  /** Whether working directory is clean */
  readonly isClean: boolean;
}

/**
 * Remote repository status
 */
export interface RemoteStatus {
  /** Whether remote origin is configured */
  readonly configured: boolean;
  /** Origin URL */
  readonly originUrl: string | null;
  /** Type of remote (GitHub, GitLab, etc.) */
  readonly remoteType: RemoteType;
}

/**
 * GitHub repository status
 */
export interface GitHubStatus {
  /** Whether GitHub repository exists */
  readonly exists: boolean;
  /** Whether repository is accessible */
  readonly accessible: boolean;
  /** Repository owner */
  readonly owner: string | null;
  /** Repository name */
  readonly name: string | null;
  /** Full repository URL */
  readonly url: string | null;
  /** Repository visibility */
  readonly visibility: RepositoryVisibility;
  /** Default branch name */
  readonly defaultBranch: string | null;
}

/**
 * Detection recommendation
 */
export interface DetectionRecommendation {
  /** Whether to skip github-repo-setup agent */
  readonly skipRepoSetup: boolean;
  /** Human-readable reason */
  readonly reason: string;
}

/**
 * Repository detection result
 */
export interface RepoDetectionResult {
  /** Detected repository mode */
  readonly mode: RepositoryMode;
  /** Detection confidence (0.0 to 1.0) */
  readonly confidence: number;
  /** Git status information */
  readonly gitStatus: GitStatus;
  /** Remote configuration status */
  readonly remoteStatus: RemoteStatus;
  /** GitHub repository status */
  readonly githubStatus: GitHubStatus;
  /** Recommendation for pipeline */
  readonly recommendation: DetectionRecommendation;
  /** Detection timestamp */
  readonly detectedAt: string;
}

/**
 * Repository detection session
 */
export interface RepoDetectionSession {
  /** Session identifier */
  readonly sessionId: string;
  /** Project identifier */
  readonly projectId: string;
  /** Session status */
  readonly status: DetectionStatus;
  /** Project root path */
  readonly rootPath: string;
  /** Detection result (if completed) */
  readonly result: RepoDetectionResult | null;
  /** Session start time */
  readonly startedAt: string;
  /** Session last update time */
  readonly updatedAt: string;
  /** Any errors during detection */
  readonly errors: readonly string[];
}

/**
 * Timeout configuration
 */
export interface TimeoutConfig {
  /** Timeout for git commands (ms) */
  readonly gitCommandMs: number;
  /** Timeout for gh commands (ms) */
  readonly ghCommandMs: number;
}

/**
 * GitHub configuration
 */
export interface GitHubConfig {
  /** Whether to check gh authentication */
  readonly checkAuthentication: boolean;
}

/**
 * Detection configuration
 */
export interface DetectionConfig {
  /** Whether to require commits to consider as existing */
  readonly requireCommits: boolean;
  /** Whether to require clean state */
  readonly requireCleanState: boolean;
}

/**
 * Repository Detector configuration
 */
export interface RepoDetectorConfig {
  /** Base path for scratchpad (defaults to .ad-sdlc/scratchpad) */
  readonly scratchpadBasePath?: string;
  /** Timeout configuration */
  readonly timeouts?: TimeoutConfig;
  /** GitHub configuration */
  readonly github?: GitHubConfig;
  /** Detection configuration */
  readonly detection?: DetectionConfig;
}

/**
 * Default timeout configuration
 */
export const DEFAULT_TIMEOUT_CONFIG: Required<TimeoutConfig> = {
  gitCommandMs: 5000,
  ghCommandMs: 10000,
} as const;

/**
 * Default GitHub configuration
 */
export const DEFAULT_GITHUB_CONFIG: Required<GitHubConfig> = {
  checkAuthentication: true,
} as const;

/**
 * Default detection configuration
 */
export const DEFAULT_DETECTION_CONFIG: Required<DetectionConfig> = {
  requireCommits: false,
  requireCleanState: false,
} as const;

/**
 * Default configuration values
 */
export const DEFAULT_REPO_DETECTOR_CONFIG: Required<RepoDetectorConfig> = {
  scratchpadBasePath: '.ad-sdlc/scratchpad',
  timeouts: DEFAULT_TIMEOUT_CONFIG,
  github: DEFAULT_GITHUB_CONFIG,
  detection: DEFAULT_DETECTION_CONFIG,
} as const;

/**
 * Detection statistics
 */
export interface DetectionStats {
  /** Time spent on git status check (ms) */
  readonly gitCheckTimeMs: number;
  /** Time spent on remote check (ms) */
  readonly remoteCheckTimeMs: number;
  /** Time spent on GitHub check (ms) */
  readonly githubCheckTimeMs: number;
  /** Total detection time (ms) */
  readonly totalTimeMs: number;
}
