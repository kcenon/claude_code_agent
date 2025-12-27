/**
 * Worker module
 *
 * Provides code generation, test writing, and self-verification
 * functionality for the Worker Agent.
 *
 * @module worker
 */

export { WorkerAgent } from './WorkerAgent.js';

export type {
  // Configuration
  WorkerAgentConfig,
  WorkerExecutionOptions,
  RetryPolicy,
  ExecutionContext,
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
} from './types.js';

export {
  DEFAULT_WORKER_AGENT_CONFIG,
  DEFAULT_CODE_PATTERNS,
  DEFAULT_RETRY_POLICY,
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
} from './errors.js';
