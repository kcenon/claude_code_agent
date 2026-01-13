/**
 * Security module type definitions
 */

/**
 * Audit event types for security logging
 */
export type AuditEventType =
  | 'api_key_used'
  | 'github_issue_created'
  | 'github_pr_created'
  | 'github_pr_merged'
  | 'file_created'
  | 'file_deleted'
  | 'file_modified'
  | 'file_watched'
  | 'file_watch_stopped'
  | 'secret_accessed'
  | 'validation_failed'
  | 'security_violation'
  | 'command_executed'
  | 'command_blocked';

/**
 * Result status for audit events
 */
export type AuditEventResult = 'success' | 'failure' | 'blocked';

/**
 * Audit event data structure
 */
export interface AuditEvent {
  /** Event type identifier */
  readonly type: AuditEventType;
  /** Actor performing the action (user, agent, system) */
  readonly actor: string;
  /** Resource being accessed or modified */
  readonly resource: string;
  /** Action being performed */
  readonly action: string;
  /** Result of the action */
  readonly result: AuditEventResult;
  /** Additional event details */
  readonly details?: Record<string, unknown>;
}

/**
 * Serialized audit log entry
 */
export interface AuditLogEntry extends AuditEvent {
  /** ISO timestamp of the event */
  readonly timestamp: string;
  /** Unique correlation ID for request tracing */
  readonly correlationId: string;
  /** Session identifier */
  readonly sessionId?: string;
}

/**
 * Secret manager configuration options
 */
export interface SecretManagerOptions {
  /** Path to .env file (default: .env) */
  readonly envFilePath?: string;
  /** Required secret keys that must be present */
  readonly requiredSecrets?: readonly string[];
  /** Whether to throw on missing required secrets */
  readonly throwOnMissing?: boolean;
}

/**
 * Input validator configuration options
 */
export interface InputValidatorOptions {
  /** Base path for file path validation */
  readonly basePath: string;
  /** Allowed URL protocols (default: ['https:']) */
  readonly allowedProtocols?: readonly string[];
  /** Block internal/localhost URLs (default: true) */
  readonly blockInternalUrls?: boolean;
  /** Maximum input length (default: 10000) */
  readonly maxInputLength?: number;
}

/**
 * Secure file handler configuration options
 */
export interface SecureFileHandlerOptions {
  /** Temporary file prefix */
  readonly tempPrefix?: string;
  /** Auto-cleanup on process exit (default: true) */
  readonly autoCleanup?: boolean;
  /** File permission mode (default: 0o600) */
  readonly fileMode?: number;
}

/**
 * Audit logger configuration options
 */
export interface AuditLoggerOptions {
  /** Log output directory */
  readonly logDir?: string;
  /** Maximum log file size in bytes */
  readonly maxFileSize?: number;
  /** Maximum number of log files to keep */
  readonly maxFiles?: number;
  /** Enable console output (default: false in production) */
  readonly consoleOutput?: boolean;
}

/**
 * Validation result with error details
 */
export interface ValidationResult {
  /** Whether validation passed */
  readonly valid: boolean;
  /** Validation error message if failed */
  readonly error?: string;
  /** Sanitized/normalized value if valid */
  readonly value?: string;
}

/**
 * Rate limiter configuration
 */
export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  readonly maxRequests: number;
  /** Time window in milliseconds */
  readonly windowMs: number;
}

/**
 * Rate limit status
 */
export interface RateLimitStatus {
  /** Whether request is allowed */
  readonly allowed: boolean;
  /** Remaining requests in current window */
  readonly remaining: number;
  /** Time until rate limit resets (ms) */
  readonly resetIn: number;
}

/**
 * Command sanitizer configuration options
 */
export interface CommandSanitizerOptions {
  /** Custom command whitelist (overrides default) */
  readonly whitelist?: Record<string, unknown>;
  /** Enable strict mode (reject any shell metacharacters) */
  readonly strictMode?: boolean;
  /** Enable command logging to console */
  readonly logCommands?: boolean;
  /** Enable audit logging for command execution (default: true) */
  readonly enableAuditLog?: boolean;
  /** Actor name for audit logging (default: 'system') */
  readonly actor?: string;
}

/**
 * Source type for whitelist loading
 */
