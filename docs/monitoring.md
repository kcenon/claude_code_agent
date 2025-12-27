# Monitoring Module

The AD-SDLC monitoring module provides comprehensive monitoring, logging, and alerting infrastructure for observability, debugging, and performance tracking.

## Overview

The monitoring module includes:

- **Logger** - Structured JSON logging with log levels and correlation IDs
- **MetricsCollector** - Performance metrics collection and aggregation
- **AlertManager** - Alert management and notifications
- **DashboardDataProvider** - Dashboard data aggregation

## Installation

The monitoring module is included in the main `ad-sdlc` package:

```typescript
import {
  Logger,
  MetricsCollector,
  AlertManager,
  DashboardDataProvider,
} from 'ad-sdlc';
```

## Logger

Provides structured logging with JSON format, log levels, and correlation IDs for request tracing.

### Basic Usage

```typescript
import { Logger, getLogger } from 'ad-sdlc';

// Using singleton
const logger = getLogger({
  logDir: '.ad-sdlc/logs',
  minLevel: 'INFO',
  consoleOutput: true,
});

// Log messages at different levels
logger.debug('Debug message', { detail: 'value' });
logger.info('Processing started', { stage: 'implementation' });
logger.warn('Resource running low', { usage: 85 });
logger.error('Operation failed', new Error('Connection timeout'), { retries: 3 });
```

### Agent and Stage Context

```typescript
// Set context for all subsequent logs
logger.setAgent('worker-1');
logger.setStage('implementation');

logger.info('Task started');
// Output includes: { "agent": "worker-1", "stage": "implementation", ... }

// Create child logger with context
const childLogger = logger.child({
  agent: 'worker-2',
  stage: 'testing',
});
```

### Correlation IDs

Track related operations across agents:

```typescript
// Generate new correlation ID
const correlationId = logger.newCorrelationId();

// Set specific correlation ID
logger.setCorrelationId('request-123');

// All logs include the correlation ID
logger.info('Step 1 completed'); // { "correlationId": "request-123", ... }
logger.info('Step 2 completed'); // { "correlationId": "request-123", ... }
```

### Reading Logs

```typescript
// Get recent entries
const entries = logger.getRecentEntries(100);

// Get entries by level
const errors = logger.getErrors(50);
const warnings = logger.getEntriesByLevel('WARN', 50);
```

### Configuration

```typescript
const logger = new Logger({
  logDir: '.ad-sdlc/logs',      // Log directory
  maxFileSize: 10 * 1024 * 1024, // 10MB max file size
  maxFiles: 5,                   // Keep 5 rotated files
  minLevel: 'DEBUG',             // Minimum log level
  consoleOutput: true,           // Enable console output
  jsonOutput: true,              // Use JSON format
});
```

## MetricsCollector

Collects and aggregates performance metrics for agents, token usage, and pipeline stages.

### Basic Usage

```typescript
import { MetricsCollector, getMetricsCollector } from 'ad-sdlc';

const metrics = getMetricsCollector({
  metricsDir: '.ad-sdlc/metrics',
  flushIntervalMs: 30000, // Flush every 30 seconds
});

metrics.setSessionId('session-123');
```

### Agent Performance Metrics

```typescript
// Record agent invocation
const startTime = metrics.recordAgentStart('worker-1');
// ... agent executes ...
metrics.recordAgentEnd('worker-1', startTime, true); // true = success

// Get agent metrics
const agentMetrics = metrics.getAgentMetrics('worker-1');
console.log(`Invocations: ${agentMetrics.invocations}`);
console.log(`Success rate: ${agentMetrics.successes / agentMetrics.invocations * 100}%`);
console.log(`Avg duration: ${agentMetrics.avgDurationMs}ms`);
console.log(`P95 duration: ${agentMetrics.p95DurationMs}ms`);

// Get all agent metrics
const allMetrics = metrics.getAllAgentMetrics();
```

### Token Usage Tracking

```typescript
// Record token usage
metrics.recordTokenUsage('worker-1', 1500, 500); // input, output tokens

// Get token usage report
const usage = metrics.getTokenUsageMetrics();
console.log(`Total input tokens: ${usage.totalInputTokens}`);
console.log(`Total output tokens: ${usage.totalOutputTokens}`);
console.log(`Estimated cost: $${usage.estimatedCostUsd}`);
console.log(`By agent:`, usage.byAgent);
```

