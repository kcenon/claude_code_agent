/**
 * Type definitions for log transports
 *
 * This module defines types for log entries, transport configurations,
 * and batch operations used by log transport implementations.
 *
 * @module logging/transports/types
 */

/**
 * Log level types matching existing monitoring types
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/**
 * Error information structure for log entries
 */
export interface ErrorInfo {
  /** Error name/type */
  readonly name: string;
  /** Error message */
  readonly message: string;
  /** Stack trace if available */
  readonly stack?: string;
  /** Error code if applicable */
  readonly code?: string;
}

/**
 * Log entry for transport implementations
 *
 * This is the standardized log entry format that all transports receive.
 * It includes all necessary fields for log shipping and correlation.
 */
export interface TransportLogEntry {
  /** ISO timestamp of the log entry */
  readonly timestamp: Date;
  /** Log level */
  readonly level: LogLevel;
  /** Log message */
  readonly message: string;
  /** Additional context data */
  readonly context: Record<string, unknown>;
  /** Correlation ID for request tracing */
  readonly correlationId?: string;
  /** Agent name if applicable */
  readonly agentId?: string;
  /** Trace ID for distributed tracing */
  readonly traceId?: string;
  /** Span ID for distributed tracing */
  readonly spanId?: string;
  /** Parent span ID for distributed tracing */
  readonly parentSpanId?: string;
  /** Pipeline stage if applicable */
  readonly stage?: string;
  /** Project ID for associating logs with a specific project */
  readonly projectId?: string;
  /** Session ID for session-based grouping */
  readonly sessionId?: string;
  /** Operation duration in milliseconds */
  readonly durationMs?: number;
  /** Error information if applicable */
  readonly error?: ErrorInfo;
  /** Source file and line if available */
  readonly source?: string;
  /** Hostname of the machine */
  readonly hostname?: string;
  /** Process ID */
  readonly pid?: number;
}

/**
 * Base transport configuration shared by all transports
 */
export interface BaseTransportConfig {
  /** Whether this transport is enabled */
  readonly enabled?: boolean;
  /** Minimum log level for this transport */
  readonly minLevel?: LogLevel;
  /** Buffer size before automatic flush */
  readonly bufferSize?: number;
  /** Flush interval in milliseconds */
  readonly flushIntervalMs?: number;
  /** Maximum retry attempts for failed logs */
  readonly maxRetries?: number;
  /** Retry delay in milliseconds */
  readonly retryDelayMs?: number;
  /** Enable batching for this transport */
  readonly enableBatching?: boolean;
}

/**
 * Console transport configuration
 */
export interface ConsoleTransportConfig extends BaseTransportConfig {
  readonly type: 'console';
  /** Output format: json or pretty */
  readonly format?: 'json' | 'pretty';
  /** Enable colors in pretty format */
  readonly colors?: boolean;
  /** Include timestamp in output */
  readonly includeTimestamp?: boolean;
}

/**
 * File transport configuration
 */
export interface FileTransportConfig extends BaseTransportConfig {
  readonly type: 'file';
  /** Log file path or directory */
  readonly path: string;
  /** Maximum file size in bytes before rotation */
  readonly maxFileSize?: number;
  /** Maximum number of files to keep */
  readonly maxFiles?: number;
  /** Log file name pattern */
  readonly fileNamePattern?: string;
  /** Enable compression for rotated files */
  readonly compress?: boolean;
  /** Date-based rotation (daily, weekly, etc.) */
  readonly datePattern?: string;
}

/**
 * Elasticsearch transport configuration
 */
export interface ElasticsearchTransportConfig extends BaseTransportConfig {
  readonly type: 'elasticsearch';
  /** Elasticsearch node URLs */
  readonly nodes: string[];
  /** Authentication configuration */
  readonly auth?: {
    readonly username?: string;
    readonly password?: string;
    readonly apiKey?: string;
  };
  /** Index name prefix */
  readonly indexPrefix?: string;
  /** Index date pattern for daily/weekly rotation */
  readonly indexDatePattern?: string;
  /** Enable TLS/SSL */
  readonly tls?: boolean;
  /** CA certificate path */
  readonly caCertPath?: string;
  /** Request timeout in milliseconds */
  readonly requestTimeout?: number;
  /** Number of shards for index */
  readonly numberOfShards?: number;
  /** Number of replicas for index */
  readonly numberOfReplicas?: number;
}

