/**
 * V&V Error Classes
 *
 * Module-specific error class extending AppError for all V&V subsystems.
 *
 * @module vnv/errors
 */

import { AppError } from '../errors/AppError.js';
import type { AppErrorOptions, ErrorContext } from '../errors/types.js';
import { ErrorSeverity } from '../errors/types.js';
import { VnvErrorCodes } from '../errors/codes.js';

/**
 * Base error class for all V&V operations.
 *
 * Follows the AD-SDLC error pattern with code, severity, category, and context.
 */
export class VnvError extends AppError {
  constructor(code: string, message: string, options: AppErrorOptions = {}) {
    super(code, message, options);
    this.name = 'VnvError';
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create error for stage verification failure
 * @param stageName
 * @param failedChecks
 * @param context
 */
export function stageVerificationFailedError(
  stageName: string,
  failedChecks: number,
  context?: ErrorContext
): VnvError {
  return new VnvError(
    VnvErrorCodes.VNV_VERIFICATION_FAILED,
    `Stage '${stageName}' verification failed: ${String(failedChecks)} check(s) did not pass`,
    {
      severity: ErrorSeverity.HIGH,
      category: 'recoverable',
      context: { stageName, failedChecks, ...context },
    }
  );
}

/**
 * Create error for content validation failure
 * @param stageName
 * @param reason
 * @param context
 */
export function contentValidationError(
  stageName: string,
  reason: string,
  context?: ErrorContext
): VnvError {
  return new VnvError(
    VnvErrorCodes.VNV_CONTENT_VALIDATION_ERROR,
    `Content validation failed for stage '${stageName}': ${reason}`,
    {
      severity: ErrorSeverity.MEDIUM,
      category: 'recoverable',
      context: { stageName, reason, ...context },
    }
  );
}

/**
 * Create error for traceability gap
 * @param affectedIds
 * @param reason
 * @param context
 */
export function traceabilityGapError(
  affectedIds: readonly string[],
  reason: string,
  context?: ErrorContext
): VnvError {
  return new VnvError(VnvErrorCodes.VNV_TRACEABILITY_GAP, `Traceability gap detected: ${reason}`, {
    severity: ErrorSeverity.HIGH,
    category: 'recoverable',
    context: { affectedIds, reason, ...context },
  });
}

/**
 * Create error for cross-document consistency violation
 * @param syncPoint
 * @param sourceDoc
 * @param targetDoc
 * @param context
 */
export function consistencyViolationError(
  syncPoint: string,
  sourceDoc: string,
  targetDoc: string,
  context?: ErrorContext
): VnvError {
  return new VnvError(
    VnvErrorCodes.VNV_CONSISTENCY_VIOLATION,
    `Consistency violation at sync point '${syncPoint}' between ${sourceDoc} and ${targetDoc}`,
    {
      severity: ErrorSeverity.MEDIUM,
      category: 'recoverable',
      context: { syncPoint, sourceDoc, targetDoc, ...context },
    }
  );
}

/**
 * Create error for RTM build failure
 * @param reason
 * @param context
 */
export function rtmBuildError(reason: string, context?: ErrorContext): VnvError {
  return new VnvError(VnvErrorCodes.VNV_RTM_BUILD_ERROR, `Failed to build RTM: ${reason}`, {
    severity: ErrorSeverity.HIGH,
    category: 'recoverable',
    context: { reason, ...context },
  });
}

/**
 * Create error for validation failure
 * @param overallResult
 * @param reason
 * @param context
 */
export function validationFailedError(
  overallResult: string,
  reason: string,
  context?: ErrorContext
): VnvError {
  return new VnvError(
    VnvErrorCodes.VNV_VALIDATION_FAILED,
    `Pipeline validation failed (${overallResult}): ${reason}`,
    {
      severity: ErrorSeverity.HIGH,
      category: 'recoverable',
      context: { overallResult, reason, ...context },
    }
  );
}

/**
 * Create error for acceptance criteria failure
 * @param requirementId
 * @param criterionId
 * @param context
 */
export function acceptanceCriteriaFailedError(
  requirementId: string,
  criterionId: string,
  context?: ErrorContext
): VnvError {
  return new VnvError(
    VnvErrorCodes.VNV_ACCEPTANCE_CRITERIA_FAILED,
    `Acceptance criterion ${criterionId} for requirement ${requirementId} not satisfied`,
    {
      severity: ErrorSeverity.MEDIUM,
      category: 'recoverable',
      context: { requirementId, criterionId, ...context },
    }
  );
}

/**
 * Create error for V&V report generation failure
 * @param reportType
 * @param reason
 * @param context
 */
export function reportGenerationError(
  reportType: string,
  reason: string,
  context?: ErrorContext
): VnvError {
  return new VnvError(
    VnvErrorCodes.VNV_REPORT_GENERATION_ERROR,
    `Failed to generate ${reportType}: ${reason}`,
    {
      severity: ErrorSeverity.MEDIUM,
      category: 'transient',
      context: { reportType, reason, ...context },
    }
  );
}

/**
 * Create error for V&V configuration error
 * @param reason
 * @param context
 */
export function vnvConfigError(reason: string, context?: ErrorContext): VnvError {
  return new VnvError(VnvErrorCodes.VNV_CONFIG_ERROR, `V&V configuration error: ${reason}`, {
    severity: ErrorSeverity.HIGH,
    category: 'fatal',
    context: { reason, ...context },
  });
}
