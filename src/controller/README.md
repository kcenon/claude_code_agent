# Controller Module

Orchestrates parallel task execution through worker pools with dependency graph analysis, progress monitoring, and distributed locking support.

## Overview

The Controller module is the central orchestration system for AD-SDLC pipeline execution. It manages worker pools, analyzes issue dependencies to determine optimal execution order, monitors progress with bottleneck detection, and provides health monitoring with automatic recovery from stuck or zombie workers.

## Features

- **Dependency Graph Analysis**: Computes priorities, detects cycles, identifies critical paths
- **Worker Pool Management**: Concurrent workers with task assignment and lifecycle management
- **Progress Monitoring**: Real-time tracking with bottleneck detection
- **Health Monitoring**: Heartbeat-based zombie worker detection and recovery
- **Stuck Worker Recovery**: Progressive escalation actions for unresponsive workers
- **Bounded Work Queue**: Backpressure support with rejection policies
- **Observability**: Prometheus-format metrics export
- **Distributed Locking**: Multi-process support via file-based locking

## Usage

### Basic Setup

```typescript
import { WorkerPoolManager, PriorityAnalyzer } from './controller';

const pool = new WorkerPoolManager({
  maxWorkers: 5,
  workerTimeout: 600000,  // 10 minutes
});

const analyzer = new PriorityAnalyzer();
```

### Analyzing Dependencies

```typescript
// Load and analyze dependency graph
const graph = await analyzer.loadGraph('.ad-sdlc/scratchpad/issues/001/dependency_graph.json');
const analysis = await analyzer.analyze(graph);

console.log('Execution order:', analysis.executionOrder);
console.log('Parallel groups:', analysis.parallelGroups);
console.log('Critical path:', analysis.criticalPath);
```

### Managing Workers

```typescript
// Get available worker slot
const workerId = pool.getAvailableSlot();

if (workerId) {
  // Create and assign work order
  const workOrder = await pool.createWorkOrder(issue, context);
  pool.assignWork(workerId, workOrder);
}

// Handle completion
pool.onCompletion((workerId, orderId, result) => {
  console.log(`Worker ${workerId} completed ${orderId}`);
});

pool.onFailure((workerId, orderId, error) => {
  console.error(`Worker ${workerId} failed:`, error);
});
```

### Work Queue Operations

```typescript
// Basic queue operations
pool.enqueue('ISSUE-001', 100);  // issueId, priority
const nextIssue = pool.dequeue();

// Bounded queue with backpressure
const result = await pool.enqueueBounded('ISSUE-002', 50);
if (!result.success) {
  console.log('Rejected:', result.reason);
}

// Dead letter queue
const deadLetters = pool.getDeadLetterQueue();
await pool.retryFromDeadLetter('ISSUE-003');
```

### Progress Monitoring

```typescript
import { ProgressMonitor } from './controller';

const monitor = new ProgressMonitor('session-1', {
  pollingInterval: 30000,
  stuckWorkerConfig: {
    warningThresholdMs: 180000,  // 3 min
    stuckThresholdMs: 300000,    // 5 min
    autoRecoveryEnabled: true,
  },
});

monitor.start(pool.getStatus(), pool.getQueue());

monitor.onEvent((event) => {
  switch (event.type) {
    case 'bottleneck_detected':
      console.log('Bottleneck:', event.data);
      break;
    case 'worker_stuck':
      console.log('Stuck worker:', event.data.workerId);
      break;
    case 'all_completed':
      console.log('All work completed!');
      break;
  }
});

const report = monitor.generateReport();
```

### Health Monitoring

```typescript
import { WorkerHealthMonitor } from './controller';

const healthMonitor = new WorkerHealthMonitor({
  heartbeatIntervalMs: 10000,
  missedHeartbeatThreshold: 3,
  maxRestarts: 3,
});

healthMonitor.start(() => pool.getActiveWorkers());

healthMonitor.onZombieDetected(async (workerId, currentTask) => {
  console.log(`Zombie detected: ${workerId}`);
  const newWorkerId = pool.reassignTask(currentTask);
  pool.respawnWorker(workerId);
});
```

### Distributed Locking (Multi-Process)

```typescript
const pool = new WorkerPoolManager({
  distributedLock: {
    enabled: true,
    lockTimeout: 5000,
    lockRetryAttempts: 10,
  },
});

// Thread-safe operations
await pool.assignWorkWithLock(workerId, workOrder);
await pool.completeWorkWithLock(workerId, result);
await pool.synchronizeState('project-1');
```

## Architecture

```
WorkerPoolManager (Central Hub)
├── PriorityAnalyzer
│   └── Graph analysis, cycle detection, critical path
├── BoundedWorkQueue
│   └── Backpressure, dead letter queue
├── WorkerPoolMetrics
│   └── Prometheus export
└── Scratchpad (distributed locks)

ProgressMonitor
└── StuckWorkerHandler
    └── Recovery actions

WorkerHealthMonitor
└── Zombie detection, worker restart
```

