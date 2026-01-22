/**
 * Logger - Unified logging class with multi-transport support
 *
 * Features:
 * - Multi-transport support (Console, File, Elasticsearch, CloudWatch)
 * - Buffering and retry mechanism via transports
 * - Configuration-based transport selection
 * - Environment-based configuration support
 * - Runtime reconfiguration capability
 *
 * @module logging
 */

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import os from 'node:os';
import { getPath } from '../config/paths.js';
import type { ILogTransport, TransportHealth } from './transports/ILogTransport.js';
import { ConsoleTransport } from './transports/ConsoleTransport.js';
import { FileTransport } from './transports/FileTransport.js';
import { ElasticsearchTransport } from './transports/ElasticsearchTransport.js';
import { CloudWatchTransport } from './transports/CloudWatchTransport.js';
import type {
  LogLevel,
  TransportLogEntry,
  TransportConfig,
  ConsoleTransportConfig,
  FileTransportConfig,
  ElasticsearchTransportConfig,
  CloudWatchTransportConfig,
  MaskingPattern,
  LogEntry,
  LogQueryFilter,
  LogQueryResult,
  LogAggregationSource,
  LogAggregationOptions,
  LogCompressionOptions,
  LogQueryParseResult,
  StructuredLogQueryResult,
} from './transports/types.js';
import { LOG_LEVEL_PRIORITY, shouldLog } from './transports/types.js';
import { LogContext } from './LogContext.js';
import { LogQueryParser } from './LogQueryParser.js';

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  /** Minimum log level */
  readonly minLevel?: LogLevel;
  /** Transport configurations */
  readonly transports?: TransportConfig[];
  /** Enable sensitive data masking */
  readonly enableMasking?: boolean;
  /** Custom masking patterns */
  readonly maskingPatterns?: MaskingPattern[];
  /** Default correlation ID */
  readonly correlationId?: string;
  /** Default context to include in all log entries */
  readonly defaultContext?: Record<string, unknown>;
}

/**
 * Environment-based configuration
 */
export interface EnvironmentConfig {
  /** Environment variable prefix for configuration */
  readonly envPrefix?: string;
  /** Use LOG_LEVEL environment variable */
  readonly useLogLevel?: boolean;
  /** Use LOG_TRANSPORTS environment variable */
  readonly useTransports?: boolean;
}

/**
 * Logger state for health monitoring
 */
export type LoggerState = 'uninitialized' | 'initializing' | 'ready' | 'error' | 'closed';

/**
 * Information about the last transport error
 */
export interface LastTransportError {
  /** Transport name that failed */
  readonly transport: string;
  /** Error message */
  readonly error: string;
  /** Timestamp when error occurred */
  readonly timestamp: number;
  /** Correlation ID of the failed log entry */
  readonly correlationId?: string;
}

/**
 * Logger health information
 */
export interface LoggerHealth {
  /** Current logger state */
  readonly state: LoggerState;
  /** Transport health information */
  readonly transports: Map<string, TransportHealth>;
  /** Total logs sent */
  readonly totalLogs: number;
  /** Total logs failed */
  readonly failedLogs: number;
  /** Last log time */
  readonly lastLogTime?: Date;
  /** Last transport error information */
  readonly lastTransportError?: LastTransportError;
}

/**
 * Default masking replacement string
 */
const DEFAULT_MASK_REPLACEMENT = '***REDACTED***';

/**
 * Default sensitive data masking patterns
 *
 * Covers common sensitive data types:
 * - API keys (GitHub, OpenAI, Anthropic, AWS, Google, Azure)
 * - Authentication tokens (Bearer, Basic, JWT)
 * - Passwords and secrets
 * - Credit card numbers
 * - Social security numbers
 * - Private keys and certificates
 */
