/**
 * Helpers for long-input regression tests of regular expressions that used to
 * backtrack polynomially (CodeQL js/polynomial-redos, kcenon/claude_code_agent#973).
 */

/** Number of repetitions of the character that made the old expressions slow. */
export const LONG_INPUT_LENGTH = 100_000;

/**
 * Generous wall-clock bound in milliseconds. The old expressions needed seconds
 * (or much longer) at {@link LONG_INPUT_LENGTH}; the rewritten ones finish in a
 * few milliseconds, so the bound leaves room for slow CI runners.
 */
export const LONG_INPUT_TIME_LIMIT_MS = 1000;

/**
 * Run a function and measure its wall-clock time.
 * @param fn - Function under test
 * @returns The function result and the elapsed time in milliseconds
 */
export function timed<T>(fn: () => T): { result: T; elapsedMs: number } {
  const start = performance.now();
  const result = fn();
  return { result, elapsedMs: performance.now() - start };
}