### Pipeline Stage Tracking

```typescript
// Record stage execution
metrics.recordStageStart('implementation');
// ... stage executes ...
metrics.recordStageEnd('implementation', true);

// Get stage durations
const stages = metrics.getStageDurations();
for (const stage of stages) {
  console.log(`${stage.stage}: ${stage.status} (${stage.durationMs}ms)`);
}
```

### Custom Metrics

```typescript
// Counters
metrics.incrementCounter('api_calls', 1, { endpoint: '/api/issues' });
const count = metrics.getCounter('api_calls', { endpoint: '/api/issues' });

// Gauges
metrics.setGauge('queue_depth', 42);
const depth = metrics.getGauge('queue_depth');

// Histograms
metrics.recordHistogram('response_time', 0.5, { endpoint: '/api/issues' });
const histogram = metrics.getHistogram('response_time', { endpoint: '/api/issues' });
console.log(`Count: ${histogram.count}, Sum: ${histogram.sum}`);
```

### Prometheus Export

```typescript
// Enable Prometheus format
const metrics = getMetricsCollector({ prometheusFormat: true });

// Export metrics
const prometheusOutput = metrics.exportPrometheus();
// Output:
// # HELP agent_invocation_total Counter metric
// # TYPE agent_invocation_total counter
// agent_invocation_total{agent="worker-1",status="success"} 42
// ...
```

## AlertManager

Manages alerts and notifications for critical events.

### Basic Usage

```typescript
import { AlertManager, getAlertManager } from 'ad-sdlc';

const alerts = getAlertManager({
  alertsDir: '.ad-sdlc/alerts',
  consoleAlerts: true,
});
```

### Firing Alerts

```typescript
// Fire a known alert
alerts.fire('pipeline_stuck', 'Pipeline has not progressed for 10 minutes', {
  stage: 'implementation',
  lastProgress: new Date().toISOString(),
});

// Fire with severity levels
alerts.critical('system_error', 'Database connection lost');
alerts.warning('slow_response', 'Agent response time exceeded threshold');
alerts.info('task_completed', 'Implementation phase completed');
```

### Built-in Alerts

The following alerts are pre-defined:

| Name | Severity | Description |
|------|----------|-------------|
| `pipeline_stuck` | critical | Pipeline has not made progress |
| `high_error_rate` | critical | Error rate exceeds 10% |
| `token_budget_exceeded` | critical | Session token budget exceeded |
| `slow_agent` | warning | Agent P95 latency > 60s |
| `low_coverage` | warning | Test coverage below 70% |
| `agent_failure` | warning | Agent invocation failed |

### Custom Alerts

```typescript
// Register custom alert
alerts.registerAlert({
  name: 'custom_threshold',
  description: 'Custom metric exceeded threshold',
  severity: 'warning',
  condition: 'metric > threshold',
  cooldownMs: 5 * 60 * 1000, // 5 minute cooldown
});

// Fire custom alert
alerts.fire('custom_threshold', 'Metric reached 95%', { value: 95 });
```

### Alert Handlers

```typescript
// Add custom handler
alerts.addHandler(async (alert) => {
  if (alert.severity === 'critical') {
    await sendSlackNotification(alert);
  }
});

// Remove handler
alerts.removeHandler(handler);
```

### Resolving Alerts

```typescript
// Resolve an alert
alerts.resolve('pipeline_stuck', 'Pipeline resumed progress');
```

### Alert History

```typescript
// Get alert history
const history = alerts.getHistory(100);

// Get active (unresolved) alerts
const active = alerts.getActiveAlerts();

// Get counts
console.log(`Critical alerts: ${alerts.getCriticalCount()}`);
console.log(`Warning alerts: ${alerts.getWarningCount()}`);
```

## DashboardDataProvider

Provides aggregated data for monitoring dashboards.

### Basic Usage

```typescript
import { DashboardDataProvider, getDashboardDataProvider } from 'ad-sdlc';

const dashboard = getDashboardDataProvider({
  refreshIntervalMs: 10000, // Refresh every 10 seconds
});

// Start auto-refresh
dashboard.startAutoRefresh();

// Manually refresh
dashboard.refresh();
```

### Dashboard Panels

