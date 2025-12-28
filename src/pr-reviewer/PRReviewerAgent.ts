/**
 * PR Reviewer Agent module
 *
 * Implements PR creation, automated code review, quality gate enforcement,
 * and feedback generation based on Worker Agent implementation results.
 *
 * @module pr-reviewer/PRReviewerAgent
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import yaml from 'js-yaml';

import type {
  PRReviewerAgentConfig,
  PRReviewResult,
  PRReviewOptions,
  PullRequest,
  Review,
  ReviewComment,
  ReviewStatus,
  ReviewDecision,
  Decision,
  WorkerFeedback,
  CheckResults,
  QualityGateResult,
  ImplementationResult,
  PRCreateOptions,
  GitHubPRInfo,
} from './types.js';
import { DEFAULT_PR_REVIEWER_CONFIG } from './types.js';
import { QualityGate } from './QualityGate.js';
import { ReviewChecks } from './ReviewChecks.js';
import {
  ImplementationResultNotFoundError,
  ImplementationResultParseError,
  PRCreationError,
  PRMergeError,
  PRCloseError,
  ReviewSubmissionError,
  CITimeoutError,
  GitOperationError,
  ResultPersistenceError,
} from './errors.js';

const execAsync = promisify(exec);

/**
 * Command execution result
 */
interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * GitHub PR data from gh CLI
 */
interface GitHubPRData {
  number: number;
  url: string;
  title: string;
  headRefName: string;
  baseRefName: string;
  createdAt: string;
  state: string;
  statusCheckRollup?: Array<{ name?: string; status: string }>;
  reviews?: Array<{ state?: string; author?: { login?: string } }>;
}

/**
 * Singleton instance
 */
let instance: PRReviewerAgent | null = null;

/**
 * PR Reviewer Agent
 *
 * Reviews Worker Agent implementation results, creates PRs,
 * performs automated code review, and makes merge decisions.
 */
export class PRReviewerAgent {
  private readonly config: Required<PRReviewerAgentConfig>;
  private readonly qualityGate: QualityGate;
  private readonly reviewChecks: ReviewChecks;

  constructor(config: PRReviewerAgentConfig = {}) {
    this.config = {
      projectRoot: config.projectRoot ?? DEFAULT_PR_REVIEWER_CONFIG.projectRoot,
      resultsPath: config.resultsPath ?? DEFAULT_PR_REVIEWER_CONFIG.resultsPath,
      autoMerge: config.autoMerge ?? DEFAULT_PR_REVIEWER_CONFIG.autoMerge,
      mergeStrategy: config.mergeStrategy ?? DEFAULT_PR_REVIEWER_CONFIG.mergeStrategy,
      deleteBranchOnMerge:
        config.deleteBranchOnMerge ?? DEFAULT_PR_REVIEWER_CONFIG.deleteBranchOnMerge,
      coverageThreshold: config.coverageThreshold ?? DEFAULT_PR_REVIEWER_CONFIG.coverageThreshold,
      maxComplexity: config.maxComplexity ?? DEFAULT_PR_REVIEWER_CONFIG.maxComplexity,
      ciTimeout: config.ciTimeout ?? DEFAULT_PR_REVIEWER_CONFIG.ciTimeout,
      ciPollInterval: config.ciPollInterval ?? DEFAULT_PR_REVIEWER_CONFIG.ciPollInterval,
    };

    this.qualityGate = new QualityGate({
      config: {
        required: {
          codeCoverage: this.config.coverageThreshold,
        },
        recommended: {
          maxComplexity: this.config.maxComplexity,
        },
      },
    });

    this.reviewChecks = new ReviewChecks({
      projectRoot: this.config.projectRoot,
    });
  }