## API Reference

### WorkerPoolManager

#### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxWorkers` | `number` | `5` | Maximum concurrent workers |
| `workerTimeout` | `number` | `600000` | Worker timeout (10 min) |
| `workOrdersPath` | `string` | `.ad-sdlc/scratchpad/progress` | Work orders directory |
| `queueConfig` | `BoundedQueueConfig` | - | Queue limit configuration |
| `distributedLock` | `DistributedLockOptions` | - | Multi-process lock config |
| `metricsConfig` | `WorkerPoolMetricsConfig` | - | Metrics configuration |

#### Key Methods

```typescript
// Worker management
getStatus(): WorkerPoolStatus
getWorker(workerId: string): WorkerInfo
getAvailableSlot(): string | null
resetWorker(workerId: string): void
releaseWorker(workerId: string): void

// Work order management
createWorkOrder(issue, context): Promise<WorkOrder>
assignWork(workerId: string, workOrder: WorkOrder): void
completeWork(workerId: string, result: WorkOrderResult): Promise<void>
failWork(workerId: string, orderId: string, error: Error): Promise<void>

// Queue operations
enqueue(issueId: string, priorityScore: number): void
enqueueBounded(issueId: string, priorityScore: number): Promise<EnqueueResult>
dequeue(): string | null

// State persistence
saveState(projectId: string): Promise<void>
loadState(projectId: string): Promise<ControllerState | null>

// Metrics
getMetricsSnapshot(): WorkerPoolMetricsSnapshot | null
exportMetrics(format?: MetricsExportFormat): string | null
```

### BoundedQueueConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxSize` | `number` | `1000` | Maximum queue size |
| `softLimitRatio` | `number` | `0.8` | Soft limit (80%) |
| `rejectionPolicy` | `string` | `'reject'` | `'reject'` \| `'drop-oldest'` \| `'drop-lowest-priority'` |
| `backpressureThreshold` | `number` | `0.6` | Backpressure activation (60%) |
| `enableDeadLetter` | `boolean` | `true` | Enable dead letter queue |

### ProgressMonitorConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `pollingInterval` | `number` | `30000` | Check interval (30 sec) |
| `maxRecentActivities` | `number` | `50` | Activity history size |
| `enableNotifications` | `boolean` | `true` | Enable event notifications |

### HealthCheckConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `heartbeatIntervalMs` | `number` | `10000` | Heartbeat interval |
| `missedHeartbeatThreshold` | `number` | `3` | Missed beats for zombie |
| `memoryThresholdBytes` | `number` | `1GB` | Memory warning threshold |
| `maxRestarts` | `number` | `3` | Maximum worker restarts |

### StuckWorkerConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `warningThresholdMs` | `number` | `180000` | Warning at 3 min |
| `stuckThresholdMs` | `number` | `300000` | Stuck at 5 min |
| `criticalThresholdMs` | `number` | `600000` | Critical at 10 min |
| `autoRecoveryEnabled` | `boolean` | `true` | Enable auto-recovery |
| `maxRecoveryAttempts` | `number` | `3` | Max recovery attempts |

## Error Handling

### Error Types

```typescript
// Graph errors
GraphNotFoundError
GraphParseError
CircularDependencyError
IssueNotFoundError

// Worker pool errors
NoAvailableWorkerError
WorkerNotFoundError
WorkOrderNotFoundError
DependenciesNotResolvedError

// Health check errors
ZombieWorkerError
WorkerRestartError
MaxRestartsExceededError

// Queue errors
QueueFullError
QueueBackpressureActiveError
TaskPriorityTooLowError
```

### Error Properties

Each error includes:
- `severity`: HIGH, MEDIUM, LOW, CRITICAL
- `category`: 'fatal', 'recoverable', 'transient'
- `context`: Additional contextual data

## Events

### Progress Events

| Event Type | Description |
|------------|-------------|
| `progress_updated` | Progress metrics changed |
| `bottleneck_detected` | Performance bottleneck found |
| `worker_stuck` | Worker not progressing |
| `recovery_attempted` | Recovery action taken |
| `critical_escalation` | Critical threshold reached |
| `all_completed` | All work finished |

### Health Events

| Event Type | Description |
|------------|-------------|
| `heartbeat_received` | Worker heartbeat received |
| `zombie_detected` | Worker marked as zombie |
| `worker_restarting` | Worker being restarted |
| `task_reassigned` | Task moved to another worker |

### Queue Events

| Event Type | Description |
|------------|-------------|
| `task_enqueued` | Task added to queue |
| `backpressure_activated` | Queue backpressure on |
| `soft_limit_warning` | Queue near capacity |
| `task_moved_to_dead_letter` | Task sent to DLQ |

## Related Modules

- [Worker](../worker/README.md) - Executes work orders
- [Scratchpad](../scratchpad/README.md) - State persistence
- [Monitoring](../monitoring/README.md) - Metrics collection

## Testing

```bash
npm test -- tests/controller
```
