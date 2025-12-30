/**
 * Repository Detector Agent error definitions
 *
 * Custom error classes for repository detection operations.
 */

/**
 * Base error class for Repository Detector operations
 */
export class RepoDetectorError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'RepoDetectorError';
  }
}

/**
 * Error when project path is not found
 */
export class ProjectNotFoundError extends RepoDetectorError {
  constructor(path: string) {
    super(`Project path not found: ${path}`, 'PROJECT_NOT_FOUND', { path });
    this.name = 'ProjectNotFoundError';
  }
}

/**
 * Error when no active session exists
 */
export class NoActiveSessionError extends RepoDetectorError {
  constructor() {
    super('No active detection session. Call startSession() first.', 'NO_ACTIVE_SESSION');
    this.name = 'NoActiveSessionError';
  }
}

/**
 * Error when session is in an invalid state for the requested operation
 */
export class InvalidSessionStateError extends RepoDetectorError {
  constructor(currentStatus: string, requiredStatus: string) {
    super(
      `Invalid session state: ${currentStatus}. Required: ${requiredStatus}`,
      'INVALID_SESSION_STATE',
      { currentStatus, requiredStatus }
    );
    this.name = 'InvalidSessionStateError';
  }
}

/**
 * Error when Git command fails
 */
export class GitCommandError extends RepoDetectorError {
  constructor(command: string, message: string, exitCode?: number) {
    super(`Git command failed: ${command} - ${message}`, 'GIT_COMMAND_ERROR', {
      command,
      exitCode,
    });
    this.name = 'GitCommandError';
  }
}

/**
 * Error when Git command times out
 */
export class GitCommandTimeoutError extends RepoDetectorError {
  constructor(command: string, timeoutMs: number) {
    super(
      `Git command timed out after ${String(timeoutMs)}ms: ${command}`,
      'GIT_COMMAND_TIMEOUT',
      { command, timeoutMs }
    );
    this.name = 'GitCommandTimeoutError';
  }
}

/**
 * Error when gh CLI is not authenticated
 */
export class GitHubAuthenticationError extends RepoDetectorError {
  constructor() {
    super(
      'GitHub CLI is not authenticated. Run `gh auth login` to authenticate.',
      'GITHUB_AUTH_ERROR'
    );
    this.name = 'GitHubAuthenticationError';
  }
}

/**
 * Error when gh CLI command fails
 */
export class GitHubCommandError extends RepoDetectorError {
  constructor(command: string, message: string) {
    super(`GitHub CLI command failed: ${command} - ${message}`, 'GITHUB_COMMAND_ERROR', {
      command,
    });
    this.name = 'GitHubCommandError';
  }
}

/**
 * Error when GitHub repository is not accessible
 */
export class GitHubNotAccessibleError extends RepoDetectorError {
  constructor(repoUrl: string, reason?: string) {
    super(
      `GitHub repository not accessible: ${repoUrl}${reason ? ` - ${reason}` : ''}`,
      'GITHUB_NOT_ACCESSIBLE',
      { repoUrl, reason }
    );
    this.name = 'GitHubNotAccessibleError';
  }
}

/**
 * Error when output file cannot be written
 */
export class OutputWriteError extends RepoDetectorError {
  constructor(path: string, cause?: Error) {
    super(`Failed to write output file: ${path}`, 'OUTPUT_WRITE_ERROR', { path, cause });
    this.name = 'OutputWriteError';
  }
}

/**
 * Error when detection process times out
 */
export class DetectionTimeoutError extends RepoDetectorError {
  constructor(timeoutMs: number) {
    super(`Detection timed out after ${String(timeoutMs)}ms`, 'DETECTION_TIMEOUT', { timeoutMs });
    this.name = 'DetectionTimeoutError';
  }
}
