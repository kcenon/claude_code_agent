# Analysis Orchestrator Agent Module

The analysis-orchestrator module coordinates the complete analysis pipeline from user input to issue generation, managing Document Reader, Code Reader, Comparator, and Issue Generator agents.

## Overview

The module includes:

- **AnalysisOrchestratorAgent** - Main class for coordinating analysis pipeline
- **Types** - Comprehensive type definitions for pipeline state, stages, and reports
- **Errors** - Custom error classes for pipeline operations

## Installation

The analysis-orchestrator module is included in the main `ad-sdlc` package:

```typescript
import {
  AnalysisOrchestratorAgent,
  getAnalysisOrchestratorAgent,
  resetAnalysisOrchestratorAgent,
} from 'ad-sdlc';
```

## AnalysisOrchestratorAgent

Main class that orchestrates the analysis pipeline workflow.

### Basic Usage

```typescript
import { AnalysisOrchestratorAgent, getAnalysisOrchestratorAgent } from 'ad-sdlc';

// Using singleton
const orchestrator = getAnalysisOrchestratorAgent();

// Or create new instance with custom config
const orchestrator = new AnalysisOrchestratorAgent({
  scratchpadBasePath: '.ad-sdlc/scratchpad',
  parallelExecution: true,
  maxRetries: 3,
});

// Start analysis session
const session = await orchestrator.startAnalysis({
  projectPath: '/path/to/project',
  scope: 'full',
  generateIssues: true,
});

// Execute the pipeline
const result = await orchestrator.execute();

console.log(`Analysis ${result.success ? 'succeeded' : 'failed'}`);
console.log(`Report: ${result.outputPaths.analysisReport}`);
```

### CLI Usage

The orchestrator can be invoked via the CLI:

```bash
# Run full analysis
ad-sdlc analyze --project /path/to/project

# Run with specific scope
ad-sdlc analyze --project /path/to/project --scope documents_only
ad-sdlc analyze --project /path/to/project --scope code_only
ad-sdlc analyze --project /path/to/project --scope comparison

# Generate issues from analysis
ad-sdlc analyze --project /path/to/project --generate-issues

# Check analysis status
ad-sdlc analyze --project /path/to/project --status --project-id my-project

# Resume previous analysis
ad-sdlc analyze --project /path/to/project --resume --project-id my-project

# Output in different formats
ad-sdlc analyze --project /path/to/project --output-format json
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `scratchpadBasePath` | string | `.ad-sdlc/scratchpad` | Base path for output files |
| `parallelExecution` | boolean | `true` | Execute independent stages in parallel |
| `continueOnError` | boolean | `true` | Continue pipeline on non-critical errors |
| `maxRetries` | number | `3` | Maximum retry attempts for failed stages |
| `stageTimeoutMs` | number | `300000` | Default timeout per stage (5 minutes) |
| `stageTimeouts` | object | See below | Per-stage timeout overrides |
| `circuitBreaker` | object | See below | Circuit breaker configuration |
| `parallelExecutionConfig` | object | See below | Parallel execution configuration |

### Parallel Execution Configuration

The orchestrator supports advanced parallel execution with timeout protection, fail-fast behavior, and partial result handling:

```typescript
const orchestrator = new AnalysisOrchestratorAgent({
  parallelExecution: true,
  parallelExecutionConfig: {
    parallelExecutionTimeoutMs: 600000, // 10 minutes total timeout
    failFast: true,                      // Abort on critical stage failure
    requiredStages: ['document_reader'], // Critical stages for fail-fast
    allowPartialResults: true,           // Continue with partial results
    minSuccessRatio: 0.5,               // 50% stages must succeed
  },
});
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `parallelExecutionTimeoutMs` | number | `600000` | Timeout for entire parallel group (10 min) |
| `failFast` | boolean | `false` | Abort remaining stages when critical stage fails |
| `requiredStages` | string[] | `[]` | Stages required for pipeline to continue |
| `allowPartialResults` | boolean | `true` | Continue with partial results |
| `minSuccessRatio` | number | `0.5` | Minimum success ratio for partial results |

