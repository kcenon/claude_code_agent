/**
 * Validation Agent
 *
 * Validates pipeline outputs by checking requirement implementation status,
 * acceptance criteria satisfaction, traceability chain completeness, and
 * quality gate results. Produces a comprehensive ValidationReport.
 *
 * Implements IAgent interface for AgentFactory integration.
 *
 * @module validation-agent/ValidationAgent
 */

import type { IAgent } from '../agents/types.js';
import { getLogger } from '../logging/index.js';
import type { Logger } from '../logging/index.js';
import type { RtmEntry, RtmGap, RequirementsTraceabilityMatrix } from '../rtm-builder/types.js';
import type { VnvRigor, OverallResult } from '../vnv/types.js';
import { AcceptanceCriteriaValidator } from './AcceptanceCriteriaValidator.js';
import type {
  ValidationContext,
  ValidationReport,
  RequirementValidationSummary,
  AcceptanceCriteriaValidationSummary,
  TraceabilityValidationSummary,
  QualityGateResult,
  QualityGateValidationSummary,
} from './types.js';

// =============================================================================
// Constants
// =============================================================================

/**
 * Agent ID for ValidationAgent used in AgentFactory
 */
export const VALIDATION_AGENT_ID = 'validation-agent';

// =============================================================================
// Agent class
// =============================================================================

/**
 * Validation Agent
 *
 * Validates a pipeline run by analysing the RTM and producing a
 * comprehensive ValidationReport covering requirement coverage,
 * acceptance criteria, traceability chains, and quality gates.
 */
export class ValidationAgent implements IAgent {
  public readonly agentId = VALIDATION_AGENT_ID;
  public readonly name = 'Validation Agent';

  private initialized = false;
  private logger: Logger;
  private readonly acValidator: AcceptanceCriteriaValidator;

  constructor() {
    this.logger = getLogger();
    this.acValidator = new AcceptanceCriteriaValidator();
  }

