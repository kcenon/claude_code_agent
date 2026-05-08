/**
 * Execution environment detection helpers.
 *
 * Standalone utilities for inspecting the runtime environment to decide
 * whether a real {@link ExecutionAdapter} backend is available.
 *
 * @packageDocumentation
 */

/**
 * Detect if running inside a Claude Code session.
 *
 * Checks four environment variables that Claude Code may set:
 * - `CLAUDE_CODE_SESSION` — legacy session marker
 * - `CLAUDE_CODE` — legacy presence flag
 * - `CLAUDECODE` — runtime flag (set to "1")
 * - `CLAUDE_CODE_ENTRYPOINT` — entry point identifier (e.g. "cli")
 *
 * @returns True if any Claude Code marker is present in the process env.
 */
export function isClaudeCodeSession(): boolean {
  return (
    (process.env['CLAUDE_CODE_SESSION'] ?? '') !== '' ||
    (process.env['CLAUDE_CODE'] ?? '') !== '' ||
    process.env['CLAUDECODE'] === '1' ||
    (process.env['CLAUDE_CODE_ENTRYPOINT'] ?? '') !== ''
  );
}

/**
 * Detect if an `ANTHROPIC_API_KEY` is configured in the environment.
 *
 * @returns True when the env var is set to a non-empty string.
 */
export function hasAnthropicApiKey(): boolean {
  const value = process.env['ANTHROPIC_API_KEY'];
  return value !== undefined && value !== '';
}

/**
 * Indicates whether a real execution backend (Claude Code session or
 * Anthropic API key) is available. Used by the CLI to decide whether
 * pipeline execution will hit a live model or fall back to a stub.
 *
 * @returns True if at least one real backend marker is detected.
 */
export function hasRealExecutionEnvironment(): boolean {
  return isClaudeCodeSession() || hasAnthropicApiKey();
}

/**
 * Identifier for the detected execution backend. Used for diagnostic
 * display in CLI commands like `doctor` and `pipeline --dry-run`.
 *
 * `'claude-code'` takes precedence over `'anthropic-api'` so that an
 * active session is always preferred when both markers are present.
 */
export type ExecutionEnvironmentLabel = 'claude-code' | 'anthropic-api' | 'none';

/**
 * Describe the active execution backend, if any.
 *
 * @returns Label identifying the highest-priority backend that is
 *   currently available, or `'none'` when neither marker is present.
 */
export function describeExecutionEnvironment(): ExecutionEnvironmentLabel {
  if (isClaudeCodeSession()) {
    return 'claude-code';
  }
  if (hasAnthropicApiKey()) {
    return 'anthropic-api';
  }
  return 'none';
}
