/**
 * CommandSanitizer - Secure command execution with injection prevention
 *
 * Features:
 * - Command whitelisting
 * - Argument sanitization
 * - Shell metacharacter prevention
 * - Safe execution using execFile (bypasses shell)
 */

import {
  execFile as execFileCallback,
  execFileSync,
  type ExecFileOptions,
  type ExecFileSyncOptions,
} from 'node:child_process';
import { promisify } from 'node:util';
import {
  type CommandWhitelistConfig,
  DEFAULT_COMMAND_WHITELIST,
  isAllowedCommand,
  isAllowedSubcommand,
  getCommandConfig,
  containsShellMetacharacters,
  SHELL_METACHARACTERS,
} from './CommandWhitelist.js';
import { CommandInjectionError, CommandNotAllowedError } from './errors.js';
import type { SanitizedCommand, CommandExecResult, CommandSanitizerOptions } from './types.js';

const execFileAsync = promisify(execFileCallback);

/**
 * Singleton instance of CommandSanitizer
 */
let sanitizerInstance: CommandSanitizer | null = null;

/**
 * CommandSanitizer - Validates and executes commands safely
 *
 * This class provides secure command execution by:
 * 1. Validating commands against a whitelist
 * 2. Sanitizing arguments to prevent injection
 * 3. Using execFile instead of exec (bypasses shell)
 */
export class CommandSanitizer {
  private readonly whitelist: CommandWhitelistConfig;
  private readonly strictMode: boolean;
  private readonly logCommands: boolean;

  constructor(options: CommandSanitizerOptions = {}) {
    this.whitelist = options.whitelist ?? DEFAULT_COMMAND_WHITELIST;
    this.strictMode = options.strictMode ?? true;
    this.logCommands = options.logCommands ?? false;
  }

  /**
   * Validate and sanitize a command before execution
   *
   * @param baseCommand - The base command (e.g., 'git', 'npm')
   * @param args - Command arguments
   * @returns Sanitized command object
   * @throws CommandNotAllowedError if command is not whitelisted
   * @throws CommandInjectionError if injection is detected
   */
  public validateCommand(baseCommand: string, args: string[]): SanitizedCommand {
    // Check if base command is allowed
    if (!isAllowedCommand(baseCommand, this.whitelist)) {
      throw new CommandNotAllowedError(baseCommand, 'Command not in whitelist');
    }

    const config = getCommandConfig(baseCommand, this.whitelist);
    const sanitizedArgs: string[] = [];

    // Validate subcommand if defined
    if (args.length > 0 && config?.subcommands !== undefined) {
      const subcommand = args[0];
      if (subcommand !== undefined && !isAllowedSubcommand(baseCommand, subcommand, this.whitelist)) {
        throw new CommandNotAllowedError(
          `${baseCommand} ${subcommand}`,
          `Subcommand '${subcommand}' not allowed for '${baseCommand}'`
        );
      }
    }

    // Check argument count
    if (config?.maxArgs !== undefined && args.length > config.maxArgs) {
      throw new CommandInjectionError(
        `Too many arguments: ${String(args.length)} (max: ${String(config.maxArgs)})`
      );
    }

    // Sanitize each argument
    for (const arg of args) {
      const sanitized = this.sanitizeArgument(arg, baseCommand);
      sanitizedArgs.push(sanitized);
    }

    const subCommand = sanitizedArgs.length > 0 ? sanitizedArgs[0] : undefined;

    return {
      baseCommand,
      subCommand,
      args: sanitizedArgs,
      rawCommand: `${baseCommand} ${sanitizedArgs.join(' ')}`,
    };
  }

  /**
   * Sanitize a single argument
   *
   * @param arg - The argument to sanitize
   * @param command - The base command (for context-specific validation)
   * @returns Sanitized argument
   * @throws CommandInjectionError if dangerous characters are detected in strict mode
   */
  public sanitizeArgument(arg: string, command?: string): string {
    // Check for null bytes (always dangerous)
    if (arg.includes('\0')) {
      throw new CommandInjectionError('Null byte detected in argument');
    }

    // Check for newlines (can be used to inject commands)
    if (arg.includes('\n') || arg.includes('\r')) {
      throw new CommandInjectionError('Newline detected in argument');
    }

    // In strict mode, reject any shell metacharacters
    if (this.strictMode && containsShellMetacharacters(arg)) {
      throw new CommandInjectionError(
        `Shell metacharacters detected in argument: ${this.maskSensitiveArg(arg)}`
      );
    }

    // Additional validation based on command config
    const config = command !== undefined ? getCommandConfig(command, this.whitelist) : undefined;
    if (config !== undefined && !config.allowArbitraryArgs) {
      // For commands without allowArbitraryArgs, do extra validation
      if (arg.startsWith('-') && arg.length > 2 && !arg.startsWith('--')) {
        // Multiple short flags like -abc are okay
      } else if (arg.startsWith('--') && arg.includes('=')) {
        // --flag=value format, validate the value part
        const valueIndex = arg.indexOf('=');
        const value = arg.slice(valueIndex + 1);
        if (containsShellMetacharacters(value)) {
          throw new CommandInjectionError(
            `Shell metacharacters in flag value: ${this.maskSensitiveArg(value)}`
          );
        }
      }
    }

    return arg;
  }

