/**
 * Logger - Structured logging with JSON format and log levels
 *
 * Features:
 * - Structured JSON logging
 * - Log levels (DEBUG, INFO, WARN, ERROR)
 * - Correlation ID tracking
 * - Agent context in all logs
 * - File rotation
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { LogEntry, LogLevel, LoggerOptions, ErrorInfo } from './types.js';

/**
 * Default log directory
 */
const DEFAULT_LOG_DIR = '.ad-sdlc/logs';

/**
 * Default max file size (10MB)
 */
const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * Default max files to keep
 */
const DEFAULT_MAX_FILES = 5;

/**
 * Log level priority for filtering
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

/**
 * Structured logger for the AD-SDLC system
 */
export class Logger {
  private readonly logDir: string;
  private readonly maxFileSize: number;
  private readonly maxFiles: number;
  private readonly minLevel: LogLevel;
  private readonly consoleOutput: boolean;
  private readonly jsonOutput: boolean;
  private correlationId: string;
  private sessionId: string;
  private currentAgent: string | undefined;
  private currentStage: string | undefined;
  private currentProjectId: string | undefined;
  private currentLogFile: string | null = null;
  private currentFileSize = 0;

  constructor(options: LoggerOptions = {}) {
    this.logDir = options.logDir ?? DEFAULT_LOG_DIR;
    this.maxFileSize = options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
    this.maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
    this.minLevel = options.minLevel ?? 'INFO';
    this.consoleOutput = options.consoleOutput ?? process.env['NODE_ENV'] !== 'production';
    this.jsonOutput = options.jsonOutput ?? true;
    this.correlationId = randomUUID();
    this.sessionId = randomUUID();

    this.ensureLogDirectory();
    this.initializeLogFile();
  }

