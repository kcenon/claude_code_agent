/**
 * GitHub Review Client
 *
 * Provides support for multi-file, line-level review comments using the GitHub REST API.
 * Uses `gh api` CLI to make authenticated requests without additional dependencies.
 *
 * @module pr-reviewer/GitHubReviewClient
 */

import type {
  GitHubReviewClientConfig,
  LineReviewComment,
  MultiFileReviewRequest,
  MultiFileReviewResult,
  ReviewCommentResult,
} from './types.js';
import { DEFAULT_GITHUB_REVIEW_CLIENT_CONFIG } from './types.js';
import { ReviewCommentError } from './errors.js';
import { getCommandSanitizer } from '../security/index.js';
import { tryGetProjectRoot } from '../utils/index.js';

/**
 * Command execution result
 */
interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * GitHub API response for creating a review
 */
interface GitHubReviewAPIResponse {
  id: number;
  node_id: string;
  state: string;
}

/**
 * GitHub API response for creating a comment
 */
interface GitHubCommentAPIResponse {
  id: number;
  line: number;
  path: string;
}

/**
 * GitHub Review Client
 *
 * Enables multi-file, line-level review comments on GitHub PRs.
 * This addresses the limitation of `gh pr comment` which only supports
 * general PR comments, not diff-attached line comments.
 */
export class GitHubReviewClient {
  private readonly config: Required<GitHubReviewClientConfig>;
  private repoInfo: { owner: string; repo: string } | null = null;

  constructor(config: GitHubReviewClientConfig = {}) {
    this.config = {
      projectRoot:
        config.projectRoot ??
        tryGetProjectRoot() ??
        DEFAULT_GITHUB_REVIEW_CLIENT_CONFIG.projectRoot,
      continueOnCommentFailure:
        config.continueOnCommentFailure ??
        DEFAULT_GITHUB_REVIEW_CLIENT_CONFIG.continueOnCommentFailure,
      useBatchReview: config.useBatchReview ?? DEFAULT_GITHUB_REVIEW_CLIENT_CONFIG.useBatchReview,
    };
  }