  // ---------------------------------------------------------------------------
  // IAgent lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Initialize the agent
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    await Promise.resolve();
    this.initialized = true;
  }

  /**
   * Dispose of the agent and release resources
   */
  public async dispose(): Promise<void> {
    await Promise.resolve();
    this.initialized = false;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Validate a pipeline run and produce a ValidationReport.
   *
   * Steps:
   * 1. Requirement Validation — check RTM entries for implementation status
   * 2. Acceptance Criteria Validation — use AcceptanceCriteriaValidator
   * 3. Traceability Validation — check RTM chain completeness
   * 4. Quality Gate Validation — check quality gate results from implementations
   * 5. Determine overall result (pass/pass_with_warnings/fail)
   * 6. Generate recommendations based on findings
   * 7. Return ValidationReport
   *
   * @param context - Validation context including RTM and pipeline metadata
   * @returns Complete validation report
   */
  public validate(context: ValidationContext): Promise<ValidationReport> {
    const { projectId, pipelineId, rigor, rtm } = context;

    this.logger.info(`Starting validation for pipeline ${pipelineId} at rigor=${rigor}`);

    // 1. Requirement Validation
    const requirementValidation = this.validateRequirements(rtm.entries);

    // 2. Acceptance Criteria Validation
    const acceptanceCriteriaValidation = this.acValidator.validate(rtm.entries);

    // 3. Traceability Validation
    const traceabilityValidation = this.validateTraceability(rtm);

    // 4. Quality Gate Validation
    const qualityGateResults = this.validateQualityGates(rtm.entries);

    // 5. Determine overall result
    const overallResult = this.determineOverallResult(
      requirementValidation,
      acceptanceCriteriaValidation,
      traceabilityValidation,
      qualityGateResults,
      rtm.gaps,
      rigor
    );

    // 6. Generate recommendations
    const recommendations = this.generateRecommendations(
      requirementValidation,
      acceptanceCriteriaValidation,
      traceabilityValidation,
      qualityGateResults,
      rtm.entries
    );

    this.logger.info(`Validation complete: result=${overallResult}`);

    // 7. Return ValidationReport
    return Promise.resolve({
      reportId: `VR-${pipelineId}-${String(Date.now())}`,
      projectId,
      pipelineId,
      generatedAt: new Date().toISOString(),
      overallResult,
      rigor,
      requirementValidation,
      acceptanceCriteriaValidation,
      traceabilityValidation,
      qualityGateResults,
      recommendations,
    });
  }

  // ---------------------------------------------------------------------------
  // Private: Requirement Validation
  // ---------------------------------------------------------------------------

  /**
   * Validate requirement implementation coverage.
   *
   * Checks each RTM entry for implementation status and computes
   * coverage metrics.
   *
   * @param entries - RTM entries to validate
   * @returns Requirement validation summary
   */
  private validateRequirements(entries: readonly RtmEntry[]): RequirementValidationSummary {
    const totalRequirements = entries.length;
    const unimplementedRequirements: string[] = [];

    let implementedCount = 0;
    let verifiedCount = 0;

    for (const entry of entries) {
      const hasImplementations = entry.implementations.length > 0;
      const isImplemented =
        hasImplementations || entry.status === 'implemented' || entry.status === 'verified';

      if (isImplemented) {
        implementedCount++;
      } else {
        unimplementedRequirements.push(entry.requirementId);
      }

      if (entry.status === 'verified') {
        verifiedCount++;
      }
    }

    const coveragePercent =
      totalRequirements > 0 ? (implementedCount / totalRequirements) * 100 : 100;

    return {
      totalRequirements,
      implementedRequirements: implementedCount,
      verifiedRequirements: verifiedCount,
      unimplementedRequirements,
      coveragePercent,
    };
  }

  // ---------------------------------------------------------------------------
  // Private: Traceability Validation
  // ---------------------------------------------------------------------------

  /**
   * Validate traceability chain completeness using RTM coverage metrics and gaps.
   *
   * @param rtm - The complete RTM to analyse
   * @returns Traceability validation summary
   */
  private validateTraceability(rtm: RequirementsTraceabilityMatrix): TraceabilityValidationSummary {
    const { coverageMetrics, gaps } = rtm;

    const brokenLinks: string[] = [];
    const orphanArtifacts: string[] = [];

    for (const gap of gaps) {
      if (gap.type === 'broken_chain') {
        brokenLinks.push(gap.message);
      } else if (gap.type === 'orphan_component') {
        for (const id of gap.affectedIds) {
          orphanArtifacts.push(id);
        }
      }
    }

    const chainComplete = brokenLinks.length === 0 && orphanArtifacts.length === 0;

    return {
      chainComplete,
      brokenLinks,
      orphanArtifacts,
      forwardCoverage: coverageMetrics.forwardCoveragePercent,
      backwardCoverage: coverageMetrics.backwardCoveragePercent,
    };
  }

  // ---------------------------------------------------------------------------
  // Private: Quality Gate Validation
  // ---------------------------------------------------------------------------

  /**
   * Validate quality gates based on implementation results.
   *
   * Checks:
   * - All builds passed
   * - All tests passed
   * - No blocked implementations
   *
   * @param entries - RTM entries with implementation results
   * @returns Quality gate validation summary
   */
  private validateQualityGates(entries: readonly RtmEntry[]): QualityGateValidationSummary {
    const gateResults: QualityGateResult[] = [];

    // Gate 1: Build success
    const buildGate = this.checkBuildGate(entries);
    gateResults.push(buildGate);

    // Gate 2: Test success
    const testGate = this.checkTestGate(entries);
    gateResults.push(testGate);

    // Gate 3: No blocked implementations
    const blockedGate = this.checkBlockedGate(entries);
    gateResults.push(blockedGate);

    const allGatesPassed = gateResults.every((g) => g.passed);

    return {
      allGatesPassed,
      gateResults,
    };
  }

  /**
   * Check that all implementations have passing builds.
   * @param entries
   */
  private checkBuildGate(entries: readonly RtmEntry[]): QualityGateResult {
    const allImpls = entries.flatMap((e) => e.implementations);

    if (allImpls.length === 0) {
      return {
        gateName: 'build-success',
        passed: true,
        details: 'No implementations to verify',
      };
    }

    const failedBuilds = allImpls.filter((impl) => !impl.buildPassed);

    if (failedBuilds.length === 0) {
      return {
        gateName: 'build-success',
        passed: true,
        details: `All ${String(allImpls.length)} implementation(s) have passing builds`,
      };
    }

    return {
      gateName: 'build-success',
      passed: false,
      details: `${String(failedBuilds.length)} of ${String(allImpls.length)} implementation(s) have failing builds`,
    };
  }

  /**
   * Check that all implementations have passing tests.
   * @param entries
   */
  private checkTestGate(entries: readonly RtmEntry[]): QualityGateResult {
    const allImpls = entries.flatMap((e) => e.implementations);

    if (allImpls.length === 0) {
      return {
        gateName: 'test-success',
        passed: true,
        details: 'No implementations to verify',
      };
    }

    const failedTests = allImpls.filter((impl) => !impl.testsPassed);

    if (failedTests.length === 0) {
      return {
        gateName: 'test-success',
        passed: true,
        details: `All ${String(allImpls.length)} implementation(s) have passing tests`,
      };
    }

    return {
      gateName: 'test-success',
      passed: false,
      details: `${String(failedTests.length)} of ${String(allImpls.length)} implementation(s) have failing tests`,
    };
  }

  /**
   * Check that no implementations are blocked.
   * @param entries
   */
  private checkBlockedGate(entries: readonly RtmEntry[]): QualityGateResult {
    const allImpls = entries.flatMap((e) => e.implementations);

    if (allImpls.length === 0) {
      return {
        gateName: 'no-blocked-implementations',
        passed: true,
        details: 'No implementations to verify',
      };
    }

    const blockedImpls = allImpls.filter((impl) => impl.status === 'blocked');

    if (blockedImpls.length === 0) {
      return {
        gateName: 'no-blocked-implementations',
        passed: true,
        details: `No blocked implementations out of ${String(allImpls.length)}`,
      };
    }

    return {
      gateName: 'no-blocked-implementations',
      passed: false,
      details: `${String(blockedImpls.length)} of ${String(allImpls.length)} implementation(s) are blocked`,
    };
  }

  // ---------------------------------------------------------------------------
  // Private: Overall Result Determination
  // ---------------------------------------------------------------------------

  /**
   * Determine the overall validation result.
   *
   * - `pass`: All requirements implemented, all AC pass, no error-severity gaps,
   *           all quality gates pass
   * - `pass_with_warnings`: All critical checks pass but warnings exist
   *           (e.g., some AC untested, coverage < 100%, warning-severity gaps)
   * - `fail`: Any critical check fails (unimplemented P0/P1 requirements,
   *           failed AC for P0/P1, error-severity gaps)
   * @param reqValidation
   * @param acValidation
   * @param traceValidation
   * @param qgValidation
   * @param gaps
   * @param _rigor
   */
  private determineOverallResult(
    reqValidation: RequirementValidationSummary,
    acValidation: AcceptanceCriteriaValidationSummary,
    traceValidation: TraceabilityValidationSummary,
    qgValidation: QualityGateValidationSummary,
    gaps: readonly RtmGap[],
    _rigor: VnvRigor
  ): OverallResult {
    // Check for hard failures
    const hasErrorGaps = gaps.some((g) => g.severity === 'error');
    const hasFailedAC = acValidation.failedCriteria.length > 0;
    const hasUnimplemented = reqValidation.unimplementedRequirements.length > 0;
    const qualityGatesFailed = !qgValidation.allGatesPassed;

    if (hasErrorGaps || hasFailedAC || qualityGatesFailed) {
      return 'fail';
    }

    if (hasUnimplemented) {
      return 'fail';
    }

    // Check for warnings
    const hasWarningGaps = gaps.some((g) => g.severity === 'warning');
    const hasUntestedAC = acValidation.untestedCriteria.length > 0;
    const coverageBelow100 = reqValidation.coveragePercent < 100;
    const chainIncomplete = !traceValidation.chainComplete;

    if (hasWarningGaps || hasUntestedAC || coverageBelow100 || chainIncomplete) {
      return 'pass_with_warnings';
    }

    return 'pass';
  }

  // ---------------------------------------------------------------------------
  // Private: Recommendation Generation
  // ---------------------------------------------------------------------------

  /**
   * Generate actionable recommendations based on validation findings.
   *
   * @param reqValidation - Requirement validation summary
   * @param acValidation - Acceptance criteria validation summary
   * @param traceValidation - Traceability validation summary
   * @param qgValidation - Quality gate validation summary
   * @param entries - RTM entries for requirement context
   * @returns List of actionable recommendation strings
   */
  private generateRecommendations(
    reqValidation: RequirementValidationSummary,
    acValidation: AcceptanceCriteriaValidationSummary,
    traceValidation: TraceabilityValidationSummary,
    qgValidation: QualityGateValidationSummary,
    entries: readonly RtmEntry[]
  ): readonly string[] {
    const recommendations: string[] = [];
    const entryMap = new Map(entries.map((e) => [e.requirementId, e]));

    // Unimplemented requirements
    for (const reqId of reqValidation.unimplementedRequirements) {
      const entry = entryMap.get(reqId);
      const title = entry?.requirementTitle ?? 'unknown';
      recommendations.push(`Implement requirement ${reqId}: ${title}`);
    }

    // Failed acceptance criteria
    for (const failedAC of acValidation.failedCriteria) {
      recommendations.push(
        `Fix acceptance criterion ${failedAC.criterionId} for ${failedAC.requirementId}: ${failedAC.description}`
      );
    }

    // Untested acceptance criteria
    if (acValidation.untestedCriteria.length > 0) {
      recommendations.push(
        `Test untested acceptance criteria: ${acValidation.untestedCriteria.join(', ')}`
      );
    }

    // Broken traceability chains
    for (const link of traceValidation.brokenLinks) {
      recommendations.push(`Resolve traceability gap: ${link}`);
    }

    // Orphan artifacts
    if (traceValidation.orphanArtifacts.length > 0) {
      recommendations.push(
        `Link orphan artifacts to requirements: ${traceValidation.orphanArtifacts.join(', ')}`
      );
    }

    // Low coverage
    if (traceValidation.forwardCoverage < 100) {
      recommendations.push(
        `Increase forward traceability coverage from ${traceValidation.forwardCoverage.toFixed(1)}% to meet threshold`
      );
    }

    if (traceValidation.backwardCoverage < 100) {
      recommendations.push(
        `Increase backward traceability coverage from ${traceValidation.backwardCoverage.toFixed(1)}% to meet threshold`
      );
    }

    // Failed quality gates
    for (const gate of qgValidation.gateResults) {
      if (!gate.passed) {
        recommendations.push(`Fix quality gate "${gate.gateName}": ${gate.details}`);
      }
    }

    return recommendations;
  }
}

// =============================================================================
// Singleton
// =============================================================================

/** Singleton instance */
let instance: ValidationAgent | null = null;

/**
 * Get the singleton instance of ValidationAgent
 *
 * @returns The singleton instance
 */
export function getValidationAgent(): ValidationAgent {
  if (instance === null) {
    instance = new ValidationAgent();
  }
  return instance;
}

/**
 * Reset the singleton instance (mainly for testing)
 */
export function resetValidationAgent(): void {
  instance = null;
}