const DEFAULT_MASKING_PATTERNS: MaskingPattern[] = [
  // GitHub tokens
  { name: 'github_pat', pattern: /ghp_[a-zA-Z0-9]{36}/g },
  { name: 'github_oauth', pattern: /gho_[a-zA-Z0-9]{36}/g },
  { name: 'github_app', pattern: /ghs_[a-zA-Z0-9]{36}/g },
  { name: 'github_refresh', pattern: /ghr_[a-zA-Z0-9]{36}/g },

  // AI provider API keys
  { name: 'openai_api_key', pattern: /sk-[a-zA-Z0-9]{48}/g },
  { name: 'openai_api_key_proj', pattern: /sk-proj-[a-zA-Z0-9_-]{100,}/g },
  { name: 'anthropic_api_key', pattern: /sk-ant-[a-zA-Z0-9-]{95}/g },

  // AWS credentials
  { name: 'aws_access_key', pattern: /AKIA[0-9A-Z]{16}/g },
  {
    name: 'aws_secret_key',
    pattern: /(?:aws)?_?secret_?(?:access)?_?key["'\s:=]+["']?([a-zA-Z0-9/+=]{40})["']?/gi,
  },
  {
    name: 'aws_session_token',
    pattern:
      /(?:aws_session_token|x-amz-security-token)["'\s:=]+["']?([a-zA-Z0-9/+=]{100,})["']?/gi,
  },

  // Google Cloud
  { name: 'google_api_key', pattern: /AIza[0-9A-Za-z_-]{35}/g },
  { name: 'google_oauth', pattern: /[0-9]+-[0-9A-Za-z_]{32}\.apps\.googleusercontent\.com/g },

  // Azure
  {
    name: 'azure_storage_key',
    pattern: /(?:AccountKey|SharedAccessSignature)=([a-zA-Z0-9/+=]{86,88})/g,
  },
  {
    name: 'azure_connection_string',
    pattern: /DefaultEndpointsProtocol=https;AccountName=[^;]+;AccountKey=[^;]+/g,
  },

  // Generic patterns
  {
    name: 'generic_api_key',
    pattern: /(?:api[_-]?key|apikey|api_secret|api_token)["\s:=]+["']?([a-zA-Z0-9_-]{20,})["']?/gi,
  },
  {
    name: 'generic_secret',
    pattern: /(?:secret|private_key|client_secret)["\s:=]+["']?([a-zA-Z0-9_-]{20,})["']?/gi,
  },
  {
    name: 'generic_password',
    pattern: /(?:password|passwd|pwd)["\s:=]+["']?([^\s"']{8,})["']?/gi,
  },

  // Authentication tokens
  { name: 'bearer_token', pattern: /Bearer\s+[a-zA-Z0-9._-]+/gi },
  { name: 'basic_auth', pattern: /Basic\s+[a-zA-Z0-9+/=]+/gi },
  { name: 'jwt_token', pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g },

  // Private keys and certificates
  {
    name: 'private_key',
    pattern:
      /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g,
  },
  {
    name: 'certificate',
    pattern: /-----BEGIN\s+CERTIFICATE-----[\s\S]*?-----END\s+CERTIFICATE-----/g,
  },

  // Credit card numbers (basic patterns)
  { name: 'credit_card_visa', pattern: /\b4[0-9]{12}(?:[0-9]{3})?\b/g },
  { name: 'credit_card_mastercard', pattern: /\b5[1-5][0-9]{14}\b/g },
  { name: 'credit_card_amex', pattern: /\b3[47][0-9]{13}\b/g },

  // Social Security Number (US)
  { name: 'ssn', pattern: /\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b/g },

  // Database connection strings
  { name: 'db_connection_postgres', pattern: /postgres(?:ql)?:\/\/[^:]+:[^@]+@[^\s]+/gi },
  { name: 'db_connection_mysql', pattern: /mysql:\/\/[^:]+:[^@]+@[^\s]+/gi },
  { name: 'db_connection_mongodb', pattern: /mongodb(?:\+srv)?:\/\/[^:]+:[^@]+@[^\s]+/gi },
  { name: 'db_connection_redis', pattern: /redis:\/\/[^:]+:[^@]+@[^\s]+/gi },

  // Slack tokens
  { name: 'slack_token', pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}[a-zA-Z0-9-]*/g },
  {
    name: 'slack_webhook',
    pattern: /https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[a-zA-Z0-9]+/g,
  },

  // NPM tokens
  { name: 'npm_token', pattern: /npm_[a-zA-Z0-9]{36}/g },

  // Stripe keys
  { name: 'stripe_secret', pattern: /sk_live_[a-zA-Z0-9]{24,}/g },
  { name: 'stripe_publishable', pattern: /pk_live_[a-zA-Z0-9]{24,}/g },

  // Twilio
  { name: 'twilio_api_key', pattern: /SK[a-f0-9]{32}/g },
];

/**
 * Unified Logger class with multi-transport support
 *
 * @example
 * ```typescript
 * const logger = new Logger({
 *   minLevel: 'INFO',
 *   transports: [
 *     { type: 'console', format: 'pretty', colors: true },
 *     { type: 'file', path: './logs' },
 *   ],
 * });
 *
 * await logger.initialize();
 *
 * logger.info('Application started', { version: '1.0.0' });
 * logger.error('Failed to connect', { error: err.message });
 *
 * await logger.close();
 * ```
 */
