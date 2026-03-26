/**
 * RTM Builder Agent Module
 *
 * Assembles a Requirements Traceability Matrix (RTM) by reading project
 * artifacts and tracing functional requirements through features, components,
 * issues, implementations, and pull requests.
 *
 * @module rtm-builder
 */

// Main agent class (singleton + constructor)
export {
  RtmBuilderAgent,
  getRtmBuilderAgent,
  resetRtmBuilderAgent,
  RTM_BUILDER_AGENT_ID,
} from './RtmBuilderAgent.js';

// Error classes
export { RtmBuildError } from './errors.js';

// Schemas
export {
  RTM_SCHEMA_VERSION,
  RtmAcceptanceCriterionSchema,
  RtmImplStatusSchema,
  RtmEntrySchema,
  RtmGapTypeSchema,
  RtmGapSchema,
  RtmCoverageMetricsSchema,
  PipelineModeSchema,
  RequirementsTraceabilityMatrixSchema,
  RtmValidationResultSchema,
  RtmBuildContextSchema,
} from './schemas.js';

// Schema-inferred types
export type {
  RtmAcceptanceCriterionParsed,
  RtmImplStatusParsed,
  RtmEntryParsed,
  RtmGapTypeParsed,
  RtmGapParsed,
  RtmCoverageMetricsParsed,
  RequirementsTraceabilityMatrixParsed,
  RtmValidationResultParsed,
  RtmBuildContextParsed,
} from './schemas.js';

// Type exports
export type {
  RtmAcceptanceCriterion,
  RtmImplStatus,
  RtmEntry,
  RtmGapType,
  RtmGap,
  RtmCoverageMetrics,
  RequirementsTraceabilityMatrix,
  RtmValidationResult,
  RtmBuildContext,
} from './types.js';