/**
 * CloudWatch transport configuration
 */
export interface CloudWatchTransportConfig extends BaseTransportConfig {
  readonly type: 'cloudwatch';
  /** AWS region */
  readonly region: string;
  /** Log group name */
  readonly logGroupName: string;
  /** Log stream prefix */
  readonly logStreamPrefix?: string;
  /** AWS credentials (optional, uses default chain if not provided) */
  readonly credentials?: {
    readonly accessKeyId?: string;
    readonly secretAccessKey?: string;
    readonly sessionToken?: string;
  };
  /** Create log group if it doesn't exist */
  readonly createLogGroup?: boolean;
  /** Log retention in days */
  readonly retentionInDays?: number;
}

/**
 * Union type for all transport configurations
 */
export type TransportConfig =
  | ConsoleTransportConfig
  | FileTransportConfig
  | ElasticsearchTransportConfig
  | CloudWatchTransportConfig;

/**
 * Batch operation types for transport batching
 */
export type BatchOperationType = 'log' | 'flush';

/**
 * Batch operation for grouped log shipping
 */
export interface BatchOperation {
  /** Operation type */
  readonly type: BatchOperationType;
  /** Log entry for log operations */
  readonly entry?: TransportLogEntry;
  /** Timestamp of the operation */
  readonly timestamp: Date;
}

/**
 * Transport factory configuration
 */
export interface TransportFactoryConfig {
  /** Default transport configurations */
  readonly transports: TransportConfig[];
  /** Global minimum log level */
  readonly globalMinLevel?: LogLevel;
  /** Enable sensitive data masking */
  readonly enableMasking?: boolean;
  /** Custom masking patterns */
  readonly maskingPatterns?: MaskingPattern[];
}

/**
 * Sensitive data masking pattern
 */
export interface MaskingPattern {
  /** Pattern name for identification */
  readonly name: string;
  /** Regular expression pattern to match */
  readonly pattern: RegExp;
  /** Replacement string */
  readonly replacement?: string;
}

/**
 * Transport metrics for monitoring
 */
export interface TransportMetrics {
  /** Transport name */
  readonly transportName: string;
  /** Total logs processed */
  readonly totalLogs: number;
  /** Successful logs shipped */
  readonly successfulLogs: number;
  /** Failed log attempts */
  readonly failedLogs: number;
  /** Current buffer size */
  readonly bufferSize: number;
  /** Average latency in milliseconds */
  readonly avgLatencyMs: number;
  /** Last flush time */
  readonly lastFlushTime?: Date;
  /** Last error time */
  readonly lastErrorTime?: Date;
}

/**
 * Log level priority for filtering
 */
export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

/**
 * Check if a log level meets the minimum level requirement
 *
 * @param level - Log level of the entry being evaluated
 * @param minLevel - Minimum log level threshold for the transport
 * @returns True if the entry level is at or above the minimum threshold
 */
export function shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
}

/**
 * Log entry for query and aggregation operations
 * This is the format used for log file storage and querying.
 */
export interface LogEntry {
  /** ISO timestamp of the log entry */
  readonly timestamp: string;
  /** Log level */
  readonly level: LogLevel;
  /** Log message */
  readonly message: string;
  /** Correlation ID for request tracing */
  readonly correlationId: string;
  /** Agent name if applicable */
  readonly agent?: string;
  /** Pipeline stage if applicable */
  readonly stage?: string;
  /** Project ID for associating logs with a specific project */
  readonly projectId?: string;
  /** Operation duration in milliseconds */
  readonly durationMs?: number;
  /** Additional context data */
  readonly context?: Record<string, unknown>;
  /** Error information if applicable */
  readonly error?: ErrorInfo;
}

