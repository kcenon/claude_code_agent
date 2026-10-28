/**
 * Stage Verifier Agent
 *
 * IAgent implementation that verifies pipeline stage outputs against
 * defined rules and performs cross-document consistency checks.
 *
 * This agent is invoked after each pipeline stage to validate that
 * the stage's artifacts meet quality, structure, traceability, and
 * content requirements at the configured rigor level.
 *
 * @module stage-verifier/StageVerifierAgent
 */

import path from 'node:path';

import type { IAgent } from '../agents/types.js';
import type { StageName, StageResult } from '../ad-sdlc-orchestrator/types.js';
import {
  buildTraceabilityRecord,
  locateDocuments,
  TRACEABILITY_BOUNDARY_STAGE,
  type TraceabilityRecord,
} from '../vnv/traceability.js';
import type { VerificationContext, DocumentType } from '../vnv/types.js';
import type {
  VerificationCheck,
  StageVerificationResult,
  ConsistencyCheckResult,
  SkippedVerificationRule,
  VerificationRuleContext,
} from './types.js';
import { shouldRunRule } from './rules.js';
import { verificationCheckSet, verificationDisposition } from './applicability.js';
import { checkCrossDocumentConsistency } from './consistency.js';

/**
 * Agent ID for StageVerifierAgent used in AgentFactory
 */
export const STAGE_VERIFIER_AGENT_ID = 'stage-verifier-agent';

/**
 * Stage Verifier Agent
 *
 * Validates pipeline stage outputs by executing verification rules
 * filtered by rigor level. Also provides cross-document consistency
 * checking for document-producing stages.
 *
 * Implements IAgent interface for unified agent instantiation through AgentFactory.
 */
export class StageVerifierAgent implements IAgent {
  public readonly agentId = STAGE_VERIFIER_AGENT_ID;
  public readonly name = 'Stage Verifier Agent';

  /**
   * Initialize the agent. No-op for StageVerifierAgent.
   */
  async initialize(): Promise<void> {
    // No initialization required
  }

  /**
   * Dispose of the agent. No-op for StageVerifierAgent.
   */
  async dispose(): Promise<void> {
    // No cleanup required
  }

  /**
   * Verify a completed pipeline stage against its verification disposition.
   *
   * The stage's disposition comes from `VERIFICATION_APPLICABILITY` for the
   * pipeline mode. A `not_applicable` stage passes with its documented
   * reason. A stage with a check set executes the rules that meet the rigor
   * threshold and records the filtered rules as skipped. A stage without a
   * disposition fails closed instead of passing silently.
   *
   * @param stageName - Name of the pipeline stage to verify
   * @param stageResult - The stage's execution result containing artifact paths
   * @param context - Verification context with rigor level and project directory
   * @returns Aggregated stage verification result
   * @throws StageVerificationError if rule execution encounters an unrecoverable error
   */
  async verifyStage(
    stageName: StageName,
    stageResult: StageResult,
    context: VerificationContext
  ): Promise<StageVerificationResult> {
    const startTime = Date.now();
    const checks: VerificationCheck[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];
    const finish = (
      passed: boolean,
      extra: Partial<
        Pick<
          StageVerificationResult,
          'checkSet' | 'notApplicableReason' | 'skippedRules' | 'traceability'
        >
      > = {}
    ): StageVerificationResult => ({
      stageName,
      passed,
      rigor: context.rigor,
      checks,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      ...extra,
    });

    const disposition = verificationDisposition(context.pipelineMode, stageName);
    if (disposition?.kind === 'not_applicable') {
      return finish(true, { notApplicableReason: disposition.reason });
    }
    const rules =
      disposition === undefined ? undefined : verificationCheckSet(disposition.checkSet);
    if (disposition === undefined || rules === undefined) {
      // Unclassified slots fail closed; the inventory check rejects them before release.
      errors.push(
        `No verification disposition for stage '${stageName}' in ${context.pipelineMode} mode`
      );
      return finish(false);
    }

    // Filter rules by rigor level; filtered rules are reported as skipped, never as passed.
    const applicableRules = rules.filter((rule) => shouldRunRule(rule.minRigor, context.rigor));
    const skippedRules: SkippedVerificationRule[] = rules
      .filter((rule) => !shouldRunRule(rule.minRigor, context.rigor))
      .map((rule) => ({
        checkId: rule.checkId,
        name: rule.name,
        severity: rule.severity,
        minRigor: rule.minRigor,
      }));

    const ruleContext = await this.ruleContext(stageName, stageResult, context);

    // Execute each applicable rule
    for (const rule of applicableRules) {
      try {
        const check = await rule.check(stageResult.artifacts, context.projectDir, ruleContext);
        checks.push(check);

        if (!check.passed) {
          if (check.severity === 'error') {
            errors.push(`[${check.checkId}] ${check.message}`);
          } else if (check.severity === 'warning') {
            warnings.push(`[${check.checkId}] ${check.message}`);
          }
        }
      } catch (err) {
        // Rule execution itself threw — record as a failed error-severity check
        const errorMessage = err instanceof Error ? err.message : String(err);
        const failedCheck: VerificationCheck = {
          checkId: rule.checkId,
          name: rule.name,
          category: rule.category,
          passed: false,
          severity: 'error',
          message: `Rule execution error: ${errorMessage}`,
          details: { error: errorMessage },
        };
        checks.push(failedCheck);
        errors.push(`[${rule.checkId}] Rule execution error: ${errorMessage}`);
      }
    }

    // Determine overall pass/fail:
    // Passed if no error-severity checks failed
    const hasErrorFailures = checks.some((c) => !c.passed && c.severity === 'error');
    return finish(!hasErrorFailures, {
      checkSet: disposition.checkSet,
      ...(skippedRules.length > 0 ? { skippedRules } : {}),
      ...(ruleContext.traceability !== undefined ? { traceability: ruleContext.traceability } : {}),
    });
  }