```typescript
// Get all panels
const panels = dashboard.getAllPanels();

// Get specific panel
const healthPanel = dashboard.getPanel('system_health');
```

Available panels:
- `pipeline_progress` - Current pipeline stage and progress
- `agent_performance` - Agent metrics table
- `token_usage` - Token consumption by agent
- `recent_errors` - Recent error logs
- `active_alerts` - Currently active alerts
- `system_health` - Overall health score

### Quick Data Access

```typescript
// Get pipeline progress
const progress = dashboard.getPipelineProgress();
console.log(`Stage: ${progress.currentStage}`);
console.log(`Progress: ${progress.completedStages}/${progress.totalStages}`);

// Get agent performance
const agents = dashboard.getAgentPerformance();

// Get token usage
const tokens = dashboard.getTokenUsage();

// Get recent errors
const errors = dashboard.getRecentErrors(50);

// Get active alerts
const alerts = dashboard.getActiveAlerts();

// Get health score (0-100)
const score = dashboard.getHealthScore();
```

### Dashboard Summary

```typescript
const summary = dashboard.getSummary();
console.log(`Health: ${summary.healthScore}%`);
console.log(`Progress: ${summary.pipelineProgress}%`);
console.log(`Active alerts: ${summary.activeAlerts}`);
console.log(`Token cost: $${summary.tokenUsage.cost}`);
```

### Export

```typescript
// Export all dashboard data as JSON
const jsonData = dashboard.exportAsJson();
```

## Error Classes

All monitoring errors extend `MonitoringError`:

```typescript
import {
  MonitoringError,
  LogRotationError,
  MetricsCollectionError,
  AlertEvaluationError,
  LogWriteError,
  MetricsExportError,
  DashboardDataError,
} from 'ad-sdlc';

try {
  // Monitoring operation
} catch (error) {
  if (error instanceof MonitoringError) {
    console.log(`Monitoring error: ${error.code}`);
  }
}
```

## Log Entry Format

Logs are stored in JSON Lines format (`.jsonl`):

```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "INFO",
  "message": "Agent task completed",
  "correlationId": "abc-123-def",
  "agent": "worker-1",
  "stage": "implementation",
  "context": {
    "taskId": 42,
    "duration": 1500
  }
}
```

## File Locations

Default file locations:

| Type | Location |
|------|----------|
| Application logs | `.ad-sdlc/logs/app-*.jsonl` |
| Audit logs | `.ad-sdlc/logs/audit/audit-*.jsonl` |
| Metrics | `.ad-sdlc/metrics/metrics-*.json` |
| Prometheus metrics | `.ad-sdlc/metrics/metrics.prom` |
| Alerts | `.ad-sdlc/alerts/alerts.jsonl` |

## Best Practices

1. **Use correlation IDs** - Set correlation ID at the start of each request/task for tracing
2. **Set agent context** - Always set agent name and stage for better log filtering
3. **Monitor token usage** - Track token consumption to control costs
4. **Configure alerts** - Set up alerts for critical thresholds
5. **Review dashboards** - Regularly check health scores and active alerts
6. **Log rotation** - Configure appropriate max file size and count to manage disk usage

## Integration Example

```typescript
import {
  getLogger,
  getMetricsCollector,
  getAlertManager,
  getDashboardDataProvider,
} from 'ad-sdlc';

// Initialize monitoring infrastructure
const logger = getLogger({ consoleOutput: true });
const metrics = getMetricsCollector();
const alerts = getAlertManager();
const dashboard = getDashboardDataProvider();

// Set up session
logger.setSessionId('session-123');
metrics.setSessionId('session-123');

// Configure alert handler
alerts.addHandler(async (alert) => {
  logger.warn(`Alert: ${alert.name}`, { alert });
});

// Start dashboard auto-refresh
dashboard.startAutoRefresh();

// In your agent execution
async function executeAgent(agentName: string) {
  logger.setAgent(agentName);
  const startTime = metrics.recordAgentStart(agentName);

  try {
    // Execute agent logic
    // ...

    metrics.recordAgentEnd(agentName, startTime, true);
    logger.info('Agent completed successfully');
  } catch (error) {
    metrics.recordAgentEnd(agentName, startTime, false);
    logger.error('Agent failed', error as Error);
    alerts.fire('agent_failure', `Agent ${agentName} failed`, { error });
  }
}
```