  /**
   * Submit a multi-file review with line-level comments
   *
   * Uses the GitHub REST API to create a review with multiple file comments
   * attached to specific lines in the diff.
   *
   * @param request - The review request with comments
   * @returns Result of the review submission
   */
  public async submitMultiFileReview(
    request: MultiFileReviewRequest
  ): Promise<MultiFileReviewResult> {
    const commentResults: ReviewCommentResult[] = [];
    let reviewSubmitted = false;
    let reviewId: number | undefined;

    try {
      // Get PR head commit SHA
      const commitSha = await this.getPRHeadCommit(request.prNumber);

      if (this.config.useBatchReview && request.comments.length > 0) {
        // Use batch review API (creates review with all comments at once)
        const result = await this.createBatchReview(request, commitSha);
        reviewSubmitted = result.reviewSubmitted;
        reviewId = result.reviewId;

        // All comments succeed or fail together in batch mode
        for (const comment of request.comments) {
          const commentResult: ReviewCommentResult = result.reviewSubmitted
            ? { success: true, path: comment.path, line: comment.line }
            : {
                success: false,
                path: comment.path,
                line: comment.line,
                error: 'Batch review submission failed',
              };
          commentResults.push(commentResult);
        }
      } else {
        // Submit review first (without comments)
        const reviewResult = await this.submitReviewOnly(
          request.prNumber,
          request.body,
          request.event
        );
        reviewSubmitted = reviewResult.success;
        reviewId = reviewResult.reviewId;

        // Then add individual line comments
        for (const comment of request.comments) {
          const result = await this.addLineComment(request.prNumber, comment, commitSha);
          commentResults.push(result);

          if (!result.success && !this.config.continueOnCommentFailure) {
            break;
          }
        }
      }
    } catch (error) {
      // If we failed early, mark remaining comments as failed
      const processedCount = commentResults.length;
      for (let i = processedCount; i < request.comments.length; i++) {
        const comment = request.comments[i];
        if (comment !== undefined) {
          commentResults.push({
            success: false,
            path: comment.path,
            line: comment.line,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }

    const successCount = commentResults.filter((r) => r.success).length;
    const failureCount = commentResults.filter((r) => !r.success).length;

    const result: MultiFileReviewResult = {
      reviewSubmitted,
      commentResults,
      successCount,
      failureCount,
    };

    if (reviewId !== undefined) {
      return { ...result, reviewId };
    }

    return result;
  }

  /**
   * Add a single line-level comment to a PR
   *
   * @param prNumber - The PR number
   * @param comment - The comment to add
   * @param commitSha - The commit SHA to attach the comment to
   * @returns Result of the comment submission
   */
  public async addLineComment(
    prNumber: number,
    comment: LineReviewComment,
    commitSha?: string
  ): Promise<ReviewCommentResult> {
    try {
      const sha = commitSha ?? (await this.getPRHeadCommit(prNumber));
      const { owner, repo } = await this.getRepoInfo();

      // Build comment body with suggestion if provided
      let body = comment.body;
      if (comment.suggestion !== undefined) {
        body += `\n\n\`\`\`suggestion\n${comment.suggestion}\n\`\`\``;
      }

      // Use gh api to create the comment
      const result = await this.executeCommand(
        `gh api repos/${owner}/${repo}/pulls/${String(prNumber)}/comments ` +
          `-f commit_id="${sha}" ` +
          `-f path="${this.escapeForShell(comment.path)}" ` +
          `-F line=${String(comment.line)} ` +
          `-f side="${comment.side ?? 'RIGHT'}" ` +
          `-f body="${this.escapeForShell(body)}"`
      );

      if (result.exitCode !== 0) {
        throw new Error(result.stderr);
      }

      const response = JSON.parse(result.stdout) as GitHubCommentAPIResponse;
      return {
        success: true,
        commentId: response.id,
        path: comment.path,
        line: comment.line,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        path: comment.path,
        line: comment.line,
        error: errorMessage,
      };
    }
  }

  /**
   * Create a batch review with all comments at once
   *
   * Uses POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews
   * with comments array for efficient batch submission.
   * @param request
   * @param commitSha
   */
  private async createBatchReview(
    request: MultiFileReviewRequest,
    commitSha: string
  ): Promise<{ reviewSubmitted: boolean; reviewId?: number }> {
    try {
      const { owner, repo } = await this.getRepoInfo();

      // Build comments array for the API
      const commentsPayload = request.comments.map((c) => {
        let body = c.body;
        if (c.suggestion !== undefined) {
          body += `\n\n\`\`\`suggestion\n${c.suggestion}\n\`\`\``;
        }
        return {
          path: c.path,
          line: c.line,
          side: c.side ?? 'RIGHT',
          body,
        };
      });

      // Create the request body as JSON
      const requestBody = JSON.stringify({
        commit_id: commitSha,
        body: request.body,
        event: request.event,
        comments: commentsPayload,
      });

      // Use gh api with --input for complex JSON body
      const result = await this.executeCommand(
        `echo '${this.escapeForShell(requestBody)}' | gh api repos/${owner}/${repo}/pulls/${String(request.prNumber)}/reviews --input -`
      );

      if (result.exitCode !== 0) {
        throw new Error(result.stderr);
      }

      const response = JSON.parse(result.stdout) as GitHubReviewAPIResponse;
      return {
        reviewSubmitted: true,
        reviewId: response.id,
      };
    } catch {
      return {
        reviewSubmitted: false,
      };
    }
  }

  /**
   * Submit a review without line comments
   * @param prNumber
   * @param body
   * @param event
   */
  private async submitReviewOnly(
    prNumber: number,
    body: string,
    event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'
  ): Promise<{ success: boolean; reviewId?: number }> {
    try {
      const { owner, repo } = await this.getRepoInfo();

      const result = await this.executeCommand(
        `gh api repos/${owner}/${repo}/pulls/${String(prNumber)}/reviews ` +
          `-f body="${this.escapeForShell(body)}" ` +
          `-f event="${event}"`
      );

      if (result.exitCode !== 0) {
        throw new Error(result.stderr);
      }

      const response = JSON.parse(result.stdout) as GitHubReviewAPIResponse;
      return {
        success: true,
        reviewId: response.id,
      };
    } catch {
      return { success: false };
    }
  }

  /**
   * Get the head commit SHA for a PR
   * @param prNumber
   */
  private async getPRHeadCommit(prNumber: number): Promise<string> {
    const result = await this.executeCommand(
      `gh pr view ${String(prNumber)} --json headRefOid --jq .headRefOid`
    );

    if (result.exitCode !== 0 || !result.stdout.trim()) {
      throw new ReviewCommentError(prNumber, '', 0, new Error('Failed to get PR head commit'));
    }

    return result.stdout.trim();
  }

  /**
   * Get repository owner and name
   */
  private async getRepoInfo(): Promise<{ owner: string; repo: string }> {
    if (this.repoInfo !== null) {
      return this.repoInfo;
    }

    const result = await this.executeCommand(
      'gh repo view --json nameWithOwner --jq .nameWithOwner'
    );

    if (result.exitCode !== 0 || !result.stdout.trim()) {
      throw new Error('Failed to get repository information');
    }

    const [owner, repo] = result.stdout.trim().split('/');
    if (owner === undefined || repo === undefined) {
      throw new Error('Invalid repository format');
    }

    this.repoInfo = { owner, repo };
    return this.repoInfo;
  }

  /**
   * Convert ReviewComment to LineReviewComment format
   *
   * Helper method to convert internal review comments to the format
   * expected by the GitHub API.
   * @param file
   * @param line
   * @param severity
   * @param comment
   * @param suggestedFix
   */
  public static convertToLineComment(
    file: string,
    line: number,
    severity: string,
    comment: string,
    suggestedFix?: string
  ): LineReviewComment {
    const severityEmoji = GitHubReviewClient.getSeverityEmoji(severity);
    const body = `${severityEmoji} **${severity.toUpperCase()}**: ${comment}`;

    const result: LineReviewComment = {
      path: file,
      line,
      body,
      side: 'RIGHT',
    };

    if (suggestedFix !== undefined) {
      return { ...result, suggestion: suggestedFix };
    }

    return result;
  }

  /**
   * Get emoji for severity level
   * @param severity
   */
  private static getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical':
        return '🚨';
      case 'major':
        return '⚠️';
      case 'minor':
        return '💡';
      case 'suggestion':
        return '💭';
      default:
        return '📝';
    }
  }

  /**
   * Execute a shell command using safe execution
   * @param command
   */
  private async executeCommand(command: string): Promise<CommandResult> {
    const sanitizer = getCommandSanitizer();

    try {
      const result = await sanitizer.execFromString(command, {
        cwd: this.config.projectRoot,
        timeout: 60000,
        maxBuffer: 5 * 1024 * 1024,
      });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.success ? 0 : (result.exitCode ?? 1),
      };
    } catch (error: unknown) {
      if (error !== null && typeof error === 'object' && 'exitCode' in error) {
        const execError = error as { stdout?: string; stderr?: string; exitCode?: number };
        return {
          stdout: execError.stdout ?? '',
          stderr: execError.stderr ?? '',
          exitCode: execError.exitCode ?? 1,
        };
      }
      throw error;
    }
  }

  /**
   * Escape string for shell command
   * @param str
   */
  private escapeForShell(str: string): string {
    const sanitizer = getCommandSanitizer();
    return sanitizer.escapeForParser(str);
  }

  /**
   * Get configuration
   */
  public getConfig(): Required<GitHubReviewClientConfig> {
    return { ...this.config };
  }
}

/**
 * Get a singleton instance of GitHubReviewClient
 */
let instance: GitHubReviewClient | null = null;

/**
 *
 * @param config
 */
export function getGitHubReviewClient(config?: GitHubReviewClientConfig): GitHubReviewClient {
  if (!instance) {
    instance = new GitHubReviewClient(config);
  }
  return instance;
}

/**
 * Reset singleton instance (for testing)
 */
export function resetGitHubReviewClient(): void {
  instance = null;
}