  /**
   * Context passed to every rule of a stage: the stage identity, the V&V
   * options, the run's documents, and, at the final validation stage, the
   * traceability record built from the run's artifacts.
   * @param stageName - Stage being verified
   * @param stageResult - The stage's execution result
   * @param context - Verification context
   * @returns Rule context
   */
  private async ruleContext(
    stageName: StageName,
    stageResult: StageResult,
    context: VerificationContext
  ): Promise<VerificationRuleContext> {
    const artifacts = [...(context.upstreamArtifacts ?? []), ...stageResult.artifacts];
    const base: VerificationRuleContext = {
      stageName,
      agentType: stageResult.agentType,
      pipelineMode: context.pipelineMode,
      ...(context.options !== undefined ? { options: context.options } : {}),
      documents: locateDocuments(artifacts),
    };
    const options = context.options;
    if (
      stageName !== TRACEABILITY_BOUNDARY_STAGE ||
      options === undefined ||
      (!options.acceptanceCriteriaValidation && !options.generateRtm)
    )
      return base;
    let traceability: TraceabilityRecord;
    try {
      traceability = await buildTraceabilityRecord({
        projectDir: context.projectDir,
        projectId: context.projectId || path.basename(context.projectDir),
        mode: context.pipelineMode,
        artifacts,
      });
    } catch (error: unknown) {
      return {
        ...base,
        traceabilityError: error instanceof Error ? error.message : String(error),
      };
    }
    return { ...base, traceability };
  }

  /**
   * Verify cross-document consistency using sync points.
   *
   * Reads `doc-sync-points.yaml` from the project root and checks that
   * referenced values are consistent across PRD, SRS, and SDS documents.
   *
   * @param projectDir - Absolute path to the project root
   * @param _modifiedDocument - The document type that was just modified
   * @param documents - Document locations; defaults to `docs/PRD.md`, `docs/SRS.md`, `docs/SDS.md`
   * @returns Consistency check result with any violations found
   */
  async verifyCrossDocumentConsistency(
    projectDir: string,
    _modifiedDocument: DocumentType,
    documents?: Readonly<Partial<Record<DocumentType, string>>>
  ): Promise<ConsistencyCheckResult> {
    return checkCrossDocumentConsistency(projectDir, documents);
  }
}
