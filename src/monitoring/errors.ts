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