/**
 * Log query filter options
 */
export interface LogQueryFilter {
  /** Filter by log level */
  readonly level?: LogLevel;
  /** Filter by agent name */
  readonly agent?: string;
  /** Filter by pipeline stage */
  readonly stage?: string;
  /** Filter by project ID */
  readonly projectId?: string;
  /** Filter by correlation ID */
  readonly correlationId?: string;
  /** Start time (ISO string) */
  readonly startTime?: string;
  /** End time (ISO string) */
  readonly endTime?: string;
  /** Text search in message */
  readonly messageContains?: string;
}

/**
 * Log query result with pagination
 */
export interface LogQueryResult {
  /** Matching log entries */
  readonly entries: LogEntry[];
  /** Total count of matching entries */
  readonly totalCount: number;
  /** Whether there are more entries */
  readonly hasMore: boolean;
}

/**
 * Log aggregation source configuration
 */
export interface LogAggregationSource {
  /** Source identifier */
  readonly id: string;
  /** Source type */
  readonly type: 'file' | 'directory' | 'stream';
  /** Source path for file/directory types */
  readonly path?: string;
  /** Optional filter to apply to entries from this source */
  readonly filter?: LogQueryFilter;
}

/**
 * Log aggregation options
 */
export interface LogAggregationOptions {
  /** Output destination path */
  readonly outputPath?: string;
  /** Whether to enable compression for aggregated output */
  readonly compress?: boolean;
  /** Whether to deduplicate entries by correlationId + timestamp */
  readonly deduplicate?: boolean;
  /** Sort order for aggregated entries */
  readonly sortOrder?: 'asc' | 'desc';
}

/**
 * Log compression options
 */
export interface LogCompressionOptions {
  /** Compression algorithm */
  readonly algorithm?: 'gzip' | 'none';
  /** Compression level (1-9 for gzip) */
  readonly level?: number;
  /** Whether to delete original after compression */
  readonly deleteOriginal?: boolean;
}

/**
 * Query field names for structured log search
 */
export type LogQueryField =
  | 'level'
  | 'agent'
  | 'stage'
  | 'projectId'
  | 'correlationId'
  | 'message'
  | 'time';

/**
 * Logical operators for combining query conditions
 */
export type LogQueryOperator = 'AND' | 'OR' | 'NOT';

/**
 * Single field condition in a query
 */
export interface LogQueryCondition {
  /** Field to filter */
  readonly field: LogQueryField;
  /** Value or pattern to match */
  readonly value: string;
  /** Whether this is a negated condition */
  readonly negated?: boolean;
  /** For time field: range end value (value becomes start) */
  readonly rangeEnd?: string;
}

/**
 * Compound query expression with logical operators
 */
export interface LogQueryExpression {
  /** Type of expression */
  readonly type: 'condition' | 'compound';
  /** Single condition (when type is 'condition') */
  readonly condition?: LogQueryCondition;
  /** Operator for compound expressions */
  readonly operator?: LogQueryOperator;
  /** Left operand for compound expressions */
  readonly left?: LogQueryExpression;
  /** Right operand for compound expressions (or single operand for NOT) */
  readonly right?: LogQueryExpression;
}

/**
 * Result of parsing a structured query
 */
export interface LogQueryParseResult {
  /** Whether parsing was successful */
  readonly success: boolean;
  /** Parsed expression (when successful) */
  readonly expression?: LogQueryExpression;
  /** Error message (when unsuccessful) */
  readonly error?: string;
  /** Position of error in query string */
  readonly errorPosition?: number;
}

/**
 * Extended query result with query metadata
 */
export interface StructuredLogQueryResult extends LogQueryResult {
  /** Original query string */
  readonly query: string;
  /** Parsed expression */
  readonly expression: LogQueryExpression;
  /** Time taken to execute query in milliseconds */
  readonly executionTimeMs: number;
}
