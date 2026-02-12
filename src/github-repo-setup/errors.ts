/**
 * GitHub Repo Setup Agent error definitions
 *
 * Custom error classes for repository creation and initialization operations.
 */

/**
 * Base error class for GitHub Repo Setup operations
 */
export class RepoSetupError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'RepoSetupError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error when no active setup session exists
 */
export class NoActiveSetupSessionError extends RepoSetupError {
  constructor() {
    super('No active setup session. Call startSession() first.', 'NO_ACTIVE_SESSION');
    this.name = 'NoActiveSetupSessionError';
  }
}

/**
 * Error when session is in an invalid state for the requested operation
 */
export class InvalidSetupStateError extends RepoSetupError {
  constructor(currentStatus: string, requiredStatus: string) {
    super(
      `Invalid session state: ${currentStatus}. Required: ${requiredStatus}`,
      'INVALID_SESSION_STATE',
      { currentStatus, requiredStatus }
    );
    this.name = 'InvalidSetupStateError';
  }
}

/**
 * Error when repository creation fails via gh CLI
 */
export class RepoCreationError extends RepoSetupError {
  constructor(repoName: string, reason: string) {
    super(`Failed to create repository "${repoName}": ${reason}`, 'REPO_CREATION_ERROR', {
      repoName,
    });
    this.name = 'RepoCreationError';
  }
}

/**
 * Error when repository already exists on GitHub
 */
export class RepoAlreadyExistsError extends RepoSetupError {
  constructor(repoFullName: string) {
    super(`Repository "${repoFullName}" already exists on GitHub`, 'REPO_ALREADY_EXISTS', {
      repoFullName,
    });
    this.name = 'RepoAlreadyExistsError';
  }
}

/**
 * Error when gh CLI is not authenticated
 */
export class GhAuthenticationError extends RepoSetupError {
  constructor() {
    super('GitHub CLI is not authenticated. Run `gh auth login` to authenticate.', 'GH_AUTH_ERROR');
    this.name = 'GhAuthenticationError';
  }
}

/**
 * Error when git command fails during initialization
 */
export class GitInitError extends RepoSetupError {
  constructor(command: string, reason: string) {
    super(`Git command failed during repo setup: ${command} - ${reason}`, 'GIT_INIT_ERROR', {
      command,
    });
    this.name = 'GitInitError';
  }
}

/**
 * Error when output file cannot be written
 */
export class SetupOutputWriteError extends RepoSetupError {
  constructor(outputPath: string, cause?: Error) {
    super(`Failed to write setup output: ${outputPath}`, 'OUTPUT_WRITE_ERROR', {
      outputPath,
      cause,
    });
    this.name = 'SetupOutputWriteError';
  }
}