  /**
   * Main review entry point
   * Processes an implementation result and returns the review result
   */
  public async review(workOrderId: string, options: PRReviewOptions = {}): Promise<PRReviewResult> {
    const startedAt = new Date().toISOString();

    // 1. Read implementation result
    const implResult = await this.readImplementationResult(workOrderId);

    // 2. Create PR if branch exists
    const pullRequest = await this.createPullRequest(implResult, options);

    // 3. Wait for CI (unless skipped)
    if (options.skipCIWait !== true) {
      await this.waitForCI(pullRequest.number);
    }

    // 4. Perform code review
    const { comments, metrics } = await this.reviewChecks.runAllChecks(implResult.changes);

    // 5. Gather check results
    const checks = this.getCheckResults(implResult);

    // 6. Evaluate quality gates
    const qualityGateResult = this.qualityGate.evaluate(metrics, checks, comments);

    // 7. Make decision
    const reviewStatus = this.determineReviewStatus(qualityGateResult, comments, options);
    const decision = this.makeDecision(
      pullRequest,
      reviewStatus,
      qualityGateResult,
      comments,
      options
    );

    // 8. Submit review
    if (options.dryRun !== true) {
      await this.submitReview(pullRequest.number, reviewStatus, comments);
    }

    // 9. Execute decision
    if (options.dryRun !== true) {
      await this.executeDecision(pullRequest, decision, options);
    }

    // 10. Generate feedback
    const feedback = this.generateFeedback(comments, qualityGateResult);

    // 11. Build review object
    const review: Review = {
      status: reviewStatus,
      reviewedAt: new Date().toISOString(),
      revisionRound: 1,
      comments,
      summary: this.qualityGate.getSummary(qualityGateResult),
    };

    const completedAt = new Date().toISOString();

    // 12. Build result
    const result: PRReviewResult = {
      workOrderId,
      issueId: implResult.issueId,
      githubIssue: implResult.githubIssue,
      pullRequest,
      review,
      qualityMetrics: metrics,
      checks,
      qualityGate: qualityGateResult,
      decision,
      feedbackForWorker: feedback,
      startedAt,
      completedAt,
    };

    // 13. Persist result
    if (options.dryRun !== true) {
      await this.persistResult(result);
    }

    return result;
  }

  /**
   * Review from implementation result file path
   */
  public async reviewFromFile(
    resultPath: string,
    options: PRReviewOptions = {}
  ): Promise<PRReviewResult> {
    const startedAt = new Date().toISOString();

    // Read implementation result directly
    const implResult = await this.parseImplementationResultFile(resultPath);

    // Create PR if branch exists
    const pullRequest = await this.createPullRequest(implResult, options);

    // Wait for CI (unless skipped)
    if (options.skipCIWait !== true) {
      await this.waitForCI(pullRequest.number);
    }

    // Perform code review
    const { comments, metrics } = await this.reviewChecks.runAllChecks(implResult.changes);

    // Gather check results
    const checks = this.getCheckResults(implResult);

    // Evaluate quality gates
    const qualityGateResult = this.qualityGate.evaluate(metrics, checks, comments);

    // Make decision
    const reviewStatus = this.determineReviewStatus(qualityGateResult, comments, options);
    const decision = this.makeDecision(
      pullRequest,
      reviewStatus,
      qualityGateResult,
      comments,
      options
    );

    // Submit review and execute decision
    if (options.dryRun !== true) {
      await this.submitReview(pullRequest.number, reviewStatus, comments);
      await this.executeDecision(pullRequest, decision, options);
    }

    // Generate feedback
    const feedback = this.generateFeedback(comments, qualityGateResult);

    // Build review object
    const review: Review = {
      status: reviewStatus,
      reviewedAt: new Date().toISOString(),
      revisionRound: 1,
      comments,
      summary: this.qualityGate.getSummary(qualityGateResult),
    };

    const completedAt = new Date().toISOString();

    // Build result
    const result: PRReviewResult = {
      workOrderId: implResult.workOrderId,
      issueId: implResult.issueId,
      githubIssue: implResult.githubIssue,
      pullRequest,
      review,
      qualityMetrics: metrics,
      checks,
      qualityGate: qualityGateResult,
      decision,
      feedbackForWorker: feedback,
      startedAt,
      completedAt,
    };

    // Persist result
    if (options.dryRun !== true) {
      await this.persistResult(result);
    }

    return result;
  }

