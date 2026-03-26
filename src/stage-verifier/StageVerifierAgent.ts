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

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as yaml from 'js-yaml';

import type { IAgent } from '../agents/types.js';
import type { StageName, StageResult } from '../ad-sdlc-orchestrator/types.js';
import type { VerificationContext, DocumentType } from '../vnv/types.js';
import type {
  VerificationCheck,
  StageVerificationResult,
  ConsistencyCheckResult,
  ConsistencyViolation,
} from './types.js';
import { VERIFICATION_RULES, shouldRunRule } from './rules.js';
import { StageVerificationError } from './errors.js';
import { VnvErrorCodes } from '../errors/codes.js';
import { ErrorSeverity } from '../errors/types.js';

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
   * Verify a completed pipeline stage against its verification rules.
   *
   * Executes all rules for the given stage that meet the rigor threshold,
   * collects results, and returns an aggregated verification result.
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

    // Get rules for this stage
    const rules = VERIFICATION_RULES.get(stageName);

    if (!rules || rules.length === 0) {
      // No rules defined for this stage — pass by default
      return {
        stageName,
        passed: true,
        rigor: context.rigor,
        checks: [],
        warnings: [`No verification rules defined for stage '${stageName}'`],
        errors: [],
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - startTime,
      };
    }

    // Filter rules by rigor level
    const applicableRules = rules.filter((rule) => shouldRunRule(rule.minRigor, context.rigor));

    // Execute each applicable rule
    for (const rule of applicableRules) {
      try {
        const check = await rule.check(stageResult.artifacts, context.projectDir);
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
    const passed = !hasErrorFailures;

    return {
      stageName,
      passed,
      rigor: context.rigor,
      checks,
      warnings,
      errors,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Verify cross-document consistency using sync points.
   *
   * Reads `doc-sync-points.yaml` from the project root and checks that
   * referenced values are consistent across PRD, SRS, and SDS documents.
   *
   * @param projectDir - Absolute path to the project root
   * @param modifiedDocument - The document type that was just modified
   * @param _modifiedDocument
   * @returns Consistency check result with any violations found
   */
  async verifyCrossDocumentConsistency(
    projectDir: string,
    _modifiedDocument: DocumentType
  ): Promise<ConsistencyCheckResult> {
    const syncPointsPath = join(projectDir, 'doc-sync-points.yaml');

    // Check if sync points file exists
    if (!existsSync(syncPointsPath)) {
      return {
        passed: true,
        syncPointsChecked: 0,
        violations: [],
      };
    }

    // Read and parse sync points
    let syncPointsContent: string;
    try {
      syncPointsContent = await readFile(syncPointsPath, 'utf-8');
    } catch (err) {
      throw new StageVerificationError(
        VnvErrorCodes.VNV_CONSISTENCY_VIOLATION,
        `Failed to read doc-sync-points.yaml: ${err instanceof Error ? err.message : String(err)}`,
        {
          severity: ErrorSeverity.MEDIUM,
          category: 'recoverable',
          context: { projectDir, syncPointsPath },
        }
      );
    }

    let syncPointsData: Record<string, unknown>;
    try {
      const parsed = yaml.load(syncPointsContent);
      if (parsed === null || typeof parsed !== 'object') {
        throw new Error('Parsed content is not an object');
      }
      syncPointsData = parsed as Record<string, unknown>;
    } catch (err) {
      throw new StageVerificationError(
        VnvErrorCodes.VNV_CONSISTENCY_VIOLATION,
        `Failed to parse doc-sync-points.yaml: ${err instanceof Error ? err.message : String(err)}`,
        {
          severity: ErrorSeverity.MEDIUM,
          category: 'recoverable',
          context: { projectDir },
        }
      );
    }

    // Extract sync points array
    const syncPoints = syncPointsData['syncPoints'] ?? syncPointsData['sync_points'];
    if (!Array.isArray(syncPoints)) {
      return {
        passed: true,
        syncPointsChecked: 0,
        violations: [],
      };
    }

    // Read the documents that exist
    const docPaths: Record<DocumentType, string> = {
      prd: join(projectDir, 'docs', 'PRD.md'),
      srs: join(projectDir, 'docs', 'SRS.md'),
      sds: join(projectDir, 'docs', 'SDS.md'),
    };

    const docContents: Partial<Record<DocumentType, string>> = {};
    for (const [docType, docPath] of Object.entries(docPaths) as [DocumentType, string][]) {
      if (existsSync(docPath)) {
        try {
          docContents[docType] = await readFile(docPath, 'utf-8');
        } catch {
          // Skip unreadable documents
        }
      }
    }

    const violations: ConsistencyViolation[] = [];
    let syncPointsChecked = 0;

    for (const syncPoint of syncPoints) {
      if (typeof syncPoint !== 'object' || syncPoint === null) {
        continue;
      }

      const sp = syncPoint as Record<string, unknown>;
      const rawName = sp['name'] ?? sp['id'];
      const name =
        typeof rawName === 'string'
          ? rawName
          : typeof rawName === 'number'
            ? String(rawName)
            : 'unknown';
      const sourceDocs = sp['documents'] ?? sp['docs'];

      if (!Array.isArray(sourceDocs) || sourceDocs.length < 2) {
        continue;
      }

      syncPointsChecked++;

      // Check if the value/pattern exists in all referenced documents
      const pattern = sp['pattern'] ?? sp['value'];
      if (typeof pattern !== 'string') {
        continue;
      }

      const docsWithPattern: string[] = [];
      const docsWithoutPattern: string[] = [];

      for (const docRef of sourceDocs) {
        const docType = String(docRef).toLowerCase() as DocumentType;
        const content = docContents[docType];
        if (content === undefined) {
          // Document not available; skip
          continue;
        }

        if (content.includes(pattern)) {
          docsWithPattern.push(docType);
        } else {
          docsWithoutPattern.push(docType);
        }
      }

      // If pattern found in some but not all available docs, report violation
      if (docsWithPattern.length > 0 && docsWithoutPattern.length > 0) {
        const severity = sp['severity'] as 'critical' | 'high' | 'medium' | undefined;
        const sourceDoc = docsWithPattern[0] ?? 'unknown';
        const targetDoc = docsWithoutPattern[0] ?? 'unknown';
        violations.push({
          syncPointName: name,
          severity: severity ?? 'medium',
          sourceDoc,
          targetDoc,
          description: `Sync point '${name}' pattern '${pattern}' found in ${docsWithPattern.join(', ')} but missing from ${docsWithoutPattern.join(', ')}`,
        });
      }
    }

    return {
      passed: violations.length === 0,
      syncPointsChecked,
      violations,
    };
  }
}
