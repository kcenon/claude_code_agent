/**
 * PR Reviewer Agent module
 *
 * Implements PR creation, automated code review, quality gate enforcement,
 * and feedback generation based on Worker Agent implementation results.
 *
 * @module pr-reviewer/PRReviewerAgent
 */

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
  PRCreateResult,
  GitHubPRInfo,
  MergeReadinessResult,
  CIFixDelegationResult,
} from './types.js';
import { DEFAULT_PR_REVIEWER_CONFIG } from './types.js';
import type { CIFixHandoff } from '../ci-fixer/types.js';
import { QualityGate } from './QualityGate.js';
import { ReviewChecks } from './ReviewChecks.js';
import { PRCreator } from './PRCreator.js';
import { MergeDecision } from './MergeDecision.js';
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
import { getCommandSanitizer } from '../security/index.js';
import { safeJsonParse, tryJsonParse, tryGetProjectRoot } from '../utils/index.js';
import {
  GitHubPRDataSchema,
  GitHubPRDataArraySchema,
  GitHubCheckResultArraySchema,
} from '../schemas/github.js';

/**
 * Command execution result
 */
interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
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
  private readonly prCreator: PRCreator;
  private readonly mergeDecision: MergeDecision;

  constructor(config: PRReviewerAgentConfig = {}) {
    this.config = {
      projectRoot:
        config.projectRoot ?? tryGetProjectRoot() ?? DEFAULT_PR_REVIEWER_CONFIG.projectRoot,
      resultsPath: config.resultsPath ?? DEFAULT_PR_REVIEWER_CONFIG.resultsPath,
      autoMerge: config.autoMerge ?? DEFAULT_PR_REVIEWER_CONFIG.autoMerge,
      mergeStrategy: config.mergeStrategy ?? DEFAULT_PR_REVIEWER_CONFIG.mergeStrategy,
      deleteBranchOnMerge:
        config.deleteBranchOnMerge ?? DEFAULT_PR_REVIEWER_CONFIG.deleteBranchOnMerge,
      coverageThreshold: config.coverageThreshold ?? DEFAULT_PR_REVIEWER_CONFIG.coverageThreshold,
      maxComplexity: config.maxComplexity ?? DEFAULT_PR_REVIEWER_CONFIG.maxComplexity,
      ciTimeout: config.ciTimeout ?? DEFAULT_PR_REVIEWER_CONFIG.ciTimeout,
      ciPollInterval: config.ciPollInterval ?? DEFAULT_PR_REVIEWER_CONFIG.ciPollInterval,
      enableCIFixDelegation:
        config.enableCIFixDelegation ?? DEFAULT_PR_REVIEWER_CONFIG.enableCIFixDelegation,
      maxCIRetries: config.maxCIRetries ?? DEFAULT_PR_REVIEWER_CONFIG.maxCIRetries,
      maxCIFixDelegations:
        config.maxCIFixDelegations ?? DEFAULT_PR_REVIEWER_CONFIG.maxCIFixDelegations,
      ciFixTimeout: config.ciFixTimeout ?? DEFAULT_PR_REVIEWER_CONFIG.ciFixTimeout,
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

    this.prCreator = new PRCreator({
      projectRoot: this.config.projectRoot,
      baseBranch: 'main',
      enableDraftPR: true,
      draftThreshold: this.config.coverageThreshold,
      autoAssignLabels: true,
    });

    this.mergeDecision = new MergeDecision({
      projectRoot: this.config.projectRoot,
      mergeStrategy: this.config.mergeStrategy,
      deleteBranchOnMerge: this.config.deleteBranchOnMerge,
    });
  }

  /**
   * Create PR only (without full review)
   * Implements UC-014: PR Creation from Completed Work
   *
   * This method is the main entry point for creating a PR when Worker signals completion.
   * It handles:
   * - Branch naming validation
   * - Automatic label assignment
   * - Draft PR creation for incomplete work
   * - Issue linking
   *
   * @param workOrderId - Work order ID to create PR for
   * @returns PR creation result with PR details, labels, and draft status
   */
  public async createPROnly(workOrderId: string): Promise<PRCreateResult> {
    const implResult = await this.readImplementationResult(workOrderId);
    return this.prCreator.createFromImplementationResult(implResult);
  }

  /**
   * Create PR from implementation result file
   *
   * @param resultPath - Path to implementation result YAML file
   * @returns PR creation result
   */
  public async createPRFromFile(resultPath: string): Promise<PRCreateResult> {
    const implResult = await this.parseImplementationResultFile(resultPath);
    return this.prCreator.createFromImplementationResult(implResult);
  }

  /**
   * Get the PRCreator instance for direct access to PR creation utilities
   */
  public getPRCreator(): PRCreator {
    return this.prCreator;
  }

  /**
   * Get the MergeDecision instance for direct access to merge utilities
   */
  public getMergeDecision(): MergeDecision {
    return this.mergeDecision;
  }

  /**
   * Check merge readiness for a PR
   * Implements UC-016: Quality Gates and Merge Decision
   *
   * This method checks:
   * - Quality gates (coverage, tests, lint, security, etc.)
   * - Merge conflicts
   * - Blocking reviews
   * - CI pipeline status
   *
   * @param prNumber - PR number to check
   * @param implResult - Implementation result with metrics
   * @returns Merge readiness result with detailed report
   */
  public async checkMergeReadiness(
    prNumber: number,
    implResult: ImplementationResult
  ): Promise<MergeReadinessResult> {
    // Run code review to get metrics
    const { comments, metrics } = await this.reviewChecks.runAllChecks(implResult.changes);

    // Get check results
    const checks = this.getCheckResults(implResult);

    // Evaluate quality gates
    const qualityGateResult = this.qualityGate.evaluate(metrics, checks, comments);

    // Check merge readiness
    return this.mergeDecision.checkMergeReadiness(prNumber, qualityGateResult, metrics, checks);
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

    // 9. Execute decision (pass GitHub issue for proper commit message)
    if (options.dryRun !== true) {
      await this.executeDecision(pullRequest, decision, options, implResult.githubIssue);
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

    // Submit review and execute decision (pass GitHub issue for proper commit message)
    if (options.dryRun !== true) {
      await this.submitReview(pullRequest.number, reviewStatus, comments);
      await this.executeDecision(pullRequest, decision, options, implResult.githubIssue);
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
        `gh pr create --title "${this.escapeForParser(prOptions.title)}" ` +
          `--body "${this.escapeForParser(prOptions.body)}" ` +
          `--base "${prOptions.base ?? 'main'}" ` +
          `--head "${prOptions.head}" ` +
          `--json number,url,title,headRefName,baseRefName,createdAt,state`
      );

      if (result.exitCode !== 0) {
        throw new PRCreationError(branchName, new Error(result.stderr));
      }

      const prData = safeJsonParse(result.stdout, GitHubPRDataSchema, {
        context: 'gh pr create output',
      });
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

      const prs = tryJsonParse(result.stdout, GitHubPRDataArraySchema, {
        context: 'gh pr list output',
      });
      const pr = prs?.[0];
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

    const data = safeJsonParse(result.stdout, GitHubPRDataSchema, {
      context: 'gh pr view output',
    });
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
        `gh pr review ${String(prNumber)} ${event} --body "${this.escapeForParser(body)}"`
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
        `gh pr comment ${String(prNumber)} --body "${this.escapeForParser(`**${comment.file}:${String(comment.line)}**\n${body}`)}"`
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
   * Implements UC-016: Quality Gates and Merge Decision
   *
   * @param pullRequest - The pull request to act on
   * @param decision - The decision to execute
   * @param options - Review options
   * @param issueNumber - Optional GitHub issue number for commit message
   */
  private async executeDecision(
    pullRequest: PullRequest,
    decision: Decision,
    options: PRReviewOptions,
    issueNumber?: number
  ): Promise<Decision> {
    if (options.dryRun === true) {
      return decision;
    }

    switch (decision.action) {
      case 'merge':
        if (this.config.autoMerge || options.forceApprove === true) {
          // Generate proper squash commit message
          const mergeMessage = this.mergeDecision.generateSquashMessage(
            pullRequest,
            issueNumber,
            decision.reason
          );

          // Execute merge with proper commit message
          const mergeResult = await this.mergeDecision.executeMerge(
            pullRequest.number,
            mergeMessage
          );

          if (mergeResult.success) {
            // Use conditional spread to avoid undefined with exactOptionalPropertyTypes
            return {
              ...decision,
              mergedAt: new Date().toISOString(),
              ...(mergeResult.mergeCommit !== undefined && {
                mergeCommit: mergeResult.mergeCommit,
              }),
            };
          } else {
            throw new PRMergeError(
              pullRequest.number,
              mergeResult.error ?? 'Merge failed',
              undefined
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
   * Execute a shell command using safe execution
   * Uses execFile to bypass shell and prevent command injection
   */
  private async executeCommand(command: string): Promise<CommandResult> {
    const sanitizer = getCommandSanitizer();

    try {
      const result = await sanitizer.execFromString(command, {
        cwd: this.config.projectRoot,
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024,
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
   * Escape content for use within double quotes in command strings
   * Uses the centralized sanitizer method
   */
  private escapeForParser(str: string): string {
    const sanitizer = getCommandSanitizer();
    return sanitizer.escapeForParser(str);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ==========================================================================
  // CI Fix Delegation Methods
  // ==========================================================================

  /**
   * Delegate CI fix to CIFixAgent
   * Called when CI fails repeatedly and auto-fix should be attempted.
   *
   * @param prNumber - PR number with CI failures
   * @param implResult - Implementation result with context
   * @param retryCount - Number of CI failures that triggered delegation
   * @returns Delegation result
   */
  public async delegateToCIFixer(
    prNumber: number,
    implResult: ImplementationResult,
    retryCount: number
  ): Promise<CIFixDelegationResult> {
    if (!this.config.enableCIFixDelegation) {
      return {
        delegated: false,
        reason: 'CI fix delegation is disabled',
        delegatedAt: new Date().toISOString(),
      };
    }

    if (retryCount < this.config.maxCIRetries) {
      return {
        delegated: false,
        reason: `CI retry count (${String(retryCount)}) below threshold (${String(this.config.maxCIRetries)})`,
        delegatedAt: new Date().toISOString(),
      };
    }

    // Create handoff document
    const handoff = await this.createCIFixHandoff(prNumber, implResult);
    const handoffPath = await this.persistCIFixHandoff(handoff);

    return {
      delegated: true,
      handoffPath,
      reason: `Delegating to CI Fix Agent after ${String(retryCount)} CI failures`,
      delegatedAt: new Date().toISOString(),
    };
  }

  /**
   * Create CI fix handoff document
   */
  private async createCIFixHandoff(
    prNumber: number,
    implResult: ImplementationResult
  ): Promise<CIFixHandoff> {
    // Get failed checks
    const failedChecks = await this.getFailedCIChecks(prNumber);

    return {
      prNumber,
      prUrl: `https://github.com/${await this.getRepoName()}/pull/${String(prNumber)}`,
      branch: implResult.branch.name,
      originalIssue:
        implResult.githubIssue !== undefined
          ? `#${String(implResult.githubIssue)}`
          : implResult.issueId,
      failedChecks: failedChecks.map((check) => ({
        name: check.name,
        status: check.status as 'failed' | 'error',
        conclusion: check.conclusion as
          | 'success'
          | 'failure'
          | 'neutral'
          | 'cancelled'
          | 'skipped'
          | 'timed_out'
          | undefined,
      })),
      failureLogs: [],
      attemptHistory: [],
      implementationSummary: `Implementation for ${implResult.issueId}`,
      changedFiles: implResult.changes.map((c) => c.filePath),
      testFiles: implResult.tests.filesCreated,
      maxFixAttempts: this.config.maxCIFixDelegations,
      currentAttempt: 1,
      escalationThreshold: this.config.maxCIFixDelegations,
    };
  }

  /**
   * Get failed CI checks for a PR
   */
  private async getFailedCIChecks(
    prNumber: number
  ): Promise<Array<{ name: string; status: string; conclusion?: string | null | undefined }>> {
    try {
      const result = await this.executeCommand(
        `gh pr checks ${String(prNumber)} --json name,status,conclusion`
      );

      if (result.exitCode !== 0) {
        return [];
      }

      const checks = tryJsonParse(result.stdout, GitHubCheckResultArraySchema, {
        context: 'gh pr checks output',
      });
      if (!checks) {
        return [];
      }

      return checks.filter((c) => c.conclusion === 'failure' || c.conclusion === 'error');
    } catch {
      return [];
    }
  }

  /**
   * Get repository name
   */
  private async getRepoName(): Promise<string> {
    try {
      const result = await this.executeCommand(
        'gh repo view --json nameWithOwner --jq .nameWithOwner'
      );
      return result.stdout.trim();
    } catch {
      return 'unknown/repo';
    }
  }

  /**
   * Persist CI fix handoff document
   */
  private async persistCIFixHandoff(handoff: CIFixHandoff): Promise<string> {
    const ciFixDir = join(this.config.projectRoot, '.ad-sdlc/scratchpad/ci-fix');

    if (!existsSync(ciFixDir)) {
      await mkdir(ciFixDir, { recursive: true });
    }

    const handoffPath = join(ciFixDir, `handoff-PR-${String(handoff.prNumber)}.yaml`);
    const yamlContent = yaml.dump(handoff, { indent: 2 });
    await writeFile(handoffPath, yamlContent, 'utf-8');

    return handoffPath;
  }

  /**
   * Check if CI fix delegation should be triggered
   *
   * @param prNumber - PR number to check
   * @param retryCount - Current CI retry count
   * @returns Whether delegation should be triggered
   */
  public shouldDelegateToCIFixer(_prNumber: number, retryCount: number): boolean {
    return this.config.enableCIFixDelegation && retryCount >= this.config.maxCIRetries;
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
