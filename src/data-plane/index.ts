/**
 * Data Plane - Data Storage and Persistence
 *
 * This module exports components responsible for:
 * - Unified data-plane facade (DataPlane class)
 * - Scratchpad data storage and validation
 * - Schema definitions and versioning
 * - Data serialization mapping (snake_case ↔ camelCase)
 *
 * @packageDocumentation
 */

// Data-Plane facade
export {
  DataPlane,
  getDataPlane,
  resetDataPlane,
  DataPlaneError,
  DataAccessError,
  DataValidationError,
  SerializationError,
  camelToSnake,
  snakeToCamel,
  toSnakeCase,
  toCamelCase,
} from './DataPlane.js';

export type { DataPlaneOptions } from './DataPlane.js';

// Re-export scratchpad module
export {
  Scratchpad,
  getScratchpad,
  resetScratchpad,
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
} from '../scratchpad/index.js';

export type {
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
  Priority,
} from '../scratchpad/index.js';

// Re-export schemas module (explicit exports to avoid conflicts)
// GitHub schemas
export {
  GitHubPRDataSchema,
  GitHubPRDataArraySchema,
  GitHubMergeInfoSchema,
  GitHubReviewSchema,
  GitHubReviewsResponseSchema,
  GitHubCheckResultSchema,
  GitHubCheckResultArraySchema,
  GitHubRepoInfoSchema,
  SecurityAuditResultSchema,
  GitHubRunDataSchema,
} from '../schemas/index.js';

export type {
  GitHubPRData,
  GitHubMergeInfo,
  GitHubReview,
  GitHubReviewsResponse,
  GitHubCheckResult,
  GitHubRepoInfo,
  SecurityAuditResult,
  GitHubRunData,
} from '../schemas/index.js';

// Common schemas (with aliases for conflicts)
export {
  PackageJsonPartialSchema,
  PackageJsonVersionSchema,
  FileLockSchema,
  DependencyNodeSchema as CommonDependencyNodeSchema,
  DependencyGraphSchema as CommonDependencyGraphSchema,
  ProgressCheckpointSchema,
  ProgressReportSchema,
  IssueQueueSchema as CommonIssueQueueSchema,
  WorkerStatusSchema as CommonWorkerStatusSchema,
  ControllerStateSchema as CommonControllerStateSchema,
  LogEntrySchema,
  AuditLogEntrySchema,
  PriorityAnalysisSchema,
} from '../schemas/index.js';

export type {
  PackageJsonPartial,
  PackageJsonVersion,
  FileLock as CommonFileLock,
  DependencyNode as CommonDependencyNode,
  DependencyGraph as CommonDependencyGraph,
  ProgressCheckpoint,
  ProgressReport,
  IssueQueue as CommonIssueQueue,
  WorkerStatus as CommonWorkerStatus,
  ControllerState as CommonControllerState,
  LogEntry,
  AuditLogEntry,
  PriorityAnalysis,
} from '../schemas/index.js';
