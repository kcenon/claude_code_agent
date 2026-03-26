/**
 * Zod Schemas for Validation Agent Types
 *
 * Runtime validation schemas for validation contexts, summaries,
 * acceptance criteria results, and validation reports.
 *
 * @module validation-agent/schemas
 */

import { z } from 'zod';
import {
  RequirementsTraceabilityMatrixSchema,
  PipelineModeSchema,
} from '../rtm-builder/schemas.js';

// =============================================================================
// Shared Enums
// =============================================================================

/** Zod schema for VnvRigor (re-validated at validation boundary) */
export const VnvRigorSchema = z.enum(['strict', 'standard', 'minimal']);

/** Zod schema for OverallResult */
export const OverallResultSchema = z.enum(['pass', 'pass_with_warnings', 'fail']);

/** Zod schema for AcceptanceCriterionResult result field */
export const AcceptanceCriterionResultEnum = z.enum(['pass', 'fail', 'untested']);

// =============================================================================
// ValidationContext Schema
// =============================================================================

/**
 * Zod schema for {@link ValidationContext}
 */
export const ValidationContextSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  projectId: z.string().min(1, 'Project ID is required'),
  pipelineMode: PipelineModeSchema,
  rigor: VnvRigorSchema,
  pipelineId: z.string().min(1, 'Pipeline ID is required'),
  rtm: RequirementsTraceabilityMatrixSchema,
});

/** Inferred type from ValidationContextSchema */
export type ValidationContextParsed = z.infer<typeof ValidationContextSchema>;

// =============================================================================
// RequirementValidationSummary Schema
// =============================================================================

/**
 * Zod schema for {@link RequirementValidationSummary}
 */
export const RequirementValidationSummarySchema = z.object({
  totalRequirements: z.number().int().min(0),
  implementedRequirements: z.number().int().min(0),
  verifiedRequirements: z.number().int().min(0),
  unimplementedRequirements: z.array(z.string()).readonly(),
  coveragePercent: z.number().min(0).max(100),
});

/** Inferred type from RequirementValidationSummarySchema */
export type RequirementValidationSummaryParsed = z.infer<typeof RequirementValidationSummarySchema>;

// =============================================================================
// AcceptanceCriterionResult Schema
// =============================================================================

/**
 * Zod schema for {@link AcceptanceCriterionResult}
 */
export const AcceptanceCriterionResultSchema = z.object({
  criterionId: z.string().min(1, 'Criterion ID is required'),
  requirementId: z.string().min(1, 'Requirement ID is required'),
  description: z.string().min(1, 'Description is required'),
  result: AcceptanceCriterionResultEnum,
  evidence: z.string().optional(),
});

/** Inferred type from AcceptanceCriterionResultSchema */
export type AcceptanceCriterionResultParsed = z.infer<typeof AcceptanceCriterionResultSchema>;

// =============================================================================
// AcceptanceCriteriaValidationSummary Schema
// =============================================================================

/**
 * Zod schema for {@link AcceptanceCriteriaValidationSummary}
 */
export const AcceptanceCriteriaValidationSummarySchema = z.object({
  totalCriteria: z.number().int().min(0),
  validatedCriteria: z.number().int().min(0),
  failedCriteria: z.array(AcceptanceCriterionResultSchema).readonly(),
  untestedCriteria: z.array(z.string()).readonly(),
  passRate: z.number().min(0).max(100),
});

/** Inferred type from AcceptanceCriteriaValidationSummarySchema */
export type AcceptanceCriteriaValidationSummaryParsed = z.infer<
  typeof AcceptanceCriteriaValidationSummarySchema
>;

// =============================================================================
// TraceabilityValidationSummary Schema
// =============================================================================

/**
 * Zod schema for {@link TraceabilityValidationSummary}
 */
export const TraceabilityValidationSummarySchema = z.object({
  chainComplete: z.boolean(),
  brokenLinks: z.array(z.string()).readonly(),
  orphanArtifacts: z.array(z.string()).readonly(),
  forwardCoverage: z.number().min(0).max(100),
  backwardCoverage: z.number().min(0).max(100),
});

/** Inferred type from TraceabilityValidationSummarySchema */
export type TraceabilityValidationSummaryParsed = z.infer<
  typeof TraceabilityValidationSummarySchema
>;

// =============================================================================
// QualityGateResult Schema
// =============================================================================

/**
 * Zod schema for {@link QualityGateResult}
 */
export const QualityGateResultSchema = z.object({
  gateName: z.string().min(1, 'Gate name is required'),
  passed: z.boolean(),
  details: z.string().min(1, 'Details are required'),
});

/** Inferred type from QualityGateResultSchema */
export type QualityGateResultParsed = z.infer<typeof QualityGateResultSchema>;

// =============================================================================
// QualityGateValidationSummary Schema
// =============================================================================

/**
 * Zod schema for {@link QualityGateValidationSummary}
 */
export const QualityGateValidationSummarySchema = z.object({
  allGatesPassed: z.boolean(),
  gateResults: z.array(QualityGateResultSchema).readonly(),
});

/** Inferred type from QualityGateValidationSummarySchema */
export type QualityGateValidationSummaryParsed = z.infer<typeof QualityGateValidationSummarySchema>;

// =============================================================================
// ValidationReport Schema
// =============================================================================

/**
 * Zod schema for {@link ValidationReport}
 */
export const ValidationReportSchema = z.object({
  reportId: z.string().min(1, 'Report ID is required'),
  projectId: z.string().min(1, 'Project ID is required'),
  pipelineId: z.string().min(1, 'Pipeline ID is required'),
  generatedAt: z.string().min(1, 'Generated timestamp is required'),
  overallResult: OverallResultSchema,
  rigor: VnvRigorSchema,
  requirementValidation: RequirementValidationSummarySchema,
  acceptanceCriteriaValidation: AcceptanceCriteriaValidationSummarySchema,
  traceabilityValidation: TraceabilityValidationSummarySchema,
  qualityGateResults: QualityGateValidationSummarySchema,
  recommendations: z.array(z.string()).readonly(),
});

/** Inferred type from ValidationReportSchema */
export type ValidationReportParsed = z.infer<typeof ValidationReportSchema>;
