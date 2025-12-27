# Controller Module

The controller module provides dependency graph analysis and work prioritization for the Controller Agent orchestration.

## Overview

The module includes:

- **PriorityAnalyzer** - Analyzes dependency graphs and computes optimal execution order
- **Priority Scoring** - Calculates priority scores based on weights, dependencies, and critical path
- **Critical Path Analysis** - Identifies the longest path through the dependency graph
- **Parallel Group Identification** - Groups issues that can be executed concurrently

## Installation

The controller module is included in the main `ad-sdlc` package:

```typescript
import {
  PriorityAnalyzer,
  CONTROLLER_PRIORITY_WEIGHTS,
  DEFAULT_ANALYZER_CONFIG,
} from 'ad-sdlc';
```

## PriorityAnalyzer

Main class for dependency graph analysis and work prioritization.

### Basic Usage

```typescript
import { PriorityAnalyzer } from 'ad-sdlc';

// Create analyzer with default configuration
const analyzer = new PriorityAnalyzer();

// Load and analyze a dependency graph
const graph = await analyzer.loadGraph('path/to/dependency_graph.json');
const result = analyzer.analyze(graph);

console.log(`Total issues: ${result.statistics.totalIssues}`);
console.log(`Critical path length: ${result.criticalPath.path.length}`);
console.log(`Ready for execution: ${result.prioritizedQueue.readyForExecution.length}`);
```

### Custom Configuration

```typescript
const analyzer = new PriorityAnalyzer({
  weights: {
    P0: 100,  // Critical priority weight
    P1: 75,   // High priority weight
    P2: 50,   // Medium priority weight
    P3: 25,   // Low priority weight
  },
  criticalPathBonus: 50,      // Bonus for issues on critical path
  dependentMultiplier: 10,    // Score per dependent issue
  quickWinBonus: 15,          // Bonus for small effort issues
  quickWinThreshold: 4,       // Hours threshold for quick win
});
```

### Dependency Graph Format

The analyzer expects a JSON file with the following structure:

```json
{
  "nodes": [
    {
      "id": "ISS-001",
      "title": "Implement user authentication",
      "priority": "P0",
      "effort": 8,
      "status": "pending"
    },
    {
      "id": "ISS-002",
      "title": "Add database schema",
      "priority": "P1",
      "effort": 4,
      "status": "completed"
    }
  ],
  "edges": [
    {
      "from": "ISS-001",
      "to": "ISS-002"
    }
  ]
}
```

### Node Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | Yes | Unique issue identifier |
| `title` | string | Yes | Issue title |
| `priority` | P0\|P1\|P2\|P3 | Yes | Priority level |
| `effort` | number | Yes | Estimated hours |
| `status` | string | Yes | pending\|ready\|in_progress\|completed\|blocked\|failed |
| `url` | string | No | GitHub issue URL |
| `componentId` | string | No | Source SDS component ID |

### Analysis Result

```typescript
const result = analyzer.analyze(graph);

// Execution order (respects dependencies and priorities)
result.executionOrder;  // ['ISS-002', 'ISS-001', ...]

// Parallel groups by depth level
result.parallelGroups;
// [
//   { groupIndex: 0, issueIds: ['ISS-002'], totalEffort: 4 },
//   { groupIndex: 1, issueIds: ['ISS-001'], totalEffort: 8 }
// ]

// Critical path information
result.criticalPath;
// {
//   path: ['ISS-002', 'ISS-001'],
//   totalDuration: 12,
//   bottleneck: 'ISS-001'
// }

// Prioritized work queue
result.prioritizedQueue;
// {
//   queue: ['ISS-001', 'ISS-002'],  // All issues by priority score
//   readyForExecution: ['ISS-001'], // Issues with resolved dependencies
//   blocked: []                      // Issues waiting on dependencies
// }

// Graph statistics
result.statistics;
// {
//   totalIssues: 2,
//   totalDependencies: 1,
//   maxDepth: 1,
//   rootIssues: 1,
//   leafIssues: 1,
//   criticalPathLength: 2,
//   byPriority: { P0: 1, P1: 1, P2: 0, P3: 0 },
//   byStatus: { pending: 1, completed: 1, ... }
// }
```

### Getting Next Executable Issue

```typescript
// After analyzing the graph
analyzer.analyze(graph);

// Get the highest priority issue ready for execution
const nextIssue = analyzer.getNextExecutableIssue();
// Returns issue ID or null if none are ready

// Check if dependencies are resolved
const ready = analyzer.areDependenciesResolved('ISS-001');
// Returns true/false
```

### Dependency Queries

