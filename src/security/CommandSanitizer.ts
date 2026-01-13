/**
 * CommandSanitizer - Secure command execution with injection prevention
 *
 * Features:
 * - Command whitelisting
 * - Argument sanitization
 * - Shell metacharacter prevention
 * - Safe execution using execFile (bypasses shell)
 * - Audit logging for all command executions
 * - Runtime whitelist updates with thread-safe operations
 * - External whitelist source loading (file, URL)
 */

import {
  execFile as execFileCallback,
  execFileSync,
  type ExecFileOptions,
  type ExecFileSyncOptions,
} from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import {
  type CommandWhitelistConfig,
  DEFAULT_COMMAND_WHITELIST,
  isAllowedCommand,
  isAllowedSubcommand,
  getCommandConfig,
  containsShellMetacharacters,
} from './CommandWhitelist.js';
import { CommandInjectionError, CommandNotAllowedError, WhitelistUpdateError } from './errors.js';
import type {
  SanitizedCommand,
  CommandExecResult,
  CommandSanitizerOptions,
  WhitelistSource,
  WhitelistUpdateOptions,
  WhitelistUpdateResult,
  WhitelistSnapshot,
} from './types.js';
import { getAuditLogger } from './AuditLogger.js';

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
 * 4. Supporting runtime whitelist updates with thread-safe operations
 */
export class CommandSanitizer {
  private whitelist: CommandWhitelistConfig;
  private whitelistVersion: number;
  private updateInProgress: boolean;
  private readonly strictMode: boolean;
  private readonly logCommands: boolean;
  private readonly enableAuditLog: boolean;
  private readonly actor: string;

