/**
 * Command Executor module
 *
 * Provides an abstraction layer for shell command execution to enable testability.
 * Includes production implementation using CommandSanitizer and mock implementation for testing.
 *
 * @module utilities/CommandExecutor
 */

import { getCommandSanitizer } from '../security/index.js';

/**
 * Command execution result
 */
export interface ExecutionResult {
  /** Standard output from the command */
  stdout: string;
  /** Standard error from the command */
  stderr: string;
  /** Exit code (0 = success) */
  exitCode: number;
}

/**
 * Options for command execution
 */
export interface ExecuteOptions {
  /** Working directory for command execution */
  cwd?: string;
  /** Timeout in milliseconds */
  timeout?: number;
  /** Maximum buffer size for stdout/stderr */
  maxBuffer?: number;
  /** Whether to ignore non-zero exit codes (returns result instead of throwing) */
  ignoreExitCode?: boolean;
}

/**
 * Command executor interface for dependency injection and testing
 */
export interface ICommandExecutor {
  /**
   * Execute a shell command asynchronously
   *
   * @param command - The command string to execute
   * @param options - Execution options
   * @returns Promise resolving to execution result
   */
  execute(command: string, options?: ExecuteOptions): Promise<ExecutionResult>;
}

/**
 * Production command executor using CommandSanitizer
 *
 * This implementation provides secure command execution through the centralized
 * CommandSanitizer which validates commands against a whitelist and prevents
 * command injection attacks.
 */
export class ShellCommandExecutor implements ICommandExecutor {
  private readonly defaultCwd: string;
  private readonly defaultTimeout: number;
  private readonly defaultMaxBuffer: number;

  constructor(options?: { cwd?: string; timeout?: number; maxBuffer?: number }) {
    this.defaultCwd = options?.cwd ?? process.cwd();
    this.defaultTimeout = options?.timeout ?? 120000;
    this.defaultMaxBuffer = options?.maxBuffer ?? 10 * 1024 * 1024;
  }

  /**
   * Execute a command using the secure CommandSanitizer
   */
  public async execute(command: string, options?: ExecuteOptions): Promise<ExecutionResult> {
    const sanitizer = getCommandSanitizer();

    try {
      const result = await sanitizer.execFromString(command, {
        cwd: options?.cwd ?? this.defaultCwd,
        timeout: options?.timeout ?? this.defaultTimeout,
        maxBuffer: options?.maxBuffer ?? this.defaultMaxBuffer,
      });

      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.success ? 0 : (result.exitCode ?? 1),
      };
    } catch (error: unknown) {
      // Handle error responses that include exitCode (command ran but failed)
      if (error !== null && typeof error === 'object' && 'exitCode' in error) {
        const execError = error as { stdout?: string; stderr?: string; exitCode?: number };

        if (options?.ignoreExitCode === true) {
          return {
            stdout: execError.stdout ?? '',
            stderr: execError.stderr ?? '',
            exitCode: execError.exitCode ?? 1,
          };
        }
      }
      throw error;
    }
  }
}

/**
 * Mock command executor for testing
 *
 * Allows test code to define expected command responses without executing
 * actual shell commands. Supports exact match and pattern-based matching.
 */
export class MockCommandExecutor implements ICommandExecutor {
  private readonly exactResponses = new Map<string, ExecutionResult>();
  private readonly patternResponses: Array<{ pattern: RegExp; result: ExecutionResult }> = [];
  private readonly executedCommands: Array<{ command: string; options?: ExecuteOptions }> = [];
  private defaultResult: ExecutionResult = { stdout: '', stderr: '', exitCode: 0 };

  /**
   * Mock a specific command response (exact match)
   *
   * @param command - The exact command string to match
   * @param result - The result to return when command is executed
   */
  public mockResponse(command: string, result: ExecutionResult): void {
    this.exactResponses.set(command, result);
  }

  /**
   * Mock a command response using a regex pattern
   *
   * @param pattern - Regex pattern to match against commands
   * @param result - The result to return when pattern matches
   */
  public mockPatternResponse(pattern: RegExp, result: ExecutionResult): void {
    this.patternResponses.push({ pattern, result });
  }

  /**
   * Set default result for unmatched commands
   *
   * @param result - Default result to return
   */
  public setDefaultResult(result: ExecutionResult): void {
    this.defaultResult = result;
  }

  /**
   * Get list of all executed commands (for assertions)
   */
  public getExecutedCommands(): ReadonlyArray<{ command: string; options?: ExecuteOptions }> {
    return this.executedCommands;
  }

  /**
   * Clear all mock responses and executed commands
   */
  public reset(): void {
    this.exactResponses.clear();
    this.patternResponses.length = 0;
    this.executedCommands.length = 0;
    this.defaultResult = { stdout: '', stderr: '', exitCode: 0 };
  }

  /**
   * Check if a specific command was executed
   *
   * @param command - The command to check for (exact match)
   * @returns true if the command was executed
   */
  public wasExecuted(command: string): boolean {
    return this.executedCommands.some((c) => c.command === command);
  }

  /**
   * Check if any command matching the pattern was executed
   *
   * @param pattern - Regex pattern to match
   * @returns true if a matching command was executed
   */
  public wasPatternExecuted(pattern: RegExp): boolean {
    return this.executedCommands.some((c) => pattern.test(c.command));
  }

  /**
   * Execute a mocked command
   */
  public execute(command: string, options?: ExecuteOptions): Promise<ExecutionResult> {
    // Only add options if defined to maintain exactOptionalPropertyTypes compatibility
    if (options !== undefined) {
      this.executedCommands.push({ command, options });
    } else {
      this.executedCommands.push({ command });
    }

    // Check exact match first
    const exactMatch = this.exactResponses.get(command);
    if (exactMatch !== undefined) {
      return Promise.resolve(exactMatch);
    }

    // Check pattern matches
    for (const { pattern, result } of this.patternResponses) {
      if (pattern.test(command)) {
        return Promise.resolve(result);
      }
    }

    // Return default result
    return Promise.resolve(this.defaultResult);
  }
}

/**
 * Default singleton instance of ShellCommandExecutor
 */
let defaultExecutor: ICommandExecutor | null = null;

/**
 * Get the default command executor singleton
 */
export function getCommandExecutor(): ICommandExecutor {
  if (defaultExecutor === null) {
    defaultExecutor = new ShellCommandExecutor();
  }
  return defaultExecutor;
}

/**
 * Set a custom command executor (useful for testing)
 *
 * @param executor - The executor to use as default
 */
export function setCommandExecutor(executor: ICommandExecutor): void {
  defaultExecutor = executor;
}

/**
 * Reset the default command executor to null
 */
export function resetCommandExecutor(): void {
  defaultExecutor = null;
}
