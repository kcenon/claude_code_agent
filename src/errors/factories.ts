/**
 * Error Factory Functions
 *
 * Convenience factory functions for creating common error patterns.
 * These reduce boilerplate and ensure consistent error creation across modules.
 *
 * @module errors/factories
 */

import { AppError } from './AppError.js';
import { ErrorCodes } from './codes.js';
import { ErrorSeverity } from './types.js';
import type { ErrorContext, AppErrorOptions } from './types.js';

// =============================================================================
// Document-Related Error Factories
// =============================================================================

/**
 * Create error for document not found
 * @param documentType - The type of document that was not found
 * @param path - The file path where the document was expected
 * @param context - Additional error context information
 * @returns The constructed document-not-found AppError
 */
export function documentNotFoundError(
  documentType: string,
  path: string,
  context?: ErrorContext
): AppError {
  return new AppError(ErrorCodes.DOC_NOT_FOUND, `${documentType} not found at ${path}`, {
    severity: ErrorSeverity.HIGH,
    category: 'fatal',
    context: { documentType, path, ...context },
  });
}

/**
 * Create error for document parse failure
 * @param documentType - The type of document that failed to parse
 * @param path - The file path of the document
 * @param reason - The reason parsing failed
 * @param context - Additional error context information
 * @returns The constructed document-parse-error AppError
 */
export function documentParseError(
  documentType: string,
  path: string,
  reason: string,
  context?: ErrorContext
): AppError {
  return new AppError(
    ErrorCodes.DOC_PARSE_ERROR,
    `Failed to parse ${documentType} at ${path}: ${reason}`,
    {
      severity: ErrorSeverity.HIGH,
      category: 'fatal',
      context: { documentType, path, reason, ...context },
    }
  );
}

/**
 * Create error for document validation failure
 * @param documentType - The type of document that failed validation
 * @param errors - The list of validation error messages
 * @param context - Additional error context information
 * @returns The constructed document-validation-error AppError
 */
export function documentValidationError(
  documentType: string,
  errors: string[],
  context?: ErrorContext
): AppError {
  return new AppError(
    ErrorCodes.DOC_VALIDATION_ERROR,
    `${documentType} validation failed: ${errors.join(', ')}`,
    {
      severity: ErrorSeverity.HIGH,
      category: 'fatal',
      context: { documentType, validationErrors: errors, ...context },
    }
  );
}

/**
 * Create error for document write failure
 * @param documentType - The type of document that failed to write
 * @param path - The target file path for the write operation
 * @param reason - The reason the write failed
 * @param context - Additional error context information
 * @returns The constructed document-write-error AppError
 */
export function documentWriteError(
  documentType: string,
  path: string,
  reason: string,
  context?: ErrorContext
): AppError {
  return new AppError(
    ErrorCodes.DOC_WRITE_ERROR,
    `Failed to write ${documentType} to ${path}: ${reason}`,
    {
      severity: ErrorSeverity.HIGH,
      category: 'recoverable',
      context: { documentType, path, reason, ...context },
    }
  );
}

// =============================================================================
// Agent-Related Error Factories
// =============================================================================

/**
 * Create error for agent initialization failure
 * @param agentType - The type of agent that failed to initialize
 * @param reason - The reason initialization failed
 * @param context - Additional error context information
 * @returns The constructed agent-init-error AppError
 */
export function agentInitError(
  agentType: string,
  reason: string,
  context?: ErrorContext
): AppError {
  return new AppError(
    ErrorCodes.AGT_INIT_ERROR,
    `Failed to initialize ${agentType} agent: ${reason}`,
    {
      severity: ErrorSeverity.HIGH,
      category: 'fatal',
      context: { agentType, reason, ...context },
    }
  );
}

/**
 * Create error for agent execution failure
 * @param agentType - The type of agent that failed
 * @param operation - The operation that was being executed
 * @param reason - The reason execution failed
 * @param context - Additional error context information
 * @returns The constructed agent-execution-error AppError
 */
export function agentExecutionError(
  agentType: string,
  operation: string,
  reason: string,
  context?: ErrorContext
): AppError {
  return new AppError(
    ErrorCodes.AGT_EXECUTION_ERROR,
    `${agentType} agent failed during ${operation}: ${reason}`,
    {
      severity: ErrorSeverity.HIGH,
      category: 'recoverable',
      context: { agentType, operation, reason, ...context },
    }
  );
}