```typescript
// Get direct dependencies
const deps = analyzer.getDependencies('ISS-001');
// ['ISS-002']

// Get direct dependents
const dependents = analyzer.getDependents('ISS-002');
// ['ISS-001']

// Get all transitive dependencies
const allDeps = analyzer.getTransitiveDependencies('ISS-003');
// ['ISS-001', 'ISS-002']

// Check if A depends on B
const depends = analyzer.dependsOn('ISS-003', 'ISS-001');
// true
```

## Priority Scoring Algorithm

The priority score for each issue is calculated as:

```
score = priorityWeight + (dependentCount × dependentMultiplier)
        + (isOnCriticalPath ? criticalPathBonus : 0)
        + (effort ≤ quickWinThreshold ? quickWinBonus : 0)
```

### Default Weights

| Priority | Weight |
|----------|--------|
| P0 (Critical) | 100 |
| P1 (High) | 75 |
| P2 (Medium) | 50 |
| P3 (Low) | 25 |

### Scoring Factors

| Factor | Default | Description |
|--------|---------|-------------|
| `criticalPathBonus` | 50 | Added to issues on the critical path |
| `dependentMultiplier` | 10 | Multiplied by number of dependents |
| `quickWinBonus` | 15 | Added to issues with small effort |
| `quickWinThreshold` | 4 | Max hours for quick win bonus |

## Critical Path Analysis

The critical path is the longest path through the dependency graph, weighted by effort. This represents the minimum time to complete all work.

```typescript
const result = analyzer.analyze(graph);

// Issues on critical path are marked
const issue = result.issues.get('ISS-001');
issue.isOnCriticalPath;  // true/false

// Critical path details
result.criticalPath.path;           // Ordered issue IDs
result.criticalPath.totalDuration;  // Sum of efforts
result.criticalPath.bottleneck;     // Issue with highest effort on path
```

## Error Handling

The module provides specific error types:

```typescript
import {
  GraphNotFoundError,
  GraphParseError,
  GraphValidationError,
  CircularDependencyError,
  IssueNotFoundError,
  EmptyGraphError,
} from 'ad-sdlc';

try {
  const graph = await analyzer.loadGraph('path/to/graph.json');
  const result = analyzer.analyze(graph);
} catch (error) {
  if (error instanceof GraphNotFoundError) {
    console.error('File not found:', error.path);
  } else if (error instanceof CircularDependencyError) {
    console.error('Circular dependency:', error.cycle.join(' -> '));
  } else if (error instanceof GraphValidationError) {
    console.error('Validation errors:', error.errors);
  }
}
```

## Integration with Controller Agent

The PriorityAnalyzer is designed to be used by the Controller Agent for:

1. **Work Scheduling** - Determine which issues to assign to workers
2. **Dependency Tracking** - Ensure prerequisites are completed
3. **Progress Monitoring** - Track critical path and blockers
4. **Resource Optimization** - Identify parallel execution opportunities

### Example Integration

```typescript
class ControllerAgent {
  private analyzer = new PriorityAnalyzer();
  private currentGraph: RawDependencyGraph;

  async initialize(graphPath: string): Promise<void> {
    this.currentGraph = await this.analyzer.loadGraph(graphPath);
    this.analyzer.analyze(this.currentGraph);
  }

  async scheduleNextWork(): Promise<string | null> {
    return this.analyzer.getNextExecutableIssue();
  }

  getBlockedIssues(): readonly string[] {
    const result = this.analyzer.analyze(this.currentGraph);
    return result.prioritizedQueue.blocked;
  }
}
```

## Types

### ControllerPriority

```typescript
type ControllerPriority = 'P0' | 'P1' | 'P2' | 'P3';
```

### IssueNode

```typescript
interface IssueNode {
  readonly id: string;
  readonly title: string;
  readonly priority: ControllerPriority;
  readonly effort: number;
  readonly status: IssueStatus;
  readonly url?: string;
  readonly componentId?: string;
}
```

### AnalyzedIssue

```typescript
interface AnalyzedIssue {
  readonly node: IssueNode;
  readonly dependencies: readonly string[];
  readonly dependents: readonly string[];
  readonly transitiveDependencies: readonly string[];
  readonly depth: number;
  readonly priorityScore: number;
  readonly isOnCriticalPath: boolean;
  readonly dependenciesResolved: boolean;
}
```

### GraphAnalysisResult

```typescript
interface GraphAnalysisResult {
  readonly issues: ReadonlyMap<string, AnalyzedIssue>;
  readonly executionOrder: readonly string[];
  readonly parallelGroups: readonly ParallelGroup[];
  readonly criticalPath: CriticalPath;
  readonly prioritizedQueue: PrioritizedQueue;
  readonly statistics: GraphStatistics;
}
```

See the TypeScript source files for complete type definitions.