### Stage Timeouts

Individual stage timeouts can be configured:

```typescript
const orchestrator = new AnalysisOrchestratorAgent({
  stageTimeouts: {
    document_reader: 600000,   // 10 minutes for large documents
    code_reader: 900000,       // 15 minutes for large codebases
    comparator: 300000,        // 5 minutes
    issue_generator: 300000,   // 5 minutes
  },
});
```

### Circuit Breaker

The circuit breaker prevents repeated calls to failing stages:

```typescript
const orchestrator = new AnalysisOrchestratorAgent({
  circuitBreaker: {
    failureThreshold: 3,     // Open after 3 consecutive failures
    resetTimeoutMs: 60000,   // Try again after 1 minute
    enabled: true,
  },
});

## Analysis Scopes

The orchestrator supports different analysis scopes:

| Scope | Stages | Description |
|-------|--------|-------------|
| `full` | document_reader, code_reader, comparator | Complete analysis of documents and code |
| `documents_only` | document_reader | Analyze only PRD/SRS/SDS documents |
| `code_only` | code_reader | Analyze only source code |
| `comparison` | document_reader, code_reader, comparator | Compare documents with code |

## Pipeline Stages

### document_reader

Parses and analyzes existing PRD/SRS/SDS documents.

```typescript
interface DocumentReaderOutput {
  currentState: CurrentState;
  documentsProcessed: number;
  requirementsExtracted: number;
}
```

### code_reader (codebase_analyzer)

Analyzes the source code structure and patterns.

```typescript
interface CodeReaderOutput {
  architectureOverview: ArchitectureOverview;
  dependencyGraph: DependencyGraph;
  filesAnalyzed: number;
}
```

### comparator

Compares document specifications with actual code implementation.

```typescript
interface ComparatorOutput {
  documentedNotImplemented: string[];
  implementedNotDocumented: string[];
  discrepancies: Discrepancy[];
}
```

### issue_generator (optional)

Generates GitHub issues from analysis findings.

```typescript
interface IssueGeneratorOutput {
  issuesCreated: number;
  issueIds: string[];
}
```

## Pipeline State

The orchestrator maintains pipeline state throughout execution:

```yaml
pipeline_state:
  analysis_id: "uuid"
  project_id: "my-project"
  project_path: "/path/to/project"
  started_at: "2024-12-28T00:00:00Z"
  updated_at: "2024-12-28T00:00:00Z"
  overall_status: "running"  # pending, running, completed, failed
  scope: "full"
  generate_issues: true

  stages:
    - name: "document_reader"
      status: "completed"
      started_at: "2024-12-28T00:00:00Z"
      completed_at: "2024-12-28T00:00:05Z"
      output_path: ".ad-sdlc/scratchpad/analysis/document_reader_output.yaml"
      retry_count: 0
      error: null

    - name: "code_reader"
      status: "running"
      started_at: "2024-12-28T00:00:05Z"
      completed_at: null
      output_path: null
      retry_count: 0
      error: null

  statistics:
    total_stages: 3
    completed_stages: 1
    failed_stages: 0
    skipped_stages: 0
    total_duration_ms: 5000

  warnings: []
  errors: []
```

## Analysis Report

The orchestrator generates a comprehensive analysis report:

```yaml
analysis_report:
  analysis_id: "uuid"
  project_id: "my-project"
  generated_at: "2024-12-28T00:00:00Z"
  analysis_version: "1.0.0"
  overall_status: "success"  # success, partial, failed
  scope: "full"
  total_duration_ms: 15000

  document_analysis:
    prd_found: true
    srs_found: true
    sds_found: true
    requirements_count: 25
    features_count: 15
    components_count: 10
    coverage_prd_to_srs: 0.92
    coverage_srs_to_sds: 0.88

  code_analysis:
    files_analyzed: 150
    modules_found: 12
    functions_found: 245
    classes_found: 48
    test_coverage_estimate: 0.75

  comparison:
    documented_not_implemented: 3
    implemented_not_documented: 5
    discrepancy_count: 8
    alignment_score: 0.85

  issues:
    issues_created: 8
    by_priority:
      P0: 2
      P1: 3
      P2: 3

  recommendations:
    - priority: "high"
      category: "documentation"
      title: "Update SDS for new API endpoints"
      description: "3 API endpoints are implemented but not documented in SDS"
    - priority: "medium"
      category: "implementation"
      title: "Implement pending features"
      description: "2 features in SRS are not yet implemented"
