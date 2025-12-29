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
import type {
  LogEntry,
  LogLevel,
  LoggerOptions,
  ErrorInfo,
  AgentLogConfig,
  MaskingPattern,
  LogQueryFilter,
  LogQueryResult,
} from './types.js';

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
 * Default agent logs directory
 */
const DEFAULT_AGENT_LOGS_DIR = 'agent-logs';

/**
 * Default masking replacement string
 */
const DEFAULT_MASK_REPLACEMENT = '***REDACTED***';

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
 * Default sensitive data masking patterns
 */
const DEFAULT_MASKING_PATTERNS: MaskingPattern[] = [
  { name: 'github_pat', pattern: /ghp_[a-zA-Z0-9]{36}/g },
  { name: 'github_oauth', pattern: /gho_[a-zA-Z0-9]{36}/g },
  { name: 'github_app', pattern: /ghs_[a-zA-Z0-9]{36}/g },
  { name: 'github_refresh', pattern: /ghr_[a-zA-Z0-9]{36}/g },
  { name: 'openai_api_key', pattern: /sk-[a-zA-Z0-9]{48}/g },
  { name: 'anthropic_api_key', pattern: /sk-ant-[a-zA-Z0-9-]{95}/g },
  { name: 'generic_api_key', pattern: /(?:api[_-]?key|apikey|api_secret)["\s:=]+["']?([a-zA-Z0-9_-]{20,})["']?/gi },
  { name: 'bearer_token', pattern: /Bearer\s+[a-zA-Z0-9._-]+/gi },
  { name: 'basic_auth', pattern: /Basic\s+[a-zA-Z0-9+/=]+/gi },
  { name: 'jwt_token', pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g },
  { name: 'aws_access_key', pattern: /AKIA[0-9A-Z]{16}/g },
  { name: 'aws_secret_key', pattern: /(?:aws)?_?secret_?(?:access)?_?key["'\s:=]+["']?([a-zA-Z0-9/+=]{40})["']?/gi },
];

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
  private readonly agentLogConfig: AgentLogConfig;
  private readonly maskingPatterns: MaskingPattern[];
  private readonly enableMasking: boolean;
  private correlationId: string;
  private sessionId: string;
  private currentAgent: string | undefined;
  private currentStage: string | undefined;
  private currentProjectId: string | undefined;
  private currentLogFile: string | null = null;
  private currentFileSize = 0;
  private readonly agentLogFiles: Map<string, { file: string; size: number }> = new Map();

  constructor(options: LoggerOptions = {}) {
    this.logDir = options.logDir ?? DEFAULT_LOG_DIR;
    this.maxFileSize = options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
    this.maxFiles = options.maxFiles ?? DEFAULT_MAX_FILES;
    this.minLevel = options.minLevel ?? 'INFO';
    this.consoleOutput = options.consoleOutput ?? process.env['NODE_ENV'] !== 'production';
    this.jsonOutput = options.jsonOutput ?? true;
    this.agentLogConfig = options.agentLogConfig ?? { enabled: false };
    this.enableMasking = options.enableMasking ?? true;
    this.maskingPatterns = [
      ...DEFAULT_MASKING_PATTERNS,
      ...(options.maskingPatterns ?? []),
    ];
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
    // Create agent logs directory if enabled
    if (this.agentLogConfig.enabled === true) {
      const agentLogsDir = this.getAgentLogsDir();
      if (!fs.existsSync(agentLogsDir)) {
        fs.mkdirSync(agentLogsDir, { recursive: true, mode: 0o755 });
      }
    }
  }

  /**
   * Get the agent logs directory path
   */
  private getAgentLogsDir(): string {
    return path.join(this.logDir, this.agentLogConfig.directory ?? DEFAULT_AGENT_LOGS_DIR);
  }

  /**
   * Mask sensitive data in a string
   */
  private maskSensitiveData(text: string): string {
    if (!this.enableMasking) {
      return text;
    }

    let masked = text;
    for (const { pattern, replacement } of this.maskingPatterns) {
      // Reset lastIndex for global patterns
      pattern.lastIndex = 0;
      masked = masked.replace(pattern, replacement ?? DEFAULT_MASK_REPLACEMENT);
    }
    return masked;
  }

  /**
   * Mask sensitive data in an object recursively
   */
  private maskObject(obj: unknown): unknown {
    if (!this.enableMasking) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.maskSensitiveData(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.maskObject(item));
    }

    if (obj !== null && typeof obj === 'object') {
      const masked: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        masked[key] = this.maskObject(value);
      }
      return masked;
    }

    return obj;
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
    // Apply masking to message
    const maskedMessage = this.maskSensitiveData(message);

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: maskedMessage,
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
      // Apply masking to context
      const maskedContext = this.maskObject(context) as Record<string, unknown>;
      (entry as { context?: Record<string, unknown> }).context = maskedContext;
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
      message: this.maskSensitiveData(error.message),
    };

    if (error.stack !== undefined) {
      (errorInfo as { stack?: string }).stack = this.maskSensitiveData(error.stack);
    }

    return errorInfo;
  }

  /**
   * Get or create agent log file info
   */
  private getOrCreateAgentLogFile(agentName: string): { file: string; size: number } {
    const existing = this.agentLogFiles.get(agentName);
    if (existing !== undefined) {
      return existing;
    }

    const agentLogsDir = this.getAgentLogsDir();

    // Ensure agent logs directory exists
    if (!fs.existsSync(agentLogsDir)) {
      fs.mkdirSync(agentLogsDir, { recursive: true, mode: 0o755 });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(agentLogsDir, `${agentName}-${timestamp}.jsonl`);
    const logInfo = { file, size: 0 };
    this.agentLogFiles.set(agentName, logInfo);

    // Rotate old agent log files
    this.rotateAgentLogFiles(agentName);

    return logInfo;
  }

  /**
   * Rotate old agent log files
   */
  private rotateAgentLogFiles(agentName: string): void {
    try {
      const agentLogsDir = this.getAgentLogsDir();
      if (!fs.existsSync(agentLogsDir)) {
        return;
      }

      const maxFiles = this.agentLogConfig.maxFiles ?? this.maxFiles;
      const files = fs
        .readdirSync(agentLogsDir)
        .filter((f) => f.startsWith(`${agentName}-`) && f.endsWith('.jsonl'))
        .map((f) => ({
          name: f,
          path: path.join(agentLogsDir, f),
          mtime: fs.statSync(path.join(agentLogsDir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.mtime - a.mtime);

      for (let i = maxFiles; i < files.length; i++) {
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
   * Check if agent log file rotation is needed
   */
  private checkAgentLogRotation(agentName: string): void {
    const logInfo = this.agentLogFiles.get(agentName);
    if (logInfo === undefined) {
      return;
    }

    const maxFileSize = this.agentLogConfig.maxFileSize ?? this.maxFileSize;
    if (logInfo.size >= maxFileSize) {
      // Create new log file
      const agentLogsDir = this.getAgentLogsDir();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const file = path.join(agentLogsDir, `${agentName}-${timestamp}.jsonl`);
      this.agentLogFiles.set(agentName, { file, size: 0 });
      this.rotateAgentLogFiles(agentName);
    }
  }

  /**
   * Write entry to agent-specific log file
   */
  private writeToAgentLog(entry: LogEntry, line: string): void {
    if (this.agentLogConfig.enabled !== true || entry.agent === undefined) {
      return;
    }

    try {
      const logInfo = this.getOrCreateAgentLogFile(entry.agent);
      this.checkAgentLogRotation(entry.agent);

      const lineBytes = Buffer.byteLength(line, 'utf8');
      fs.appendFileSync(logInfo.file, line, { mode: 0o644 });
      logInfo.size += lineBytes;
    } catch {
      // Ignore agent log write errors
    }
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

    // Write to agent-specific log file
    this.writeToAgentLog(entry, line);

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
      agentLogConfig: this.agentLogConfig,
      enableMasking: this.enableMasking,
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

  /**
   * Query log entries with advanced filtering
   */
  public queryLogs(filter: LogQueryFilter, limit = 100, offset = 0): LogQueryResult {
    const allEntries = this.getAllLogEntries();
    const filtered = this.applyFilter(allEntries, filter);

    const totalCount = filtered.length;
    const entries = filtered.slice(offset, offset + limit);
    const hasMore = offset + limit < totalCount;

    return { entries, totalCount, hasMore };
  }

  /**
   * Get all log entries from all log files
   */
  private getAllLogEntries(): LogEntry[] {
    const entries: LogEntry[] = [];

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

      for (const file of files) {
        const content = fs.readFileSync(file.path, 'utf8');
        const lines = content.trim().split('\n');
        for (const line of lines) {
          if (line.trim() !== '') {
            try {
              entries.push(JSON.parse(line) as LogEntry);
            } catch {
              // Skip malformed lines
            }
          }
        }
      }
    } catch {
      // Ignore read errors
    }

    // Sort by timestamp descending (most recent first)
    return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Apply filter to log entries
   */
  private applyFilter(entries: LogEntry[], filter: LogQueryFilter): LogEntry[] {
    return entries.filter((entry) => {
      if (filter.level !== undefined && entry.level !== filter.level) {
        return false;
      }
      if (filter.agent !== undefined && entry.agent !== filter.agent) {
        return false;
      }
      if (filter.stage !== undefined && entry.stage !== filter.stage) {
        return false;
      }
      if (filter.projectId !== undefined && entry.projectId !== filter.projectId) {
        return false;
      }
      if (filter.correlationId !== undefined && entry.correlationId !== filter.correlationId) {
        return false;
      }
      if (filter.startTime !== undefined) {
        const entryTime = new Date(entry.timestamp).getTime();
        const startTime = new Date(filter.startTime).getTime();
        if (entryTime < startTime) {
          return false;
        }
      }
      if (filter.endTime !== undefined) {
        const entryTime = new Date(entry.timestamp).getTime();
        const endTime = new Date(filter.endTime).getTime();
        if (entryTime > endTime) {
          return false;
        }
      }
      if (filter.messageContains !== undefined) {
        if (!entry.message.toLowerCase().includes(filter.messageContains.toLowerCase())) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Get log entries for a specific agent
   */
  public getAgentLogs(agentName: string, limit = 100): LogEntry[] {
    // First try agent-specific log file
    if (this.agentLogConfig.enabled === true) {
      const agentEntries = this.getAgentLogEntries(agentName);
      if (agentEntries.length > 0) {
        return agentEntries.slice(0, limit);
      }
    }

    // Fall back to filtering main logs
    return this.queryLogs({ agent: agentName }, limit).entries;
  }

  /**
   * Get entries from agent-specific log file
   */
  private getAgentLogEntries(agentName: string): LogEntry[] {
    const entries: LogEntry[] = [];
    const agentLogsDir = this.getAgentLogsDir();

    if (!fs.existsSync(agentLogsDir)) {
      return entries;
    }

    try {
      const files = fs
        .readdirSync(agentLogsDir)
        .filter((f) => f.startsWith(`${agentName}-`) && f.endsWith('.jsonl'))
        .map((f) => ({
          name: f,
          path: path.join(agentLogsDir, f),
          mtime: fs.statSync(path.join(agentLogsDir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.mtime - a.mtime);

      for (const file of files) {
        const content = fs.readFileSync(file.path, 'utf8');
        const lines = content.trim().split('\n');
        for (const line of lines) {
          if (line.trim() !== '') {
            try {
              entries.push(JSON.parse(line) as LogEntry);
            } catch {
              // Skip malformed lines
            }
          }
        }
      }
    } catch {
      // Ignore read errors
    }

    return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Get logs within a time range
   */
  public getLogsByTimeRange(startTime: string, endTime: string, limit = 100): LogEntry[] {
    return this.queryLogs({ startTime, endTime }, limit).entries;
  }

  /**
   * Search logs by message content
   */
  public searchLogs(searchTerm: string, limit = 100): LogEntry[] {
    return this.queryLogs({ messageContains: searchTerm }, limit).entries;
  }

  /**
   * Get logs by correlation ID (for tracing a request)
   */
  public getLogsByCorrelationId(correlationId: string): LogEntry[] {
    return this.queryLogs({ correlationId }, 1000).entries;
  }

  /**
   * Get agent log file path for a specific agent
   */
  public getAgentLogFile(agentName: string): string | null {
    const logInfo = this.agentLogFiles.get(agentName);
    return logInfo?.file ?? null;
  }

  /**
   * Get list of all agents that have logs
   */
  public getLoggedAgents(): string[] {
    const agents = new Set<string>();

    // From main logs
    const entries = this.getRecentEntries(1000);
    for (const entry of entries) {
      if (entry.agent !== undefined) {
        agents.add(entry.agent);
      }
    }

    // From agent logs directory
    if (this.agentLogConfig.enabled === true) {
      const agentLogsDir = this.getAgentLogsDir();
      if (fs.existsSync(agentLogsDir)) {
        const files = fs.readdirSync(agentLogsDir);
        for (const file of files) {
          const match = file.match(/^([^-]+)-/);
          if (match !== null && match[1] !== undefined) {
            agents.add(match[1]);
          }
        }
      }
    }

    return Array.from(agents).sort();
  }

  /**
   * Enable or disable masking at runtime
   */
  public setMaskingEnabled(enabled: boolean): void {
    (this as { enableMasking: boolean }).enableMasking = enabled;
  }

  /**
   * Check if masking is enabled
   */
  public isMaskingEnabled(): boolean {
    return this.enableMasking;
  }

  /**
   * Add a custom masking pattern at runtime
   */
  public addMaskingPattern(pattern: MaskingPattern): void {
    this.maskingPatterns.push(pattern);
  }

  /**
   * Get list of registered masking pattern names
   */
  public getMaskingPatternNames(): string[] {
    return this.maskingPatterns.map((p) => p.name);
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
