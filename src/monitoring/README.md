# Monitoring Module

Comprehensive monitoring, metrics collection, alerting, and token budget management for the AD-SDLC pipeline.

## Overview

The Monitoring module provides observability infrastructure including performance metrics collection, alert management, token budget enforcement, dashboard data provision, and distributed tracing. It enables cost control, performance tracking, and proactive issue detection throughout pipeline execution.

## Features

- **Metrics Collection**: Agent performance, token usage, pipeline stage timing
- **Alert Management**: Condition-based alerts with escalation support
- **Token Budget**: Session-based limits with forecasting and warnings
- **Dashboard Data**: Real-time aggregated data for visualization
- **Context Optimization**: Token-aware context pruning
- **Distributed Tracing**: OpenTelemetry integration
- **Query Caching**: TTL-based result caching
- **Model Selection**: Task complexity-based model recommendations

## Usage

### Metrics Collection

```typescript
import { getMetricsCollector } from './monitoring';

const metrics = getMetricsCollector({
  metricsDir: '.ad-sdlc/metrics',
  flushIntervalMs: 30000,
});

// Record agent performance
const startTime = Date.now();
// ... agent execution ...
metrics.recordAgentEnd('prd-writer', startTime, true);

// Record token usage
metrics.recordTokenUsage('prd-writer', 1000, 500);  // input, output tokens

// Record pipeline stages
metrics.recordStageStart('document_generation');
// ... stage execution ...
metrics.recordStageEnd('document_generation', true);

// Export Prometheus format
const prometheusMetrics = metrics.exportPrometheus();
```

### Alert Management

```typescript
import { getAlertManager } from './monitoring';

const alertManager = getAlertManager({
  cooldownMs: 300000,  // 5 minutes
  escalationConfig: {
    enabled: true,
    escalationIntervalMs: 60000,
  },
});

// Register custom alert
alertManager.registerAlert({
  name: 'custom_alert',
  severity: 'warning',
  message: 'Custom condition triggered',
  cooldownMs: 60000,
  condition: {
    type: 'threshold',
    metric: 'error_rate',
    operator: 'gt',
    value: 0.1,
  },
});

// Fire alert
alertManager.warning('high_latency', 'Response time exceeded threshold', {
  latencyMs: 5000,
  endpoint: '/api/process',
});

// Fire with condition check
alertManager.fireIfConditionMet('error_rate_alert', 'Error rate high', {
  error_rate: 0.15,
});

// Get active alerts
const activeAlerts = alertManager.getActiveAlerts();
```

### Token Budget Management

```typescript
import { getTokenBudgetManager } from './monitoring';

const budget = getTokenBudgetManager({
  sessionTokenLimit: 1000000,
  sessionCostLimitUsd: 10.0,
  warningThresholds: [50, 75, 90],
  enablePersistence: true,
});

// Record usage
const result = budget.recordUsage(1000, 500, 0.05);
if (result.warnings.length > 0) {
  console.log('Budget warnings:', result.warnings);
}
if (result.hardLimitReached) {
  console.log('Budget exhausted!');
}

// Check current status
const status = budget.getStatus();
console.log(`Used: ${status.percentUsed}%`);

// Get forecast
const forecast = budget.getForecast();
console.log(`Estimated completion: ${forecast.estimatedTasksRemaining} tasks`);
console.log(`Projected overage: ${forecast.projectedOverage}`);
```

### Dashboard Data

```typescript
import { getDashboardDataProvider } from './monitoring';

const dashboard = getDashboardDataProvider({
  refreshIntervalMs: 10000,
});

dashboard.startAutoRefresh();

// Get health score (0-100)
const healthScore = dashboard.getHealthScore();

// Get summary
const summary = dashboard.getSummary();
console.log(`Health: ${summary.healthScore}`);
console.log(`Progress: ${summary.pipelineProgress}%`);
console.log(`Active alerts: ${summary.activeAlerts}`);

// Get specific panel
const agentPanel = dashboard.getPanel('agent_performance');

// Export all data
const json = dashboard.exportAsJson();
```

### Context Pruning

```typescript
import { createContextPruner } from './monitoring';

const pruner = createContextPruner({
  maxTokens: 8000,
  strategy: 'balanced',
  recencyWeight: 0.3,
  relevanceWeight: 0.4,
  priorityWeight: 0.3,
  relevanceKeywords: ['authentication', 'security'],
});

const sections = [
  { id: 'recent', content: '...', tokens: 2000, timestamp: Date.now() },
  { id: 'old', content: '...', tokens: 3000, timestamp: Date.now() - 86400000 },
];

const result = pruner.prune(sections);
console.log(`Included: ${result.included.length} sections`);
console.log(`Tokens saved: ${result.tokensSaved}`);
```

### Distributed Tracing

```typescript
import { getOpenTelemetryProvider } from './monitoring';

const otel = getOpenTelemetryProvider({
  serviceName: 'ad-sdlc',
  exporters: [
    { type: 'otlp', endpoint: 'http://localhost:4318/v1/traces' },
  ],
  sampling: {
    strategy: 'ratio',
    ratio: 0.1,  // 10% sampling
  },
});

// Create span
const span = otel.startSpan('process_document', {
  attributes: { 'document.type': 'prd' },
});

try {
  // ... processing ...
  span.setStatus({ code: 'OK' });
} catch (error) {
  span.recordException(error);
  span.setStatus({ code: 'ERROR' });
} finally {
  span.end();
}
```

