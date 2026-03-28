/**
 * Local Review Agent - Performs code review without GitHub PR
 *
 * Alternative to PRReviewerAgent for local-only pipelines.
 * Reuses ReviewChecks (security, complexity, quality analysis) and
 * QualityGate (metric threshold evaluation) — both are fully local.
 *
 * Writes a review report to the scratchpad and optionally merges
 * the implementation branch to main via local `git merge`.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import type { IAgent } from '../agents/types.js';
import { ReviewChecks } from './ReviewChecks.js';
import type { ReviewChecksOptions } from './ReviewChecks.js';
import { QualityGate } from './QualityGate.js';
import type { QualityGateOptions } from './QualityGate.js';
import type {
  ReviewComment,
  QualityGateResult,
  QualityMetrics,
  CheckResults,
  ImplementationResult,
} from './types.js';
import { getCommandSanitizer } from '../security/index.js';
import { getLogger } from '../logging/index.js';

const logger = getLogger();

export const LOCAL_REVIEWER_ID = 'local-reviewer-agent';

/**
 * Result of a local code review
 */
export interface LocalReviewResult {
  /** Work order ID that was reviewed */
  readonly workOrderId: string;
  /** Overall review decision */
  readonly decision: 'approve' | 'request_changes';
  /** Quality gate evaluation result */
  readonly qualityGate: QualityGateResult;
  /** Review comments (security, quality, complexity findings) */
  readonly comments: readonly ReviewComment[];
  /** Path to the written review report JSON */
  readonly reportPath: string;
  /** Whether the branch was merged locally */
  readonly mergedLocally: boolean;
}

/**
 * Options for local review execution
 */
export interface LocalReviewOptions {
  /** Directory to write the review report */
  readonly outputDir: string;
  /** Merge branch to main after approval (default: false) */
  readonly autoMerge?: boolean;
  /** Project root for running checks (default: process.cwd()) */
  readonly projectRoot?: string;
  /** Work order ID for tracking */
  readonly workOrderId?: string;
}

/**
 * Performs local code review without GitHub integration.
 * Implements IAgent for pipeline compatibility.
 */
export class LocalReviewAgent implements IAgent {
  public readonly agentId = LOCAL_REVIEWER_ID;
  public readonly name = 'Local Review Agent';

  private reviewChecks: ReviewChecks | null = null;
  private qualityGate: QualityGate | null = null;

  /**
   *
   */
  initialize(): void {
    logger.debug('LocalReviewAgent initialized');
  }

  /**
   *
   */
  dispose(): void {
    this.reviewChecks = null;
    this.qualityGate = null;
    logger.debug('LocalReviewAgent disposed');
  }

  /**
   * Perform local code review on implementation results.
   *
   * @param implResult - Implementation result from worker agent
   * @param options - Review configuration
   * @returns LocalReviewResult with decision, comments, and report path
   */
  async reviewLocal(
    implResult: ImplementationResult,
    options: LocalReviewOptions
  ): Promise<LocalReviewResult> {
    const projectRoot = options.projectRoot ?? process.cwd();
    const workOrderId = options.workOrderId ?? 'unknown';

    logger.info(`Starting local review for work order ${workOrderId}`);

    // Initialize checks if needed
    if (!this.reviewChecks) {
      this.reviewChecks = new ReviewChecks({
        projectRoot,
        enableSecurityScan: true,
        enableComplexityAnalysis: true,
        enableTestingChecks: true,
        enableStaticAnalysis: true,
      } satisfies ReviewChecksOptions);
    }

    if (!this.qualityGate) {
      this.qualityGate = new QualityGate({} satisfies QualityGateOptions);
    }

    // 1. Run review checks on changed files
    const changes = implResult.changes;
    let comments: ReviewComment[] = [];
    let metrics: QualityMetrics = {
      codeCoverage: 0,
      newLinesCoverage: 0,
      complexityScore: 0,
      securityIssues: { critical: 0, high: 0, medium: 0, low: 0 },
      styleViolations: 0,
      testCount: 0,
    };

    if (changes.length > 0) {
      try {
        const result = await this.reviewChecks.runAllChecks(changes);
        comments = result.comments;
        metrics = result.metrics;
      } catch (err) {
        logger.warn(`Review checks failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 2. Evaluate quality gate
    const verification = implResult.verification;

    const checkResults: CheckResults = {
      ciPassed: verification.testsPassed && verification.lintPassed && verification.buildPassed,
      testsPassed: verification.testsPassed,
      lintPassed: verification.lintPassed,
      securityScanPassed: metrics.securityIssues.critical === 0,
      buildPassed: verification.buildPassed,
    };

    const qualityGate = this.qualityGate.evaluate(metrics, checkResults, comments);
    const decision = qualityGate.passed ? ('approve' as const) : ('request_changes' as const);

    logger.info(
      `Review decision: ${decision} (${String(qualityGate.failures.length)} failures, ${String(qualityGate.warnings.length)} warnings)`
    );

    // 3. Write review report
    await mkdir(options.outputDir, { recursive: true });
    const reportPath = join(options.outputDir, 'review_report.json');

    const report = {
      schemaVersion: '1.0',
      workOrderId,
      reviewedAt: new Date().toISOString(),
      decision,
      qualityGate: {
        passed: qualityGate.passed,
        failures: qualityGate.failures,
        warnings: qualityGate.warnings,
      },
      metrics,
      comments: comments.map((c) => ({
        file: c.file,
        line: c.line,
        severity: c.severity,
        comment: c.comment,
        suggestedFix: c.suggestedFix,
      })),
      summary: {
        totalComments: comments.length,
        critical: comments.filter((c) => c.severity === 'critical').length,
        major: comments.filter((c) => c.severity === 'major').length,
        minor: comments.filter((c) => c.severity === 'minor').length,
        suggestions: comments.filter((c) => c.severity === 'suggestion').length,
      },
    };

    await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
    logger.info(`Review report written to ${reportPath}`);

    // 4. Optional local merge
    let mergedLocally = false;
    if (options.autoMerge === true && decision === 'approve' && implResult.branch.name !== '') {
      mergedLocally = this.mergeLocally(implResult.branch.name, projectRoot);
    }

    return {
      workOrderId,
      decision,
      qualityGate,
      comments,
      reportPath,
      mergedLocally,
    };
  }

  /**
   * Merge a feature branch to main using local git.
   * @param branchName
   * @param projectRoot
   */
  private mergeLocally(branchName: string, projectRoot: string): boolean {
    try {
      const sanitizer = getCommandSanitizer();
      const mergeResult = sanitizer.execGitSync(['merge', branchName, '--no-edit'], {
        cwd: projectRoot,
      });

      if (mergeResult.success) {
        logger.info(`Merged branch ${branchName} to current branch locally`);
        return true;
      }

      logger.warn(`Local merge failed: ${mergeResult.stderr}`);
      return false;
    } catch (err) {
      logger.warn(`Local merge error: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }
}
