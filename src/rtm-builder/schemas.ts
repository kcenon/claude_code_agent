/**
 * Zod Schemas for RTM Builder Types
 *
 * Runtime validation schemas for all RTM data structures.
 * Follows the pattern established in scratchpad/schemas.ts.
 *
 * @module rtm-builder/schemas
 */

import { z } from 'zod';

// =============================================================================
// Schema Version
// =============================================================================

/**
 * Current RTM schema version
 */
export const RTM_SCHEMA_VERSION = '1.0.0';

// =============================================================================
// Acceptance Criterion Schema
// =============================================================================

/**
 * Zod schema for RtmAcceptanceCriterion
 */
export const RtmAcceptanceCriterionSchema = z.object({
  id: z.string().min(1, 'Acceptance criterion ID is required'),
  description: z.string().min(1, 'Description is required'),
  validated: z.boolean(),
  validationMethod: z.string().optional(),
});
export type RtmAcceptanceCriterionParsed = z.infer<typeof RtmAcceptanceCriterionSchema>;

// =============================================================================
// Implementation Status Schema
// =============================================================================

/**
 * Zod schema for RtmImplStatus
 */
export const RtmImplStatusSchema = z.object({
  workOrderId: z.string().min(1, 'Work order ID is required'),
  status: z.enum(['completed', 'failed', 'blocked']),
  testsPassed: z.boolean(),
  buildPassed: z.boolean(),
});
export type RtmImplStatusParsed = z.infer<typeof RtmImplStatusSchema>;

// =============================================================================
// RTM Entry Schema
// =============================================================================

/**
 * Zod schema for RtmEntry
 */
export const RtmEntrySchema = z.object({
  requirementId: z.string().regex(/^FR-\d{3}$/, 'Must be in format FR-XXX'),
  requirementTitle: z.string().min(1, 'Requirement title is required'),
  priority: z.string().regex(/^P[0-3]$/, 'Must be P0, P1, P2, or P3'),
  features: z.array(z.string()).readonly(),
  useCases: z.array(z.string()).readonly(),
  components: z.array(z.string()).readonly(),
  issues: z.array(z.string()).readonly(),
  workOrders: z.array(z.string()).readonly(),
  implementations: z.array(RtmImplStatusSchema).readonly(),
  pullRequests: z.array(z.string()).readonly(),
  acceptanceCriteria: z.array(RtmAcceptanceCriterionSchema).readonly(),
  status: z.enum(['not_started', 'in_progress', 'implemented', 'verified']),
});
export type RtmEntryParsed = z.infer<typeof RtmEntrySchema>;

// =============================================================================
// Gap Type Schema
// =============================================================================

/**
 * Zod schema for RtmGapType
 */
export const RtmGapTypeSchema = z.enum([
  'uncovered_requirement',
  'orphan_component',
  'missing_test',
  'unvalidated_acceptance_criteria',
  'broken_chain',
]);
export type RtmGapTypeParsed = z.infer<typeof RtmGapTypeSchema>;

// =============================================================================
// Gap Schema
// =============================================================================

/**
 * Zod schema for RtmGap
 */
export const RtmGapSchema = z.object({
  type: RtmGapTypeSchema,
  severity: z.enum(['error', 'warning']),
  affectedIds: z.array(z.string()).readonly(),
  message: z.string().min(1, 'Gap message is required'),
});
export type RtmGapParsed = z.infer<typeof RtmGapSchema>;

// =============================================================================
// Coverage Metrics Schema
// =============================================================================

/**
 * Zod schema for RtmCoverageMetrics
 */
export const RtmCoverageMetricsSchema = z.object({
  totalRequirements: z.number().int().min(0),
  requirementsWithFeatures: z.number().int().min(0),
  requirementsWithComponents: z.number().int().min(0),
  requirementsWithIssues: z.number().int().min(0),
  requirementsWithImplementations: z.number().int().min(0),
  requirementsWithPRs: z.number().int().min(0),
  forwardCoveragePercent: z.number().min(0).max(100),
  backwardCoveragePercent: z.number().min(0).max(100),
  acceptanceCriteriaTotal: z.number().int().min(0),
  acceptanceCriteriaValidated: z.number().int().min(0),
});
export type RtmCoverageMetricsParsed = z.infer<typeof RtmCoverageMetricsSchema>;

// =============================================================================
// Pipeline Mode Schema
// =============================================================================

/**
 * Zod schema for PipelineMode (re-validated at RTM boundary)
 */
export const PipelineModeSchema = z.enum(['greenfield', 'enhancement', 'import']);

// =============================================================================
// Requirements Traceability Matrix Schema
// =============================================================================

/**
 * Zod schema for the complete RequirementsTraceabilityMatrix
 */
export const RequirementsTraceabilityMatrixSchema = z.object({
  version: z.string().min(1),
  projectId: z.string().min(1, 'Project ID is required'),
  generatedAt: z.string().min(1),
  pipelineMode: PipelineModeSchema,
  entries: z.array(RtmEntrySchema).readonly(),
  coverageMetrics: RtmCoverageMetricsSchema,
  gaps: z.array(RtmGapSchema).readonly(),
});
export type RequirementsTraceabilityMatrixParsed = z.infer<
  typeof RequirementsTraceabilityMatrixSchema
>;

// =============================================================================
// Validation Result Schema
// =============================================================================

/**
 * Zod schema for RtmValidationResult
 */
export const RtmValidationResultSchema = z.object({
  valid: z.boolean(),
  gaps: z.array(RtmGapSchema).readonly(),
  coverageMetrics: RtmCoverageMetricsSchema,
});
export type RtmValidationResultParsed = z.infer<typeof RtmValidationResultSchema>;

// =============================================================================
// Build Context Schema
// =============================================================================

/**
 * Zod schema for RtmBuildContext
 */
export const RtmBuildContextSchema = z.object({
  projectDir: z.string().min(1, 'Project directory is required'),
  projectId: z.string().min(1, 'Project ID is required'),
  pipelineMode: PipelineModeSchema,
});
export type RtmBuildContextParsed = z.infer<typeof RtmBuildContextSchema>;