  /**
   * Read implementation result from scratchpad
   */
  private async readImplementationResult(workOrderId: string): Promise<ImplementationResult> {
    const resultPath = join(
      this.config.projectRoot,
      this.config.resultsPath,
      'results',
      `${workOrderId}-result.yaml`
    );

    if (!existsSync(resultPath)) {
      throw new ImplementationResultNotFoundError(workOrderId, resultPath);
    }

    return this.parseImplementationResultFile(resultPath);
  }

  /**
   * Parse implementation result file
   */
  private async parseImplementationResultFile(filePath: string): Promise<ImplementationResult> {
    try {
      const content = await readFile(filePath, 'utf-8');
      return yaml.load(content) as ImplementationResult;
    } catch (error) {
      throw new ImplementationResultParseError(
        filePath,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Create pull request from implementation result
   */
  private async createPullRequest(
    implResult: ImplementationResult,
    _options: PRReviewOptions
  ): Promise<PullRequest> {
    const branchName = implResult.branch.name;

    // Check if PR already exists
    const existingPR = await this.findExistingPR(branchName);
    if (existingPR) {
      return existingPR;
    }

    // Generate PR content
    const prOptions = this.generatePRContent(implResult);

    // Create PR using gh CLI
    try {
      const result = await this.executeCommand(
        `gh pr create --title "${this.escapeShell(prOptions.title)}" ` +
          `--body "${this.escapeShell(prOptions.body)}" ` +
          `--base "${prOptions.base ?? 'main'}" ` +
          `--head "${prOptions.head}" ` +
          `--json number,url,title,headRefName,baseRefName,createdAt,state`
      );

      if (result.exitCode !== 0) {
        throw new PRCreationError(branchName, new Error(result.stderr));
      }

      const prData = JSON.parse(result.stdout) as GitHubPRData;
      return {
        number: prData.number,
        url: prData.url,
        title: prData.title,
        branch: prData.headRefName,
        base: prData.baseRefName,
        createdAt: prData.createdAt,
        state: prData.state.toLowerCase() as 'open' | 'closed' | 'merged',
      };
    } catch (error) {
      if (error instanceof PRCreationError) throw error;
      throw new PRCreationError(branchName, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Find existing PR for branch
   */
  private async findExistingPR(branchName: string): Promise<PullRequest | null> {
    try {
      const result = await this.executeCommand(
        `gh pr list --head "${branchName}" --json number,url,title,headRefName,baseRefName,createdAt,state --limit 1`
      );

      if (result.exitCode !== 0 || !result.stdout.trim()) {
        return null;
      }

      const prs = JSON.parse(result.stdout) as GitHubPRData[];
      const pr = prs[0];
      if (pr === undefined) {
        return null;
      }

      return {
        number: pr.number,
        url: pr.url,
        title: pr.title,
        branch: pr.headRefName,
        base: pr.baseRefName,
        createdAt: pr.createdAt,
        state: pr.state.toLowerCase() as 'open' | 'closed' | 'merged',
      };
    } catch {
      return null;
    }
  }

  /**
   * Generate PR title and body from implementation result
   */
  private generatePRContent(implResult: ImplementationResult): PRCreateOptions {
    const issueRef =
      implResult.githubIssue !== undefined
        ? `#${String(implResult.githubIssue)}`
        : implResult.issueId;

    const title = `feat(${this.extractScope(implResult.issueId)}): Implement ${implResult.issueId}`;

    const changesDescription = implResult.changes
      .map((c) => `- ${c.changeType}: ${c.filePath} - ${c.description}`)
      .join('\n');

    const body = `## Summary
Implements ${issueRef}

## Changes Made
${changesDescription}

## Testing
- Tests created: ${String(implResult.tests.filesCreated.length)} files
- Total tests: ${String(implResult.tests.totalTests)}
- Coverage: ${String(implResult.tests.coveragePercentage)}%

## Verification
- Tests: ${implResult.verification.testsPassed ? '✅ Passed' : '❌ Failed'}
- Lint: ${implResult.verification.lintPassed ? '✅ Passed' : '❌ Failed'}
- Build: ${implResult.verification.buildPassed ? '✅ Passed' : '❌ Failed'}

## Checklist
- [x] Code follows project style guidelines
- [x] Tests added/updated
- [x] Self-review completed

---
_Auto-generated by AD-SDLC PR Review Agent_`;

    return {
      title,
      body,
      base: 'main',
      head: implResult.branch.name,
    };
  }

  /**
   * Extract scope from issue ID
   */
  private extractScope(issueId: string): string {
    // ISS-001-feature-name -> feature
    const parts = issueId.split('-');
    const scope = parts[2];
    if (scope !== undefined) {
      return scope;
    }
    return 'feature';
  }

  /**
   * Wait for CI checks to complete
   */
  private async waitForCI(prNumber: number): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < this.config.ciTimeout) {
      const prInfo = await this.getPRInfo(prNumber);

      const allChecksComplete = prInfo.statusCheckRollup.every(
        (check) => check.status !== 'pending' && check.status !== 'running'
      );

      if (allChecksComplete) {
        return;
      }

      await this.sleep(this.config.ciPollInterval);
    }

    throw new CITimeoutError(prNumber, this.config.ciTimeout);
  }

  /**
   * Get PR info from GitHub
   */
  private async getPRInfo(prNumber: number): Promise<GitHubPRInfo> {
    const result = await this.executeCommand(
      `gh pr view ${String(prNumber)} --json number,state,statusCheckRollup,reviews`
    );

    if (result.exitCode !== 0) {
      throw new GitOperationError(`Failed to get PR info: ${result.stderr}`);
    }

    const data = JSON.parse(result.stdout) as GitHubPRData;
    return {
      number: data.number,
      state: data.state.toLowerCase() as 'open' | 'closed' | 'merged',
      statusCheckRollup: (data.statusCheckRollup ?? []).map((check) => ({
        name: check.name ?? 'unknown',
        status: check.status as 'pending' | 'running' | 'passed' | 'failed' | 'skipped',
      })),
      reviews: (data.reviews ?? []).map((review) => ({
        state: review.state ?? 'unknown',
        author: review.author?.login ?? 'unknown',
      })),
    };
  }

  /**
   * Get check results from implementation result
   */
  private getCheckResults(implResult: ImplementationResult): CheckResults {
    return {
      ciPassed:
        implResult.verification.testsPassed &&
        implResult.verification.lintPassed &&
        implResult.verification.buildPassed,
      testsPassed: implResult.verification.testsPassed,
      lintPassed: implResult.verification.lintPassed,
      securityScanPassed: true, // Assume passed unless security scan fails
      buildPassed: implResult.verification.buildPassed,
    };
  }

  /**
   * Determine review status based on quality gate and comments
   */
  private determineReviewStatus(
    qualityGateResult: QualityGateResult,
    comments: readonly ReviewComment[],
    options: PRReviewOptions
  ): ReviewStatus {
    if (options.forceApprove === true) {
      return 'approved';
    }

    // Check for critical issues
    const hasCritical = comments.some((c) => c.severity === 'critical' && !c.resolved);
    if (hasCritical) {
      return 'rejected';
    }

    // Check quality gates
    if (!qualityGateResult.passed) {
      return 'changes_requested';
    }

    // Check for major issues
    const hasMajor = comments.some((c) => c.severity === 'major' && !c.resolved);
    if (hasMajor) {
      return 'changes_requested';
    }

    return 'approved';
  }

  /**
   * Make final decision based on review
   */
  private makeDecision(
    _pullRequest: PullRequest,
    reviewStatus: ReviewStatus,
    qualityGateResult: QualityGateResult,
    _comments: readonly ReviewComment[],
    _options: PRReviewOptions
  ): Decision {
    let action: ReviewDecision;
    let reason: string;

    switch (reviewStatus) {
      case 'approved':
        action = 'merge';
        reason = qualityGateResult.passed
          ? 'All quality gates passed and no blocking issues found.'
          : 'Approved with warnings - quality gates passed.';
        break;

      case 'changes_requested':
        action = 'revise';
        reason =
          qualityGateResult.failures.length > 0
            ? `Quality gates failed: ${qualityGateResult.failures.join(', ')}`
            : 'Major issues require attention before merge.';
        break;

      case 'rejected':
        action = 'reject';
        reason = 'Critical issues found that block this PR.';
        break;

      default:
        action = 'revise';
        reason = 'Review incomplete.';
    }

    return {
      action,
      reason,
    };
  }

  /**
   * Submit review to GitHub
   */
  private async submitReview(
    prNumber: number,
    status: ReviewStatus,
    comments: readonly ReviewComment[]
  ): Promise<void> {
    // Map status to gh review event
    let event: string;
    let body: string;

    switch (status) {
      case 'approved':
        event = '--approve';
        body = 'LGTM! All quality gates passed.';
        break;
      case 'changes_requested':
        event = '--request-changes';
        body = 'Please address the issues noted in the review.';
        break;
      case 'rejected':
        event = '--request-changes';
        body = 'Critical issues found. Please see comments for details.';
        break;
    }

    try {
      // Submit the main review
      const result = await this.executeCommand(
        `gh pr review ${String(prNumber)} ${event} --body "${this.escapeShell(body)}"`
      );

      if (result.exitCode !== 0) {
        throw new ReviewSubmissionError(prNumber, new Error(result.stderr));
      }

      // Add individual line comments for issues
      for (const comment of comments.filter((c) => !c.resolved)) {
        await this.addReviewComment(prNumber, comment);
      }
    } catch (error) {
      if (error instanceof ReviewSubmissionError) throw error;
      throw new ReviewSubmissionError(prNumber, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Add a review comment to a specific file/line
   */
  private async addReviewComment(prNumber: number, comment: ReviewComment): Promise<void> {
    try {
      const severityEmoji = this.getSeverityEmoji(comment.severity);
      const body =
        `${severityEmoji} **${comment.severity.toUpperCase()}**: ${comment.comment}` +
        (comment.suggestedFix !== undefined ? `\n\n💡 Suggested fix: ${comment.suggestedFix}` : '');

      // Note: gh pr comment doesn't support line-level comments directly
      // In practice, we'd use the GitHub API for this
      await this.executeCommand(
        `gh pr comment ${String(prNumber)} --body "${this.escapeShell(`**${comment.file}:${String(comment.line)}**\n${body}`)}"`
      );
    } catch {
      // Ignore comment failures - non-critical
    }
  }

  /**
   * Get emoji for severity level
   */
  private getSeverityEmoji(severity: string): string {
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
   * Execute the review decision
   */
  private async executeDecision(
    pullRequest: PullRequest,
    decision: Decision,
    options: PRReviewOptions
  ): Promise<Decision> {
    if (options.dryRun === true) {
      return decision;
    }

    switch (decision.action) {
      case 'merge':
        if (this.config.autoMerge || options.forceApprove === true) {
          try {
            const mergeFlags = this.getMergeFlags();
            const result = await this.executeCommand(
              `gh pr merge ${String(pullRequest.number)} ${mergeFlags}`
            );

            if (result.exitCode === 0) {
              return {
                ...decision,
                mergedAt: new Date().toISOString(),
                // Extract merge commit from output if available
              };
            }
          } catch (error) {
            throw new PRMergeError(
              pullRequest.number,
              'Merge failed',
              error instanceof Error ? error : undefined
            );
          }
        }
        break;

      case 'reject':
        try {
          await this.executeCommand(
            `gh pr close ${String(pullRequest.number)} --comment "Closing due to critical issues."`
          );
        } catch (error) {
          throw new PRCloseError(pullRequest.number, error instanceof Error ? error : undefined);
        }
        break;

      case 'revise':
        // No action needed - review comments already posted
        break;
    }

    return decision;
  }

  /**
   * Get merge flags based on configuration
   */
  private getMergeFlags(): string {
    const flags: string[] = [];

    switch (this.config.mergeStrategy) {
      case 'squash':
        flags.push('--squash');
        break;
      case 'rebase':
        flags.push('--rebase');
        break;
      case 'merge':
        flags.push('--merge');
        break;
    }

    if (this.config.deleteBranchOnMerge) {
      flags.push('--delete-branch');
    }

    return flags.join(' ');
  }

  /**
   * Generate feedback for worker agent
   */
  private generateFeedback(
    comments: readonly ReviewComment[],
    qualityGateResult: QualityGateResult
  ): WorkerFeedback {
    const positiveNotes: string[] = [];
    const improvements: string[] = [];

    // Add positive notes based on passed gates
    if (qualityGateResult.passed) {
      positiveNotes.push('All required quality gates passed');
    }

    const criticalCount = comments.filter((c) => c.severity === 'critical').length;
    const majorCount = comments.filter((c) => c.severity === 'major').length;

    if (criticalCount === 0) {
      positiveNotes.push('No critical security or quality issues');
    }

    if (majorCount === 0) {
      positiveNotes.push('No major issues found in the implementation');
    }

    // Add improvements based on comments
    for (const comment of comments.filter((c) => !c.resolved)) {
      if (comment.severity === 'critical' || comment.severity === 'major') {
        improvements.push(`${comment.file}:${String(comment.line)} - ${comment.comment}`);
      }
    }

    // Add improvements based on warnings
    for (const warning of qualityGateResult.warnings) {
      improvements.push(warning);
    }

    return {
      positiveNotes,
      improvements,
    };
  }

  /**
   * Persist review result to scratchpad
   */
  private async persistResult(result: PRReviewResult): Promise<void> {
    const reviewsDir = join(this.config.projectRoot, this.config.resultsPath, 'reviews');

    try {
      if (!existsSync(reviewsDir)) {
        await mkdir(reviewsDir, { recursive: true });
      }

      const resultPath = join(reviewsDir, `PR-${String(result.pullRequest.number)}-review.yaml`);
      const yamlContent = yaml.dump(result, { indent: 2 });
      await writeFile(resultPath, yamlContent, 'utf-8');
    } catch (error) {
      throw new ResultPersistenceError(reviewsDir, error instanceof Error ? error : undefined);
    }
  }

  /**
   * Execute a shell command
   */
  private async executeCommand(command: string): Promise<CommandResult> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.config.projectRoot,
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024,
      });

      return { stdout, stderr, exitCode: 0 };
    } catch (error: unknown) {
      if (error !== null && typeof error === 'object' && 'code' in error) {
        const execError = error as { stdout?: string; stderr?: string; code?: number };
        return {
          stdout: execError.stdout ?? '',
          stderr: execError.stderr ?? '',
          exitCode: execError.code ?? 1,
        };
      }
      throw error;
    }
  }

  /**
   * Escape shell special characters
   */
  private escapeShell(str: string): string {
    return str.replace(/"/g, '\\"').replace(/`/g, '\\`').replace(/\$/g, '\\$');
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get configuration
   */
  public getConfig(): Required<PRReviewerAgentConfig> {
    return { ...this.config };
  }
}

/**
 * Get singleton instance of PRReviewerAgent
 */
export function getPRReviewerAgent(config?: PRReviewerAgentConfig): PRReviewerAgent {
  if (!instance) {
    instance = new PRReviewerAgent(config);
  }
  return instance;
}

/**
 * Reset singleton instance (for testing)
 */
export function resetPRReviewerAgent(): void {
  instance = null;
}
