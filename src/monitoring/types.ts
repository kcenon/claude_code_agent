/**
 * Monitoring module type definitions
 */

/**
 * Log level types
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/**
 * Log entry structure for structured logging
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
 * Error information structure
 */
export interface ErrorInfo {
  /** Error name/type */
  readonly name: string;
  /** Error message */
  readonly message: string;
  /** Stack trace if available */
  readonly stack?: string;
}

/**
 * Logger configuration options
 */
export interface LoggerOptions {
  /** Log output directory */
  readonly logDir?: string;
  /** Maximum log file size in bytes */
  readonly maxFileSize?: number;
  /** Maximum number of log files to keep */
  readonly maxFiles?: number;
  /** Minimum log level to output */
  readonly minLevel?: LogLevel;
  /** Enable console output */
  readonly consoleOutput?: boolean;
  /** Enable JSON output format */
  readonly jsonOutput?: boolean;
}

/**
 * Metric types for different measurements
 */
export type MetricType = 'counter' | 'gauge' | 'histogram';

/**
 * Metric definition
 */
export interface MetricDefinition {
  /** Metric name */
  readonly name: string;
  /** Metric type */
  readonly type: MetricType;
  /** Description of the metric */
  readonly description: string;
  /** Labels for the metric */
  readonly labels?: readonly string[];
  /** Histogram buckets (for histogram type only) */
  readonly buckets?: readonly number[];
}

/**
 * Metric value with labels
 */
export interface MetricValue {
  /** Metric name */
  readonly name: string;
  /** Current value */
  readonly value: number;
  /** Labels for the metric */
  readonly labels?: Record<string, string>;
  /** Timestamp of the measurement */
  readonly timestamp: string;
}

/**
 * Histogram data
 */
export interface HistogramData {
  /** Metric name */
  readonly name: string;
  /** Labels for the metric */
  readonly labels?: Record<string, string>;
  /** Bucket counts */
  readonly buckets: Record<string, number>;
  /** Sum of all values */
  readonly sum: number;
  /** Count of observations */
  readonly count: number;
}

/**
 * Metrics collector configuration
 */
export interface MetricsCollectorOptions {
  /** Metrics output directory */
  readonly metricsDir?: string;
  /** Flush interval in milliseconds */
  readonly flushIntervalMs?: number;
  /** Enable Prometheus format export */
  readonly prometheusFormat?: boolean;
}

/**
 * Agent performance metrics
 */
export interface AgentMetrics {
  /** Agent name */
  readonly agent: string;
  /** Number of invocations */
  readonly invocations: number;
  /** Successful invocations */
  readonly successes: number;
  /** Failed invocations */
  readonly failures: number;
  /** Average duration in milliseconds */
  readonly avgDurationMs: number;
  /** P95 duration in milliseconds */
  readonly p95DurationMs: number;
  /** Total input tokens used */
  readonly inputTokens: number;
  /** Total output tokens used */
  readonly outputTokens: number;
}

/**
 * Token usage metrics
 */
export interface TokenUsageMetrics {
  /** Session ID */
  readonly sessionId: string;
  /** Total input tokens */
  readonly totalInputTokens: number;
  /** Total output tokens */
  readonly totalOutputTokens: number;
  /** Token usage by agent */
  readonly byAgent: Record<string, { input: number; output: number }>;
  /** Estimated cost in USD */
  readonly estimatedCostUsd: number;
}

/**
 * Pipeline stage duration
 */
export interface StageDuration {
  /** Stage name */
  readonly stage: string;
  /** Start time ISO string */
  readonly startTime: string;
  /** End time ISO string if completed */
  readonly endTime?: string;
  /** Duration in milliseconds if completed */
  readonly durationMs?: number;
  /** Status of the stage */
  readonly status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

/**
 * Alert severity levels
 */
export type AlertSeverity = 'critical' | 'warning' | 'info';

/**
 * Alert definition
 */
export interface AlertDefinition {
  /** Alert name */
  readonly name: string;
  /** Alert description */
  readonly description: string;
  /** Severity level */
  readonly severity: AlertSeverity;
  /** Condition expression */
  readonly condition: string;
  /** Evaluation window in milliseconds */
  readonly windowMs?: number;
  /** Cooldown period in milliseconds */
  readonly cooldownMs?: number;
}

/**
 * Alert event
 */
export interface AlertEvent {
  /** Alert name */
  readonly name: string;
  /** Severity level */
  readonly severity: AlertSeverity;
  /** Alert message */
  readonly message: string;
  /** Timestamp of the alert */
  readonly timestamp: string;
  /** Alert context data */
  readonly context?: Record<string, unknown>;
  /** Whether the alert is resolved */
  readonly resolved?: boolean;
}

/**
 * Alert handler function type
 */
export type AlertHandler = (alert: AlertEvent) => void | Promise<void>;

/**
 * Alert manager configuration
 */
export interface AlertManagerOptions {
  /** Directory for storing alert history */
  readonly alertsDir?: string;
  /** Maximum alerts to keep in history */
  readonly maxHistorySize?: number;
  /** Enable console alerts */
  readonly consoleAlerts?: boolean;
}

/**
 * Dashboard panel data
 */
export interface DashboardPanel {
  /** Panel title */
  readonly title: string;
  /** Panel type */
  readonly type: 'progress' | 'table' | 'timeSeries' | 'logViewer' | 'gauge';
  /** Panel data */
  readonly data: unknown;
  /** Last updated timestamp */
  readonly lastUpdated: string;
}

/**
 * Dashboard data provider configuration
 */
export interface DashboardDataProviderOptions {
  /** Refresh interval in milliseconds */
  readonly refreshIntervalMs?: number;
}

/**
 * Pipeline progress data
 */
export interface PipelineProgress {
  /** Current stage */
  readonly currentStage: string;
  /** Total stages */
  readonly totalStages: number;
  /** Completed stages */
  readonly completedStages: number;
  /** Stage details */
  readonly stages: StageDuration[];
}

/**
 * Log storage configuration
 */
export interface LogStorageOptions {
  /** Local storage path */
  readonly localPath?: string;
  /** Maximum file size for rotation */
  readonly maxFileSize?: number;
  /** Maximum number of files to keep */
  readonly maxFiles?: number;
  /** Log retention in days */
  readonly retentionDays?: number;
}
