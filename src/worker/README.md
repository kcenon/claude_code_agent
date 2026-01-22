# Worker Module

Executes Work Orders from the Controller Agent to implement code changes, generate tests, and verify implementations with automatic retry and checkpoint/resume capabilities.

## Overview

The Worker Agent module is responsible for the actual implementation work in the AD-SDLC pipeline. It receives Work Orders from the Controller, analyzes code context, generates tests, runs verification pipelines, and commits changes. The module features sophisticated error categorization, checkpoint-based crash recovery, and parallel verification execution.

## Features

- **Code Generation**: Analyzes context and prepares for code implementation
- **Test Generation**: Creates comprehensive test suites with proper patterns and mocking
- **Parallel Verification**: Runs tests, linting, and builds concurrently
- **Checkpoint/Resume**: Automatic state saving after each step for crash recovery
- **Retry Management**: Intelligent retry logic with error categorization
- **Git Operations**: Creates branches, commits changes with conventional commit messages
- **Self-Verification**: Validates implementation with automatic fix attempts

## Usage

### Basic Setup

```typescript
import { WorkerAgent } from './worker';

const worker = new WorkerAgent({
  projectRoot: process.cwd(),
  maxRetries: 3,
  testCommand: 'npm test',
  lintCommand: 'npm run lint',
  buildCommand: 'npm run build',
});

await worker.initialize();
```

### Implementing a Work Order

```typescript
import { WorkOrder } from '../controller';

const workOrder: WorkOrder = {
  orderId: 'WO-001',
  issueId: 'ISSUE-123',
  priority: 1,
  context: {
    issueTitle: 'Add user authentication',
    issueBody: 'Implement JWT-based authentication',
    relatedFiles: [
      { path: 'src/auth/index.ts', relevance: 'high' }
    ],
  },
  acceptanceCriteria: [
    'Users can login with email/password',
    'JWT tokens are issued on successful login',
  ],
};

const result = await worker.implement(workOrder);

if (result.status === 'completed') {
  console.log('Implementation successful:', result.branchName);
} else {
  console.log('Implementation blocked:', result.blockers);
}
```

### Execution Options

```typescript
const result = await worker.implement(workOrder, {
  skipTests: false,           // Skip test generation
  skipVerification: false,    // Skip verification pipeline
  dryRun: true,               // Don't commit changes
  retryPolicy: {
    maxAttempts: 5,
    baseDelayMs: 2000,
    backoff: 'exponential',
  },
});
```

### Checkpoint/Resume Support

```typescript
// Check if previous checkpoint exists
if (await worker.hasCheckpoint(workOrder.orderId)) {
  console.log('Resuming from checkpoint...');
}

// Implementation automatically resumes from last checkpoint
const result = await worker.implement(workOrder);

// Access checkpoint manager directly
const checkpointManager = worker.getCheckpointManager();
```

## Architecture

```
WorkerAgent
├── TestGenerator
│   ├── CodeAnalyzer
│   ├── TestStrategyFactory
│   ├── AssertionBuilder
│   ├── FixtureManager
│   └── FrameworkAdapters (Vitest/Jest/Mocha)
├── CheckpointManager
├── SelfVerificationAgent
├── RetryHandler
└── SecureFileOps
```

## Execution Flow

```
implement(workOrder)
│
├─ 1. Context Analysis
│  └─ analyzeContext() → CodeContext
│
├─ 2. Branch Creation
│  └─ createBranch() → branchName
│
├─ 3. Code Generation
│  └─ generateCode(context) → modifies files
│
├─ 4. Test Generation (if !skipTests)
│  └─ generateTests(context) → TestGenerationResult
│
├─ 5. Verification (if !skipVerification)
│  ├─ runVerification() [parallel: tests, lint, build]
│  └─ If failed → retry/fix
│
├─ 6. Commit Changes (if !dryRun)
│  └─ commitChanges(workOrder) → commits
│
└─ 7. Save Result
   └─ saveResult(result) → YAML file

Checkpoint saved after each step for resume capability
```

