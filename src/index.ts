/**
 * AD-SDLC - Agent-Driven Software Development Lifecycle
 *
 * @packageDocumentation
 */

// Re-export security module
export * from './security/index.js';

// Re-export scratchpad module (with explicit handling of conflicts)
export {
  // Core
  Scratchpad,
  getScratchpad,
  resetScratchpad,
  // Schemas
  SCHEMA_VERSION,
  CollectedInfoSchema,
  WorkOrderSchema,
  ImplementationResultSchema,
  PRReviewResultSchema,
  ControllerStateSchema,
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
  PrioritySchema,
  CollectionStatusSchema,
  ImplementationStatusSchema,
  ReviewDecisionSchema,
  // Validation
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
} from './scratchpad/index.js';

export type {
  // Types from scratchpad/types.ts
  ScratchpadSection,
  ProgressSubsection,
  DocumentType,
  FileFormat,
  ScratchpadOptions,
  ProjectInfo,
  ClarificationEntry,
  FileLock,
  AtomicWriteOptions,
  ReadOptions,
  // Types from scratchpad/schemas.ts
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
  CollectionStatus,
  ImplementationStatus,
  ReviewDecision,
  FieldError,
  SchemaValidationResult,
} from './scratchpad/index.js';

// Priority is exported with a different name to avoid conflict
export { PrioritySchema as ScratchpadPrioritySchema } from './scratchpad/index.js';
export type { Priority as ScratchpadPriority } from './scratchpad/index.js';

// Re-export issue-generator module
export * from './issue-generator/index.js';

// Re-export init module
export * from './init/index.js';