/**
 * Create error for agent timeout
 * @param agentType - The type of agent that timed out
 * @param operation - The operation that timed out
 * @param timeoutMs - The timeout threshold in milliseconds
 * @param context - Additional error context information
 * @returns The constructed agent-timeout-error AppError
 */
export function agentTimeoutError(
  agentType: string,
  operation: string,
  timeoutMs: number,
  context?: ErrorContext
): AppError {
  return new AppError(
    ErrorCodes.AGT_TIMEOUT_ERROR,
    `${agentType} agent timed out during ${operation} after ${String(timeoutMs)}ms`,
    {
      severity: ErrorSeverity.MEDIUM,
      category: 'transient',
      context: { agentType, operation, timeoutMs, ...context },
    }
  );
}

/**
 * Create error for agent not found
 * @param agentType - The type of agent that was not found
 * @param context - Additional error context information
 * @returns The constructed agent-not-found AppError
 */
export function agentNotFoundError(agentType: string, context?: ErrorContext): AppError {
  return new AppError(
    ErrorCodes.AGT_NOT_FOUND,
    `Agent type '${agentType}' not found or not registered`,
    {
      severity: ErrorSeverity.HIGH,
      category: 'fatal',
      context: { agentType, ...context },
    }
  );
}

// =============================================================================
// Infrastructure Error Factories
// =============================================================================

/**
 * Create error for file access failure
 * @param operation - The file operation that failed
 * @param path - The file path that could not be accessed
 * @param reason - The reason the file access failed
 * @param context - Additional error context information
 * @returns The constructed file-access-error AppError
 */
export function fileAccessError(
  operation: 'read' | 'write' | 'delete',
  path: string,
  reason: string,
  context?: ErrorContext
): AppError {
  return new AppError(
    ErrorCodes.INF_FILE_ACCESS_ERROR,
    `Failed to ${operation} file at ${path}: ${reason}`,
    {
      severity: ErrorSeverity.HIGH,
      category: 'recoverable',
      context: { operation, path, reason, ...context },
    }
  );
}

/**
 * Create error for lock acquisition failure
 * @param resource - The resource that could not be locked
 * @param timeoutMs - The lock acquisition timeout in milliseconds
 * @param context - Additional error context information
 * @returns The constructed lock-acquisition-error AppError
 */
export function lockAcquisitionError(
  resource: string,
  timeoutMs: number,
  context?: ErrorContext
): AppError {
  return new AppError(
    ErrorCodes.INF_LOCK_ACQUISITION_ERROR,
    `Failed to acquire lock for ${resource} within ${String(timeoutMs)}ms`,
    {
      severity: ErrorSeverity.MEDIUM,
      category: 'transient',
      context: { resource, timeoutMs, ...context },
    }
  );
}

/**
 * Create error for lock timeout
 * @param resource - The resource whose lock timed out
 * @param holderId - The identifier of the current lock holder
 * @param context - Additional error context information
 * @returns The constructed lock-timeout-error AppError
 */
export function lockTimeoutError(
  resource: string,
  holderId: string,
  context?: ErrorContext
): AppError {
  return new AppError(
    ErrorCodes.INF_LOCK_TIMEOUT_ERROR,
    `Lock for ${resource} timed out (held by ${holderId})`,
    {
      severity: ErrorSeverity.MEDIUM,
      category: 'transient',
      context: { resource, holderId, ...context },
    }
  );
}

/**
 * Create error for configuration load failure
 * @param configPath - The path to the configuration file that failed to load
 * @param reason - The reason the configuration load failed
 * @param context - Additional error context information
 * @returns The constructed config-load-error AppError
 */
export function configLoadError(
  configPath: string,
  reason: string,
  context?: ErrorContext
): AppError {
  return new AppError(
    ErrorCodes.INF_CONFIG_LOAD_ERROR,
    `Failed to load configuration from ${configPath}: ${reason}`,
    {
      severity: ErrorSeverity.HIGH,
      category: 'fatal',
      context: { configPath, reason, ...context },
    }
  );
}

// =============================================================================
// Security Error Factories
// =============================================================================

/**
 * Create error for path traversal attempt
 * @param path - The path that triggered the traversal detection
 * @param baseDir - The base directory that the path must not escape
 * @param context - Additional error context information
 * @returns The constructed path-traversal-error AppError
 */