  constructor(options: CommandSanitizerOptions = {}) {
    this.whitelist =
      (options.whitelist as CommandWhitelistConfig | undefined) ?? DEFAULT_COMMAND_WHITELIST;
    this.whitelistVersion = 1;
    this.updateInProgress = false;
    this.strictMode = options.strictMode ?? true;
    this.logCommands = options.logCommands ?? false;
    this.enableAuditLog = options.enableAuditLog ?? true;
    this.actor = options.actor ?? 'system';
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
      if (
        subcommand !== undefined &&
        !isAllowedSubcommand(baseCommand, subcommand, this.whitelist)
      ) {
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
      ...(subCommand !== undefined ? { subCommand } : {}),
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
    if (config !== undefined && config.allowArbitraryArgs !== true) {
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
   * Escape content for use within double quotes in command strings
   * Escapes backslashes and double quotes for parseCommandString compatibility
   *
   * @param content - The content to escape
   * @returns Escaped content safe for use in double-quoted command arguments
   * @example
   * // Usage: `gh pr create --title "${sanitizer.escapeForParser(title)}"`
   */
  public escapeForParser(content: string): string {
    // Escape backslashes first, then double quotes
    return content.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  /**
   * Escape a single argument for shell use
   * Wraps in single quotes and escapes internal single quotes
   *
   * @param arg - The argument to escape
   * @returns Escaped argument safe for shell use
   * @deprecated Use escapeForParser() for execFromString, or use array-based methods (execGit, execGh)
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

      this.logCommandExecution(command, 'success', duration);

      return {
        success: true,
        stdout,
        stderr,
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

      this.logCommandExecution(command, 'failure', duration, errorMessage);

      return {
        success: false,
        stdout: execError.stdout ?? '',
        stderr: execError.stderr ?? errorMessage,
        command: command.rawCommand,
        duration,
        ...(execError.code !== undefined ? { exitCode: execError.code } : {}),
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

      this.logCommandExecution(command, 'success', duration);

      return {
        success: true,
        stdout: output,
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

      this.logCommandExecution(command, 'failure', duration, errorMessage);

      return {
        success: false,
        stdout: typeof execError.stdout === 'string' ? execError.stdout : '',
        stderr: typeof execError.stderr === 'string' ? execError.stderr : errorMessage,
        command: command.rawCommand,
        duration,
        ...(execError.status !== undefined ? { exitCode: execError.status } : {}),
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
   * Get current whitelist version number
   *
   * @returns Current version number
   */
  public getWhitelistVersion(): number {
    return this.whitelistVersion;
  }

  /**
   * Get a snapshot of the current whitelist state
   * Thread-safe operation that captures the current state
   *
   * @returns Whitelist snapshot with version and configuration
   */
  public getWhitelistSnapshot(): WhitelistSnapshot {
    return {
      version: this.whitelistVersion,
      timestamp: new Date(),
      config: { ...this.whitelist },
    };
  }

  /**
   * Update the whitelist at runtime
   * Thread-safe operation using version tracking
   *
   * @param newConfig - New whitelist configuration
   * @param options - Update options
   * @returns Update result with success status and version info
   */
  public async updateWhitelist(
    newConfig: CommandWhitelistConfig,
    options: WhitelistUpdateOptions = {}
  ): Promise<WhitelistUpdateResult> {
    const { merge = false, validate = true } = options;
    const previousVersion = this.whitelistVersion;

    // Prevent concurrent updates
    if (this.updateInProgress) {
      return {
        success: false,
        version: this.whitelistVersion,
        commandCount: Object.keys(this.whitelist).length,
        previousVersion,
        error: 'Another whitelist update is in progress',
      };
    }

    this.updateInProgress = true;

    try {
      // Validate new configuration if requested
      if (validate) {
        const validationError = this.validateWhitelistConfig(newConfig);
        if (validationError !== null) {
          return {
            success: false,
            version: this.whitelistVersion,
            commandCount: Object.keys(this.whitelist).length,
            previousVersion,
            error: validationError,
          };
        }
      }

      // Perform atomic update
      const finalConfig = merge ? { ...this.whitelist, ...newConfig } : newConfig;

      // Atomic swap
      this.whitelist = finalConfig;
      this.whitelistVersion++;

      // Log the update
      this.logWhitelistUpdate('object', previousVersion, this.whitelistVersion);

      return {
        success: true,
        version: this.whitelistVersion,
        commandCount: Object.keys(finalConfig).length,
        previousVersion,
      };
    } finally {
      this.updateInProgress = false;
    }
  }

  /**
   * Load whitelist from an external file
   * Supports JSON format
   *
   * @param filePath - Path to the whitelist file
   * @param options - Update options
   * @returns Update result
   */
  public async loadWhitelistFromFile(
    filePath: string,
    options: WhitelistUpdateOptions = {}
  ): Promise<WhitelistUpdateResult> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const config = JSON.parse(content) as CommandWhitelistConfig;

      return this.updateWhitelist(config, options);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new WhitelistUpdateError(filePath, errorMessage);
    }
  }

  /**
   * Load whitelist from a URL
   * Supports JSON format
   *
   * @param url - URL to fetch whitelist from
   * @param options - Update options
   * @returns Update result
   */
  public async loadWhitelistFromUrl(
    url: string,
    options: WhitelistUpdateOptions = {}
  ): Promise<WhitelistUpdateResult> {
    const { timeout = 30000 } = options;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new WhitelistUpdateError(url, `HTTP ${String(response.status)}: ${response.statusText}`);
      }

      const config = (await response.json()) as CommandWhitelistConfig;
      return this.updateWhitelist(config, options);
    } catch (error) {
      if (error instanceof WhitelistUpdateError) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new WhitelistUpdateError(url, errorMessage);
    }
  }