  /**
   * Escape a single argument for shell use
   * Wraps in single quotes and escapes internal single quotes
   *
   * @param arg - The argument to escape
   * @returns Escaped argument safe for shell use
   */
  public escapeForShell(arg: string): string {
    // Single-quote the argument and escape any internal single quotes
    // 'arg' -> 'arg'
    // "it's" -> 'it'\''s'
    return `'${arg.replace(/'/g, "'\\''")}'`;
  }

  /**
   * Execute a command safely using execFile (no shell)
   *
   * @param command - Sanitized command object
   * @param options - Execution options
   * @returns Command execution result
   */
  public async safeExec(
    command: SanitizedCommand,
    options: ExecFileOptions = {}
  ): Promise<CommandExecResult> {
    const startTime = Date.now();

    if (this.logCommands) {
      console.log(`[CommandSanitizer] Executing: ${command.rawCommand}`);
    }

    try {
      const { stdout, stderr } = await execFileAsync(command.baseCommand, command.args, {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: 300000, // 5 minute default timeout
        ...options,
      } as ExecFileOptions & { encoding: 'utf-8' });

      const duration = Date.now() - startTime;

      if (this.logCommands) {
        console.log(`[CommandSanitizer] Completed in ${String(duration)}ms`);
      }

      return {
        success: true,
        stdout: stdout ?? '',
        stderr: stderr ?? '',
        command: command.rawCommand,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Extract stdout/stderr from error if available
      const execError = error as { stdout?: string; stderr?: string; code?: number };

      if (this.logCommands) {
        console.error(`[CommandSanitizer] Failed after ${String(duration)}ms: ${errorMessage}`);
      }

      return {
        success: false,
        stdout: execError.stdout ?? '',
        stderr: execError.stderr ?? errorMessage,
        command: command.rawCommand,
        duration,
        exitCode: execError.code,
      };
    }
  }

  /**
   * Validate and execute a command in one step
   *
   * @param baseCommand - The base command
   * @param args - Command arguments
   * @param options - Execution options
   * @returns Command execution result
   */
  public async exec(
    baseCommand: string,
    args: string[],
    options: ExecFileOptions = {}
  ): Promise<CommandExecResult> {
    const sanitized = this.validateCommand(baseCommand, args);
    return this.safeExec(sanitized, options);
  }

  /**
   * Execute a git command safely
   *
   * @param args - Git command arguments (e.g., ['status', '--porcelain'])
   * @param options - Execution options
   * @returns Command execution result
   */
  public async execGit(args: string[], options: ExecFileOptions = {}): Promise<CommandExecResult> {
    return this.exec('git', args, options);
  }

  /**
   * Execute a GitHub CLI command safely
   *
   * @param args - gh command arguments (e.g., ['pr', 'list'])
   * @param options - Execution options
   * @returns Command execution result
   */
  public async execGh(args: string[], options: ExecFileOptions = {}): Promise<CommandExecResult> {
    return this.exec('gh', args, options);
  }

  /**
   * Execute an npm command safely
   *
   * @param args - npm command arguments (e.g., ['install', '--save-dev'])
   * @param options - Execution options
   * @returns Command execution result
   */
  public async execNpm(args: string[], options: ExecFileOptions = {}): Promise<CommandExecResult> {
    return this.exec('npm', args, options);
  }

  /**
   * Execute a command synchronously using execFileSync (no shell)
   *
   * @param command - Sanitized command object
   * @param options - Execution options
   * @returns Command execution result
   */
  public safeExecSync(
    command: SanitizedCommand,
    options: ExecFileSyncOptions = {}
  ): CommandExecResult {
    const startTime = Date.now();

    if (this.logCommands) {
      console.log(`[CommandSanitizer] Executing (sync): ${command.rawCommand}`);
    }

    try {
      const output = execFileSync(command.baseCommand, command.args, {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
        timeout: 300000,
        ...options,
      } as ExecFileSyncOptions & { encoding: 'utf-8' });

      const duration = Date.now() - startTime;

      if (this.logCommands) {
        console.log(`[CommandSanitizer] Completed in ${String(duration)}ms`);
      }

      return {
        success: true,
        stdout: output ?? '',
        stderr: '',
        command: command.rawCommand,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const execError = error as { stdout?: string; stderr?: string; status?: number };
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (this.logCommands) {
        console.error(`[CommandSanitizer] Failed after ${String(duration)}ms: ${errorMessage}`);
      }

      return {
        success: false,
        stdout: typeof execError.stdout === 'string' ? execError.stdout : '',
        stderr: typeof execError.stderr === 'string' ? execError.stderr : errorMessage,
        command: command.rawCommand,
        duration,
        exitCode: execError.status,
      };
    }
  }

  /**
   * Validate and execute a command synchronously
   *
   * @param baseCommand - The base command
   * @param args - Command arguments
   * @param options - Execution options
   * @returns Command execution result
   */
  public execSync(
    baseCommand: string,
    args: string[],
    options: ExecFileSyncOptions = {}
  ): CommandExecResult {
    const sanitized = this.validateCommand(baseCommand, args);
    return this.safeExecSync(sanitized, options);
  }

  /**
   * Execute a git command synchronously
   *
   * @param args - Git command arguments
   * @param options - Execution options
   * @returns Command execution result
   */
  public execGitSync(args: string[], options: ExecFileSyncOptions = {}): CommandExecResult {
    return this.execSync('git', args, options);
  }

  /**
   * Execute a GitHub CLI command synchronously
   *
   * @param args - gh command arguments
   * @param options - Execution options
   * @returns Command execution result
   */
  public execGhSync(args: string[], options: ExecFileSyncOptions = {}): CommandExecResult {
    return this.execSync('gh', args, options);
  }

  /**
   * Check if a command is allowed
   *
   * @param command - The command to check
   * @returns True if the command is allowed
   */
  public isAllowed(command: string): boolean {
    return isAllowedCommand(command, this.whitelist);
  }

  /**
   * Parse a command string into base command and arguments
   * Note: This is for migration purposes only. Prefer passing arguments as array.
   *
   * @param commandString - Full command string (e.g., "git status --porcelain")
   * @returns Parsed command and arguments
   */
  public parseCommandString(commandString: string): { command: string; args: string[] } {
    // Simple tokenization - doesn't handle all shell quoting
    const tokens = commandString.trim().split(/\s+/);
    const command = tokens[0] ?? '';
    const args = tokens.slice(1);
    return { command, args };
  }

  /**
   * Mask sensitive parts of an argument for logging
   *
   * @param arg - The argument to mask
   * @returns Masked argument
   */
  private maskSensitiveArg(arg: string): string {
    // Show first and last few characters, mask the middle
    if (arg.length <= 8) {
      return '[REDACTED]';
    }
    return `${arg.slice(0, 3)}...${arg.slice(-3)}`;
  }

  /**
   * Validate a config-based command (from workflow.yaml etc.)
   * This is more permissive but still checks for obvious injection
   *
   * @param commandString - Command string from configuration
   * @returns Validation result
   */
  public validateConfigCommand(commandString: string): {
    valid: boolean;
    reason?: string;
    parsed?: { command: string; args: string[] };
  } {
    // Check for obvious injection patterns
    const dangerousPatterns = [
      /;\s*rm\s/i, // ; rm
      /\|\s*bash/i, // | bash
      /\$\(/i, // $( command substitution
      /`[^`]+`/i, // ` command substitution
      />\s*\/etc/i, // redirect to /etc
      /curl\s+.+\|\s*(sh|bash)/i, // curl | bash
      /wget\s+.+-O\s*-\s*\|/i, // wget -O - |
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(commandString)) {
        return {
          valid: false,
          reason: `Dangerous command pattern detected`,
        };
      }
    }

    // Check for disallowed characters that are commonly used in injection
    // Note: We're more permissive here as config commands may need some shell features
    const highRiskChars = /[`$]/g;
    if (highRiskChars.test(commandString)) {
      return {
        valid: false,
        reason: 'Command substitution characters not allowed',
      };
    }

    const parsed = this.parseCommandString(commandString);

    return {
      valid: true,
      parsed,
    };
  }
}

/**
 * Get the singleton CommandSanitizer instance
 *
 * @param options - Optional configuration options
 * @returns CommandSanitizer instance
 */
export function getCommandSanitizer(options?: CommandSanitizerOptions): CommandSanitizer {
  if (sanitizerInstance === null) {
    sanitizerInstance = new CommandSanitizer(options);
  }
  return sanitizerInstance;
}

/**
 * Reset the CommandSanitizer singleton (for testing)
 */
export function resetCommandSanitizer(): void {
  sanitizerInstance = null;
}
