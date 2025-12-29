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

### Agent, Stage, and Project Context

```typescript
// Set context for all subsequent logs
logger.setAgent('worker-1');
logger.setStage('implementation');
logger.setProjectId('proj-001');

logger.info('Task started');
// Output includes: { "agent": "worker-1", "stage": "implementation", "projectId": "proj-001", ... }

// Create child logger with context
const childLogger = logger.child({
  agent: 'worker-2',
  stage: 'testing',
  projectId: 'proj-002',
});
```

### Duration Tracking

Track operation duration by passing `durationMs` in the context:

```typescript
const startTime = Date.now();
// ... perform operation ...
const duration = Date.now() - startTime;

logger.info('Operation completed', { durationMs: duration, result: 'success' });
// Output: { "durationMs": 150, "context": { "result": "success" }, ... }
```

The `durationMs` field is automatically extracted from context and stored as a separate field in the log entry.

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

### Sensitive Data Masking

The logger automatically masks sensitive data in log messages, context, and error information:

```typescript
// Automatically masked patterns:
// - GitHub tokens (ghp_*, gho_*, ghs_*, ghr_*)
// - OpenAI API keys (sk-*)
// - Anthropic API keys (sk-ant-*)
// - Bearer tokens
// - JWT tokens
// - AWS access keys
// - Generic API keys

logger.info('Token: ghp_1234567890abcdefghijklmnopqrstuvwxyz');
// Output: { "message": "Token: ***REDACTED***", ... }

// Masking also works in context
logger.info('Auth configured', { apiKey: 'sk-secret-key-value' });
// Output: { "context": { "apiKey": "***REDACTED***" }, ... }

// Add custom masking patterns
const logger = new Logger({
  maskingPatterns: [
    { name: 'custom_secret', pattern: /SECRET_[A-Z0-9]+/g, replacement: '[HIDDEN]' },
  ],
});

// Disable masking (not recommended for production)
const debugLogger = new Logger({ enableMasking: false });

// Toggle masking at runtime
logger.setMaskingEnabled(false);
console.log(logger.isMaskingEnabled()); // false

// Get list of active masking patterns
const patterns = logger.getMaskingPatternNames();
// ['github_pat', 'openai_api_key', 'jwt_token', ...]
```

### Agent-Specific Logging

Enable per-agent log files for easier debugging and filtering:

```typescript
const logger = new Logger({
  logDir: '.ad-sdlc/logs',
  agentLogConfig: {
    enabled: true,
    directory: 'agent-logs',  // Relative to logDir
    maxFileSize: 10 * 1024 * 1024,  // 10MB per agent
    maxFiles: 5,  // Keep 5 rotated files per agent
  },
});

logger.setAgent('collector');
logger.info('Starting collection');  // Written to both main log and agent-logs/collector-*.jsonl

logger.setAgent('prd-writer');
logger.info('Writing PRD');  // Written to both main log and agent-logs/prd-writer-*.jsonl

// Get logs for a specific agent
const collectorLogs = logger.getAgentLogs('collector', 100);

// Get list of all agents that have logs
const agents = logger.getLoggedAgents();
// ['collector', 'prd-writer', 'srs-writer', ...]

// Get agent log file path
const logFile = logger.getAgentLogFile('collector');
```

File structure:
```
.ad-sdlc/logs/
├── app-2024-01-15T10-30-00-000Z.jsonl   # Main log file
├── agent-logs/
│   ├── collector-2024-01-15T10-30-00-000Z.jsonl
│   ├── prd-writer-2024-01-15T10-31-00-000Z.jsonl
│   └── srs-writer-2024-01-15T10-32-00-000Z.jsonl
```

### Advanced Log Querying

Query and filter logs with multiple criteria:

```typescript
// Query with filters
const result = logger.queryLogs({
  level: 'ERROR',
  agent: 'worker-1',
  stage: 'implementation',
  projectId: 'proj-001',
  correlationId: 'abc-123',
  startTime: '2024-01-15T00:00:00.000Z',
  endTime: '2024-01-15T23:59:59.999Z',
  messageContains: 'failed',
}, 100, 0);  // limit, offset

console.log(`Found ${result.totalCount} entries`);
console.log(`Has more: ${result.hasMore}`);

// Convenience methods
const agentLogs = logger.getAgentLogs('worker-1', 100);
const timeRangeLogs = logger.getLogsByTimeRange('2024-01-15T00:00:00Z', '2024-01-15T12:00:00Z');
const searchResults = logger.searchLogs('connection timeout', 50);
const traceLogs = logger.getLogsByCorrelationId('abc-123-def');
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
  "projectId": "proj-001",
  "durationMs": 1500,
  "context": {
    "taskId": 42
  }
}
```

### Log Entry Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `timestamp` | string | Yes | ISO 8601 timestamp |
| `level` | string | Yes | Log level (DEBUG, INFO, WARN, ERROR) |
| `message` | string | Yes | Log message |
| `correlationId` | string | Yes | Request/operation tracing ID |
| `agent` | string | No | Agent name that generated the log |
| `stage` | string | No | Current pipeline stage |
| `projectId` | string | No | Associated project ID |
| `durationMs` | number | No | Operation duration in milliseconds |
| `context` | object | No | Additional context data |
| `error` | object | No | Error information (name, message, stack) |

## File Locations

Default file locations:

| Type | Location |
|------|----------|
| Application logs | `.ad-sdlc/logs/app-*.jsonl` |
| Agent-specific logs | `.ad-sdlc/logs/agent-logs/{agent}-*.jsonl` |
| Audit logs | `.ad-sdlc/logs/audit/audit-*.jsonl` |
| Metrics | `.ad-sdlc/metrics/metrics-*.json` |
| Prometheus metrics | `.ad-sdlc/metrics/metrics.prom` |
| Alerts | `.ad-sdlc/alerts/alerts.jsonl` |

## Best Practices

1. **Use correlation IDs** - Set correlation ID at the start of each request/task for tracing
2. **Set agent context** - Always set agent name and stage for better log filtering
3. **Set project ID** - Associate logs with projects for multi-project environments
4. **Track durations** - Include `durationMs` in context for performance analysis
5. **Monitor token usage** - Track token consumption to control costs
6. **Configure alerts** - Set up alerts for critical thresholds
7. **Review dashboards** - Regularly check health scores and active alerts
8. **Log rotation** - Configure appropriate max file size and count to manage disk usage
9. **Enable sensitive data masking** - Keep masking enabled in production to prevent credential leaks
10. **Use agent-specific logs** - Enable agent logging for easier debugging in multi-agent systems
11. **Add custom masking patterns** - Register patterns for any organization-specific secrets

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
