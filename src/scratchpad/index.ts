/**
 * Scratchpad module for file-based state sharing between agents
 *
 * This module implements the Scratchpad pattern that enables
 * inter-agent communication through structured file operations.
 *
 * @example
 * ```typescript
 * import { getScratchpad } from './scratchpad';
 *
 * const scratchpad = getScratchpad();
 * const projectId = await scratchpad.generateProjectId();
 *
 * // Write YAML data
 * await scratchpad.writeYaml(
 *   scratchpad.getCollectedInfoPath(projectId),
 *   { projectId, data: 'example' }
 * );
 * ```
 */

export { Scratchpad, getScratchpad, resetScratchpad } from './Scratchpad.js';

// Error classes
export { LockError, LockContentionError, LockStolenError, LockTimeoutError } from './errors.js';

export type {
  ScratchpadSection,
  ProgressSubsection,
  DocumentType,
  FileFormat,
  ScratchpadOptions,
  ProjectInfo,
  ClarificationEntry,
  FileLock,
  LockConfig,
  LockOptions,
  AtomicWriteOptions,
  ReadOptions,
} from './types.js';

// Schema exports
export {
  SCHEMA_VERSION,
  // Schemas
  CollectedInfoSchema,
  WorkOrderSchema,
  ImplementationResultSchema,
  PRReviewResultSchema,
  ControllerStateSchema,
  // Sub-schemas
  FunctionalRequirementSchema,
  NonFunctionalRequirementSchema,
  ConstraintSchema,
  AssumptionSchema,
  DependencySchema,
  ClarificationSchema,
  SourceReferenceSchema,
  FileChangeSchema,
  TestInfoSchema,
  ReviewCommentSchema,
  QualityMetricsSchema,
  IssueQueueSchema,
  WorkerStatusSchema,
  WorkOrderContextSchema,
  RelatedFileSchema,
  DependencyStatusSchema,
  AcceptanceCriterionSchema,
  // Enum schemas
  PrioritySchema,
  CollectionStatusSchema,
  ImplementationStatusSchema,
  ReviewDecisionSchema,
} from './schemas.js';

// Type exports from schemas
export type {
  CollectedInfo,
  WorkOrder,
  ImplementationResult,
  PRReviewResult,
  ControllerState,
  FunctionalRequirement,
  NonFunctionalRequirement,
  Constraint,
  Assumption,
  Dependency,
  Clarification,
  SourceReference,
  FileChange,
  TestInfo,
  ReviewComment,
  QualityMetrics,
  IssueQueue,
  WorkerStatus,
  WorkOrderContext,
  RelatedFile,
  DependencyStatus,
  AcceptanceCriterion,
  Priority,
  CollectionStatus,
  ImplementationStatus,
  ReviewDecision,
} from './schemas.js';

// Validation exports
export {
  validateCollectedInfo,
  validateWorkOrder,
  validateImplementationResult,
  validatePRReviewResult,
  validateControllerState,
  assertCollectedInfo,
  assertWorkOrder,
  assertImplementationResult,
  assertPRReviewResult,
  assertControllerState,
  getSchemaVersion,
  isCompatibleVersion,
  ensureSchemaVersion,
  SchemaValidationError,
} from './validation.js';

export type { FieldError, ValidationResult as SchemaValidationResult } from './validation.js';
