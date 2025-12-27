# Worker Module

The worker module provides code generation, test writing, and self-verification functionality for the Worker Agent.

## Overview

The module includes:

- **WorkerAgent** - Main class that processes Work Orders to implement code changes
- **Context Analysis** - Analyzes related files and detects code patterns
- **Branch Management** - Creates feature branches with automatic prefix detection
- **Verification** - Runs tests, lint, and build to verify implementation
- **Result Generation** - Creates implementation results in YAML format

## Installation

The worker module is included in the main `ad-sdlc` package:

```typescript
import {
  WorkerAgent,
  DEFAULT_WORKER_AGENT_CONFIG,
  DEFAULT_CODE_PATTERNS,
  DEFAULT_RETRY_POLICY,
} from 'ad-sdlc';
```

## WorkerAgent

Main class for processing Work Orders and generating code implementations.

### Basic Usage

```typescript
import { WorkerAgent } from 'ad-sdlc';

// Create agent with default configuration
const agent = new WorkerAgent();

// Process a work order
const result = await agent.implement(workOrder);

console.log(`Status: ${result.status}`);
console.log(`Branch: ${result.branch.name}`);
console.log(`Changes: ${result.changes.length} files modified`);
```

### Custom Configuration

```typescript
const agent = new WorkerAgent({
  projectRoot: '/path/to/project',
  resultsPath: '.ad-sdlc/scratchpad/progress',
  maxRetries: 3,
  testCommand: 'npm test',
  lintCommand: 'npm run lint',
  buildCommand: 'npm run build',
  autoFixLint: true,
  coverageThreshold: 80,
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `projectRoot` | `string` | `process.cwd()` | Project root directory |
| `resultsPath` | `string` | `.ad-sdlc/scratchpad/progress` | Path to store results |
| `maxRetries` | `number` | `3` | Maximum retry attempts |
| `testCommand` | `string` | `npm test` | Command to run tests |
| `lintCommand` | `string` | `npm run lint` | Command to run linter |
| `buildCommand` | `string` | `npm run build` | Command to run build |
| `autoFixLint` | `boolean` | `true` | Auto-fix lint errors |
| `coverageThreshold` | `number` | `80` | Minimum coverage percentage |

## Work Order Format

The WorkerAgent expects a Work Order with the following structure:

```typescript
interface WorkOrder {
  orderId: string;           // Unique work order ID (e.g., "WO-001")
  issueId: string;           // Issue ID (e.g., "ISS-001")
  issueUrl?: string;         // GitHub issue URL
  createdAt: string;         // ISO timestamp
  priority: number;          // Priority score
  context: WorkOrderContext; // Context information
  acceptanceCriteria: string[]; // Criteria to satisfy
}

interface WorkOrderContext {
  sdsComponent?: string;     // SDS component reference
  srsFeature?: string;       // SRS feature reference
  prdRequirement?: string;   // PRD requirement reference
  relatedFiles: RelatedFile[];     // Related files
  dependenciesStatus: DependencyStatus[]; // Dependency status
}
```

## Implementation Result

The agent generates an implementation result:

```yaml
implementation_result:
  workOrderId: WO-001
  issueId: ISS-001
  githubIssue: 45
  status: completed
  startedAt: "2025-12-27T10:00:00Z"
  completedAt: "2025-12-27T11:30:00Z"
  changes:
    - filePath: src/feature/NewFeature.ts
      changeType: create
      description: New feature implementation
      linesAdded: 150
      linesRemoved: 0
  tests:
    filesCreated:
      - tests/feature/NewFeature.test.ts
    totalTests: 12
    coveragePercentage: 85
  verification:
    testsPassed: true
    testsOutput: "All tests passed"
    lintPassed: true
    lintOutput: "No lint errors"
    buildPassed: true
    buildOutput: "Build successful"
  branch:
    name: feature/iss-001-new-feature
    commits:
      - hash: abc123
        message: "feat(feature): implement new feature"
```

## Context Analysis

The agent analyzes code context from related files:

```typescript
const context = await agent.analyzeContext(workOrder);