## API Reference

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `projectRoot` | `string` | `tryGetProjectRoot()` | Root directory of the project |
| `resultsPath` | `string` | `.ad-sdlc/scratchpad/progress` | Output directory for results |
| `maxRetries` | `number` | `3` | Maximum retry attempts |
| `testCommand` | `string` | `npm test` | Command to run tests |
| `lintCommand` | `string` | `npm run lint` | Command to run linter |
| `buildCommand` | `string` | `npm run build` | Command to build project |
| `autoFixLint` | `boolean` | `true` | Auto-fix lint errors |
| `coverageThreshold` | `number` | `80` | Minimum coverage percentage |

### Retry Policy Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxAttempts` | `number` | `3` | Maximum retry attempts |
| `baseDelayMs` | `number` | `1000` | Base delay between retries |
| `backoff` | `string` | `'exponential'` | `'fixed'` \| `'linear'` \| `'exponential'` |
| `maxDelayMs` | `number` | `30000` | Maximum delay cap |
| `timeoutMs` | `number` | `600000` | Operation timeout (10 min) |

### Test Generation Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `coverageTarget` | `number` | `80` | Target coverage percentage |
| `namingConvention` | `string` | `'should_when'` | Test naming pattern |
| `includeEdgeCases` | `boolean` | `true` | Generate edge case tests |
| `includeErrorHandling` | `boolean` | `true` | Generate error tests |
| `mockStrategy` | `string` | `'comprehensive'` | `'minimal'` \| `'comprehensive'` |
| `testFilePattern` | `string` | `'test'` | `'test'` \| `'spec'` |

### Key Methods

```typescript
// Main implementation
implement(workOrder: WorkOrder, options?: WorkerExecutionOptions): Promise<ImplementationResult>

// Context analysis
analyzeContext(workOrder: WorkOrder): Promise<CodeContext>

// Branch management
createBranch(workOrder: WorkOrder): Promise<string>

// Test generation
generateTests(context: ExecutionContext): Promise<TestGenerationResult>

// Verification
runVerification(): Promise<VerificationResult>

// Commit changes
commitChanges(workOrder: WorkOrder): Promise<void>

// State access
hasCheckpoint(workOrderId: string): Promise<boolean>
getCheckpointManager(): CheckpointManager
getTestGenerator(): TestGenerator
getLastTestGenerationResult(): TestGenerationResult | null
```

## Error Handling

### Error Categories

| Category | Retry | Fix Attempt | Escalate | Examples |
|----------|-------|-------------|----------|----------|
| `transient` | Yes | No | No | Network, timeouts |
| `recoverable` | Yes | Yes | No | Test failures, lint errors |
| `fatal` | No | No | Yes | Missing deps, permissions |

### Error Types

```typescript
// Fatal errors - immediate escalation
WorkOrderParseError
FileReadError
FileWriteError
MaxRetriesExceededError
ImplementationBlockedError

// Recoverable errors - retry with fix
ContextAnalysisError
BranchCreationError
CodeGenerationError
TestGenerationError
VerificationError

// Transient errors - retry with backoff
CommandTimeoutError
OperationTimeoutError
```

### Error Handling Pattern

```typescript
try {
  const result = await worker.implement(workOrder);
} catch (error) {
  if (error instanceof MaxRetriesExceededError) {
    console.error('All retries exhausted:', error.attempts);
  } else if (error instanceof ImplementationBlockedError) {
    console.error('Blocked by:', error.blockers);
  }
}
```

## Related Modules

- [Controller](../controller/README.md) - Assigns work orders to workers
- [Scratchpad](../scratchpad/README.md) - Checkpoint storage
- [Security](../security/README.md) - Secure file operations

## Testing

```bash
npm test -- tests/worker
```
