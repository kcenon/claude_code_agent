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

// Re-export controller module (with explicit handling of conflicts)
export {
  PriorityAnalyzer,
  DEFAULT_PRIORITY_WEIGHTS as CONTROLLER_PRIORITY_WEIGHTS,
  DEFAULT_ANALYZER_CONFIG,
  ControllerError,
  GraphNotFoundError,
  GraphParseError,
  GraphValidationError,
  CircularDependencyError as ControllerCircularDependencyError,
  IssueNotFoundError,
  PriorityAnalysisError,
  EmptyGraphError,
} from './controller/index.js';

export type {
  IssueStatus,
  PriorityWeights,
  IssueNode,
  DependencyEdge as ControllerDependencyEdge,
  RawDependencyGraph,
  AnalyzedIssue,
  ParallelGroup as ControllerParallelGroup,
  CriticalPath,
  PrioritizedQueue,
  GraphAnalysisResult,
  GraphStatistics,
  PriorityAnalyzerConfig,
  Priority as ControllerPriority,
} from './controller/index.js';

// Re-export state-manager module
export {
  StateManager,
  getStateManager,
  resetStateManager,
  StateManagerError,
  InvalidTransitionError,
  StateNotFoundError,
  ProjectNotFoundError,
  ProjectExistsError,
  StateValidationError,
  LockAcquisitionError,
  HistoryError,
  WatchError,
} from './state-manager/index.js';

export type {
  ProjectState,
  StateManagerOptions,
  StateChangeEvent,
  StateChangeCallback,
  StateWatcher,
  StateHistoryEntry,
  StateHistory,
  StateTransition,
  TransitionResult,
  ProjectStateSummary,
  ValidationResult,
  ValidationError as StateValidationErrorDetail,
  UpdateOptions,
  ReadStateOptions,
  StateWithMetadata,
} from './state-manager/index.js';

// Re-export agent-validator module
export {
  AGENT_SCHEMA_VERSION,
  VALID_TOOLS,
  VALID_MODELS,
  AgentFrontmatterSchema,
  AgentToolSchema,
  AgentModelSchema,
  RECOMMENDED_SECTIONS,
  AgentValidationException,
  AgentNotFoundError,
  FrontmatterParseError,
  FrontmatterValidationError,
  AgentNotRegisteredError,
  validateAgentFile,
  validateAllAgents,
  formatValidationReport,
} from './agent-validator/index.js';

export type {
  AgentTool,
  AgentModel,
  AgentFrontmatter,
  AgentDefinition,
  AgentValidationError,
  AgentValidationResult,
  AgentValidationReport,
  ValidateAgentOptions,
} from './agent-validator/index.js';