console.log(`Related files: ${context.relatedFiles.length}`);
console.log(`Indentation: ${context.patterns.indentation}`);
console.log(`Quote style: ${context.patterns.quoteStyle}`);
console.log(`Test framework: ${context.patterns.testFramework}`);
```

### Detected Patterns

| Pattern | Type | Description |
|---------|------|-------------|
| `indentation` | `'spaces' \| 'tabs'` | Indentation style |
| `indentSize` | `number` | Indent size (if spaces) |
| `quoteStyle` | `'single' \| 'double'` | String quote preference |
| `useSemicolons` | `boolean` | Semicolon usage |
| `trailingComma` | `'none' \| 'es5' \| 'all'` | Trailing comma style |
| `testFramework` | `'jest' \| 'vitest' \| 'mocha'` | Detected test framework |

## Branch Creation

The agent creates branches with automatic prefix detection:

```typescript
const branchName = await agent.createBranch(workOrder);
// Returns: "feature/iss-001-add-feature"
```

### Branch Prefixes

| Issue ID Contains | Branch Prefix |
|-------------------|---------------|
| `fix` or `bug` | `fix/` |
| `doc` | `docs/` |
| `test` | `test/` |
| `refactor` | `refactor/` |
| Default | `feature/` |

## Execution Options

```typescript
const result = await agent.implement(workOrder, {
  skipTests: false,        // Skip test generation
  skipVerification: false, // Skip verification
  dryRun: false,          // Don't commit changes
  retryPolicy: {
    maxAttempts: 3,
    baseDelayMs: 5000,
    backoff: 'exponential',
    maxDelayMs: 60000,
  },
});
```

## Error Handling

The module provides specific error classes:

```typescript
import {
  WorkerError,              // Base error class
  WorkOrderParseError,      // Work order parsing failed
  ContextAnalysisError,     // Context analysis failed
  FileReadError,            // File read failed
  FileWriteError,           // File write failed
  BranchCreationError,      // Branch creation failed
  BranchExistsError,        // Branch already exists
  CommitError,              // Commit failed
  GitOperationError,        // Git operation failed
  CodeGenerationError,      // Code generation failed
  TestGenerationError,      // Test generation failed
  VerificationError,        // Verification failed
  MaxRetriesExceededError,  // Max retries exceeded
  ImplementationBlockedError, // Implementation blocked
  ResultPersistenceError,   // Result save/load failed
} from 'ad-sdlc';
```

### Error Handling Example

```typescript
try {
  const result = await agent.implement(workOrder);
} catch (error) {
  if (error instanceof VerificationError) {
    console.error(`Verification failed: ${error.verificationType}`);
    console.error(`Output: ${error.output}`);
  } else if (error instanceof MaxRetriesExceededError) {
    console.error(`Max retries (${error.attempts}) exceeded`);
    console.error(`Last error: ${error.lastError?.message}`);
  } else if (error instanceof ImplementationBlockedError) {
    console.error(`Blocked by: ${error.blockers.join(', ')}`);
  }
}
```

## Retry Policy

The agent supports configurable retry with backoff:

```typescript
const result = await agent.implement(workOrder, {
  retryPolicy: {
    maxAttempts: 3,          // Maximum attempts
    baseDelayMs: 5000,       // Initial delay (5 seconds)
    backoff: 'exponential',  // 'fixed', 'linear', or 'exponential'
    maxDelayMs: 60000,       // Maximum delay (1 minute)
  },
});
```

### Backoff Strategies

| Strategy | Delay Calculation |
|----------|-------------------|
| `fixed` | Always `baseDelayMs` |
| `linear` | `baseDelayMs * attempt` |
| `exponential` | `baseDelayMs * 2^(attempt-1)` |

## Recording Changes

Manually record file changes and tests:

```typescript
// Record file change
agent.recordFileChange({
  filePath: 'src/new-file.ts',
  changeType: 'create',
  description: 'New implementation file',
  linesAdded: 100,
  linesRemoved: 0,
});

// Record test file
agent.recordTestFile('tests/new-file.test.ts', 5);
```

## Complete Example

```typescript
import { WorkerAgent, ImplementationBlockedError } from 'ad-sdlc';

const agent = new WorkerAgent({
  projectRoot: '/path/to/project',
  testCommand: 'npm test -- --coverage',
  coverageThreshold: 80,
});

const workOrder = {
  orderId: 'WO-001',
  issueId: 'ISS-045-add-user-auth',
  issueUrl: 'https://github.com/org/repo/issues/45',
  createdAt: new Date().toISOString(),
  priority: 75,
  context: {
    sdsComponent: 'CMP-007',
    relatedFiles: [
      { path: 'src/auth/index.ts', reason: 'Auth module entry' },
      { path: 'src/auth/types.ts', reason: 'Auth types' },
    ],
    dependenciesStatus: [],
  },
  acceptanceCriteria: [
    'Implement user login',
    'Add JWT token generation',
    'Write unit tests',
  ],
};

try {
  const result = await agent.implement(workOrder);

  if (result.status === 'completed') {
    console.log('Implementation successful!');
    console.log(`Branch: ${result.branch.name}`);
    console.log(`Files changed: ${result.changes.length}`);
    console.log(`Tests added: ${result.tests.totalTests}`);
  }
} catch (error) {
  if (error instanceof ImplementationBlockedError) {
    console.error('Implementation blocked:', error.blockers);
  } else {
    console.error('Implementation failed:', error);
  }
}
```

## API Reference

### WorkerAgent Methods

| Method | Description |
|--------|-------------|
| `implement(workOrder, options?)` | Process work order and generate implementation |
| `analyzeContext(workOrder)` | Analyze code context from work order |
| `createBranch(workOrder)` | Create feature branch |
| `generateCode(context)` | Generate code (placeholder) |
| `generateTests(context)` | Generate tests (placeholder) |
| `runVerification()` | Run tests, lint, and build |
| `commitChanges(workOrder)` | Commit staged changes |
| `createResult(...)` | Create implementation result |
| `saveResult(result)` | Save result to disk |
| `recordFileChange(change)` | Record a file change |
| `recordTestFile(path, count)` | Record a test file |
| `getConfig()` | Get current configuration |