export function pathTraversalError(
  path: string,
  baseDir: string,
  context?: ErrorContext
): AppError {
  return new AppError(
    ErrorCodes.SEC_PATH_TRAVERSAL_ERROR,
    `Path traversal attempt detected: ${path} escapes ${baseDir}`,
    {
      severity: ErrorSeverity.CRITICAL,
      category: 'fatal',
      context: { path, baseDir, ...context },
    }
  );
}

/**
 * Create error for command injection attempt
 * @param command - The command string that triggered the injection detection
 * @param pattern - The matched injection pattern
 * @param context - Additional error context information
 * @returns The constructed command-injection-error AppError
 */
export function commandInjectionError(
  command: string,
  pattern: string,
  context?: ErrorContext
): AppError {
  return new AppError(
    ErrorCodes.SEC_COMMAND_INJECTION_ERROR,
    `Command injection attempt detected: matched pattern '${pattern}'`,
    {
      severity: ErrorSeverity.CRITICAL,
      category: 'fatal',
      context: { command, pattern, ...context },
    }
  );
}

/**
 * Create error for permission denied
 * @param resource - The resource that access was denied for
 * @param action - The action that was denied
 * @param context - Additional error context information
 * @returns The constructed permission-denied AppError
 */
export function permissionDeniedError(
  resource: string,
  action: string,
  context?: ErrorContext
): AppError {
  return new AppError(
    ErrorCodes.SEC_PERMISSION_DENIED,
    `Permission denied: cannot ${action} on ${resource}`,
    {
      severity: ErrorSeverity.HIGH,
      category: 'fatal',
      context: { resource, action, ...context },
    }
  );
}

/**
 * Create error for rate limit exceeded
 * @param resource - The resource that exceeded the rate limit
 * @param limit - The maximum number of allowed requests
 * @param windowMs - The rate limit window in milliseconds
 * @param context - Additional error context information
 * @returns The constructed rate-limit-exceeded AppError
 */
export function rateLimitExceededError(
  resource: string,
  limit: number,
  windowMs: number,
  context?: ErrorContext
): AppError {
  return new AppError(
    ErrorCodes.SEC_RATE_LIMIT_EXCEEDED,
    `Rate limit exceeded for ${resource}: ${String(limit)} requests per ${String(windowMs)}ms`,
    {
      severity: ErrorSeverity.MEDIUM,
      category: 'transient',
      context: { resource, limit, windowMs, ...context },
    }
  );
}

// =============================================================================
// External Service Error Factories
// =============================================================================

/**
 * Create error for GitHub API failure
 * @param operation - The GitHub API operation that failed
 * @param statusCode - The HTTP status code returned, if available
 * @param message - The error message from the API
 * @param context - Additional error context information
 * @returns The constructed GitHub-API-error AppError
 */
export function githubApiError(
  operation: string,
  statusCode: number | undefined,
  message: string,
  context?: ErrorContext
): AppError {
  return new AppError(
    ErrorCodes.EXT_GITHUB_API_ERROR,
    `GitHub API error during ${operation}: ${message}`,
    {
      severity: ErrorSeverity.HIGH,
      category: statusCode !== undefined && statusCode >= 500 ? 'transient' : 'recoverable',
      context: { operation, statusCode, ...context },
    }
  );
}

/**
 * Create error for CI execution failure
 * @param pipeline - The CI pipeline that failed
 * @param stage - The pipeline stage where the failure occurred
 * @param reason - The reason the CI execution failed
 * @param context - Additional error context information
 * @returns The constructed CI-execution-error AppError
 */
export function ciExecutionError(
  pipeline: string,
  stage: string,
  reason: string,
  context?: ErrorContext
): AppError {
  return new AppError(
    ErrorCodes.EXT_CI_EXECUTION_ERROR,
    `CI execution failed at ${pipeline}/${stage}: ${reason}`,
    {
      severity: ErrorSeverity.HIGH,
      category: 'recoverable',
      context: { pipeline, stage, reason, ...context },
    }
  );
}

/**
 * Create error for network failure
 * @param operation - The network operation that failed
 * @param endpoint - The target endpoint URL or address
 * @param reason - The reason the network request failed
 * @param context - Additional error context information
 * @returns The constructed network-error AppError
 */