## Architecture

```
MetricsCollector
    ↓ (provides data)
DashboardDataProvider
    ↓ (triggers on thresholds)
AlertManager
    ↓ (tracks costs)
TokenBudgetManager
    ↓ (optimizes context)
ContextPruner
    ↓ (selects model)
ModelSelector
```

## API Reference

### MetricsCollector

| Method | Description |
|--------|-------------|
| `recordAgentEnd(agent, startTime, success)` | Record agent completion |
| `recordTokenUsage(agent, input, output)` | Record token consumption |
| `recordStageStart(stage)` | Start pipeline stage timer |
| `recordStageEnd(stage, success)` | End pipeline stage timer |
| `incrementCounter(name, value, labels)` | Increment counter metric |
| `setGauge(name, value, labels)` | Set gauge metric |
| `recordHistogram(name, value, labels)` | Record histogram value |
| `exportPrometheus()` | Export Prometheus format |
| `flush()` | Force metrics flush |

### AlertManager

| Method | Description |
|--------|-------------|
| `registerAlert(definition)` | Register alert definition |
| `fire(name, message, context)` | Fire registered alert |
| `fireAdHoc(name, message, severity, context)` | Fire one-time alert |
| `critical(name, message, context)` | Fire critical alert |
| `warning(name, message, context)` | Fire warning alert |
| `resolve(name, message)` | Resolve active alert |
| `acknowledge(name)` | Acknowledge alert |
| `getActiveAlerts()` | Get all active alerts |
| `fireIfConditionMet(name, message, metrics)` | Conditional firing |

### TokenBudgetManager

| Method | Description |
|--------|-------------|
| `recordUsage(input, output, cost)` | Record token usage |
| `checkBudget()` | Check current budget status |
| `getStatus()` | Get detailed budget status |
| `getForecast()` | Get usage forecast |
| `adjustTokenLimit(limit)` | Adjust token limit |
| `adjustCostLimit(limit)` | Adjust cost limit |
| `enableOverride()` | Enable budget override |
| `reset()` | Reset budget tracking |

### Configuration Options

#### MetricsCollectorOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `metricsDir` | `string` | `.ad-sdlc/metrics` | Output directory |
| `flushIntervalMs` | `number` | `30000` | Flush interval |
| `prometheusFormat` | `boolean` | `true` | Enable Prometheus |

#### AlertManagerOptions

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cooldownMs` | `number` | `300000` | Alert cooldown (5 min) |
| `maxHistorySize` | `number` | `1000` | Max alert history |
| `escalationConfig` | `object` | - | Escalation settings |

#### TokenBudgetConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `sessionTokenLimit` | `number` | - | Max tokens per session |
| `sessionCostLimitUsd` | `number` | - | Max cost per session |
| `warningThresholds` | `number[]` | `[50, 75, 90]` | Warning percentages |
| `hardLimitThreshold` | `number` | `100` | Hard limit percentage |
| `enablePersistence` | `boolean` | `false` | Persist state to disk |

#### ContextPrunerConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxTokens` | `number` | Required | Token limit |
| `strategy` | `string` | `'balanced'` | `'recency'` \| `'relevance'` \| `'priority'` \| `'balanced'` |
| `recencyWeight` | `number` | `0.3` | Recency weight (0-1) |
| `relevanceWeight` | `number` | `0.4` | Relevance weight (0-1) |
| `priorityWeight` | `number` | `0.3` | Priority weight (0-1) |

## Default Alerts

| Alert Name | Severity | Condition |
|------------|----------|-----------|
| `pipeline_stuck` | critical | No progress > 10 min |
| `high_error_rate` | warning | Error rate > 10% |
| `token_budget_exceeded` | critical | Budget exhausted |
| `slow_agent` | warning | P95 latency > 60s |
| `low_coverage` | warning | Coverage < 70% |
| `agent_failure` | warning | Agent call failed |

## Token Pricing

| Model | Input (per 1M) | Output (per 1M) |
|-------|----------------|-----------------|
| Sonnet | $3.00 | $15.00 |
| Opus | $15.00 | $75.00 |
| Haiku | $0.25 | $1.25 |

## Error Handling

```typescript
// Error types
MonitoringError (base)
├── MetricsCollectionError
├── AlertEvaluationError
├── BudgetExceededError
├── ContextPruningError
├── ModelSelectionError
└── CacheError
```

## Testing Support

All singletons have reset functions for test isolation:

```typescript
import {
  resetMetricsCollector,
  resetAlertManager,
  resetTokenBudgetManager,
  resetDashboardDataProvider,
} from './monitoring';

beforeEach(() => {
  resetMetricsCollector();
  resetAlertManager();
  // ...
});
```

## Related Modules

- [Controller](../controller/README.md) - Worker pool metrics
- [Worker](../worker/README.md) - Task execution metrics
- [Logging](../logging/README.md) - Structured logging

## Testing

```bash
npm test -- tests/monitoring
```