  /**
   * Load whitelist from any supported source
   *
   * @param source - Whitelist source configuration
   * @param options - Update options
   * @returns Update result
   */
  public async loadWhitelistFromSource(
    source: WhitelistSource,
    options: WhitelistUpdateOptions = {}
  ): Promise<WhitelistUpdateResult> {
    switch (source.type) {
      case 'file':
        if (source.path === undefined) {
          throw new WhitelistUpdateError('file', 'File path is required');
        }
        return this.loadWhitelistFromFile(source.path, options);

      case 'url':
        if (source.url === undefined) {
          throw new WhitelistUpdateError('url', 'URL is required');
        }
        return this.loadWhitelistFromUrl(source.url, options);

      case 'object':
        if (source.config === undefined) {
          throw new WhitelistUpdateError('object', 'Configuration object is required');
        }
        return this.updateWhitelist(source.config as CommandWhitelistConfig, options);

      default:
        throw new WhitelistUpdateError('unknown', `Unknown source type: ${String(source.type)}`);
    }
  }

  /**
   * Validate whitelist configuration structure
   *
   * @param config - Configuration to validate
   * @returns Error message if invalid, null if valid
   */
  private validateWhitelistConfig(config: CommandWhitelistConfig): string | null {
    if (typeof config !== 'object' || config === null) {
      return 'Configuration must be an object';
    }

    for (const [command, cmdConfig] of Object.entries(config)) {
      if (typeof command !== 'string' || command.length === 0) {
        return 'Command names must be non-empty strings';
      }

      if (typeof cmdConfig !== 'object' || cmdConfig === null) {
        return `Configuration for '${command}' must be an object`;
      }

      if (typeof cmdConfig.allowed !== 'boolean') {
        return `'allowed' field for '${command}' must be a boolean`;
      }

      if (cmdConfig.subcommands !== undefined) {
        if (!Array.isArray(cmdConfig.subcommands)) {
          return `'subcommands' field for '${command}' must be an array`;
        }
        for (const sub of cmdConfig.subcommands) {
          if (typeof sub !== 'string') {
            return `Subcommands for '${command}' must be strings`;
          }
        }
      }

      if (cmdConfig.maxArgs !== undefined && typeof cmdConfig.maxArgs !== 'number') {
        return `'maxArgs' field for '${command}' must be a number`;
      }

      if (
        cmdConfig.allowArbitraryArgs !== undefined &&
        typeof cmdConfig.allowArbitraryArgs !== 'boolean'
      ) {
        return `'allowArbitraryArgs' field for '${command}' must be a boolean`;
      }
    }

    return null;
  }

  /**
   * Log whitelist update to audit log
   *
   * @param source - Source of the update
   * @param previousVersion - Previous whitelist version
   * @param newVersion - New whitelist version
   */
  private logWhitelistUpdate(source: string, previousVersion: number, newVersion: number): void {
    if (!this.enableAuditLog) {
      return;
    }

    try {
      const logger = getAuditLogger();
      logger.log({
        type: 'command_executed',
        actor: this.actor,
        resource: 'whitelist',
        action: 'update',
        result: 'success',
        details: {
          source,
          previousVersion,
          newVersion,
          commandCount: Object.keys(this.whitelist).length,
        },
      });
    } catch {
      // Silently ignore audit logging errors
    }
  }