export function networkError(
  operation: string,
  endpoint: string,
  reason: string,
  context?: ErrorContext
): AppError {
  return new AppError(
    ErrorCodes.EXT_NETWORK_ERROR,
    `Network error during ${operation} to ${endpoint}: ${reason}`,
    {
      severity: ErrorSeverity.MEDIUM,
      category: 'transient',
      context: { operation, endpoint, reason, ...context },
    }
  );
}

// =============================================================================
// Generic Error Factories
// =============================================================================

/**
 * Create generic validation error
 * @param field - The name of the field that failed validation
 * @param expected - The expected type or format description
 * @param received - The actual value that was received
 * @param context - Additional error context information
 * @returns The constructed validation-error AppError
 */
export function validationError(
  field: string,
  expected: string,
  received: unknown,
  context?: ErrorContext
): AppError {
  return new AppError(
    ErrorCodes.GEN_INVALID_ARGUMENT,
    `Invalid value for ${field}: expected ${expected}, received ${typeof received}`,
    {
      severity: ErrorSeverity.MEDIUM,
      category: 'fatal',
      context: { field, expected, received, ...context },
    }
  );
}

/**
 * Create not implemented error
 * @param feature - The name of the unimplemented feature
 * @param context - Additional error context information
 * @returns The constructed not-implemented AppError
 */
export function notImplementedError(feature: string, context?: ErrorContext): AppError {
  return new AppError(ErrorCodes.GEN_NOT_IMPLEMENTED, `Feature not implemented: ${feature}`, {
    severity: ErrorSeverity.HIGH,
    category: 'fatal',
    context: { feature, ...context },
  });
}

/**
 * Create operation timeout error
 * @param operation - The name of the operation that timed out
 * @param timeoutMs - The timeout threshold in milliseconds
 * @param context - Additional error context information
 * @returns The constructed operation-timeout AppError
 */
export function operationTimeoutError(
  operation: string,
  timeoutMs: number,
  context?: ErrorContext
): AppError {
  return new AppError(
    ErrorCodes.GEN_TIMEOUT,
    `Operation '${operation}' timed out after ${String(timeoutMs)}ms`,
    {
      severity: ErrorSeverity.MEDIUM,
      category: 'transient',
      context: { operation, timeoutMs, ...context },
    }
  );
}

// =============================================================================
// Factory Creation Utilities
// =============================================================================

/**
 * Create a module-specific error factory
 *
 * @param moduleName - The name of the module to scope errors to
 * @param defaultCode - The default error code for this module
 * @param defaultOptions - Default options applied to all errors from this factory
 * @returns A factory function that creates module-scoped AppError instances
 * @example
 * ```typescript
 * const createPRDError = createModuleErrorFactory('PRD Writer', ErrorCodes.DOC_PARSE_ERROR);
 * throw createPRDError('Failed to parse section', { section: 'requirements' });
 * ```
 */
export function createModuleErrorFactory(
  moduleName: string,
  defaultCode: string,
  defaultOptions?: Partial<AppErrorOptions>
): (message: string, context?: ErrorContext) => AppError {
  return (message: string, context?: ErrorContext): AppError => {
    return new AppError(`[${moduleName}] ${message}`, defaultCode, {
      ...defaultOptions,
      context: { module: moduleName, ...defaultOptions?.context, ...context },
    });
  };
}

/**
 * Create an error factory bound to specific error codes
 *
 * @param codeMap - A mapping of factory names to their error codes
 * @returns An object of named factory functions for creating AppError instances
 * @example
 * ```typescript
 * const errors = createBoundErrorFactories({
 *   notFound: ErrorCodes.DOC_NOT_FOUND,
 *   parseError: ErrorCodes.DOC_PARSE_ERROR,
 * });
 * throw errors.notFound('Document not found', { path: '/path/to/doc' });
 * ```
 */
export function createBoundErrorFactories<T extends Record<string, string>>(
  codeMap: T
): {
  [K in keyof T]: (message: string, options?: AppErrorOptions) => AppError;
} {
  const factories = {} as {
    [K in keyof T]: (message: string, options?: AppErrorOptions) => AppError;
  };

  for (const [key, code] of Object.entries(codeMap)) {
    factories[key as keyof T] = (message: string, options?: AppErrorOptions): AppError => {
      return new AppError(code, message, options);
    };
  }

  return factories;
}
