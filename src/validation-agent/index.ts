/**
 * Validation Agent Module
 *
 * Validates pipeline outputs against requirements, acceptance criteria,
 * traceability chains, and quality gates. Produces a comprehensive
 * ValidationReport as part of the V&V framework (Phase 4).
 *
 * @module validation-agent
 */

// Main agent class (singleton + constructor)
export {
  ValidationAgent,
  getValidationAgent,
  resetValidationAgent,
  VALIDATION_AGENT_ID,
} from './ValidationAgent.js';

// Acceptance Criteria Validator
export { AcceptanceCriteriaValidator } from './AcceptanceCriteriaValidator.js';

// Error classes
export { ValidationError } from './errors.js';

// Schemas
export {
  VnvRigorSchema,
  OverallResultSchema,
  AcceptanceCriterionResultEnum,
  ValidationContextSchema,
  RequirementValidationSummarySchema,
  AcceptanceCriterionResultSchema,
  AcceptanceCriteriaValidationSummarySchema,
  TraceabilityValidationSummarySchema,
  QualityGateResultSchema,
  QualityGateValidationSummarySchema,
  ValidationReportSchema,
} from './schemas.js';

// Schema-inferred types
export type {
  ValidationContextParsed,
  RequirementValidationSummaryParsed,
  AcceptanceCriterionResultParsed,
  AcceptanceCriteriaValidationSummaryParsed,
  TraceabilityValidationSummaryParsed,
  QualityGateResultParsed,
  QualityGateValidationSummaryParsed,
  ValidationReportParsed,
} from './schemas.js';

// Type exports
export type {
  ValidationContext,
  RequirementValidationSummary,
  AcceptanceCriterionResult,
  AcceptanceCriteriaValidationSummary,
  TraceabilityValidationSummary,
  QualityGateResult,
  QualityGateValidationSummary,
  ValidationReport,
} from './types.js';
