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
