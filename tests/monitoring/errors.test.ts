import { describe, it, expect } from 'vitest';
import {
  MonitoringError,
  LogRotationError,
  MetricsCollectionError,
  AlertEvaluationError,
  LogWriteError,
  MetricsExportError,
  DashboardDataError,
} from '../../src/monitoring/index.js';

describe('MonitoringError', () => {
  it('should create with message and code', () => {
    const error = new MonitoringError('Test error', 'TEST_CODE');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(MonitoringError);
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.name).toBe('MonitoringError');
  });

  it('should use default code when not provided', () => {
    const error = new MonitoringError('Test error');
    expect(error.code).toBe('MONITORING_ERROR');
  });
});

describe('LogRotationError', () => {
  it('should create with log directory and reason', () => {
    const error = new LogRotationError('/path/to/logs', 'disk full');

    expect(error).toBeInstanceOf(MonitoringError);
    expect(error.message).toContain('/path/to/logs');
    expect(error.message).toContain('disk full');
    expect(error.code).toBe('LOG_ROTATION_ERROR');
    expect(error.name).toBe('LogRotationError');
    expect(error.logDir).toBe('/path/to/logs');
  });
});

describe('MetricsCollectionError', () => {
  it('should create with metric name and reason', () => {
    const error = new MetricsCollectionError('agent_duration', 'invalid value');

    expect(error).toBeInstanceOf(MonitoringError);
    expect(error.message).toContain('agent_duration');
    expect(error.message).toContain('invalid value');
    expect(error.code).toBe('METRICS_COLLECTION_ERROR');
    expect(error.name).toBe('MetricsCollectionError');
    expect(error.metricName).toBe('agent_duration');
  });
});

describe('AlertEvaluationError', () => {
  it('should create with alert name and reason', () => {
    const error = new AlertEvaluationError('pipeline_stuck', 'condition parse failed');

    expect(error).toBeInstanceOf(MonitoringError);
    expect(error.message).toContain('pipeline_stuck');
    expect(error.message).toContain('condition parse failed');
    expect(error.code).toBe('ALERT_EVALUATION_ERROR');
    expect(error.name).toBe('AlertEvaluationError');
    expect(error.alertName).toBe('pipeline_stuck');
  });
});

describe('LogWriteError', () => {
  it('should create with file path and reason', () => {
    const error = new LogWriteError('/path/to/log.jsonl', 'permission denied');

    expect(error).toBeInstanceOf(MonitoringError);
    expect(error.message).toContain('/path/to/log.jsonl');
    expect(error.message).toContain('permission denied');
    expect(error.code).toBe('LOG_WRITE_ERROR');
    expect(error.name).toBe('LogWriteError');
    expect(error.filePath).toBe('/path/to/log.jsonl');
  });
});

describe('MetricsExportError', () => {
  it('should create with format and reason', () => {
    const error = new MetricsExportError('prometheus', 'invalid metric name');

    expect(error).toBeInstanceOf(MonitoringError);
    expect(error.message).toContain('prometheus');
    expect(error.message).toContain('invalid metric name');
    expect(error.code).toBe('METRICS_EXPORT_ERROR');
    expect(error.name).toBe('MetricsExportError');
    expect(error.format).toBe('prometheus');
  });
});

describe('DashboardDataError', () => {
  it('should create with panel type and reason', () => {
    const error = new DashboardDataError('pipeline_progress', 'data not available');

    expect(error).toBeInstanceOf(MonitoringError);
    expect(error.message).toContain('pipeline_progress');
    expect(error.message).toContain('data not available');
    expect(error.code).toBe('DASHBOARD_DATA_ERROR');
    expect(error.name).toBe('DashboardDataError');
    expect(error.panelType).toBe('pipeline_progress');
  });
});

describe('error inheritance', () => {
  it('should properly inherit from Error', () => {
    const error = new MetricsCollectionError('test', 'reason');

    expect(error.stack).toBeDefined();
    expect(error instanceof Error).toBe(true);
    expect(error instanceof MonitoringError).toBe(true);
    expect(error instanceof MetricsCollectionError).toBe(true);
  });

  it('should be catchable as MonitoringError', () => {
    const error = new LogRotationError('/logs', 'reason');

    try {
      throw error;
    } catch (e) {
      expect(e instanceof MonitoringError).toBe(true);
    }
  });
});
