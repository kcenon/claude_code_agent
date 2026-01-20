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
  /** Agent-specific log file configuration */
  readonly agentLogConfig?: AgentLogConfig;
  /** Custom masking patterns (in addition to defaults) */
  readonly maskingPatterns?: MaskingPattern[];
  /** Enable sensitive data masking (default: true) */
  readonly enableMasking?: boolean;
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
  /** Condition expression (legacy string format) */
  readonly condition: string;
  /** Type-safe condition (preferred over string condition) */
  readonly conditionTyped?: AlertConditionTyped;
  /** Evaluation window in milliseconds */
  readonly windowMs?: number;
  /** Cooldown period in milliseconds */
  readonly cooldownMs?: number;
  /** Escalation configuration for unacknowledged alerts */
  readonly escalation?: AlertEscalationConfig;
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

/**
 * Agent log file configuration
 */
export interface AgentLogConfig {
  /** Enable per-agent log files */
  readonly enabled?: boolean;
  /** Directory for agent logs (relative to logDir) */
  readonly directory?: string;
  /** Maximum file size per agent log */
  readonly maxFileSize?: number;
  /** Maximum number of files per agent */
  readonly maxFiles?: number;
}

/**
 * Sensitive data masking patterns
 */
export interface MaskingPattern {
  /** Pattern name for identification */
  readonly name: string;
  /** Regular expression pattern to match */
  readonly pattern: RegExp;
  /** Replacement string (default: '***REDACTED***') */
  readonly replacement?: string;
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
 * Alert condition operator types for type-safe conditions
 */
export type AlertConditionOperator =
  | '>'
  | '>='
  | '<'
  | '<='
  | '='
  | '!='
  | 'contains'
  | 'not_contains';

/**
 * Alert condition metric types
 */
export type AlertConditionMetric =
  | 'no_progress_for'
  | 'error_rate'
  | 'session_tokens'
  | 'agent_p95_latency'
  | 'test_coverage'
  | 'agent_status'
  | 'custom';

/**
 * Type-safe alert condition
 */
export interface AlertConditionTyped {
  /** Metric to evaluate */
  readonly metric: AlertConditionMetric;
  /** Comparison operator */
  readonly operator: AlertConditionOperator;
  /** Threshold value */
  readonly threshold: number | string;
  /** Unit for the threshold (e.g., 'm' for minutes, '%' for percentage) */
  readonly unit?: string;
  /** Custom metric name when metric is 'custom' */
  readonly customMetric?: string;
}

/**
 * Alert escalation configuration
 */
export interface AlertEscalationConfig {
  /** Time in milliseconds after which to escalate if not acknowledged */
  readonly escalateAfterMs: number;
  /** Severity to escalate to */
  readonly escalateTo: AlertSeverity;
  /** Maximum number of escalations */
  readonly maxEscalations?: number;
  /** Notification targets for escalation */
  readonly notifyTargets?: readonly string[];
}

/**
 * Alert with escalation tracking
 */
export interface AlertEventWithEscalation extends AlertEvent {
  /** Whether the alert has been acknowledged */
  readonly acknowledged?: boolean;
  /** Timestamp when acknowledged */
  readonly acknowledgedAt?: string;
  /** Current escalation level (0 = initial) */
  readonly escalationLevel?: number;
  /** Last escalation timestamp */
  readonly lastEscalatedAt?: string;
}

/**
 * Token budget persistence state
 */
export interface BudgetPersistenceState {
  /** Session ID */
  readonly sessionId: string;
  /** Current token count */
  readonly currentTokens: number;
  /** Current cost in USD */
  readonly currentCostUsd: number;
  /** Token limit if set */
  readonly tokenLimit?: number;
  /** Cost limit if set */
  readonly costLimitUsd?: number;
  /** Triggered warning keys */
  readonly triggeredWarnings: readonly string[];
  /** Override active flag */
  readonly overrideActive: boolean;
  /** Timestamp of last save */
  readonly savedAt: string;
  /** Warning history */
  readonly warningHistory: readonly BudgetWarningPersisted[];
  /** Usage history for forecasting */
  readonly usageHistory?: readonly UsageRecord[];
  /** Triggered overage alert keys */
  readonly triggeredOverageAlerts?: readonly string[];
}

/**
 * Persisted budget warning (without Date objects)
 */
export interface BudgetWarningPersisted {
  /** Warning type */
  readonly type: 'token' | 'cost';
  /** Threshold percentage that was exceeded */
  readonly thresholdPercent: number;
  /** Severity level */
  readonly severity: AlertSeverity;
  /** Warning message */
  readonly message: string;
  /** Timestamp of warning (ISO string) */
  readonly timestamp: string;
}

/**
 * Single usage record for historical tracking
 */
export interface UsageRecord {
  /** Timestamp of the usage (ISO string) */
  readonly timestamp: string;
  /** Input tokens consumed */
  readonly inputTokens: number;
  /** Output tokens consumed */
  readonly outputTokens: number;
  /** Total tokens (input + output) */
  readonly totalTokens: number;
  /** Cost in USD */
  readonly costUsd: number;
}

/**
 * Configuration for budget forecasting
 */
export interface ForecastConfig {
  /** Number of recent records to use for trend calculation (default: 10) */
  readonly windowSize?: number;
  /** Minimum records required for forecasting (default: 3) */
  readonly minRecordsRequired?: number;
  /** Weight for recent data in exponential smoothing (0-1, default: 0.3) */
  readonly smoothingFactor?: number;
}

/**
 * Budget forecast result
 */
export interface BudgetForecast {
  /** Whether forecast is available (enough data) */
  readonly available: boolean;
  /** Reason if forecast is not available */
  readonly unavailableReason?: string;
  /** Average tokens per operation */
  readonly avgTokensPerOperation?: number;
  /** Average cost per operation in USD */
  readonly avgCostPerOperation?: number;
  /** Estimated remaining operations before token limit exhaustion */
  readonly estimatedRemainingOperations?: number;
  /** Estimated time until token limit exhaustion (based on operation rate) */
  readonly estimatedTimeToExhaustionMs?: number;
  /** Estimated remaining operations before cost limit exhaustion */
  readonly estimatedRemainingOperationsByCost?: number;
  /** Estimated time until cost limit exhaustion */
  readonly estimatedTimeToExhaustionByCostMs?: number;
  /** Whether projected to exceed token limit in the forecast window */
  readonly projectedTokenOverage?: boolean;
  /** Whether projected to exceed cost limit in the forecast window */
  readonly projectedCostOverage?: boolean;
  /** Current trend: 'increasing', 'stable', 'decreasing' */
  readonly usageTrend?: 'increasing' | 'stable' | 'decreasing';
  /** Confidence level of the forecast (0-1) */
  readonly confidence?: number;
}

/**
 * Projected overage alert
 */
export interface ProjectedOverageAlert {
  /** Alert type: token or cost */
  readonly type: 'token' | 'cost';
  /** Severity of the alert */
  readonly severity: AlertSeverity;
  /** Alert message */
  readonly message: string;
  /** Timestamp of the alert (ISO string) */
  readonly timestamp: string;
  /** Estimated operations until exhaustion */
  readonly estimatedRemainingOperations: number;
  /** Estimated time until exhaustion in milliseconds */
  readonly estimatedTimeToExhaustionMs?: number;
}

/**
 * Structured query language types for log search
 */

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

/**
 * OpenTelemetry exporter types
 */
export type OpenTelemetryExporterType = 'console' | 'otlp' | 'jaeger';

/**
 * Sampling strategy types
 */
export type OpenTelemetrySamplingType =
  | 'always_on'
  | 'always_off'
  | 'probability'
  | 'rate_limiting';

/**
 * OpenTelemetry exporter configuration
 */
export interface OpenTelemetryExporterConfig {
  /** Exporter type */
  readonly type: OpenTelemetryExporterType;
  /** Whether this exporter is enabled */
  readonly enabled?: boolean;
  /** OTLP endpoint URL (for otlp/jaeger types) */
  readonly endpoint?: string;
  /** Request headers for OTLP exporter */
  readonly headers?: Record<string, string>;
  /** Request timeout in milliseconds */
  readonly timeoutMs?: number;
}

/**
 * OpenTelemetry sampling configuration
 */
export interface OpenTelemetrySamplingConfig {
  /** Sampling strategy type */
  readonly type: OpenTelemetrySamplingType;
  /** Probability for probability sampling (0.0-1.0) */
  readonly probability?: number;
  /** Rate limit for rate_limiting sampling (spans per second) */
  readonly rateLimit?: number;
}

/**
 * OpenTelemetry resource attributes
 */
export interface OpenTelemetryResourceAttributes {
  /** Service name */
  readonly serviceName?: string;
  /** Service version */
  readonly serviceVersion?: string;
  /** Deployment environment (development, staging, production) */
  readonly environment?: string;
  /** Additional custom attributes */
  readonly custom?: Record<string, string>;
}

/**
 * OpenTelemetry configuration
 */
export interface OpenTelemetryConfig {
  /** Whether OpenTelemetry is enabled */
  readonly enabled: boolean;
  /** Service name for traces */
  readonly serviceName: string;
  /** Exporter configurations */
  readonly exporters: readonly OpenTelemetryExporterConfig[];
  /** Sampling configuration */
  readonly sampling?: OpenTelemetrySamplingConfig;
  /** Resource attributes */
  readonly resourceAttributes?: OpenTelemetryResourceAttributes;
}

/**
 * Span attribute names for AD-SDLC specific attributes
 */
export const ADSDLC_SPAN_ATTRIBUTES = {
  /** Agent name attribute */
  AGENT_NAME: 'adsdlc.agent.name',
  /** Agent type attribute */
  AGENT_TYPE: 'adsdlc.agent.type',
  /** Pipeline stage attribute */
  PIPELINE_STAGE: 'adsdlc.pipeline.stage',
  /** Pipeline mode attribute (greenfield/enhancement) */
  PIPELINE_MODE: 'adsdlc.pipeline.mode',
  /** Tool name attribute */
  TOOL_NAME: 'adsdlc.tool.name',
  /** Tool result attribute */
  TOOL_RESULT: 'adsdlc.tool.result',
  /** Input tokens attribute */
  TOKENS_INPUT: 'adsdlc.tokens.input',
  /** Output tokens attribute */
  TOKENS_OUTPUT: 'adsdlc.tokens.output',
  /** Token cost in USD */
  TOKENS_COST: 'adsdlc.tokens.cost',
  /** Model name attribute */
  MODEL_NAME: 'adsdlc.model.name',
  /** Correlation ID for tracing across agents */
  CORRELATION_ID: 'adsdlc.correlation_id',
  /** Parent tool use ID for subagent correlation */
  PARENT_TOOL_USE_ID: 'adsdlc.parent_tool_use_id',
} as const;

/**
 * Type for AD-SDLC span attribute keys
 */
export type AdsdlcSpanAttributeKey =
  (typeof ADSDLC_SPAN_ATTRIBUTES)[keyof typeof ADSDLC_SPAN_ATTRIBUTES];

/**
 * Pipeline mode types
 */
export type PipelineMode = 'greenfield' | 'enhancement';

/**
 * Span context for propagation across agents
 */
export interface SpanContext {
  /** Trace ID */
  readonly traceId: string;
  /** Span ID */
  readonly spanId: string;
  /** Trace flags */
  readonly traceFlags: number;
  /** Correlation ID for AD-SDLC specific tracing */
  readonly correlationId?: string;
}
