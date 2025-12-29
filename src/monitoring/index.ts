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
  BudgetExceededError,
  ContextPruningError,
  ModelSelectionError,
  CacheError,
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

// TokenBudgetManager
export {
  TokenBudgetManager,
  getTokenBudgetManager,
  resetTokenBudgetManager,
} from './TokenBudgetManager.js';
export type {
  TokenBudgetConfig,
  BudgetThreshold,
  BudgetStatus,
  BudgetWarning,
  BudgetCheckResult,
} from './TokenBudgetManager.js';

// ContextPruner
export { ContextPruner, createContextPruner } from './ContextPruner.js';
export type {
  ContentSection,
  PruningStrategy,
  ContextPrunerConfig,
  PruningResult,
  PruningStats,
} from './ContextPruner.js';

// QueryCache
export { QueryCache, getQueryCache, resetQueryCache } from './QueryCache.js';
export type { CacheEntry, QueryCacheConfig, CacheStats, CacheLookupResult } from './QueryCache.js';

// ModelSelector
export { ModelSelector, getModelSelector, resetModelSelector } from './ModelSelector.js';
export type {
  ModelType,
  TaskComplexity,
  ModelProfile,
  ModelSelectorConfig,
  ModelSelectionResult,
  ModelAlternative,
  TaskAnalysis,
} from './ModelSelector.js';

// TokenUsageReport
export { TokenUsageReport, createTokenUsageReport } from './TokenUsageReport.js';
export type {
  ModelUsage,
  UsageTrendPoint,
  OptimizationRecommendation,
  ReportSummary,
  TokenUsageReportData,
  AgentUsageDetail,
  StageUsageDetail,
  TokenUsageReportConfig,
} from './TokenUsageReport.js';
