/**
 * CI Fixer module error classes
 *
 * Defines error hierarchy for CI analysis, fix application,
 * delegation handling, and escalation scenarios.
 *
 * @module ci-fixer/errors
 */

import type { EscalationReason } from './types.js';

/**
 * Base error class for CI Fixer operations
 */
export class CIFixerError extends Error {
  public readonly code: string;
  public override readonly cause?: Error | undefined;

  constructor(message: string, code: string, cause?: Error) {
    super(message);
    this.name = 'CIFixerError';
    this.code = code;
    if (cause !== undefined) {
      this.cause = cause;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ============================================================================
// Handoff Errors
// ============================================================================

/**
 * Error when handoff document is not found
 */
export class HandoffNotFoundError extends CIFixerError {
  public readonly handoffPath: string;

  constructor(handoffPath: string) {
    super(`CI Fix handoff document not found at: ${handoffPath}`, 'HANDOFF_NOT_FOUND');
    this.name = 'HandoffNotFoundError';
    this.handoffPath = handoffPath;
  }
}

/**
 * Error when handoff document cannot be parsed
 */
export class HandoffParseError extends CIFixerError {
  public readonly handoffPath: string;

  constructor(handoffPath: string, cause?: Error) {
    super(`Failed to parse CI Fix handoff document at: ${handoffPath}`, 'HANDOFF_PARSE_ERROR', cause);
    this.name = 'HandoffParseError';
    this.handoffPath = handoffPath;
  }
}

/**
 * Error when handoff document is invalid
 */
export class HandoffValidationError extends CIFixerError {
  public readonly field: string;

  constructor(field: string, reason: string) {
    super(`Invalid handoff document: ${field} - ${reason}`, 'HANDOFF_VALIDATION_ERROR');
    this.name = 'HandoffValidationError';
    this.field = field;
  }
}

// ============================================================================
// CI Log Errors
// ============================================================================

/**
 * Error when CI logs cannot be fetched
 */
export class CILogFetchError extends CIFixerError {
  public readonly runId: number;

  constructor(runId: number, cause?: Error) {
    super(`Failed to fetch CI logs for run ${String(runId)}`, 'CI_LOG_FETCH_ERROR', cause);
    this.name = 'CILogFetchError';
    this.runId = runId;
  }
}

/**
 * Error when CI log parsing fails
 */
export class CILogParseError extends CIFixerError {
  constructor(reason: string, cause?: Error) {
    super(`Failed to parse CI logs: ${reason}`, 'CI_LOG_PARSE_ERROR', cause);
    this.name = 'CILogParseError';
  }
}

/**
 * Error when no CI logs are available
 */
export class CILogsNotAvailableError extends CIFixerError {
  public readonly prNumber: number;

  constructor(prNumber: number) {
    super(`No CI logs available for PR #${String(prNumber)}`, 'CI_LOGS_NOT_AVAILABLE');
    this.name = 'CILogsNotAvailableError';
    this.prNumber = prNumber;
  }
}

// ============================================================================
// Fix Errors
// ============================================================================

/**
 * Error when fix application fails
 */
export class FixApplicationError extends CIFixerError {
  public readonly fixType: string;
  public readonly file: string;

  constructor(fixType: string, file: string, cause?: Error) {
    super(`Failed to apply ${fixType} fix to ${file}`, 'FIX_APPLICATION_ERROR', cause);
    this.name = 'FixApplicationError';
    this.fixType = fixType;
    this.file = file;
  }
}

/**
 * Error when lint fix command fails
 */
export class LintFixError extends CIFixerError {
  public readonly exitCode: number;
  public readonly output: string;

  constructor(exitCode: number, output: string) {
    super(`Lint fix command failed with exit code ${String(exitCode)}`, 'LINT_FIX_ERROR');
    this.name = 'LintFixError';
    this.exitCode = exitCode;
    this.output = output;
  }
}

/**
 * Error when type fix fails
 */
export class TypeFixError extends CIFixerError {
  public readonly file: string;
  public readonly line: number;

  constructor(file: string, line: number, reason: string, cause?: Error) {
    super(
      `Failed to fix type error in ${file}:${String(line)}: ${reason}`,
      'TYPE_FIX_ERROR',
      cause
    );
    this.name = 'TypeFixError';
    this.file = file;
    this.line = line;
  }
}

/**
 * Error when test fix fails
 */
export class TestFixError extends CIFixerError {
  public readonly testFile: string;
  public readonly testName: string;

  constructor(testFile: string, testName: string, reason: string, cause?: Error) {
    super(
      `Failed to fix test "${testName}" in ${testFile}: ${reason}`,
      'TEST_FIX_ERROR',
      cause
    );
    this.name = 'TestFixError';
    this.testFile = testFile;
    this.testName = testName;
  }
}

/**
 * Error when build fix fails
 */
export class BuildFixError extends CIFixerError {
  public readonly buildError: string;

  constructor(buildError: string, cause?: Error) {
    super(`Failed to fix build error: ${buildError}`, 'BUILD_FIX_ERROR', cause);
    this.name = 'BuildFixError';
    this.buildError = buildError;
  }
}

// ============================================================================
// Verification Errors
// ============================================================================

/**
 * Error when local verification fails
 */
export class VerificationError extends CIFixerError {
  public readonly failedChecks: readonly string[];

  constructor(failedChecks: readonly string[]) {
    super(
      `Local verification failed: ${failedChecks.join(', ')}`,
      'VERIFICATION_ERROR'
    );
    this.name = 'VerificationError';
    this.failedChecks = failedChecks;
  }
}

/**
 * Error when verification times out
 */
export class VerificationTimeoutError extends CIFixerError {
  public readonly check: string;
  public readonly timeoutMs: number;

  constructor(check: string, timeoutMs: number) {
    super(
      `Verification timed out for ${check} after ${String(timeoutMs)}ms`,
      'VERIFICATION_TIMEOUT'
    );
    this.name = 'VerificationTimeoutError';
    this.check = check;
    this.timeoutMs = timeoutMs;
  }
}

// ============================================================================
// Delegation Errors
// ============================================================================

/**
 * Error when maximum delegations are exceeded
 */
export class MaxDelegationsExceededError extends CIFixerError {
  public readonly maxDelegations: number;
  public readonly currentDelegation: number;

  constructor(maxDelegations: number, currentDelegation: number) {
    super(
      `Maximum delegations (${String(maxDelegations)}) exceeded at delegation ${String(currentDelegation)}`,
      'MAX_DELEGATIONS_EXCEEDED'
    );
    this.name = 'MaxDelegationsExceededError';
    this.maxDelegations = maxDelegations;
    this.currentDelegation = currentDelegation;
  }
}

/**
 * Error when handoff creation fails
 */
export class HandoffCreationError extends CIFixerError {
  public readonly prNumber: number;

  constructor(prNumber: number, cause?: Error) {
    super(
      `Failed to create handoff document for PR #${String(prNumber)}`,
      'HANDOFF_CREATION_ERROR',
      cause
    );
    this.name = 'HandoffCreationError';
    this.prNumber = prNumber;
  }
}

// ============================================================================
// Escalation Errors
// ============================================================================

/**
 * Error when escalation is required
 */
export class EscalationRequiredError extends CIFixerError {
  public readonly reason: EscalationReason;
  public readonly prNumber: number;

  constructor(prNumber: number, reason: EscalationReason, description: string) {
    super(
      `Escalation required for PR #${String(prNumber)}: ${description}`,
      'ESCALATION_REQUIRED'
    );
    this.name = 'EscalationRequiredError';
    this.reason = reason;
    this.prNumber = prNumber;
  }
}

/**
 * Error when escalation fails
 */
export class EscalationError extends CIFixerError {
  public readonly prNumber: number;

  constructor(prNumber: number, cause?: Error) {
    super(
      `Failed to escalate PR #${String(prNumber)}`,
      'ESCALATION_ERROR',
      cause
    );
    this.name = 'EscalationError';
    this.prNumber = prNumber;
  }
}

// ============================================================================
// Git Errors
// ============================================================================

/**
 * Error when git operation fails
 */
export class GitOperationError extends CIFixerError {
  public readonly operation: string;

  constructor(operation: string, cause?: Error) {
    super(`Git operation failed: ${operation}`, 'GIT_OPERATION_ERROR', cause);
    this.name = 'GitOperationError';
    this.operation = operation;
  }
}

/**
 * Error when commit fails
 */
export class CommitError extends CIFixerError {
  public readonly branch: string;

  constructor(branch: string, cause?: Error) {
    super(`Failed to commit changes to branch: ${branch}`, 'COMMIT_ERROR', cause);
    this.name = 'CommitError';
    this.branch = branch;
  }
}

/**
 * Error when push fails
 */
export class PushError extends CIFixerError {
  public readonly branch: string;

  constructor(branch: string, cause?: Error) {
    super(`Failed to push changes to branch: ${branch}`, 'PUSH_ERROR', cause);
    this.name = 'PushError';
    this.branch = branch;
  }
}

// ============================================================================
// CI Wait Errors
// ============================================================================

/**
 * Error when CI wait times out
 */
export class CIWaitTimeoutError extends CIFixerError {
  public readonly prNumber: number;
  public readonly timeoutMs: number;

  constructor(prNumber: number, timeoutMs: number) {
    super(
      `CI wait timed out for PR #${String(prNumber)} after ${String(timeoutMs)}ms`,
      'CI_WAIT_TIMEOUT'
    );
    this.name = 'CIWaitTimeoutError';
    this.prNumber = prNumber;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Error when CI checks fail after fix
 */
export class CIStillFailingError extends CIFixerError {
  public readonly prNumber: number;
  public readonly failedChecks: readonly string[];

  constructor(prNumber: number, failedChecks: readonly string[]) {
    super(
      `CI checks still failing for PR #${String(prNumber)}: ${failedChecks.join(', ')}`,
      'CI_STILL_FAILING'
    );
    this.name = 'CIStillFailingError';
    this.prNumber = prNumber;
    this.failedChecks = failedChecks;
  }
}

// ============================================================================
// Security Errors
// ============================================================================

/**
 * Error when security vulnerability is detected
 */
export class SecurityVulnerabilityError extends CIFixerError {
  public readonly vulnerabilityType: string;
  public readonly severity: 'critical' | 'high' | 'medium' | 'low';

  constructor(vulnerabilityType: string, severity: 'critical' | 'high' | 'medium' | 'low') {
    super(
      `Security vulnerability detected: ${vulnerabilityType} (${severity})`,
      'SECURITY_VULNERABILITY'
    );
    this.name = 'SecurityVulnerabilityError';
    this.vulnerabilityType = vulnerabilityType;
    this.severity = severity;
  }
}

// ============================================================================
// Result Persistence Errors
// ============================================================================

/**
 * Error when result persistence fails
 */
export class ResultPersistenceError extends CIFixerError {
  public readonly resultPath: string;

  constructor(resultPath: string, cause?: Error) {
    super(`Failed to persist CI fix result to: ${resultPath}`, 'RESULT_PERSISTENCE_ERROR', cause);
    this.name = 'ResultPersistenceError';
    this.resultPath = resultPath;
  }
}
