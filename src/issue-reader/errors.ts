/**
 * Issue Reader module error definitions
 *
 * Custom error classes for GitHub issue importing and dependency graph operations.
 *
 * Implements SDS-001 CMP-028 (Section 3.28).
 */

/**
 * Base error class for all issue reader errors
 */
export class IssueReaderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'IssueReaderError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Error thrown when gh CLI is not authenticated
 */
export class GhAuthError extends IssueReaderError {
  constructor() {
    super('GitHub CLI is not authenticated. Run "gh auth login" to authenticate.', 'GH_AUTH_ERROR');
    this.name = 'GhAuthError';
  }
}

/**
 * Error thrown when the target repository is not found
 */
export class RepositoryNotFoundError extends IssueReaderError {
  public readonly repository: string;

  constructor(repository: string) {
    super(`Repository not found: ${repository}`, 'REPO_NOT_FOUND', { repository });
    this.name = 'RepositoryNotFoundError';
    this.repository = repository;
  }
}

/**
 * Error thrown when issue fetching from GitHub fails
 */
export class IssueFetchError extends IssueReaderError {
  public readonly repository: string;

  constructor(repository: string, reason: string) {
    super(`Failed to fetch issues from ${repository}: ${reason}`, 'ISSUE_FETCH_ERROR', {
      repository,
      reason,
    });
    this.name = 'IssueFetchError';
    this.repository = repository;
  }
}

/**
 * Error thrown when circular dependencies are detected during graph building
 */
export class CircularDependencyError extends IssueReaderError {
  public readonly cycle: readonly number[];

  constructor(cycle: readonly number[]) {
    super(
      `Circular dependency detected among issues: ${cycle.map((n) => `#${String(n)}`).join(' -> ')}`,
      'CIRCULAR_DEPENDENCY',
      { cycle }
    );
    this.name = 'CircularDependencyError';
    this.cycle = cycle;
  }
}

/**
 * Error thrown when scratchpad output writing fails
 */
export class OutputWriteError extends IssueReaderError {
  public readonly outputPath: string;

  constructor(outputPath: string, cause: Error) {
    super(
      `Failed to write import output to ${outputPath}: ${cause.message}`,
      'OUTPUT_WRITE_ERROR',
      { outputPath }
    );
    this.name = 'OutputWriteError';
    this.outputPath = outputPath;
    this.cause = cause;
  }
}