export class Logger {
  private state: LoggerState = 'uninitialized';
  private readonly transports: ILogTransport[] = [];
  private readonly minLevel: LogLevel;
  private readonly enableMasking: boolean;
  private readonly maskingPatterns: MaskingPattern[];
  private readonly defaultContext: Record<string, unknown>;

  // Context tracking
  private correlationId: string;
  private sessionId: string;
  private currentAgent?: string;
  private currentStage?: string;
  private currentProjectId?: string;
  private traceId?: string;
  private spanId?: string;
  private parentSpanId?: string;

  // Health tracking
  private totalLogs = 0;
  private failedLogs = 0;
  private lastLogTime?: Date;
  private lastTransportError?: LastTransportError;

  // Configuration
  private readonly config: LoggerConfig;

  // Query parser for structured log search
  private readonly queryParser: LogQueryParser = new LogQueryParser();

  // Log directory for query and aggregation (from file transport config)
  private logDir: string = getPath('logs');

  /**
   * Create a new Logger instance
   *
   * @param config - Logger configuration options
   */
  constructor(config: LoggerConfig = {}) {
    this.config = config;
    this.minLevel = config.minLevel ?? 'INFO';
    this.enableMasking = config.enableMasking ?? true;
    this.maskingPatterns = [...DEFAULT_MASKING_PATTERNS, ...(config.maskingPatterns ?? [])];
    this.defaultContext = config.defaultContext ?? {};
    this.correlationId = config.correlationId ?? randomUUID();
    this.sessionId = randomUUID();

    // Create transports from configuration
    if (config.transports !== undefined && config.transports.length > 0) {
      for (const transportConfig of config.transports) {
        const transport = this.createTransport(transportConfig);
        if (transport !== null) {
          this.transports.push(transport);
        }
        // Extract log directory from file transport
        if (transportConfig.type === 'file') {
          this.logDir = transportConfig.path;
        }
      }
    }
  }

  /**
   * Create a Logger from environment variables
   *
   * @param envConfig - Environment configuration options
   * @returns Logger instance configured from environment
   */
  static fromEnvironment(envConfig: EnvironmentConfig = {}): Logger {
    const prefix = envConfig.envPrefix ?? 'LOG';

    // Get log level from environment
    let minLevel: LogLevel = 'INFO';
    if (envConfig.useLogLevel !== false) {
      const envLevel = process.env[`${prefix}_LEVEL`];
      if (envLevel !== undefined && isValidLogLevel(envLevel)) {
        minLevel = envLevel;
      }
    }

    // Get transports from environment
    const transports: TransportConfig[] = [];
    if (envConfig.useTransports !== false) {
      const envTransports = process.env[`${prefix}_TRANSPORTS`];
      if (envTransports !== undefined) {
        const transportNames = envTransports.split(',').map((t) => t.trim().toLowerCase());
        for (const name of transportNames) {
          const config = createTransportConfigFromEnv(name, prefix);
          if (config !== null) {
            transports.push(config);
          }
        }
      }
    }

    // Default to console if no transports specified
    if (transports.length === 0) {
      transports.push({
        type: 'console',
        format: 'pretty',
        colors: true,
      });
    }

    return new Logger({
      minLevel,
      transports,
      enableMasking: process.env[`${prefix}_ENABLE_MASKING`] !== 'false',
    });
  }

  /**
   * Initialize all transports
   *
   * Must be called before logging.
   */
  async initialize(): Promise<void> {
    if (this.state !== 'uninitialized') {
      throw new Error(`Logger is already initialized (state: ${this.state})`);
    }

    this.state = 'initializing';

    try {
      // Initialize all transports in parallel
      await Promise.all(this.transports.map((t) => t.initialize()));
      this.state = 'ready';
    } catch (error) {
      this.state = 'error';
      throw error;
    }
  }

  /**
   * Close all transports
   *
   * Should be called before application shutdown.
   */
  async close(): Promise<void> {
    if (this.state === 'closed') {
      return;
    }

    // Close all transports, ignoring individual errors
    await Promise.allSettled(this.transports.map((t) => t.close()));
    this.state = 'closed';
  }

  /**
   * Flush all transports
   *
   * Ensures all buffered logs are shipped.
   */
  async flush(): Promise<void> {
    if (this.state !== 'ready') {
      return;
    }

    await Promise.allSettled(this.transports.map((t) => t.flush()));
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: Record<string, unknown>): void {
    this.log('DEBUG', message, context);
  }

  /**
   * Log an info message
   */
  info(message: string, context?: Record<string, unknown>): void {
    this.log('INFO', message, context);
  }