export type WhitelistSourceType = 'file' | 'url' | 'object';

/**
 * External whitelist source configuration
 */
export interface WhitelistSource {
  /** Source type */
  readonly type: WhitelistSourceType;
  /** File path (for 'file' type) */
  readonly path?: string;
  /** URL (for 'url' type) */
  readonly url?: string;
  /** Direct configuration object (for 'object' type) */
  readonly config?: Record<string, unknown>;
}

/**
 * Options for whitelist update operation
 */
export interface WhitelistUpdateOptions {
  /** Merge with existing whitelist instead of replacing */
  readonly merge?: boolean;
  /** Validate new configuration before applying */
  readonly validate?: boolean;
  /** Timeout for URL fetching in milliseconds */
  readonly timeout?: number;
}

/**
 * Result of whitelist update operation
 */
export interface WhitelistUpdateResult {
  /** Whether update was successful */
  readonly success: boolean;
  /** New whitelist version number */
  readonly version: number;
  /** Number of commands in new whitelist */
  readonly commandCount: number;
  /** Previous whitelist version */
  readonly previousVersion: number;
  /** Error message if failed */
  readonly error?: string;
}

/**
 * Whitelist state snapshot for thread-safe operations
 */
export interface WhitelistSnapshot {
  /** Version number of this snapshot */
  readonly version: number;
  /** Timestamp when snapshot was created */
  readonly timestamp: Date;
  /** Whitelist configuration */
  readonly config: Record<string, unknown>;
}

/**
 * Sanitized command ready for safe execution
 */
export interface SanitizedCommand {
  /** Base command (e.g., 'git', 'npm') */
  readonly baseCommand: string;
  /** Subcommand if any (e.g., 'status', 'install') */
  readonly subCommand?: string;
  /** Sanitized arguments array */
  readonly args: string[];
  /** Raw command string for logging (do not execute directly) */
  readonly rawCommand: string;
}

/**
 * Result of command execution
 */
export interface CommandExecResult {
  /** Whether command succeeded (exit code 0) */
  readonly success: boolean;
  /** Standard output */
  readonly stdout: string;
  /** Standard error */
  readonly stderr: string;
  /** Full command string (for logging) */
  readonly command: string;
  /** Execution duration in milliseconds */
  readonly duration: number;
  /** Exit code if available */
  readonly exitCode?: number;
}

/**
 * File watch event types
 */
export type FileWatchEventType = 'change' | 'rename' | 'add' | 'unlink' | 'error';

/**
 * File watch event data
 */
export interface FileWatchEvent {
  /** Type of file change event */
  readonly type: FileWatchEventType;
  /** Relative path of the changed file */
  readonly path: string;
  /** Absolute path of the changed file */
  readonly absolutePath: string;
  /** Timestamp of the event */
  readonly timestamp: Date;
  /** Error if type is 'error' */
  readonly error?: Error;
}

/**
 * File watch callback function type
 */
export type FileWatchCallback = (event: FileWatchEvent) => void | Promise<void>;

/**
 * Pattern filter for file watching
 */
export interface FileWatchPatternFilter {
  /** Glob patterns to include (e.g., '*.ts', '**\/*.json') */
  readonly include?: readonly string[];
  /** Glob patterns to exclude */
  readonly exclude?: readonly string[];
}

/**
 * Configuration options for file watching
 */
export interface FileWatcherConfig {
  /** Watch subdirectories recursively (default: true) */
  readonly recursive?: boolean;
  /** Debounce delay in milliseconds (default: 100) */
  readonly debounceMs?: number;
  /** Pattern filters for file types */
  readonly patterns?: FileWatchPatternFilter;
  /** Follow symbolic links (default: false for security) */
  readonly followSymlinks?: boolean;
  /** Validate symlink targets remain within security boundary (default: true) */
  readonly validateSymlinkTargets?: boolean;
  /** Enable audit logging for watch events (default: true) */
  readonly enableAuditLog?: boolean;
}

/**
 * Active file watcher handle
 */
export interface FileWatcherHandle {
  /** Unique identifier for this watcher */
  readonly id: string;
  /** Path being watched */
  readonly watchPath: string;
  /** Stop watching */
  readonly close: () => void;
  /** Check if watcher is active */
  readonly isActive: () => boolean;
}
