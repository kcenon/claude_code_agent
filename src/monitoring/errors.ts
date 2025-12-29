/**
 * Monitoring-related error classes
 */

/**
 * Base class for monitoring-related errors
 */
export class MonitoringError extends Error {
  public readonly code: string;

  constructor(message: string, code: string = 'MONITORING_ERROR') {
    super(message);
    this.name = 'MonitoringError';
    this.code = code;
    Object.setPrototypeOf(this, MonitoringError.prototype);
  }
}

/**
 * Error thrown when log rotation fails
 */
export class LogRotationError extends MonitoringError {
  public readonly logDir: string;

  constructor(logDir: string, reason: string) {
    super(`Log rotation failed in ${logDir}: ${reason}`, 'LOG_ROTATION_ERROR');
    this.name = 'LogRotationError';
    this.logDir = logDir;
    Object.setPrototypeOf(this, LogRotationError.prototype);
  }
}

/**
 * Error thrown when metrics collection fails
 */
export class MetricsCollectionError extends MonitoringError {
  public readonly metricName: string;

  constructor(metricName: string, reason: string) {
    super(`Failed to collect metric '${metricName}': ${reason}`, 'METRICS_COLLECTION_ERROR');
    this.name = 'MetricsCollectionError';
    this.metricName = metricName;
    Object.setPrototypeOf(this, MetricsCollectionError.prototype);
  }
}

/**
 * Error thrown when alert evaluation fails
 */
export class AlertEvaluationError extends MonitoringError {
  public readonly alertName: string;

  constructor(alertName: string, reason: string) {
    super(`Failed to evaluate alert '${alertName}': ${reason}`, 'ALERT_EVALUATION_ERROR');
    this.name = 'AlertEvaluationError';
    this.alertName = alertName;
    Object.setPrototypeOf(this, AlertEvaluationError.prototype);
  }
}

/**
 * Error thrown when log file write fails
 */
export class LogWriteError extends MonitoringError {
  public readonly filePath: string;

  constructor(filePath: string, reason: string) {
    super(`Failed to write to log file '${filePath}': ${reason}`, 'LOG_WRITE_ERROR');
    this.name = 'LogWriteError';
    this.filePath = filePath;
    Object.setPrototypeOf(this, LogWriteError.prototype);
  }
}

/**
 * Error thrown when metrics export fails
 */
export class MetricsExportError extends MonitoringError {
  public readonly format: string;

  constructor(format: string, reason: string) {
    super(`Failed to export metrics in ${format} format: ${reason}`, 'METRICS_EXPORT_ERROR');
    this.name = 'MetricsExportError';
    this.format = format;
    Object.setPrototypeOf(this, MetricsExportError.prototype);
  }
}

/**
 * Error thrown when dashboard data retrieval fails
 */
export class DashboardDataError extends MonitoringError {
  public readonly panelType: string;

  constructor(panelType: string, reason: string) {
    super(`Failed to get dashboard data for '${panelType}': ${reason}`, 'DASHBOARD_DATA_ERROR');
    this.name = 'DashboardDataError';
    this.panelType = panelType;
    Object.setPrototypeOf(this, DashboardDataError.prototype);
  }
}

/**
 * Error thrown when token budget is exceeded
 */
export class BudgetExceededError extends MonitoringError {
  public readonly currentTokens: number;
  public readonly tokenLimit: number;
  public readonly currentCostUsd: number;

  constructor(currentTokens: number, tokenLimit: number, currentCostUsd: number) {
    super(
      `Token budget exceeded: ${String(currentTokens)}/${String(tokenLimit)} tokens ($${currentCostUsd.toFixed(4)})`,
      'BUDGET_EXCEEDED_ERROR'
    );
    this.name = 'BudgetExceededError';
    this.currentTokens = currentTokens;
    this.tokenLimit = tokenLimit;
    this.currentCostUsd = currentCostUsd;
    Object.setPrototypeOf(this, BudgetExceededError.prototype);
  }
}

/**
 * Error thrown when context pruning fails
 */
export class ContextPruningError extends MonitoringError {
  public readonly originalTokens: number;
  public readonly targetTokens: number;

  constructor(originalTokens: number, targetTokens: number, reason: string) {
    super(
      `Failed to prune context from ${String(originalTokens)} to ${String(targetTokens)} tokens: ${reason}`,
      'CONTEXT_PRUNING_ERROR'
    );
    this.name = 'ContextPruningError';
    this.originalTokens = originalTokens;
    this.targetTokens = targetTokens;
    Object.setPrototypeOf(this, ContextPruningError.prototype);
  }
}

/**
 * Error thrown when model selection fails
 */
export class ModelSelectionError extends MonitoringError {
  public readonly taskType: string;

  constructor(taskType: string, reason: string) {
    super(`Failed to select model for task '${taskType}': ${reason}`, 'MODEL_SELECTION_ERROR');
    this.name = 'ModelSelectionError';
    this.taskType = taskType;
    Object.setPrototypeOf(this, ModelSelectionError.prototype);
  }
}

/**
 * Error thrown when cache operation fails
 */
export class CacheError extends MonitoringError {
  public readonly operation: string;

  constructor(operation: string, reason: string) {
    super(`Cache operation '${operation}' failed: ${reason}`, 'CACHE_ERROR');
    this.name = 'CacheError';
    this.operation = operation;
    Object.setPrototypeOf(this, CacheError.prototype);
  }
}
