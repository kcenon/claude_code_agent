/**
 * Monitoring module - Provides monitoring and logging infrastructure
 *
 * @packageDocumentation
 */

// Types
export type {
  LogLevel,
  LogEntry,
  ErrorInfo,
  LoggerOptions,
  AgentLogConfig,
  MaskingPattern,
  LogQueryFilter,
  LogQueryResult,
  MetricType,
  MetricDefinition,
  MetricValue,
  HistogramData,
  MetricsCollectorOptions,
  AgentMetrics,
  TokenUsageMetrics,
  StageDuration,
  AlertSeverity,
  AlertDefinition,
  AlertEvent,
  AlertHandler,
  AlertManagerOptions,
  DashboardPanel,
  DashboardDataProviderOptions,
  PipelineProgress,
  LogStorageOptions,
} from './types.js';

// Errors
export {
  MonitoringError,
  LogRotationError,
  MetricsCollectionError,
  AlertEvaluationError,
  LogWriteError,
  MetricsExportError,
  DashboardDataError,
} from './errors.js';

// Logger
export { Logger, getLogger, resetLogger } from './Logger.js';

// MetricsCollector
export {
  MetricsCollector,
  getMetricsCollector,
  resetMetricsCollector,
} from './MetricsCollector.js';

// AlertManager
export {
  AlertManager,
  getAlertManager,
  resetAlertManager,
  BUILTIN_ALERTS,
} from './AlertManager.js';

// DashboardDataProvider
export {
  DashboardDataProvider,
  getDashboardDataProvider,
  resetDashboardDataProvider,
} from './DashboardDataProvider.js';