  /**
   * Log a warning message
   */
  warn(message: string, context?: Record<string, unknown>): void {
    this.log('WARN', message, context);
  }

  /**
   * Log an error message
   */
  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    const errorContext = error !== undefined ? { error: this.formatError(error) } : {};
    this.log('ERROR', message, { ...context, ...errorContext });
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (this.state !== 'ready') {
      // If not initialized, fall back to console
      console.log(`[${level}] ${message}`, context ?? '');
      return;
    }

    if (!shouldLog(level, this.minLevel)) {
      return;
    }

    const entry = this.createEntry(level, message, context);

    // Ship to all transports asynchronously
    this.totalLogs++;
    this.lastLogTime = new Date();

    for (const transport of this.transports) {
      void transport.log(entry).catch((error: unknown) => {
        this.failedLogs++;
        const transportError: LastTransportError = {
          transport: transport.name,
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
          ...(entry.correlationId !== undefined && { correlationId: entry.correlationId }),
        };
        this.lastTransportError = transportError;
      });
    }
  }

  /**
   * Create a log entry
   *
   * This method automatically integrates with LogContext for context propagation.
   * If LogContext has active context, it will be merged with instance-level context.
   * Instance-level context takes precedence over LogContext values.
   */
  private createEntry(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): TransportLogEntry {
    // Apply masking
    const maskedMessage = this.maskSensitiveData(message);
    const maskedContext = this.maskObject({
      ...this.defaultContext,
      ...context,
    }) as Record<string, unknown>;

    // Get context from AsyncLocalStorage if available
    const logContext = LogContext.getInstance();
    const asyncContext = logContext.getContext();

    // Determine correlation ID (instance takes precedence, then async context)
    const correlationId =
      this.correlationId !== this.config.correlationId
        ? this.correlationId
        : (asyncContext?.correlationId ?? this.correlationId);

    // Determine session ID
    const sessionId = asyncContext?.sessionId ?? this.sessionId;

    // Determine agent context (instance takes precedence, then async context)
    const agentId = this.currentAgent ?? asyncContext?.agent?.agentId;
    const stage = this.currentStage ?? asyncContext?.agent?.stage;
    const projectId = this.currentProjectId ?? asyncContext?.agent?.projectId;

    // Determine trace context (instance takes precedence, then async context)
    const traceId = this.traceId ?? asyncContext?.trace?.traceId;
    const spanId = this.spanId ?? asyncContext?.trace?.spanId;
    const parentSpanId = this.parentSpanId ?? asyncContext?.trace?.parentSpanId;

    // Extract durationMs from context if present
    const durationMs =
      context?.durationMs !== undefined && typeof context.durationMs === 'number'
        ? context.durationMs
        : undefined;

    // Build entry with all optional fields using typed assignment
    const entry: TransportLogEntry = {
      timestamp: new Date(),
      level,
      message: maskedMessage,
      context: maskedContext,
      correlationId,
      sessionId,
      hostname: os.hostname(),
      pid: process.pid,
      ...(agentId !== undefined && { agentId }),
      ...(stage !== undefined && { stage }),
      ...(projectId !== undefined && { projectId }),
      ...(traceId !== undefined && { traceId }),
      ...(spanId !== undefined && { spanId }),
      ...(parentSpanId !== undefined && { parentSpanId }),
      ...(durationMs !== undefined && { durationMs }),
    };

    return entry;
  }

  /**
   * Format an error for logging
   */
  private formatError(error: Error): Record<string, unknown> {
    return {
      name: error.name,
      message: this.maskSensitiveData(error.message),
      stack: error.stack !== undefined ? this.maskSensitiveData(error.stack) : undefined,
    };
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
   * Create a transport from configuration
   */
  private createTransport(config: TransportConfig): ILogTransport | null {
    if (config.enabled === false) {
      return null;
    }

    switch (config.type) {
      case 'console':
        return new ConsoleTransport(config);
      case 'file':
        return new FileTransport(config);
      case 'elasticsearch':
        return new ElasticsearchTransport(config);
      case 'cloudwatch':
        return new CloudWatchTransport(config);
      default:
        return null;
    }
  }

  // Context setters and getters

  /**
   * Set the correlation ID for request tracing
   */
  setCorrelationId(correlationId: string): void {
    this.correlationId = correlationId;
  }

  /**
   * Get the current correlation ID
   */
  getCorrelationId(): string {
    return this.correlationId;
  }

  /**
   * Generate a new correlation ID
   */
  newCorrelationId(): string {
    this.correlationId = randomUUID();
    return this.correlationId;
  }

  /**
   * Set the session ID
   */
  setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  /**
   * Get the current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Set the current agent context
   */
  setAgent(agent?: string): void {
    if (agent === undefined) {
      delete (this as Record<string, unknown>)['currentAgent'];
    } else {
      this.currentAgent = agent;
    }
  }

  /**
   * Get the current agent context
   */
  getAgent(): string | undefined {
    return this.currentAgent;
  }

  /**
   * Set the current pipeline stage
   */
  setStage(stage?: string): void {
    if (stage === undefined) {
      delete (this as Record<string, unknown>)['currentStage'];
    } else {
      this.currentStage = stage;
    }
  }

  /**
   * Get the current pipeline stage
   */
  getStage(): string | undefined {
    return this.currentStage;
  }

  /**
   * Set the current project ID
   */
  setProjectId(projectId?: string): void {
    if (projectId === undefined) {
      delete (this as Record<string, unknown>)['currentProjectId'];
    } else {
      this.currentProjectId = projectId;
    }
  }

  /**
   * Get the current project ID
   */
  getProjectId(): string | undefined {
    return this.currentProjectId;
  }

  /**
   * Set distributed tracing context
   */
  setTraceContext(traceId: string, spanId: string, parentSpanId?: string): void {
    this.traceId = traceId;
    this.spanId = spanId;
    if (parentSpanId !== undefined) {
      this.parentSpanId = parentSpanId;
    } else {
      delete (this as Record<string, unknown>)['parentSpanId'];
    }
  }

  /**
   * Clear distributed tracing context
   */
  clearTraceContext(): void {
    delete (this as Record<string, unknown>)['traceId'];
    delete (this as Record<string, unknown>)['spanId'];
    delete (this as Record<string, unknown>)['parentSpanId'];
  }

  // Transport management

  /**
   * Add a transport at runtime
   */
  async addTransport(config: TransportConfig): Promise<void> {
    const transport = this.createTransport(config);
    if (transport === null) {
      return;
    }

    if (this.state === 'ready') {
      await transport.initialize();
    }

    this.transports.push(transport);
  }

  /**
   * Remove a transport by name at runtime
   */
  async removeTransport(name: string): Promise<boolean> {
    const index = this.transports.findIndex((t) => t.name === name);
    if (index === -1) {
      return false;
    }

    const transport = this.transports[index];
    this.transports.splice(index, 1);

    if (transport !== undefined) {
      await transport.close();
    }

    return true;
  }

  /**
   * Get transport names
   */
  getTransportNames(): string[] {
    return this.transports.map((t) => t.name);
  }

  /**
   * Get logger health information
   */
  getHealth(): LoggerHealth {
    const transportHealth = new Map<string, TransportHealth>();

    for (const transport of this.transports) {
      if (transport.getHealth !== undefined) {
        transportHealth.set(transport.name, transport.getHealth());
      }
    }

    return {
      state: this.state,
      transports: transportHealth,
      totalLogs: this.totalLogs,
      failedLogs: this.failedLogs,
      ...(this.lastLogTime !== undefined && { lastLogTime: this.lastLogTime }),
      ...(this.lastTransportError !== undefined && { lastTransportError: this.lastTransportError }),
    };
  }

  /**
   * Check if logger is ready
   */
  isReady(): boolean {
    return this.state === 'ready';
  }

  /**
   * Create a child logger with additional context
   */
  child(context: {
    agent?: string;
    stage?: string;
    projectId?: string;
    correlationId?: string;
  }): Logger {
    const child = new Logger({
      ...this.config,
      correlationId: context.correlationId ?? this.correlationId,
      defaultContext: {
        ...this.defaultContext,
        ...this.config.defaultContext,
      },
    });

    // Copy transports (share the same instances)
    child.transports.push(...this.transports);

    // Set state to ready since we're sharing transports
    child.state = this.state;

    // Copy context
    child.setSessionId(this.sessionId);
    child.setAgent(context.agent ?? this.currentAgent);
    child.setStage(context.stage ?? this.currentStage);
    child.setProjectId(context.projectId ?? this.currentProjectId);

    if (this.traceId !== undefined) {
      child.setTraceContext(this.traceId, this.spanId ?? '', this.parentSpanId);
    }

    return child;
  }

  /**
   * Reconfigure logger at runtime
   */
  async reconfigure(config: Partial<LoggerConfig>): Promise<void> {
    // Update masking patterns if provided
    if (config.maskingPatterns !== undefined) {
      this.maskingPatterns.push(...config.maskingPatterns);
    }

    // Add new transports if provided
    if (config.transports !== undefined) {
      for (const transportConfig of config.transports) {
        await this.addTransport(transportConfig);
      }
    }
  }

  // ========================================
  // Query, Aggregation, and Compression Methods
  // ========================================

  /**
   * Get the log directory path
   */
  getLogDir(): string {
    return this.logDir;
  }

  /**
   * Set the log directory path
   */
  setLogDir(logDir: string): void {
    this.logDir = logDir;
  }

  /**
   * Query log entries with advanced filtering
   */
  queryLogs(filter: LogQueryFilter, limit = 100, offset = 0): LogQueryResult {
    const allEntries = this.getAllLogEntries();
    const filtered = this.applyFilter(allEntries, filter);

    const totalCount = filtered.length;
    const entries = filtered.slice(offset, offset + limit);
    const hasMore = offset + limit < totalCount;

    return { entries, totalCount, hasMore };
  }

  /**
   * Search logs using structured query language
   *
   * Query syntax examples:
   * - level:error - Match error level logs
   * - agent:worker-1 - Match logs from specific agent
   * - level:error AND agent:worker - Combine conditions with AND
   * - level:error OR level:warn - Match multiple levels
   * - NOT level:debug - Exclude debug logs
   * - message:"failed to connect" - Search message content
   * - time:2024-01-01..2024-01-31 - Filter by time range
   * - (level:error OR level:warn) AND agent:worker - Group with parentheses
   *
   * Supported fields: level, agent, stage, projectId, correlationId, message, time
   */
  searchWithQuery(query: string, limit = 100, offset = 0): StructuredLogQueryResult {
    const entries = this.getAllLogEntries();
    return this.queryParser.search(query, entries, limit, offset);
  }

  /**
   * Parse a query string without executing it
   *
   * Useful for validating query syntax before execution
   */
  parseQuery(query: string): LogQueryParseResult {
    return this.queryParser.parse(query);
  }

  /**
   * Get all log entries from all log files
   */
  private getAllLogEntries(): LogEntry[] {
    const entries: LogEntry[] = [];

    try {
      if (!fs.existsSync(this.logDir)) {
        return entries;
      }

      const files = fs
        .readdirSync(this.logDir)
        .filter((f) => f.endsWith('.jsonl') && !f.endsWith('.gz'))
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
              const entry = JSON.parse(line) as LogEntry;
              entries.push(entry);
            } catch {
              // Skip malformed entries
            }
          }
        }
      }
    } catch {
      // Ignore read errors
    }

    // Sort by timestamp descending (most recent first)
    return entries.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
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
   * Get logs by correlation ID (for tracing a request)
   */
  getLogsByCorrelationId(correlationId: string): LogEntry[] {
    return this.queryLogs({ correlationId }, 1000).entries;
  }

  /**
   * Search logs by message content
   */
  searchLogs(searchTerm: string, limit = 100): LogEntry[] {
    return this.queryLogs({ messageContains: searchTerm }, limit).entries;
  }

  /**
   * Get logs within a time range
   */
  getLogsByTimeRange(startTime: string, endTime: string, limit = 100): LogEntry[] {
    return this.queryLogs({ startTime, endTime }, limit).entries;
  }

  /**
   * Get recent log entries
   */
  getRecentEntries(limit = 100): LogEntry[] {
    const entries = this.getAllLogEntries();
    return entries.slice(0, limit);
  }

  /**
   * Get entries filtered by level
   */
  getEntriesByLevel(level: LogLevel, limit = 100): LogEntry[] {
    return this.queryLogs({ level }, limit).entries;
  }

  /**
   * Get error entries
   */
  getErrors(limit = 50): LogEntry[] {
    return this.getEntriesByLevel('ERROR', limit);
  }

  // ========================================
  // Log Aggregation Methods
  // ========================================

  /**
   * Aggregate logs from multiple sources into a single output
   *
   * Supports file, directory, and in-memory stream sources.
   * Can deduplicate entries and sort by timestamp.
   */
  aggregateLogs(
    sources: readonly LogAggregationSource[],
    options: LogAggregationOptions = {}
  ): LogEntry[] {
    const allEntries: LogEntry[] = [];

    for (const source of sources) {
      const entries = this.loadEntriesFromSource(source);
      allEntries.push(...entries);
    }

    // Deduplicate if requested
    let result = options.deduplicate === true ? this.deduplicateEntries(allEntries) : allEntries;

    // Sort by timestamp
    const sortOrder = options.sortOrder ?? 'desc';
    result = result.sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
    });

    // Write to output if path specified
    if (options.outputPath !== undefined) {
      this.writeAggregatedOutput(result, options.outputPath, options.compress === true);
    }

    return result;
  }

  /**
   * Load log entries from a source
   */
  private loadEntriesFromSource(source: LogAggregationSource): LogEntry[] {
    const entries: LogEntry[] = [];

    try {
      if (source.type === 'file' && source.path !== undefined) {
        const content = source.path.endsWith('.gz')
          ? this.readCompressedFile(source.path)
          : fs.readFileSync(source.path, 'utf8');
        entries.push(...this.parseLogLines(content));
      } else if (source.type === 'directory' && source.path !== undefined) {
        if (fs.existsSync(source.path)) {
          const files = fs
            .readdirSync(source.path)
            .filter((f) => f.endsWith('.jsonl') || f.endsWith('.jsonl.gz'))
            .map((f) => path.join(source.path as string, f));

          for (const file of files) {
            const content = file.endsWith('.gz')
              ? this.readCompressedFile(file)
              : fs.readFileSync(file, 'utf8');
            entries.push(...this.parseLogLines(content));
          }
        }
      }

      // Apply filter if specified
      if (source.filter !== undefined) {
        return this.applyFilter(entries, source.filter);
      }
    } catch {
      // Ignore source read errors
    }

    return entries;
  }

  /**
   * Parse log lines into entries
   */
  private parseLogLines(content: string): LogEntry[] {
    const entries: LogEntry[] = [];
    const lines = content.trim().split('\n');

    for (const line of lines) {
      if (line.trim() !== '') {
        try {
          const entry = JSON.parse(line) as LogEntry;
          entries.push(entry);
        } catch {
          // Skip malformed entries
        }
      }
    }

    return entries;
  }

  /**
   * Deduplicate entries by correlationId + timestamp + message
   */
  private deduplicateEntries(entries: LogEntry[]): LogEntry[] {
    const seen = new Set<string>();
    const unique: LogEntry[] = [];

    for (const entry of entries) {
      const key = `${entry.correlationId}-${entry.timestamp}-${entry.message}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(entry);
      }
    }

    return unique;
  }

  /**
   * Write aggregated output to file
   */
  private writeAggregatedOutput(entries: LogEntry[], outputPath: string, compress: boolean): void {
    const content = entries.map((e) => JSON.stringify(e)).join('\n') + '\n';

    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
    }

    if (compress) {
      const compressed = zlib.gzipSync(Buffer.from(content, 'utf8'), { level: 6 });
      const gzPath = outputPath.endsWith('.gz') ? outputPath : `${outputPath}.gz`;
      fs.writeFileSync(gzPath, compressed, { mode: 0o644 });
    } else {
      fs.writeFileSync(outputPath, content, { mode: 0o644 });
    }
  }

  /**
   * Read a gzip compressed log file
   */
  private readCompressedFile(filePath: string): string {
    const compressed = fs.readFileSync(filePath);
    const decompressed = zlib.gunzipSync(compressed);
    return decompressed.toString('utf8');
  }

  /**
   * Get aggregated logs from all log files including compressed ones
   */
  getAggregatedLogs(filter?: LogQueryFilter, limit = 1000): LogEntry[] {
    const mainSource: LogAggregationSource = {
      id: 'main-logs',
      type: 'directory',
      path: this.logDir,
      ...(filter !== undefined && { filter }),
    };

    const entries = this.aggregateLogs([mainSource], { deduplicate: true, sortOrder: 'desc' });
    return entries.slice(0, limit);
  }

  // ========================================
  // Log Compression Methods
  // ========================================

  /**
   * Compress a log file
   *
   * Compresses the specified log file using gzip compression.
   * Optionally deletes the original file after compression.
   */
  compressLogFile(filePath: string, options: LogCompressionOptions = {}): string | null {
    const algorithm = options.algorithm ?? 'gzip';
    const level = options.level ?? 6;
    const deleteOriginal = options.deleteOriginal ?? false;

    if (algorithm === 'none') {
      return null;
    }

    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(filePath);
      const compressed = zlib.gzipSync(content, { level });
      const outputPath = `${filePath}.gz`;

      fs.writeFileSync(outputPath, compressed, { mode: 0o644 });

      if (deleteOriginal) {
        fs.unlinkSync(filePath);
      }

      return outputPath;
    } catch {
      return null;
    }
  }

  /**
   * Compress old log files that exceed the retention threshold
   *
   * Compresses log files older than the specified age (in milliseconds).
   * Useful for archiving old logs to save disk space.
   */
  compressOldLogFiles(olderThanMs: number, options: LogCompressionOptions = {}): string[] {
    const compressedFiles: string[] = [];
    const now = Date.now();

    try {
      if (!fs.existsSync(this.logDir)) {
        return compressedFiles;
      }

      const files = fs
        .readdirSync(this.logDir)
        .filter((f) => f.endsWith('.jsonl') && !f.endsWith('.gz'))
        .map((f) => ({
          name: f,
          path: path.join(this.logDir, f),
          mtime: fs.statSync(path.join(this.logDir, f)).mtime.getTime(),
        }))
        .filter((f) => now - f.mtime > olderThanMs);

      for (const file of files) {
        const compressed = this.compressLogFile(file.path, options);
        if (compressed !== null) {
          compressedFiles.push(compressed);
        }
      }
    } catch {
      // Ignore compression errors
    }

    return compressedFiles;
  }

  /**
   * Decompress a gzip compressed log file
   */
  decompressLogFile(compressedPath: string, outputPath?: string): string | null {
    if (!fs.existsSync(compressedPath) || !compressedPath.endsWith('.gz')) {
      return null;
    }

    try {
      const content = this.readCompressedFile(compressedPath);
      const outPath = outputPath ?? compressedPath.replace(/\.gz$/, '');

      // Ensure directory exists
      const dir = path.dirname(outPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
      }

      fs.writeFileSync(outPath, content, { mode: 0o644 });
      return outPath;
    } catch {
      return null;
    }
  }
}

/**
 * Check if a string is a valid log level
 */
function isValidLogLevel(level: string): level is LogLevel {
  return level in LOG_LEVEL_PRIORITY;
}

/**
 * Create transport configuration from environment variables
 */
function createTransportConfigFromEnv(
  transportName: string,
  prefix: string
): TransportConfig | null {
  switch (transportName) {
    case 'console':
      return {
        type: 'console',
        format: (process.env[`${prefix}_CONSOLE_FORMAT`] ?? 'pretty') as 'json' | 'pretty',
        colors: process.env[`${prefix}_CONSOLE_COLORS`] !== 'false',
      } as ConsoleTransportConfig;

    case 'file':
      return {
        type: 'file',
        path: process.env[`${prefix}_FILE_PATH`] ?? getPath('logs'),
        maxFileSize: parseInt(process.env[`${prefix}_FILE_MAX_SIZE`] ?? '10485760', 10),
        maxFiles: parseInt(process.env[`${prefix}_FILE_MAX_FILES`] ?? '5', 10),
      } as FileTransportConfig;

    case 'elasticsearch': {
      const nodes = process.env[`${prefix}_ES_NODES`];
      if (nodes === undefined) {
        return null;
      }
      return {
        type: 'elasticsearch',
        nodes: nodes.split(',').map((n) => n.trim()),
        indexPrefix: process.env[`${prefix}_ES_INDEX_PREFIX`] ?? 'logs',
        auth:
          process.env[`${prefix}_ES_USERNAME`] !== undefined
            ? {
                username: process.env[`${prefix}_ES_USERNAME`],
                password: process.env[`${prefix}_ES_PASSWORD`],
              }
            : undefined,
      } as ElasticsearchTransportConfig;
    }

    case 'cloudwatch': {
      const region = process.env[`${prefix}_CW_REGION`];
      const logGroupName = process.env[`${prefix}_CW_LOG_GROUP`];
      if (region === undefined || logGroupName === undefined) {
        return null;
      }
      return {
        type: 'cloudwatch',
        region,
        logGroupName,
        logStreamPrefix: process.env[`${prefix}_CW_STREAM_PREFIX`],
        createLogGroup: process.env[`${prefix}_CW_CREATE_GROUP`] === 'true',
      } as CloudWatchTransportConfig;
    }

    default:
      return null;
  }
}

// Singleton instance
let globalLogger: Logger | null = null;

/**
 * Get or create the global Logger instance
 */
export function getLogger(config?: LoggerConfig): Logger {
  if (globalLogger === null) {
    globalLogger = new Logger(config);
  }
  return globalLogger;
}

/**
 * Get or create the global Logger instance from environment
 */
export function getLoggerFromEnv(envConfig?: EnvironmentConfig): Logger {
  if (globalLogger === null) {
    globalLogger = Logger.fromEnvironment(envConfig);
  }
  return globalLogger;
}

/**
 * Reset the global Logger instance (for testing)
 */
export function resetLogger(): void {
  if (globalLogger !== null) {
    void globalLogger.close();
    globalLogger = null;
  }
}
