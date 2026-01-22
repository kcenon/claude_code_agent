/**
 * AuditLogger - Security audit logging
 *
 * Features:
 * - Structured JSON logging
 * - Correlation ID tracking
 * - File rotation
 * - Sensitive operation tracking
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AuditEvent, AuditLogEntry, AuditLoggerOptions, AuditEventType } from './types.js';
import type { Logger } from '../logging/index.js';
import { getLogger } from '../logging/index.js';
import { DEFAULT_PATHS } from '../config/paths.js';

/**
 * Default log directory
 */
const DEFAULT_LOG_DIR = DEFAULT_PATHS.AUDIT_LOGS;

/**
 * Default max file size (10MB)
 */
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Default max files to keep
 */
const DEFAULT_MAX_FILES = 5;

/**
 * Events that should always be audited
 */
export const SECURITY_SENSITIVE_EVENTS: readonly AuditEventType[] = [
  'api_key_used',
  'secret_accessed',
  'security_violation',
  'github_pr_merged',
];

/**
 * Audit logger for security-sensitive operations
 */
export class AuditLogger {
  private readonly logDir: string;
  private readonly maxFileSize: number;
  private readonly maxFiles: number;
  private readonly consoleOutput: boolean;
  private readonly logger: Logger;
  private sessionId: string;
  private correlationId: string;
  private currentLogFile: string | null = null;
  private currentFileSize = 0;

  constructor(options: AuditLoggerOptions = {}) {
    this.logDir = options.logDir ?? DEFAULT_LOG_DIR;
    this.maxFileSize = options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
    this.maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
    this.consoleOutput = options.consoleOutput ?? process.env['NODE_ENV'] !== 'production';
    this.logger = getLogger().child({ agent: 'AuditLogger' });
    this.sessionId = randomUUID();
    this.correlationId = randomUUID();

    this.ensureLogDirectory();
    this.initializeLogFile();
  }

