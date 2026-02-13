/**
 * Error Library
 *
 * Standardized error handling for the AD-SDLC system.
 *
 * @module errors
 * @example
 * ```typescript
 * import { AppError, ErrorCodes, ErrorHandler, ErrorSeverity } from './errors/index.js';
 *
 * // Create a new error
 * throw new AppError(
 *   ErrorCodes.CTL_GRAPH_NOT_FOUND,
 *   'Dependency graph file not found',
 *   { context: { path: 'graph.json' }, severity: ErrorSeverity.HIGH }
 * );
 *
 * // Handle errors
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   const appError = ErrorHandler.handle(error, {
 *     style: 'cli',
 *     output: console.error
 *   });
 *   if (!appError.isRetryable()) {
 *     throw appError;
 *   }
 * }
 * ```
 */

// Types
export {
  ErrorSeverity,
  type ErrorCategory,
  type ErrorContext,
  type SerializedError,
  type AppErrorOptions,
  type ErrorFormatStyle,
  type ErrorHandleOptions,
} from './types.js';

// Error Codes
export {
  ErrorCodes,
  ControllerErrorCodes,
  WorkerErrorCodes,
  StateManagerErrorCodes,
  PRReviewerErrorCodes,
  ErrorHandlerErrorCodes,
  ScratchpadErrorCodes,
  ConfigErrorCodes,
  SecurityErrorCodes,
  MonitoringErrorCodes,
  ControlPlaneErrorCodes,
  GenericErrorCodes,
  DocumentErrorCodes,
  AgentErrorCodes,
  InfrastructureErrorCodes,
  ExtendedSecurityErrorCodes,
  ExternalServiceErrorCodes,
  ErrorCodeDescriptions,
  type ErrorCode,
} from './codes.js';

// Base Error Class
export { AppError } from './AppError.js';

// Error Handler
export { ErrorHandler, type ErrorInfo } from './handler.js';

// Factory Functions
export {
  // Document factories
  documentNotFoundError,
  documentParseError,
  documentValidationError,
  documentWriteError,
  // Agent factories
  agentInitError,
  agentExecutionError,
  agentTimeoutError,
  agentNotFoundError,
  // Infrastructure factories
  fileAccessError,
  lockAcquisitionError,
  lockTimeoutError,
  configLoadError,
  // Security factories
  pathTraversalError,
  commandInjectionError,
  permissionDeniedError,
  rateLimitExceededError,
  // External service factories
  githubApiError,
  ciExecutionError,
  networkError,
  // Generic factories
  validationError,
  notImplementedError,
  operationTimeoutError,
  // Factory utilities
  createModuleErrorFactory,
  createBoundErrorFactories,
} from './factories.js';