```

## Error Handling

The module provides specific error classes:

```typescript
import {
  AnalysisOrchestratorError,
  NoActiveSessionError,
  AnalysisInProgressError,
  InvalidProjectPathError,
  StageExecutionError,
  StageTimeoutError,
  StageDependencyError,
  PipelineFailedError,
  AnalysisNotFoundError,
  CircuitOpenError,
  ParallelExecutionTimeoutError,
  CriticalStageFailureError,
  InsufficientPartialResultsError,
} from 'ad-sdlc';

try {
  await orchestrator.execute();
} catch (error) {
  if (error instanceof NoActiveSessionError) {
    console.error('No active session. Call startAnalysis() first.');
  } else if (error instanceof AnalysisInProgressError) {
    console.error(`Analysis already in progress: ${error.analysisId}`);
  } else if (error instanceof StageExecutionError) {
    console.error(`Stage ${error.stage} failed: ${error.reason}`);
  } else if (error instanceof StageTimeoutError) {
    console.error(`Stage ${error.stage} timed out after ${error.timeoutMs}ms`);
  } else if (error instanceof ParallelExecutionTimeoutError) {
    console.error(`Parallel execution timed out. Pending: ${error.stages.join(', ')}`);
  } else if (error instanceof CriticalStageFailureError) {
    console.error(`Critical stage ${error.stage} failed: ${error.reason}`);
  } else if (error instanceof CircuitOpenError) {
    console.error(`Circuit breaker open for ${error.stage}. Reset in ${error.resetTimeMs}ms`);
  } else if (error instanceof PipelineFailedError) {
    console.error(`Pipeline failed. Failed stages: ${error.failedStages.join(', ')}`);
  }
}
```

## Session Management

### Starting a Session

```typescript
const session = await orchestrator.startAnalysis({
  projectPath: '/path/to/project',
  projectId: 'my-project',  // Optional, auto-generated if not provided
  scope: 'full',
  generateIssues: true,
});

console.log(`Session ID: ${session.sessionId}`);
console.log(`Analysis ID: ${session.analysisId}`);
```

### Checking Status

```typescript
const status = await orchestrator.getStatus('my-project', '/path/to/project');

console.log(`Overall Status: ${status.overallStatus}`);
console.log(`Completed: ${status.statistics.completedStages}/${status.statistics.totalStages}`);
```

### Resuming Analysis

```typescript
const resumedSession = await orchestrator.resume(
  'my-project',
  '/path/to/project',
  true  // forceRerun: restart failed stages
);

const result = await orchestrator.execute();
```

## Integration with Enhancement Pipeline

The Analysis Orchestrator is the central coordinator of the Enhancement Pipeline:

```
Analysis Orchestrator
    ├── Document Reader → current_state.yaml
    ├── Code Reader → architecture_overview.yaml, dependency_graph.json
    ├── Comparator → comparison_result.yaml
    └── Issue Generator → issues/*.json
```

The orchestrator:

1. **Spawns sub-agents** - Creates and manages Document Reader, Code Reader, and Comparator agents
2. **Manages dependencies** - Ensures stages run in correct order based on dependencies
3. **Handles parallelism** - Runs independent stages in parallel for efficiency
4. **Aggregates results** - Combines outputs from all stages into comprehensive report
5. **Enables resume** - Saves state to allow resuming interrupted analyses

## Related Modules

- [Document Reader Agent](./document-reader.md) - Parses PRD/SRS/SDS documents
- [Codebase Analyzer Agent](./codebase-analyzer.md) - Analyzes source code
- [Impact Analyzer Agent](./impact-analyzer.md) - Analyzes change impacts
- [Issue Generator Agent](./issue-generator.md) - Creates GitHub issues
