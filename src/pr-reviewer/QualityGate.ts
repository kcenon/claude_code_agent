/**
 * Quality Gate module
 *
 * Evaluates quality metrics against configured thresholds
 * and provides pass/fail decisions for PR reviews.
 */

import type {
  QualityGateConfig,
  QualityGateResult,
  QualityMetrics,
  CheckResults,
  ReviewComment,
  CommentSeverity,
} from './types.js';
import { DEFAULT_QUALITY_GATE_CONFIG } from './types.js';

/**
 * Quality Gate Options
 */
export interface QualityGateOptions {
  /** Custom quality gate configuration */
  readonly config?: Partial<QualityGateConfig>;
  /** Whether to include recommendations in evaluation */
  readonly includeRecommendations?: boolean;
}

/**
 * Quality Gate Evaluator
 *
 * Evaluates PR quality metrics against configurable thresholds
 * to determine if a PR meets the required quality standards.
 */
export class QualityGate {
  private readonly config: QualityGateConfig;
  private readonly includeRecommendations: boolean;

  constructor(options: QualityGateOptions = {}) {
    this.config = {
      required: {
        ...DEFAULT_QUALITY_GATE_CONFIG.required,
        ...options.config?.required,
      },
      recommended: {
        ...DEFAULT_QUALITY_GATE_CONFIG.recommended,
        ...options.config?.recommended,
      },
    };
    this.includeRecommendations = options.includeRecommendations ?? true;
  }

  /**
   * Evaluate quality metrics against quality gates
   */
  public evaluate(
    metrics: QualityMetrics,
    checks: CheckResults,
    comments: readonly ReviewComment[]
  ): QualityGateResult {
    const requiredGates = new Map<string, boolean>();
    const recommendedGates = new Map<string, boolean>();
    const failures: string[] = [];
    const warnings: string[] = [];

    // Evaluate required gates
    this.evaluateRequiredGates(metrics, checks, comments, requiredGates, failures);

    // Evaluate recommended gates
    if (this.includeRecommendations) {
      this.evaluateRecommendedGates(metrics, checks, comments, recommendedGates, warnings);
    }

    const passed = failures.length === 0;

    return {
      passed,
      requiredGates,
      recommendedGates,
      failures,
      warnings,
    };
  }

  /**
   * Evaluate required quality gates
   */
  private evaluateRequiredGates(
    metrics: QualityMetrics,
    checks: CheckResults,
    comments: readonly ReviewComment[],
    gates: Map<string, boolean>,
    failures: string[]
  ): void {
    const required = this.config.required;

    // Tests pass check
    if (required.testsPass !== undefined) {
      const passed = checks.testsPassed;
      gates.set('tests_pass', passed);
      if (!passed) {
        failures.push('Tests must pass');
      }
    }

    // Build pass check
    if (required.buildPass !== undefined) {
      const passed = checks.buildPassed;
      gates.set('build_pass', passed);
      if (!passed) {
        failures.push('Build must pass');
      }
    }

    // Lint pass check
    if (required.lintPass !== undefined) {
      const passed = checks.lintPassed;
      gates.set('lint_pass', passed);
      if (!passed) {
        failures.push('Lint must pass');
      }
    }

    // No critical security issues
    if (required.noCriticalSecurity !== undefined) {
      const passed = metrics.securityIssues.critical === 0;
      gates.set('no_critical_security', passed);
      if (!passed) {
        failures.push(`Critical security issues found: ${String(metrics.securityIssues.critical)}`);
      }
    }

    // No critical review issues
    if (required.noCriticalIssues !== undefined) {
      const criticalComments = this.countBySeverity(comments, 'critical');
      const passed = criticalComments === 0;
      gates.set('no_critical_issues', passed);
      if (!passed) {
        failures.push(`Critical review issues found: ${String(criticalComments)}`);
      }
    }

    // Code coverage threshold
    if (required.codeCoverage !== undefined) {
      const passed = metrics.codeCoverage >= required.codeCoverage;
      gates.set('code_coverage', passed);
      if (!passed) {
        failures.push(
          `Code coverage ${String(metrics.codeCoverage)}% is below required ${String(required.codeCoverage)}%`
        );
      }
    }
  }

  /**
   * Evaluate recommended quality gates
   */
  private evaluateRecommendedGates(
    metrics: QualityMetrics,
    checks: CheckResults,
    comments: readonly ReviewComment[],
    gates: Map<string, boolean>,
    warnings: string[]
  ): void {
    const recommended = this.config.recommended;

    // No major issues
    if (recommended.noMajorIssues !== undefined) {
      const majorComments = this.countBySeverity(comments, 'major');
      const passed = majorComments === 0;
      gates.set('no_major_issues', passed);
      if (!passed) {
        warnings.push(`Major review issues found: ${String(majorComments)}`);
      }
    }

    // New lines coverage
    if (recommended.newLinesCoverage !== undefined) {
      const passed = metrics.newLinesCoverage >= recommended.newLinesCoverage;
      gates.set('new_lines_coverage', passed);
      if (!passed) {
        warnings.push(
          `New lines coverage ${String(metrics.newLinesCoverage)}% is below recommended ${String(recommended.newLinesCoverage)}%`
        );
      }
    }

    // Complexity score
    if (recommended.maxComplexity !== undefined) {
      const passed = metrics.complexityScore <= recommended.maxComplexity;
      gates.set('max_complexity', passed);
      if (!passed) {
        warnings.push(
          `Complexity score ${String(metrics.complexityScore)} exceeds recommended max ${String(recommended.maxComplexity)}`
        );
      }
    }

    // Style violations
    if (recommended.noStyleViolations !== undefined) {
      const passed = metrics.styleViolations === 0;
      gates.set('no_style_violations', passed);
      if (!passed) {
        warnings.push(`Style violations found: ${String(metrics.styleViolations)}`);
      }
    }
  }

  /**
   * Count comments by severity
   */
  private countBySeverity(
    comments: readonly ReviewComment[],
    severity: CommentSeverity
  ): number {
    return comments.filter(
      (c) => c.severity === severity && !c.resolved
    ).length;
  }

  /**
   * Get human-readable summary of gate evaluation
   */
  public getSummary(result: QualityGateResult): string {
    const lines: string[] = [];

    if (result.passed) {
      lines.push('✅ All required quality gates passed');
    } else {
      lines.push('❌ Quality gates failed');
      lines.push('');
      lines.push('**Failures:**');
      for (const failure of result.failures) {
        lines.push(`- ${failure}`);
      }
    }

    if (result.warnings.length > 0) {
      lines.push('');
      lines.push('**Warnings:**');
      for (const warning of result.warnings) {
        lines.push(`- ⚠️ ${warning}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Get quality gate configuration
   */
  public getConfig(): QualityGateConfig {
    return this.config;
  }
}