  /**
   * Parse a command string into base command and arguments
   * Handles basic quoting and shell redirections
   *
   * @param commandString - Full command string (e.g., "git status --porcelain")
   * @returns Parsed command and arguments
   */
  public parseCommandString(commandString: string): { command: string; args: string[] } {
    // Remove shell redirections (2>&1, 2>/dev/null, etc.) as execFile doesn't need them
    const cleanedCommand = commandString
      .replace(/\s+2>&1\s*/g, ' ')
      .replace(/\s+2>\/dev\/null\s*/g, ' ')
      .replace(/\s+>\/dev\/null\s*/g, ' ')
      .replace(/\s+2>\s*\S+/g, ' ')
      .trim();

    // Tokenize respecting quoted strings
    const tokens: string[] = [];
    let current = '';
    let inSingleQuote = false;
    let inDoubleQuote = false;

    for (let i = 0; i < cleanedCommand.length; i++) {
      const char = cleanedCommand[i] as string;
      const nextChar = cleanedCommand[i + 1];

      if (char === '\\' && nextChar !== undefined && !inSingleQuote) {
        // Escape sequence
        current += nextChar;
        i++;
      } else if (char === "'" && !inDoubleQuote) {
        inSingleQuote = !inSingleQuote;
      } else if (char === '"' && !inSingleQuote) {
        inDoubleQuote = !inDoubleQuote;
      } else if (char === ' ' && !inSingleQuote && !inDoubleQuote) {
        if (current.length > 0) {
          tokens.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }

    if (current.length > 0) {
      tokens.push(current);
    }

    const command = tokens[0] ?? '';
    const args = tokens.slice(1);
    return { command, args };
  }

  /**
   * Execute a command from a string (for migration compatibility)
   * Parses the command string and executes safely
   *
   * @param commandString - Full command string (e.g., "gh pr view 123 --json url")
   * @param options - Execution options
   * @returns Command execution result
   */
  public async execFromString(
    commandString: string,
    options: ExecFileOptions = {}
  ): Promise<CommandExecResult> {
    const { command, args } = this.parseCommandString(commandString);

    // Check if command is in whitelist
    if (!this.isAllowed(command)) {
      // For non-whitelisted commands, validate as config command
      const validation = this.validateConfigCommand(commandString);
      if (!validation.valid) {
        throw new CommandNotAllowedError(command, validation.reason ?? 'Command not in whitelist');
      }
      // Still use execFile for validated config commands
    }

    return this.exec(command, args, options);
  }

  /**
   * Execute a command from a string synchronously
   *
   * @param commandString - Full command string
   * @param options - Execution options
   * @returns Command execution result
   */
  public execFromStringSync(
    commandString: string,
    options: ExecFileSyncOptions = {}
  ): CommandExecResult {
    const { command, args } = this.parseCommandString(commandString);

    if (!this.isAllowed(command)) {
      const validation = this.validateConfigCommand(commandString);
      if (!validation.valid) {
        throw new CommandNotAllowedError(command, validation.reason ?? 'Command not in whitelist');
      }
    }

    return this.execSync(command, args, options);
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
   * Log command execution to audit log
   *
   * @param command - The executed command
   * @param result - Execution result ('success' or 'failure')
   * @param durationMs - Execution duration in milliseconds
   * @param error - Error message if failed
   */
  private logCommandExecution(
    command: SanitizedCommand,
    result: 'success' | 'failure',
    durationMs: number,
    error?: string
  ): void {
    if (!this.enableAuditLog) {
      return;
    }

    try {
      const logger = getAuditLogger();
      logger.log({
        type: 'command_executed',
        actor: this.actor,
        resource: command.baseCommand,
        action: command.subCommand ?? command.args[0] ?? 'execute',
        result: result === 'success' ? 'success' : 'failure',
        details: {
          rawCommand: this.maskCommandForLogging(command.rawCommand),
          durationMs,
          ...(error !== undefined ? { error } : {}),
        },
      });
    } catch {
      // Silently ignore audit logging errors
    }
  }

  /**
   * Mask potentially sensitive parts of a command for logging
   *
   * @param rawCommand - The raw command string
   * @returns Masked command string
   */
  private maskCommandForLogging(rawCommand: string): string {
    // Mask common sensitive patterns like tokens, passwords, keys
    return rawCommand
      .replace(/(--token[=\s]+)\S+/gi, '$1[REDACTED]')
      .replace(/(--password[=\s]+)\S+/gi, '$1[REDACTED]')
      .replace(/(--key[=\s]+)\S+/gi, '$1[REDACTED]')
      .replace(/(--secret[=\s]+)\S+/gi, '$1[REDACTED]')
      .replace(/([A-Za-z_]*TOKEN[=\s]+)\S+/gi, '$1[REDACTED]')
      .replace(/([A-Za-z_]*KEY[=\s]+)\S+/gi, '$1[REDACTED]');
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