  /**
   * Ensure the log directory exists
   */
  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true, mode: 0o700 });
    }
  }

  /**
   * Initialize or rotate the log file
   */
  private initializeLogFile(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.currentLogFile = path.join(this.logDir, `audit-${timestamp}.jsonl`);
    this.currentFileSize = 0;
    this.rotateOldFiles();
  }

  /**
   * Remove old log files beyond the max limit
   */
  private rotateOldFiles(): void {
    try {
      const files = fs
        .readdirSync(this.logDir)
        .filter((f) => f.startsWith('audit-') && f.endsWith('.jsonl'))
        .map((f) => ({
          name: f,
          path: path.join(this.logDir, f),
          mtime: fs.statSync(path.join(this.logDir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.mtime - a.mtime);

      // Remove files beyond max limit
      for (let i = this.maxFiles; i < files.length; i++) {
        const file = files[i];
        if (file !== undefined) {
          fs.unlinkSync(file.path);
        }
      }
    } catch {
      // Ignore rotation errors
    }
  }

  /**
   * Check if file rotation is needed
   */
  private checkRotation(): void {
    if (this.currentFileSize >= this.maxFileSize) {
      this.initializeLogFile();
    }
  }

  /**
   * Log an audit event
   *
   * @param event - The audit event to log
   */
  public log(event: AuditEvent): void {
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      correlationId: this.correlationId,
      sessionId: this.sessionId,
      ...event,
    };

    this.writeEntry(entry);
  }

  /**
   * Write a log entry to file
   */
  private writeEntry(entry: AuditLogEntry): void {
    const line = JSON.stringify(entry) + '\n';
    const lineBytes = Buffer.byteLength(line, 'utf8');

    this.checkRotation();

    if (this.currentLogFile !== null) {
      try {
        fs.appendFileSync(this.currentLogFile, line, { mode: 0o600 });
        this.currentFileSize += lineBytes;
      } catch (error) {
        // Fall back to structured logger if file write fails
        this.logger.error(
          'Audit log file write failed, logging entry via structured logger',
          error instanceof Error ? error : undefined,
          { auditEntry: entry }
        );
      }
    }

    if (this.consoleOutput) {
      this.logToConsole(entry);
    }
  }

  /**
   * Format and log entry to console
   */
  private logToConsole(entry: AuditLogEntry): void {
    const icon = entry.result === 'success' ? '✓' : entry.result === 'blocked' ? '⛔' : '✗';
    const level = entry.result === 'success' ? 'info' : 'warn';

    const auditMessage = `${icon} ${entry.type}: ${entry.actor} ${entry.action} ${entry.resource} (${entry.result})`;
    const context = {
      auditType: entry.type,
      actor: entry.actor,
      action: entry.action,
      resource: entry.resource,
      result: entry.result,
    };

    if (level === 'warn') {
      this.logger.warn(auditMessage, context);
    } else {
      this.logger.info(auditMessage, context);
    }
  }

  /**
   * Log API key usage
   */
  public logApiKeyUsage(keyName: string, actor: string, success: boolean): void {
    this.log({
      type: 'api_key_used',
      actor,
      resource: keyName,
      action: 'authenticate',
      result: success ? 'success' : 'failure',
    });
  }

  /**
   * Log GitHub issue creation
   */
  public logGitHubIssueCreated(issueNumber: number, repo: string, actor: string): void {
    this.log({
      type: 'github_issue_created',
      actor,
      resource: `${repo}#${String(issueNumber)}`,
      action: 'create',
      result: 'success',
    });
  }

  /**
   * Log GitHub PR creation
   */
  public logGitHubPRCreated(prNumber: number, repo: string, actor: string): void {
    this.log({
      type: 'github_pr_created',
      actor,
      resource: `${repo}#${String(prNumber)}`,
      action: 'create',
      result: 'success',
    });
  }

  /**
   * Log GitHub PR merge
   */
  public logGitHubPRMerged(prNumber: number, repo: string, actor: string): void {
    this.log({
      type: 'github_pr_merged',
      actor,
      resource: `${repo}#${String(prNumber)}`,
      action: 'merge',
      result: 'success',
    });
  }

  /**
   * Log file creation
   */
  public logFileCreated(filePath: string, actor: string): void {
    this.log({
      type: 'file_created',
      actor,
      resource: filePath,
      action: 'create',
      result: 'success',
    });
  }

  /**
   * Log file deletion
   */
  public logFileDeleted(filePath: string, actor: string): void {
    this.log({
      type: 'file_deleted',
      actor,
      resource: filePath,
      action: 'delete',
      result: 'success',
    });
  }

  /**
   * Log file modification
   */
  public logFileModified(filePath: string, actor: string): void {
    this.log({
      type: 'file_modified',
      actor,
      resource: filePath,
      action: 'modify',
      result: 'success',
    });
  }

  /**
   * Log secret access
   */
  public logSecretAccessed(secretName: string, actor: string): void {
    this.log({
      type: 'secret_accessed',
      actor,
      resource: secretName,
      action: 'access',
      result: 'success',
    });
  }

  /**
   * Log validation failure
   */
  public logValidationFailed(
    field: string,
    actor: string,
    details?: Record<string, unknown>
  ): void {
    const event: AuditEvent = {
      type: 'validation_failed',
      actor,
      resource: field,
      action: 'validate',
      result: 'failure',
    };
    if (details !== undefined) {
      this.log({ ...event, details });
    } else {
      this.log(event);
    }
  }

  /**
   * Log security violation
   */
  public logSecurityViolation(
    violationType: string,
    actor: string,
    details?: Record<string, unknown>
  ): void {
    const event: AuditEvent = {
      type: 'security_violation',
      actor,
      resource: violationType,
      action: 'attempt',
      result: 'blocked',
    };
    if (details !== undefined) {
      this.log({ ...event, details });
    } else {
      this.log(event);
    }
  }

  /**
   * Set a new correlation ID for request tracing
   *
   * @param correlationId - The correlation ID to set
   */
  public setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
  }

  /**
   * Get the current correlation ID
   */
  public getCorrelationId(): string {
    return this.correlationId;
  }

  /**
   * Generate a new correlation ID
   */
  public newCorrelationId(): string {
    this.correlationId = randomUUID();
    return this.correlationId;
  }

  /**
   * Get the current session ID
   */
  public getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Set the session ID
   */
  public setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  /**
   * Get the log directory path
   */
  public getLogDir(): string {
    return this.logDir;
  }

  /**
   * Get the current log file path
   */
  public getCurrentLogFile(): string | null {
    return this.currentLogFile;
  }

  /**
   * Read recent audit entries
   *
   * @param limit - Maximum number of entries to return
   * @returns Array of recent audit log entries
   */
  public getRecentEntries(limit = 100): AuditLogEntry[] {
    if (this.currentLogFile === null || !fs.existsSync(this.currentLogFile)) {
      return [];
    }

    try {
      const content = fs.readFileSync(this.currentLogFile, 'utf8');
      const lines = content.trim().split('\n');
      const entries: AuditLogEntry[] = [];

      // Read from end for most recent
      for (let i = lines.length - 1; i >= 0 && entries.length < limit; i--) {
        const line = lines[i];
        if (line !== undefined && line.trim() !== '') {
          try {
            // Internal data saved by this class - use direct parse with type assertion
            const entry = JSON.parse(line) as AuditLogEntry;
            entries.push(entry);
          } catch {
            // Skip malformed entries
          }
        }
      }

      return entries;
    } catch {
      return [];
    }
  }
}

/**
 * Singleton instance for global access
 */
let globalAuditLogger: AuditLogger | null = null;

/**
 * Get or create the global AuditLogger instance
 *
 * @param options - Options for creating new instance
 * @returns The global AuditLogger instance
 */
export function getAuditLogger(options?: AuditLoggerOptions): AuditLogger {
  if (globalAuditLogger === null) {
    globalAuditLogger = new AuditLogger(options);
  }
  return globalAuditLogger;
}

/**
 * Reset the global AuditLogger instance (for testing)
 */
export function resetAuditLogger(): void {
  globalAuditLogger = null;
}
