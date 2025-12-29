# Monitoring Module

The AD-SDLC monitoring module provides comprehensive monitoring, logging, and alerting infrastructure for observability, debugging, and performance tracking.

## Overview

The monitoring module includes:

- **Logger** - Structured JSON logging with log levels and correlation IDs
- **MetricsCollector** - Performance metrics collection and aggregation
- **AlertManager** - Alert management and notifications
- **DashboardDataProvider** - Dashboard data aggregation
- **TokenBudgetManager** - Session-based token budget control and limits
- **ContextPruner** - Intelligent context size management for large documents
- **QueryCache** - LRU-based caching for repeated API queries
- **ModelSelector** - Optimal model selection based on task complexity
- **TokenUsageReport** - Detailed usage reports with optimization recommendations

## Installation

The monitoring module is included in the main `ad-sdlc` package:

```typescript
import {
  // Core monitoring
  Logger,
  MetricsCollector,
  AlertManager,
  DashboardDataProvider,
  // Token optimization
  TokenBudgetManager,
  ContextPruner,
  QueryCache,
  ModelSelector,
  TokenUsageReport,
  // Factory functions
  getLogger,
  getMetricsCollector,
  getAlertManager,
  getDashboardDataProvider,
  getTokenBudgetManager,
  getModelSelector,
  createContextPruner,
  createQueryCache,
  createTokenUsageReport,
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

## TokenBudgetManager

Manages token budgets with session limits, warning thresholds, and hard limits for cost control.

### Basic Usage

```typescript
import { TokenBudgetManager, getTokenBudgetManager } from 'ad-sdlc';

const budget = getTokenBudgetManager({
  sessionTokenLimit: 100000,       // Max tokens per session
  sessionCostLimitUsd: 5.00,       // Max cost per session
  warningThresholds: [50, 75, 90], // Warning at these percentages
  hardLimitThreshold: 100,         // Hard limit at 100%
  onLimitReached: 'pause',         // Action: 'continue' | 'pause' | 'terminate'
});
```

### Recording Usage

```typescript
// Record token usage after each API call
const result = budget.recordUsage(1500, 500, 0.0225); // input, output, cost

if (!result.allowed) {
  console.log(`Budget exceeded: ${result.reason}`);
  console.log(`Suggested action: ${result.suggestedAction}`);
}

// Check for warnings
for (const warning of result.warnings) {
  console.log(`Warning: ${warning.message} (${warning.severity})`);
}
```

### Budget Status

```typescript
const status = budget.getStatus();

console.log(`Current tokens: ${status.currentTokens}/${status.tokenLimit}`);
console.log(`Token usage: ${status.tokenUsagePercent}%`);
console.log(`Current cost: $${status.currentCostUsd}`);
console.log(`Remaining tokens: ${status.remainingTokens}`);
console.log(`Warning exceeded: ${status.warningExceeded}`);
console.log(`Limit exceeded: ${status.limitExceeded}`);
```

### Pre-flight Estimation

```typescript
// Check if a request will exceed budget
const estimate = budget.estimateUsage(5000, 2000); // estimated input, output

if (!estimate.allowed) {
  console.log(`Cannot proceed: ${estimate.reason}`);
}
```

### Override Limits

```typescript
// Temporarily allow exceeding limits (with user consent)
if (budget.config.allowOverride) {
  budget.enableOverride();
  // Perform critical operation
  budget.disableOverride();
}
```

## ContextPruner

Intelligently prunes context to fit within token limits using configurable strategies.

### Basic Usage

```typescript
import { ContextPruner, createContextPruner } from 'ad-sdlc';

const pruner = createContextPruner(100000, {
  strategy: 'balanced',      // 'recency' | 'relevance' | 'priority' | 'balanced'
  recencyWeight: 0.3,        // Weight for recency scoring
  relevanceWeight: 0.4,      // Weight for relevance scoring
  priorityWeight: 0.3,       // Weight for priority scoring
  relevanceKeywords: ['error', 'bug', 'critical'],
  systemReserve: 500,        // Reserve for system prompts
  outputReserve: 2000,       // Reserve for expected output
});
```

### Creating Content Sections

```typescript
// Create sections from content
const systemSection = pruner.createSection('system', systemPrompt, {
  type: 'system',
  priority: 10,
  required: true,  // Cannot be pruned
});

