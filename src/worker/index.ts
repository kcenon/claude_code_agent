/**
 * Worker module
 *
 * Provides code generation, test writing, and self-verification
 * functionality for the Worker Agent.
 *
 * @module worker
 */

export { WorkerAgent, WORKER_AGENT_ID } from './WorkerAgent.js';
export type { CodeChange } from './WorkerAgent.js';
export { TestGenerator } from './TestGenerator.js';
export { SelfVerificationAgent } from './SelfVerificationAgent.js';
export { RetryHandler } from './RetryHandler.js';
export type { RetryHandlerConfig, OperationResult } from './RetryHandler.js';
export { CheckpointManager, DEFAULT_CHECKPOINT_CONFIG } from './CheckpointManager.js';
export type { CheckpointManagerConfig, CheckpointState } from './CheckpointManager.js';

// Test Generator sub-modules (Issue #237)
export { CodeAnalyzer } from './CodeAnalyzer.js';
export {
  TestStrategyFactory,
  UnitTestStrategy,
  IntegrationTestStrategy,
  E2ETestStrategy,
} from './TestStrategyFactory.js';
export type { ITestStrategy, TestContext } from './TestStrategyFactory.js';
export { AssertionBuilder } from './AssertionBuilder.js';
export type {
  IAssertionBuilder,
  Assertion,
  ExpectedValue,
  InferenceContext,
} from './AssertionBuilder.js';
export { FixtureManager } from './FixtureManager.js';
export type {
  IFixtureManager,
  FixtureSchema,
  FixtureProperty,
  Fixture,
  Mock,
  DataSpec,
  TestData,
} from './FixtureManager.js';
export {
  FrameworkAdapterFactory,
  VitestAdapter,
  JestAdapter,
  MochaAdapter,
} from './FrameworkAdapters.js';
export type { IFrameworkAdapter } from './FrameworkAdapters.js';

export type {
  // Configuration
  WorkerAgentConfig,
  WorkerExecutionOptions,
  RetryPolicy,
  ExecutionContext,
  CategoryRetryPolicy,
  // Result types
  ImplementationResult,
  ImplementationStatus,
  FileChange,
  FileChangeType,
  TestInfo,
  TestsSummary,
  VerificationResult,
  BranchInfo,
  CommitInfo,
  // Context types
  CodeContext,
  FileContext,
  CodePatterns,
  // Branch and commit types
  BranchPrefix,
  CommitType,
  // Re-exported from controller
  WorkOrder,
  WorkOrderContext,
  RelatedFile,
  // Error handling types (Issue #48)
  ErrorCategory,
  WorkerErrorInfo,
  RetryAttempt,
  ProgressCheckpoint,
  EscalationReport,
  WorkerStep,
  // Test generation types
  TestGeneratorConfig,
  TestGenerationResult,
  TestSuite,
  TestSuiteBlock,
  TestCase,
  TestCategory,
  TestPriority,
  MockDependency,
  CodeAnalysis,
  ClassInfo,
  FunctionInfo,
  MethodInfo,
  ParameterInfo,
  PropertyInfo,
  DependencyInfo,
  ExportInfo,
  // Self-verification types (UC-013)
  VerificationStep,
  SelfVerificationStatus,
  VerificationStepResult,
  FixAttempt,
  VerificationReport,
  SelfVerificationConfig,
  FixSuggestion,
  VerificationError as ParsedVerificationError,
} from './types.js';

export {
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- Exported for backward compatibility
  DEFAULT_WORKER_AGENT_CONFIG,
  DEFAULT_CODE_PATTERNS,
  DEFAULT_RETRY_POLICY,
  DEFAULT_TEST_GENERATOR_CONFIG,
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- Exported for backward compatibility
  DEFAULT_SELF_VERIFICATION_CONFIG,
  // Factory functions for runtime projectRoot resolution (Issue #256)
  getDefaultWorkerAgentConfig,
  getDefaultSelfVerificationConfig,
} from './types.js';

export {
  // Base error
  WorkerError,
  // Parsing errors
  WorkOrderParseError,
  // Analysis errors
  ContextAnalysisError,
  // File errors
  FileReadError,
  FileWriteError,
  // Git errors
  BranchCreationError,
  BranchExistsError,
  CommitError,
  GitOperationError,
  // Generation errors
  CodeGenerationError,
  TestGenerationError,
  // Verification errors
  VerificationError,
  // Execution errors
  MaxRetriesExceededError,
  ImplementationBlockedError,
  CommandExecutionError,
  // Persistence errors
  ResultPersistenceError,
  // Self-verification errors (UC-013)
  TypeCheckError,
  SelfFixError,
  EscalationRequiredError,
  VerificationPipelineError,
  CommandTimeoutError,
  OperationTimeoutError,
  // Checkpoint errors (Issue #250)
  CheckpointSaveError,
  CheckpointLoadError,
  CheckpointInvalidError,
  CheckpointExpiredError,
  // Error categorization functions (Issue #48)
  categorizeError,
  createWorkerErrorInfo,
  isRetryableError,
  requiresEscalation,
  getSuggestedAction,
} from './errors.js';