  /**
   * Ensure the log directory exists
   */
  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true, mode: 0o755 });
    }
  }

  /**
   * Initialize or rotate the log file
   */
  private initializeLogFile(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.currentLogFile = path.join(this.logDir, `app-${timestamp}.jsonl`);
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
        .filter((f) => f.startsWith('app-') && f.endsWith('.jsonl'))
        .map((f) => ({
          name: f,
          path: path.join(this.logDir, f),
          mtime: fs.statSync(path.join(this.logDir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.mtime - a.mtime);

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
   * Check if log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
  }

  /**
   * Create a log entry
   */
  private createEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error,
    durationMs?: number
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId: this.correlationId,
    };

    // Only add optional properties if they are defined
    if (this.currentAgent !== undefined) {
      (entry as { agent?: string }).agent = this.currentAgent;
    }
    if (this.currentStage !== undefined) {
      (entry as { stage?: string }).stage = this.currentStage;
    }
    if (this.currentProjectId !== undefined) {
      (entry as { projectId?: string }).projectId = this.currentProjectId;
    }
    if (durationMs !== undefined) {
      (entry as { durationMs?: number }).durationMs = durationMs;
    }
    if (context !== undefined) {
      (entry as { context?: Record<string, unknown> }).context = context;
    }
    if (error !== undefined) {
      (entry as { error?: ErrorInfo }).error = this.formatError(error);
    }

    return entry;
  }

  /**
   * Format error for logging
   */
  private formatError(error: Error): ErrorInfo {
    const errorInfo: ErrorInfo = {
      name: error.name,
      message: error.message,
    };

    if (error.stack !== undefined) {
      (errorInfo as { stack?: string }).stack = error.stack;
    }

    return errorInfo;
  }

  /**
   * Write a log entry
   */
  private writeEntry(entry: LogEntry): void {
    const line = JSON.stringify(entry) + '\n';
    const lineBytes = Buffer.byteLength(line, 'utf8');

    this.checkRotation();

    if (this.currentLogFile !== null) {
      try {
        fs.appendFileSync(this.currentLogFile, line, { mode: 0o644 });
        this.currentFileSize += lineBytes;
      } catch {
        // Fall back to console if file write fails
        console.error('[LOG]', JSON.stringify(entry));
      }
    }

    if (this.consoleOutput) {
      this.logToConsole(entry);
    }
  }

  /**
   * Format and log entry to console
   */
  private logToConsole(entry: LogEntry): void {
    if (this.jsonOutput) {
      const output = JSON.stringify(entry);
      switch (entry.level) {
        case 'ERROR':
          console.error(output);
          break;
        case 'WARN':
          console.warn(output);
          break;
        default:
          console.log(output);
      }
    } else {
      const prefix = this.getLogPrefix(entry);
      const message = `${prefix} ${entry.message}`;

      switch (entry.level) {
        case 'ERROR':
          console.error(message);
          if (entry.error?.stack !== undefined) {
            console.error(entry.error.stack);
          }
          break;
        case 'WARN':
          console.warn(message);
          break;
        default:
          console.log(message);
      }
    }
  }

  /**
   * Get log prefix for human-readable format
   */
  private getLogPrefix(entry: LogEntry): string {
    const time = entry.timestamp.substring(11, 23);
    const level = entry.level.padEnd(5);
    const agent = entry.agent !== undefined ? `[${entry.agent}]` : '';
    const stage = entry.stage !== undefined ? `(${entry.stage})` : '';
    return `${time} ${level} ${agent}${stage}`.trim();
  }

  /**
   * Extract durationMs from context if present
   */
  private extractDuration(context?: Record<string, unknown>): {
    durationMs: number | undefined;
    remainingContext: Record<string, unknown> | undefined;
  } {
    if (context === undefined) {
      return { durationMs: undefined, remainingContext: undefined };
    }

    const { durationMs, ...rest } = context;
    const duration = typeof durationMs === 'number' ? durationMs : undefined;
    const remaining = Object.keys(rest).length > 0 ? rest : undefined;

    return { durationMs: duration, remainingContext: remaining };
  }

  /**
   * Log a debug message
   */
  public debug(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog('DEBUG')) return;
    const { durationMs, remainingContext } = this.extractDuration(context);
    const entry = this.createEntry('DEBUG', message, remainingContext, undefined, durationMs);
    this.writeEntry(entry);
  }

  /**
   * Log an info message
   */
  public info(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog('INFO')) return;
    const { durationMs, remainingContext } = this.extractDuration(context);
    const entry = this.createEntry('INFO', message, remainingContext, undefined, durationMs);
    this.writeEntry(entry);
  }

  /**
   * Log a warning message
   */
  public warn(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog('WARN')) return;
    const { durationMs, remainingContext } = this.extractDuration(context);
    const entry = this.createEntry('WARN', message, remainingContext, undefined, durationMs);
    this.writeEntry(entry);
  }

  /**
   * Log an error message
   */
  public error(message: string, error?: Error, context?: Record<string, unknown>): void {
    if (!this.shouldLog('ERROR')) return;
    const { durationMs, remainingContext } = this.extractDuration(context);
    const entry = this.createEntry('ERROR', message, remainingContext, error, durationMs);
    this.writeEntry(entry);
  }

  /**
   * Set the current agent context
   */
  public setAgent(agent: string | undefined): void {
    this.currentAgent = agent;
  }

  /**
   * Get the current agent context
   */
  public getAgent(): string | undefined {
    return this.currentAgent;
  }

  /**
   * Set the current pipeline stage
   */
  public setStage(stage: string | undefined): void {
    this.currentStage = stage;
  }

  /**
   * Get the current pipeline stage
   */
  public getStage(): string | undefined {
    return this.currentStage;
  }

  /**
   * Set the current project ID
   */
  public setProjectId(projectId: string | undefined): void {
    this.currentProjectId = projectId;
  }

  /**
   * Get the current project ID
   */
  public getProjectId(): string | undefined {
    return this.currentProjectId;
  }

  /**
   * Set the correlation ID
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
   * Set the session ID
   */
  public setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  /**
   * Get the current session ID
   */
  public getSessionId(): string {
    return this.sessionId;
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
   * Create a child logger with additional context
   */
  public child(context: { agent?: string; stage?: string; projectId?: string }): Logger {
    const child = new Logger({
      logDir: this.logDir,
      maxFileSize: this.maxFileSize,
      maxFiles: this.maxFiles,
      minLevel: this.minLevel,
      consoleOutput: this.consoleOutput,
      jsonOutput: this.jsonOutput,
    });
    child.setCorrelationId(this.correlationId);
    child.setSessionId(this.sessionId);
    child.setAgent(context.agent ?? this.currentAgent);
    child.setStage(context.stage ?? this.currentStage);
    child.setProjectId(context.projectId ?? this.currentProjectId);
    // Share the same log file
    child.currentLogFile = this.currentLogFile;
    child.currentFileSize = this.currentFileSize;
    return child;
  }

  /**
   * Read recent log entries
   */
  public getRecentEntries(limit = 100): LogEntry[] {
    if (this.currentLogFile === null || !fs.existsSync(this.currentLogFile)) {
      return [];
    }

    try {
      const content = fs.readFileSync(this.currentLogFile, 'utf8');
      const lines = content.trim().split('\n');
      const entries: LogEntry[] = [];

      for (let i = lines.length - 1; i >= 0 && entries.length < limit; i--) {
        const line = lines[i];
        if (line !== undefined && line.trim() !== '') {
          try {
            entries.push(JSON.parse(line) as LogEntry);
          } catch {
            // Skip malformed lines
          }
        }
      }

      return entries;
    } catch {
      return [];
    }
  }

  /**
   * Get entries filtered by level
   */
  public getEntriesByLevel(level: LogLevel, limit = 100): LogEntry[] {
    return this.getRecentEntries(limit * 4)
      .filter((e) => e.level === level)
      .slice(0, limit);
  }

  /**
   * Get error entries
   */
  public getErrors(limit = 50): LogEntry[] {
    return this.getEntriesByLevel('ERROR', limit);
  }
}

/**
 * Singleton instance for global access
 */
let globalLogger: Logger | null = null;

/**
 * Get or create the global Logger instance
 */
export function getLogger(options?: LoggerOptions): Logger {
  if (globalLogger === null) {
    globalLogger = new Logger(options);
  }
  return globalLogger;
}

/**
 * Reset the global Logger instance (for testing)
 */
export function resetLogger(): void {
  globalLogger = null;
}