const userSection = pruner.createSection('user-1', userMessage, {
  type: 'user',
  priority: 8,
  timestamp: new Date(),
});

const historySection = pruner.createSection('history-1', conversationHistory, {
  type: 'context',
  priority: 5,
  timestamp: new Date(Date.now() - 3600000), // 1 hour ago
});
```

### Pruning Content

```typescript
const sections = [systemSection, userSection, historySection, ...moreSections];
const result = pruner.prune(sections);

console.log(`Retained ${result.stats.sectionsRetained} of ${result.stats.sectionsAnalyzed}`);
console.log(`Tokens: ${result.totalTokens} (saved ${result.tokensSaved})`);
console.log(`Reduction: ${result.stats.reductionPercent}%`);

// Use retained sections
const context = result.retainedSections.map(s => s.content).join('\n');
```

### Pruning Strategies

| Strategy | Description |
|----------|-------------|
| `recency` | Prioritize recent content |
| `relevance` | Prioritize content matching keywords |
| `priority` | Prioritize by assigned priority score |
| `balanced` | Weighted combination of all factors |

### Token Estimation

```typescript
// Estimate tokens for arbitrary text
const tokens = pruner.estimateTokens(longText);
console.log(`Estimated tokens: ${tokens}`);

// Get suggested limit for a model
const limit = ContextPruner.suggestTokenLimit('sonnet'); // Returns 80% of model limit
```

## QueryCache

LRU-based cache for repeated API queries with TTL and similarity matching.

### Basic Usage

```typescript
import { QueryCache, createQueryCache } from 'ad-sdlc';

const cache = createQueryCache({
  maxSize: 100,           // Maximum entries
  ttlMs: 30 * 60 * 1000,  // 30 minute TTL
  enableSimilarityMatch: true,
  similarityThreshold: 0.8,
});
```

### Caching Queries

```typescript
// Check cache before API call
const cachedResult = cache.get('What is TypeScript?');

if (cachedResult) {
  console.log('Cache hit!');
  return cachedResult.response;
}

// Make API call and cache result
const response = await callAPI('What is TypeScript?');
cache.set('What is TypeScript?', response, {
  model: 'sonnet',
  inputTokens: 50,
  outputTokens: 200,
});
```

### Similarity Matching

```typescript
// Similar queries can match cached entries
cache.set('What is TypeScript?', response, metadata);

// This will find the cached entry due to similarity
const result = cache.get('What is typescript?'); // Note: different case
const result2 = cache.get('What is TypeScript language?'); // Similar query
```

### Cache Statistics

```typescript
const stats = cache.getStats();

console.log(`Hits: ${stats.hits}`);
console.log(`Misses: ${stats.misses}`);
console.log(`Hit rate: ${stats.hitRate}%`);
console.log(`Entries: ${stats.entries}`);
console.log(`Tokens saved: ${stats.tokensSaved}`);
console.log(`Cost saved: $${stats.estimatedCostSaved}`);
```

### Cache Management

```typescript
// Check if entry exists
if (cache.has('query')) { ... }

// Delete specific entry
cache.delete('query');

// Clear entire cache
cache.clear();

// Get all entries (for persistence)
const entries = cache.getAllEntries();
```

## ModelSelector

Selects optimal model based on task complexity, cost sensitivity, and budget constraints.

### Basic Usage

```typescript
import { ModelSelector, getModelSelector } from 'ad-sdlc';

const selector = getModelSelector({
  defaultModel: 'sonnet',
  costSensitivity: 0.5,      // 0-1, higher = prefer cheaper
  qualitySensitivity: 0.5,   // 0-1, higher = prefer better
  budgetConstraintUsd: 10.0, // Max cost per task
  agentOverrides: {
    'validator': 'haiku',    // Force haiku for validation
    'sds-writer': 'opus',    // Force opus for architecture
  },
});
```

### Selecting a Model

```typescript
const result = selector.selectModel({
  estimatedInputTokens: 5000,
  estimatedOutputTokens: 2000,
  complexity: 'moderate',       // 'simple' | 'moderate' | 'complex' | 'critical'
  taskType: 'code_generation',
  agent: 'worker-1',
  accuracyCritical: false,
  speedCritical: true,
});

