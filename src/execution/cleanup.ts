/** SDK-observable cleanup policy shared by adapters and the stage scheduler. */
import { AppError } from '../errors/AppError.js';
import { ErrorSeverity, type ErrorContext } from '../errors/types.js';

/** SDK 0.3.258 waits up to 2 seconds for process exit; allow 3 more for other cleanup. */
export const DEFAULT_CLEANUP_GRACE_MS = 5000;

/** Allow adapter diagnostics to propagate before the scheduler's fallback expires. */
export const SCHEDULER_CLEANUP_MARGIN_MS = 1000;

/** A fatal cleanup failure; the cause remains the original execution/cancellation reason. */
export class ExecutionCleanupError extends AppError {
  constructor(message: string, reason: unknown, context: ErrorContext = {}) {
    const cause = reason instanceof Error ? reason : new Error(String(reason));
    super('EXEC-004', message, {
      severity: ErrorSeverity.CRITICAL,
      category: 'fatal',
      context: { ...context, reason: reason instanceof Error ? reason.message : reason },
      ...(reason !== undefined ? { cause } : {}),
    });
    this.name = 'ExecutionCleanupError';
  }
}

/** Recognize reconstituted cleanup errors without relying on subclass identity.
 * @param error - Candidate error from an execution or serialization boundary
 * @returns Whether the error carries the fatal cleanup code
 */
export function isExecutionCleanupError(error: unknown): error is AppError {
  return error instanceof AppError && error.code === 'EXEC-004';
}

/**
 * Bound observation, not the underlying work. Both late fulfillment and rejection
 * remain observed, and the owned timer is always removed.
 * @param work - The cleanup boundary to observe
 * @param graceMs - Time budget independent of the execution budget
 * @param onTimeout - Creates a diagnostic without asserting that work stopped
 * @returns The observed result
 */
export async function withinCleanupGrace<T>(
  work: Promise<T>,
  graceMs: number,
  onTimeout: () => Error
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(onTimeout());
        }, graceMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
