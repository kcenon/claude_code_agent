/**
 * Merge Decision module
 *
 * Implements UC-016: Quality Gates and Merge Decision
 * Handles merge conflict detection, blocking review checks,
 * detailed gate failure reports, and squash commit message generation.
 *
 * @module pr-reviewer/MergeDecision
 */

import type {
  MergeConflictInfo,
  BlockingReview,
  GateResult,
  DetailedGateReport,
  MergeReadinessResult,
  SquashMergeMessage,
  QualityGateResult,
  QualityMetrics,
  CheckResults,
  PullRequest,
} from './types.js';
import { getCommandSanitizer } from '../security/index.js';
import { tryJsonParse, tryGetProjectRoot } from '../utils/index.js';
import {
  GitHubMergeInfoSchema,
  GitHubReviewsResponseSchema,
  type GitHubReview,
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
 * Merge Decision configuration
 */
export interface MergeDecisionConfig {
  /** Project root directory */
  readonly projectRoot?: string;
  /** Merge strategy */
  readonly mergeStrategy?: 'merge' | 'squash' | 'rebase';
  /** Delete branch after merge */
  readonly deleteBranchOnMerge?: boolean;
  /** Command timeout in milliseconds */
  readonly commandTimeout?: number;
}

/**
 * Default merge decision configuration
 */
const DEFAULT_CONFIG: Required<MergeDecisionConfig> = {
  projectRoot: process.cwd(),
  mergeStrategy: 'squash',
  deleteBranchOnMerge: true,
  commandTimeout: 30000,
};

/**
 * Merge Decision Manager
 *
 * Evaluates merge readiness and generates detailed reports
 * for the PR review process.
 */
export class MergeDecision {
  private readonly config: Required<MergeDecisionConfig>;

  constructor(config: MergeDecisionConfig = {}) {
    this.config = {
      projectRoot: config.projectRoot ?? tryGetProjectRoot() ?? DEFAULT_CONFIG.projectRoot,
      mergeStrategy: config.mergeStrategy ?? DEFAULT_CONFIG.mergeStrategy,
      deleteBranchOnMerge: config.deleteBranchOnMerge ?? DEFAULT_CONFIG.deleteBranchOnMerge,
      commandTimeout: config.commandTimeout ?? DEFAULT_CONFIG.commandTimeout,
    };
  }

  /**
   * Check for merge conflicts on a PR
   * @param prNumber - Pull request number to check for conflicts
   * @returns Merge conflict details including conflicting files and mergeable state
   */
  public async checkMergeConflicts(prNumber: number): Promise<MergeConflictInfo> {
    try {
      const result = await this.executeCommand(
        `gh pr view ${String(prNumber)} --json mergeable,mergeStateStatus,files`
      );

      if (result.exitCode !== 0) {
        return {
          hasConflicts: false,
          conflictingFiles: [],
          mergeable: false,
          mergeableState: 'unknown',
        };
      }

      const data = tryJsonParse(result.stdout, GitHubMergeInfoSchema, {
        context: 'gh pr view merge info',
      });
      if (!data) {
        return {
          hasConflicts: false,
          conflictingFiles: [],
          mergeable: false,
          mergeableState: 'unknown',
        };
      }

      const mergeableState = this.mapMergeableState(data.mergeableState);
      const hasConflicts = mergeableState === 'dirty';

      // Get conflicting files if any
      const conflictingFiles: string[] = [];
      if (hasConflicts && data.files) {
        for (const file of data.files) {
          if (file.status === 'conflicted') {
            conflictingFiles.push(file.filename);
          }
        }
      }

      return {
        hasConflicts,
        conflictingFiles,
        mergeable: data.mergeable === true,
        mergeableState,
      };
    } catch {
      return {
        hasConflicts: false,
        conflictingFiles: [],
        mergeable: false,
        mergeableState: 'unknown',
      };
    }
  }

  /**
   * Check for unresolved blocking reviews
   * @param prNumber - Pull request number to check for blocking reviews
   * @returns List of reviews with CHANGES_REQUESTED status from latest review per reviewer
   */
  public async checkBlockingReviews(prNumber: number): Promise<readonly BlockingReview[]> {
    try {
      const result = await this.executeCommand(`gh pr view ${String(prNumber)} --json reviews`);

      if (result.exitCode !== 0) {
        return [];
      }

      const data = tryJsonParse(result.stdout, GitHubReviewsResponseSchema, {
        context: 'gh pr view reviews',
      });
      const reviews = data?.reviews ?? [];

      // Filter for blocking reviews (CHANGES_REQUESTED)
      const blockingReviews: BlockingReview[] = [];
      const reviewerState = new Map<string, GitHubReview>();

      // Get the latest review state per reviewer
      for (const review of reviews) {
        const author = review.author.login;
        const existing = reviewerState.get(author);

        // Keep the most recent review per reviewer
        if (!existing || new Date(review.submittedAt) > new Date(existing.submittedAt)) {
          reviewerState.set(author, review);
        }
      }

      // Collect blocking reviews
      for (const review of reviewerState.values()) {
        if (review.state === 'CHANGES_REQUESTED') {
          blockingReviews.push({
            author: review.author.login,
            state: 'CHANGES_REQUESTED',
            body: review.body,
            submittedAt: review.submittedAt,
          });
        }
      }

      return blockingReviews;
    } catch {
      return [];
    }
  }

  /**
   * Generate detailed gate failure report
   * @param prNumber - Pull request number for the report header
   * @param qualityGateResult - Aggregated pass/fail result with failure messages and warnings
   * @param metrics - Measured quality metrics including coverage, complexity, and security issues
   * @param checks - CI check statuses for tests, build, and lint
   * @returns Detailed report with gate statuses, required actions, and markdown summary
   */
  public generateDetailedReport(
    prNumber: number,
    qualityGateResult: QualityGateResult,
    metrics: QualityMetrics,
    checks: CheckResults
  ): DetailedGateReport {
    const gates: GateResult[] = [];
    const requiredActions: string[] = [];
    const recommendations: string[] = [];

    // Build gate results from required gates
    gates.push(
      this.buildGateResult(
        'Tests Pass',
        checks.testsPassed,
        'pass',
        checks.testsPassed ? 'pass' : 'fail',
        'status',
        true
      )
    );
    gates.push(
      this.buildGateResult(
        'Build Pass',
        checks.buildPassed,
        'pass',
        checks.buildPassed ? 'pass' : 'fail',
        'status',
        true
      )
    );
    gates.push(
      this.buildGateResult(
        'Lint Pass',
        checks.lintPassed,
        'pass',
        checks.lintPassed ? 'pass' : 'fail',
        'status',
        true
      )
    );
    gates.push(
      this.buildGateResult(
        'Code Coverage',
        metrics.codeCoverage >= 80,
        '≥80',
        metrics.codeCoverage,
        'percentage',
        true
      )
    );
    gates.push(
      this.buildGateResult(
        'Security (Critical)',
        metrics.securityIssues.critical === 0,
        '0',
        metrics.securityIssues.critical,
        'count',
        true
      )
    );
    gates.push(
      this.buildGateResult(
        'Security (High)',
        metrics.securityIssues.high === 0,
        '0',
        metrics.securityIssues.high,
        'count',
        true
      )
    );

    // Build gate results from recommended gates
    gates.push(
      this.buildGateResult(
        'New Lines Coverage',
        metrics.newLinesCoverage >= 90,
        '≥90',
        metrics.newLinesCoverage,
        'percentage',
        false
      )
    );
    gates.push(
      this.buildGateResult(
        'Complexity',
        metrics.complexityScore <= 10,
        '≤10',
        metrics.complexityScore,
        'number',
        false
      )
    );
    gates.push(
      this.buildGateResult(
        'Style Violations',
        metrics.styleViolations === 0,
        '0',
        metrics.styleViolations,
        'count',
        false
      )
    );

    // Generate required actions from failures
    for (const gate of gates) {
      if (!gate.passed && gate.blocking) {
        requiredActions.push(this.generateActionForGate(gate));
      }
    }

    // Generate recommendations from warnings
    for (const gate of gates) {
      if (!gate.passed && !gate.blocking) {
        recommendations.push(this.generateRecommendationForGate(gate));
      }
    }

    // Add quality gate failures as required actions
    for (const failure of qualityGateResult.failures) {
      if (!requiredActions.includes(failure)) {
        requiredActions.push(failure);
      }
    }

    // Add quality gate warnings as recommendations
    for (const warning of qualityGateResult.warnings) {
      if (!recommendations.includes(warning)) {
        recommendations.push(warning);
      }
    }

    // Generate markdown report
    const markdown = this.generateMarkdownReport(prNumber, gates, requiredActions, recommendations);

    return {
      generatedAt: new Date().toISOString(),
      prNumber,
      passed: qualityGateResult.passed,
      gates,
      requiredActions,
      recommendations,
      markdown,
    };
  }

  /**
   * Check overall merge readiness
   * @param prNumber - Pull request number to evaluate
   * @param qualityGateResult - Aggregated quality gate pass/fail result
   * @param metrics - Measured quality metrics for gate evaluation
   * @param checks - CI check statuses including test, build, and lint results
   * @returns Merge readiness assessment with blocking reasons and detailed report
   */
  public async checkMergeReadiness(
    prNumber: number,
    qualityGateResult: QualityGateResult,
    metrics: QualityMetrics,
    checks: CheckResults
  ): Promise<MergeReadinessResult> {
    // Check all conditions in parallel
    const [conflicts, blockingReviews] = await Promise.all([
      this.checkMergeConflicts(prNumber),
      this.checkBlockingReviews(prNumber),
    ]);

    const detailedReport = this.generateDetailedReport(
      prNumber,
      qualityGateResult,
      metrics,
      checks
    );

    // Collect blocking reasons
    const blockingReasons: string[] = [];

    if (!qualityGateResult.passed) {
      blockingReasons.push('Quality gates failed');
    }

    if (conflicts.hasConflicts) {
      blockingReasons.push(
        `Merge conflicts detected in ${String(conflicts.conflictingFiles.length)} file(s)`
      );
    }

    if (blockingReviews.length > 0) {
      blockingReasons.push(
        `${String(blockingReviews.length)} blocking review(s) requesting changes`
      );
    }

    if (!checks.ciPassed) {
      blockingReasons.push('CI pipeline failed');
    }

    if (!conflicts.mergeable && !conflicts.hasConflicts) {
      blockingReasons.push('PR is not in a mergeable state');
    }

    const canMerge = blockingReasons.length === 0;

    return {
      canMerge,
      qualityGates: qualityGateResult,
      conflicts,
      blockingReviews,
      ciPassed: checks.ciPassed,
      blockingReasons,
      detailedReport,
    };
  }

  /**
   * Generate squash merge commit message
   * @param pullRequest - PR metadata used to construct the commit title
   * @param issueNumber - Optional GitHub issue number to add a "Closes #N" reference
   * @param summary - Optional summary text to include in the commit body
   * @returns Formatted squash merge message with title, body, and linked issue numbers
   */
  public generateSquashMessage(
    pullRequest: PullRequest,
    issueNumber?: number,
    summary?: string
  ): SquashMergeMessage {
    const title = `${pullRequest.title} (#${String(pullRequest.number)})`;

    const bodyParts: string[] = [];

    if (summary !== undefined && summary !== '') {
      bodyParts.push(summary);
      bodyParts.push('');
    }

    const closesIssues: number[] = [];
    if (issueNumber !== undefined) {
      bodyParts.push(`Closes #${String(issueNumber)}`);
      closesIssues.push(issueNumber);
    }

    return {
      title,
      body: bodyParts.join('\n'),
      closesIssues,
    };
  }

  /**
   * Execute merge with proper commit message
   * @param prNumber - Pull request number to merge
   * @param message - Squash merge message containing title and body
   * @returns Result with success flag, optional merge commit SHA, and error message on failure
   */
  public async executeMerge(
    prNumber: number,
    message: SquashMergeMessage
  ): Promise<{ success: boolean; mergeCommit?: string; error?: string }> {
    try {
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

      // Build commit subject and body
      flags.push(`--subject "${this.escapeForParser(message.title)}"`);
      if (message.body) {
        flags.push(`--body "${this.escapeForParser(message.body)}"`);
      }

      const command = `gh pr merge ${String(prNumber)} ${flags.join(' ')}`;
      const result = await this.executeCommand(command);

      if (result.exitCode === 0) {
        // Extract merge commit from output if available
        const commitMatch = result.stdout.match(/([a-f0-9]{40})/);
        const commitSha = commitMatch?.[1];
        // Use conditional object to avoid undefined with exactOptionalPropertyTypes
        return commitSha !== undefined
          ? { success: true, mergeCommit: commitSha }
          : { success: true };
      }

      return {
        success: false,
        error: result.stderr || 'Unknown merge error',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Build a gate result object
   * @param gate - Quality gate name (e.g., "Tests Pass", "Code Coverage")
   * @param passed - Whether the gate condition was satisfied
   * @param threshold - Required threshold value for the gate
   * @param actual - Measured value to compare against the threshold
   * @param unit - Measurement unit (e.g., "percentage", "count", "status")
   * @param blocking - Whether failure of this gate blocks the merge
   * @returns Formatted gate result with status message
   */
  private buildGateResult(
    gate: string,
    passed: boolean,
    threshold: number | string,
    actual: number | string,
    unit: string,
    blocking: boolean
  ): GateResult {
    const status = passed ? '✅ PASSED' : blocking ? '❌ FAILED' : '⚠️ WARNING';
    return {
      gate,
      passed,
      threshold,
      actual,
      unit,
      blocking,
      message: `${gate}: ${String(actual)} (threshold: ${String(threshold)}) - ${status}`,
    };
  }

  /**
   * Generate action message for failed gate
   * @param gate - Failed gate result to generate an actionable message for
   * @returns Human-readable action describing what must be fixed before merge
   */
  private generateActionForGate(gate: GateResult): string {
    switch (gate.gate) {
      case 'Code Coverage':
        return `Increase test coverage to at least ${String(gate.threshold)}% (current: ${String(gate.actual)}%)`;
      case 'Tests Pass':
        return 'Fix failing tests before merge';
      case 'Build Pass':
        return 'Fix build errors before merge';
      case 'Lint Pass':
        return 'Fix linting errors before merge';
      case 'Security (Critical)':
        return `Fix ${String(gate.actual)} critical security issue(s)`;
      case 'Security (High)':
        return `Fix ${String(gate.actual)} high severity security issue(s)`;
      default:
        return `Fix ${gate.gate} issue (current: ${String(gate.actual)}, required: ${String(gate.threshold)})`;
    }
  }

  /**
   * Generate recommendation for warning gate
   * @param gate - Non-blocking gate result to generate a recommendation for
   * @returns Advisory message suggesting improvements for the non-blocking gate
   */
  private generateRecommendationForGate(gate: GateResult): string {
    switch (gate.gate) {
      case 'New Lines Coverage':
        return `Consider improving test coverage for new code (current: ${String(gate.actual)}%, recommended: ${String(gate.threshold)}%)`;
      case 'Complexity':
        return `Consider refactoring to reduce complexity (current: ${String(gate.actual)}, recommended: ≤${String(gate.threshold)})`;
      case 'Style Violations':
        return `Consider fixing ${String(gate.actual)} style violation(s)`;
      default:
        return `Consider improving ${gate.gate}`;
    }
  }

  /**
   * Generate markdown-formatted report
   * @param prNumber - Pull request number for the report heading
   * @param gates - All evaluated gate results to display in the status table
   * @param requiredActions - Blocking actions that must be resolved before merge
   * @param recommendations - Non-blocking suggestions for quality improvement
   * @returns Markdown string with gate status table, actions, and recommendations
   */
  private generateMarkdownReport(
    prNumber: number,
    gates: readonly GateResult[],
    requiredActions: readonly string[],
    recommendations: readonly string[]
  ): string {
    const lines: string[] = [];

    lines.push('## Quality Gate Report');
    lines.push('');
    lines.push(`**PR #${String(prNumber)}** - Generated at ${new Date().toISOString()}`);
    lines.push('');

    // Gate status table
    lines.push('### Gate Status');
    lines.push('');
    lines.push('| Gate | Threshold | Actual | Status |');
    lines.push('|------|-----------|--------|--------|');

    for (const gate of gates) {
      const status = gate.passed ? '✅ PASSED' : gate.blocking ? '❌ FAILED' : '⚠️ WARNING';
      lines.push(
        `| ${gate.gate} | ${String(gate.threshold)} | ${String(gate.actual)} | ${status} |`
      );
    }

    lines.push('');

    // Required actions
    if (requiredActions.length > 0) {
      lines.push('### Required Actions');
      lines.push('');
      for (let i = 0; i < requiredActions.length; i++) {
        const action = requiredActions[i];
        if (action !== undefined) {
          lines.push(`${String(i + 1)}. ${action}`);
        }
      }
      lines.push('');
    }

    // Recommendations
    if (recommendations.length > 0) {
      lines.push('### Recommendations');
      lines.push('');
      for (const rec of recommendations) {
        lines.push(`- ${rec}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Map GitHub mergeable state to our enum
   * @param state - GitHub API mergeStateStatus value (e.g., "CLEAN", "DIRTY", "BLOCKED")
   * @returns Normalized lowercase merge state or "unknown" for unrecognized values
   */
  private mapMergeableState(state?: string): 'clean' | 'dirty' | 'blocked' | 'behind' | 'unknown' {
    switch (state?.toUpperCase()) {
      case 'CLEAN':
        return 'clean';
      case 'DIRTY':
      case 'CONFLICTING':
        return 'dirty';
      case 'BLOCKED':
        return 'blocked';
      case 'BEHIND':
        return 'behind';
      default:
        return 'unknown';
    }
  }

  /**
   * Escape content for use within double quotes in command strings
   * Uses the centralized sanitizer method
   * @param str - Raw string to escape for safe inclusion in shell commands
   * @returns Escaped string safe for use within double-quoted command arguments
   */
  private escapeForParser(str: string): string {
    const sanitizer = getCommandSanitizer();
    return sanitizer.escapeForParser(str);
  }

  /**
   * Execute a shell command using safe execution
   * Uses execFile to bypass shell and prevent command injection
   * @param command - Shell command string to parse and execute safely
   * @returns Command result with stdout, stderr, and exit code
   */
  private async executeCommand(command: string): Promise<CommandResult> {
    const sanitizer = getCommandSanitizer();

    try {
      const result = await sanitizer.execFromString(command, {
        cwd: this.config.projectRoot,
        timeout: this.config.commandTimeout,
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
}