console.log(`Selected: ${result.model}`);
console.log(`Reason: ${result.reason}`);
console.log(`Estimated cost: $${result.estimatedCostUsd}`);
console.log(`Confidence: ${result.confidence}`);

// Check alternatives
for (const alt of result.alternatives) {
  console.log(`Alternative: ${alt.model} (${alt.reason})`);
}
```

### Complexity Analysis

```typescript
// Analyze content to determine complexity
const complexity = selector.analyzeComplexity(content, {
  hasCodeGeneration: true,
  hasReasoning: false,
  requiresAccuracy: true,
});

console.log(`Complexity: ${complexity}`); // 'simple' | 'moderate' | 'complex' | 'critical'
```

### Agent Recommendations

```typescript
// Get recommended model for an agent type
const model = selector.getAgentRecommendation('collector'); // Returns 'sonnet'
const model2 = selector.getAgentRecommendation('validator'); // Returns 'haiku'
const model3 = selector.getAgentRecommendation('sds-writer'); // Returns 'opus'
```

### Model Profiles

```typescript
const profile = selector.getModelProfile('sonnet');

console.log(`Input cost: $${profile.inputCostPer1k}/1K tokens`);
console.log(`Output cost: $${profile.outputCostPer1k}/1K tokens`);
console.log(`Capability: ${profile.capabilityScore}`);
console.log(`Latency: ${profile.avgLatencyMs}ms`);
console.log(`Best for: ${profile.bestFor.join(', ')}`);
```

### Cost Estimation

```typescript
const cost = selector.estimateCost('sonnet', {
  estimatedInputTokens: 10000,
  estimatedOutputTokens: 5000,
  complexity: 'moderate',
});

console.log(`Estimated cost: $${cost}`);
```

## TokenUsageReport

Generates detailed token usage reports with optimization recommendations.

### Basic Usage

```typescript
import { TokenUsageReport, createTokenUsageReport } from 'ad-sdlc';

const report = createTokenUsageReport('session-123', {
  includeRecommendations: true,
  includeTrends: true,
  trendGranularityMs: 60000,     // 1 minute
  minSavingsThreshold: 0.01,     // Min $0.01 savings for recommendations
});
```

### Recording Trend Data

```typescript
// Record trend points as usage occurs
report.recordTrendPoint(1500, 0.0225); // tokens, cost
```

### Generating Reports

```typescript
const data = report.generate(
  tokenUsageMetrics,   // From MetricsCollector
  agentMetrics,        // From MetricsCollector
  stageDurations,      // From MetricsCollector
  'sonnet'             // Primary model used
);

// Access summary
console.log(`Total tokens: ${data.summary.totalTokens}`);
console.log(`Total cost: $${data.summary.totalCostUsd}`);
console.log(`Tokens/min: ${data.summary.tokensPerMinute}`);
console.log(`Most expensive agent: ${data.summary.mostExpensiveAgent}`);
```

### Usage Breakdown

```typescript
// By model
for (const model of data.byModel) {
  console.log(`${model.model}: ${model.totalTokens} tokens ($${model.costUsd})`);
}

// By agent
for (const agent of data.byAgent) {
  console.log(`${agent.agent}: ${agent.percentageOfTotal}% of total`);
  console.log(`  Avg tokens/invocation: ${agent.avgTokensPerInvocation}`);
}

// By stage
for (const stage of data.byStage) {
  console.log(`${stage.stage}: ${stage.tokens} tokens (${stage.tokensPerSecond}/s)`);
}
```

### Optimization Recommendations

```typescript
for (const rec of data.recommendations) {
  console.log(`[${rec.priority}] ${rec.title}`);
  console.log(`  Type: ${rec.type}`);
  console.log(`  ${rec.description}`);
  if (rec.estimatedSavingsUsd) {
    console.log(`  Potential savings: $${rec.estimatedSavingsUsd}`);
  }
  console.log(`  Difficulty: ${rec.difficulty}`);
}
```

### Export Formats

```typescript
// Export as JSON
const json = report.toJSON(data);
fs.writeFileSync('report.json', json);

// Export as Markdown
const markdown = report.toMarkdown(data);
fs.writeFileSync('report.md', markdown);
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
  BudgetExceededError,
  ContextPruningError,
  ModelSelectionError,
  CacheError,
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
