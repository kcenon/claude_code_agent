# Worker Module

The worker module provides code generation, test writing, and self-verification functionality for the Worker Agent.

## Overview

The module includes:

- **WorkerAgent** - Main class that processes Work Orders to implement code changes
- **TestGenerator** - Generates comprehensive unit tests from source code
- **SelfVerificationAgent** - Self-verification loop with automatic fix attempts (UC-013)
- **Context Analysis** - Analyzes related files and detects code patterns
- **Branch Management** - Creates feature branches with automatic prefix detection
- **Verification** - Runs tests, lint, and build to verify implementation
- **Result Generation** - Creates implementation results in YAML format

## Installation

The worker module is included in the main `ad-sdlc` package:

```typescript
import {
  WorkerAgent,
  TestGenerator,
  SelfVerificationAgent,
  DEFAULT_WORKER_AGENT_CONFIG,
  DEFAULT_CODE_PATTERNS,
  DEFAULT_RETRY_POLICY,
  DEFAULT_TEST_GENERATOR_CONFIG,
  DEFAULT_SELF_VERIFICATION_CONFIG,
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
| `generateTests(context)` | Generate tests using TestGenerator |
| `getTestGenerator()` | Get the TestGenerator instance |
| `getLastTestGenerationResult()` | Get the last test generation result |
| `runVerification()` | Run tests, lint, and build |
| `commitChanges(workOrder)` | Commit staged changes |
| `createResult(...)` | Create implementation result |
| `saveResult(result)` | Save result to disk |
| `recordFileChange(change)` | Record a file change |
| `recordTestFile(path, count)` | Record a test file |
| `getConfig()` | Get current configuration |

## TestGenerator

The TestGenerator class analyzes source code and generates comprehensive unit tests following best practices.

### Basic Usage

```typescript
import { TestGenerator, DEFAULT_CODE_PATTERNS } from 'ad-sdlc';

// Create generator with default configuration
const generator = new TestGenerator();

// Generate tests for a source file
const suite = generator.generateTests(
  'src/Calculator.ts',
  sourceContent,
  DEFAULT_CODE_PATTERNS
);

console.log(`Test file: ${suite.testFile}`);
console.log(`Total tests: ${suite.totalTests}`);
console.log(`Estimated coverage: ${suite.estimatedCoverage}%`);
```

### Custom Configuration

```typescript
const generator = new TestGenerator({
  coverageTarget: 90,           // Target coverage percentage
  namingConvention: 'should_when', // Test naming convention
  includeEdgeCases: true,       // Include edge case tests
  includeErrorHandling: true,   // Include error handling tests
  includeIntegration: true,     // Include integration tests
  mockStrategy: 'comprehensive', // Mock generation strategy
  testFilePattern: 'test',      // Test file suffix (.test.ts)
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `coverageTarget` | `number` | `80` | Target coverage percentage |
| `namingConvention` | `'should_when' \| 'it_does' \| 'test_case'` | `'should_when'` | Test naming convention |
| `includeEdgeCases` | `boolean` | `true` | Generate edge case tests |
| `includeErrorHandling` | `boolean` | `true` | Generate error handling tests |
| `includeIntegration` | `boolean` | `true` | Generate integration tests |
| `mockStrategy` | `'minimal' \| 'comprehensive'` | `'comprehensive'` | Mock generation strategy |
| `testFilePattern` | `'test' \| 'spec'` | `'test'` | Test file suffix pattern |

### Naming Conventions

| Convention | Example Test Name |
|------------|-------------------|
| `should_when` | `should_return_result_when_valid_input` |
| `it_does` | `returns result with valid input` |
| `test_case` | `test_return_result_valid_input` |

### Code Analysis

The generator analyzes source code to extract testable elements:

```typescript
const analysis = generator.analyzeCode(sourceContent);

console.log(`Classes: ${analysis.classes.length}`);
console.log(`Functions: ${analysis.functions.length}`);
console.log(`Dependencies: ${analysis.dependencies.length}`);
console.log(`Exports: ${analysis.exports.length}`);
```

### Generating Tests for Multiple Files

```typescript
import type { FileContext } from 'ad-sdlc';

const files: FileContext[] = [
  { path: 'src/ServiceA.ts', content: '...', reason: 'Main service' },
  { path: 'src/ServiceB.ts', content: '...', reason: 'Helper service' },
];

const result = generator.generateTestsForFiles(files, patterns);

console.log(`Test suites: ${result.testSuites.length}`);
console.log(`Total tests: ${result.totalTests}`);
console.log(`Coverage by category:`, result.coverageByCategory);
console.log(`Warnings: ${result.warnings.length}`);
```

### Test Structure (AAA Pattern)

Generated tests follow the Arrange-Act-Assert pattern:

```typescript
describe('Calculator', () => {
  describe('add', () => {
    it('should_return_sum_when_valid_numbers', async () => {
      // Arrange
      const calculator = new Calculator();
      const a = 5;
      const b = 3;

      // Act
      const result = calculator.add(a, b);

      // Assert
      expect(result).toBe(8);
    });
  });
});
```

### Test Categories

| Category | Description | Priority |
|----------|-------------|----------|
| `happy_path` | Normal successful execution | Critical |
| `edge_case` | Boundary conditions and empty inputs | Medium |
| `error_handling` | Invalid input and error scenarios | High |
| `integration` | Integration with dependencies | Low |

### Mock Generation

The generator creates mock specifications for external dependencies:

```typescript
interface MockDependency {
  name: string;                              // Dependency name
  type: 'class' | 'function' | 'module' | 'external';
  strategy: 'spy' | 'stub' | 'mock' | 'fake';
  behavior: string;                          // Mock behavior description
}
```

### Generating Test File Content

```typescript
const content = generator.generateTestFileContent(suite, patterns);

// Write to file
await fs.writeFile(suite.testFile, content, 'utf-8');
```

### TestGenerator Methods

| Method | Description |
|--------|-------------|
| `generateTests(sourceFile, content, patterns)` | Generate test suite for a file |
| `generateTestsForFiles(files, patterns)` | Generate tests for multiple files |
| `analyzeCode(content)` | Analyze source code structure |
| `generateTestFileContent(suite, patterns)` | Generate test file content |
| `getConfig()` | Get current configuration |

### Integration with WorkerAgent

The TestGenerator is integrated with WorkerAgent for automated test generation:

```typescript
const agent = new WorkerAgent(
  { projectRoot: '/path/to/project' },
  { coverageTarget: 85, includeEdgeCases: true }  // TestGenerator config
);

// Tests are automatically generated during implement()
const result = await agent.implement(workOrder);

// Access test generation result
const testResult = agent.getLastTestGenerationResult();
console.log(`Generated ${testResult?.totalTests} tests`);
```

## SelfVerificationAgent

The SelfVerificationAgent implements the self-verification loop (UC-013) that automatically runs verification steps (tests, lint, build, typecheck) with automatic fix attempts and escalation when necessary.

### Basic Usage

```typescript
import { SelfVerificationAgent } from 'ad-sdlc';

// Create agent with default configuration
const agent = new SelfVerificationAgent();

// Run verification pipeline
const report = await agent.runVerificationPipeline('task-001');

console.log(`Status: ${report.finalStatus}`);
console.log(`Duration: ${report.totalDurationMs}ms`);
```

### Custom Configuration

```typescript
const agent = new SelfVerificationAgent({
  projectRoot: '/path/to/project',
  testCommand: 'npm test',
  lintCommand: 'npm run lint',
  buildCommand: 'npm run build',
  typecheckCommand: 'npx tsc --noEmit',
  maxFixIterations: 3,
  autoFixLint: true,
  stepsToRun: ['test', 'lint', 'build', 'typecheck'],
  commandTimeout: 300000, // 5 minutes
  continueOnFailure: false,
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `projectRoot` | `string` | `process.cwd()` | Project root directory |
| `testCommand` | `string` | `npm test` | Command to run tests |
| `lintCommand` | `string` | `npm run lint` | Command to run linter |
| `buildCommand` | `string` | `npm run build` | Command to run build |
| `typecheckCommand` | `string` | `npx tsc --noEmit` | Command to run type checker |
| `maxFixIterations` | `number` | `3` | Maximum fix attempts per step |
| `autoFixLint` | `boolean` | `true` | Auto-fix lint errors |
| `stepsToRun` | `VerificationStep[]` | All steps | Steps to execute |
| `commandTimeout` | `number` | `300000` | Command timeout (ms) |
| `continueOnFailure` | `boolean` | `false` | Continue on step failure |

### Verification Pipeline Flow

```
1. Worker completes code generation
2. Run test suite → if fail, attempt fix (max 3 times)
3. Run linter → auto-fix where possible
4. Run build → fix compilation errors
5. Run type check → fix type errors
6. Generate verification report
7. If all pass → mark complete
8. If still failing → escalate with report
```

### Running Individual Steps

```typescript
// Run a single verification step
const result = await agent.runStep('test');

console.log(`Step: ${result.step}`);
console.log(`Passed: ${result.passed}`);
console.log(`Exit code: ${result.exitCode}`);
console.log(`Duration: ${result.durationMs}ms`);
```

### Verification Report

The agent generates a detailed verification report:

```typescript
interface VerificationReport {
  taskId: string;              // Task identifier
  timestamp: string;           // Report timestamp
  results: {                   // Results for each step
    tests: VerificationStepResult | null;
    lint: VerificationStepResult | null;
    build: VerificationStepResult | null;
    typecheck: VerificationStepResult | null;
  };
  testSummary?: {              // Test summary (if tests ran)
    passed: number;
    failed: number;
    skipped: number;
    coverage: number;
  };
  lintSummary?: {              // Lint summary (if lint ran)
    errors: number;
    warnings: number;
    autoFixed: number;
  };
  fixAttempts: FixAttempt[];   // All fix attempts made
  finalStatus: 'passed' | 'failed' | 'escalated';
  totalDurationMs: number;     // Total duration
  escalation?: {               // Escalation details (if escalated)
    reason: string;
    failedSteps: VerificationStep[];
    errorLogs: string[];
    attemptedFixes: string[];
    analysis: string;
  };
}
```

### Error Parsing

The agent can parse errors from verification output:

```typescript
const errors = agent.parseErrors('typecheck', typescriptOutput);

for (const error of errors) {
  console.log(`File: ${error.filePath}`);
  console.log(`Line: ${error.line}`);
  console.log(`Code: ${error.code}`);
  console.log(`Message: ${error.message}`);
}
```

### Fix Suggestions

Analyze errors and get fix suggestions:

```typescript
const suggestions = agent.analyzeError('lint', lintOutput);

for (const suggestion of suggestions) {
  console.log(`Type: ${suggestion.type}`);
  console.log(`Description: ${suggestion.description}`);
  console.log(`Command: ${suggestion.command}`);
  console.log(`Confidence: ${suggestion.confidence}%`);
}
```

### Error Handling

```typescript
import {
  EscalationRequiredError,
  CommandTimeoutError,
  TypeCheckError,
  SelfFixError,
  VerificationPipelineError,
} from 'ad-sdlc';

try {
  const report = await agent.runVerificationPipeline('task-001');
} catch (error) {
  if (error instanceof EscalationRequiredError) {
    console.error(`Escalation needed for ${error.taskId}`);
    console.error(`Failed steps: ${error.failedSteps.join(', ')}`);
    console.error(`Total attempts: ${error.totalAttempts}`);
    console.error(`Analysis: ${error.analysis}`);
  } else if (error instanceof CommandTimeoutError) {
    console.error(`Command timed out: ${error.command}`);
    console.error(`Timeout: ${error.timeoutMs}ms`);
  }
}
```

### SelfVerificationAgent Methods

| Method | Description |
|--------|-------------|
| `runVerificationPipeline(taskId)` | Run full verification pipeline |
| `runStep(step)` | Run a single verification step |
| `parseErrors(step, output)` | Parse errors from output |
| `analyzeError(step, output)` | Analyze errors and suggest fixes |
| `allStepsPassed()` | Check if all steps passed |
| `getFixAttempts()` | Get fix attempts from last run |
| `getStepResults()` | Get step results from last run |
| `getConfig()` | Get current configuration |

### Complete Example

```typescript
import { SelfVerificationAgent, EscalationRequiredError } from 'ad-sdlc';

const agent = new SelfVerificationAgent({
  projectRoot: '/path/to/project',
  maxFixIterations: 3,
  autoFixLint: true,
});

try {
  const report = await agent.runVerificationPipeline('WO-001');

  if (report.finalStatus === 'passed') {
    console.log('All verification steps passed!');
    console.log(`Tests: ${report.testSummary?.passed} passed`);
    console.log(`Coverage: ${report.testSummary?.coverage}%`);
  }
} catch (error) {
  if (error instanceof EscalationRequiredError) {
    console.error('Verification failed, escalation required:');
    console.error(`Failed steps: ${error.failedSteps.join(', ')}`);
    console.error(`Analysis: ${error.analysis}`);

    // Send escalation to controller
    await notifyController(error);
  }
}
```

### Integration with WorkerAgent

The SelfVerificationAgent can be used alongside WorkerAgent for enhanced verification:

```typescript
import { WorkerAgent, SelfVerificationAgent } from 'ad-sdlc';

const workerAgent = new WorkerAgent({ projectRoot: '/path/to/project' });
const verificationAgent = new SelfVerificationAgent({
  projectRoot: '/path/to/project',
  maxFixIterations: 3,
});

// After code generation, run enhanced verification
const implementResult = await workerAgent.implement(workOrder, {
  skipVerification: true, // Skip basic verification
});

// Run full self-verification with fix attempts
try {
  const report = await verificationAgent.runVerificationPipeline(
    implementResult.workOrderId
  );

  if (report.finalStatus === 'passed') {
    console.log('Implementation verified successfully');
  }
} catch (error) {
  if (error instanceof EscalationRequiredError) {
    console.error('Need human intervention');
  }
}
```

## RetryHandler

The RetryHandler class provides comprehensive retry mechanism with error categorization, timeout handling, progress checkpointing, and Controller escalation support.

### Basic Usage

```typescript
import { RetryHandler } from 'ad-sdlc';

// Create handler with required configuration
const handler = new RetryHandler({
  workerId: 'worker-001',
  projectRoot: '/path/to/project',
});

// Execute an operation with retry
const result = await handler.executeWithRetry(
  async () => await someOperation(),
  {
    taskId: 'task-001',
    step: 'code_generation',
    workOrder: { id: 'WO-001' },
  }
);

if (result.success) {
  console.log('Operation succeeded:', result.data);
} else {
  console.error('Operation failed:', result.error?.message);
}
```

### Custom Configuration

```typescript
const handler = new RetryHandler({
  workerId: 'worker-001',
  projectRoot: '/path/to/project',
  checkpointPath: '.ad-sdlc/scratchpad/checkpoints',
  retryPolicy: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    backoff: 'exponential',
    maxDelayMs: 30000,
    timeoutMs: 600000, // 10 minutes
    byCategory: {
      transient: { retry: true, maxAttempts: 3 },
      recoverable: { retry: true, maxAttempts: 3, requireFixAttempt: true },
      fatal: { retry: false, escalateImmediately: true },
    },
  },
  onEscalation: async (report) => {
    await notifyController(report);
  },
  onProgress: (checkpoint) => {
    console.log(`Progress: ${checkpoint.currentStep}`);
  },
  verbose: true,
});
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `workerId` | `string` | (required) | Worker identifier |
| `projectRoot` | `string` | (required) | Project root directory |
| `checkpointPath` | `string` | `.ad-sdlc/scratchpad/checkpoints` | Checkpoint storage path |
| `retryPolicy` | `RetryPolicy` | Default policy | Retry configuration |
| `onEscalation` | `(report) => Promise<void>` | `undefined` | Escalation callback |
| `onProgress` | `(checkpoint) => void` | `undefined` | Progress callback |
| `verbose` | `boolean` | `false` | Enable detailed logging |

### Error Categories

The handler categorizes errors for intelligent retry decisions:

| Category | Description | Default Behavior |
|----------|-------------|------------------|
| `transient` | Network issues, timeouts, rate limits | Retry with exponential backoff |
| `recoverable` | Test failures, lint errors, build errors | Attempt self-fix, then retry |
| `fatal` | Missing dependencies, permission denied | Immediate escalation |

### Error Categorization Functions

```typescript
import {
  categorizeError,
  createWorkerErrorInfo,
  isRetryableError,
  requiresEscalation,
  getSuggestedAction,
} from 'ad-sdlc';

const error = new Error('Connection timeout');

// Get error category
const category = categorizeError(error); // 'transient'

// Check if retryable
if (isRetryableError(error)) {
  console.log('Will retry');
}

// Check if escalation needed
if (requiresEscalation(error)) {
  console.log('Need to escalate');
}

// Get suggested action
const suggestion = getSuggestedAction(error, category);
console.log(suggestion); // 'Retry with exponential backoff...'

// Create detailed error info
const errorInfo = createWorkerErrorInfo(error, { taskId: 'task-001' });
console.log(errorInfo.category);      // 'transient'
console.log(errorInfo.retryable);     // true
console.log(errorInfo.suggestedAction);
```

### Progress Checkpointing

The handler creates checkpoints for resume capability:

```typescript
// Create checkpoint
await handler.createCheckpoint('task-001', 'code_generation', 1, {
  filesProcessed: 5,
  currentFile: 'src/Feature.ts',
});

// Load checkpoint (for resume)
const checkpoint = await handler.loadCheckpoint('task-001');
if (checkpoint) {
  console.log(`Resume from: ${checkpoint.currentStep}`);
  console.log(`Attempt: ${checkpoint.attemptNumber}`);
}

// Clear checkpoint (on success)
await handler.clearCheckpoint('task-001');
```

### Escalation Reports

When escalation is needed, a detailed report is generated:

```typescript
interface EscalationReport {
  taskId: string;          // Task identifier
  workerId: string;        // Worker identifier
  error: WorkerErrorInfo;  // Detailed error information
  attempts: RetryAttempt[];// All retry attempts
  context: {
    workOrder: object;     // Original work order
    progressSnapshot: object; // Progress at failure
  };
  recommendation: string;  // Suggested action
  timestamp: string;       // Escalation time
}
```

### Timeout Handling

Operations are automatically wrapped with timeout:

```typescript
const handler = new RetryHandler({
  workerId: 'worker-001',
  projectRoot: '/path/to/project',
  retryPolicy: {
    ...DEFAULT_RETRY_POLICY,
    timeoutMs: 300000, // 5 minutes per operation
  },
});

// Operation will timeout after 5 minutes
const result = await handler.executeWithRetry(
  async () => await longRunningOperation(),
  context
);
```

### RetryHandler Methods

| Method | Description |
|--------|-------------|
| `executeWithRetry(operation, context)` | Execute operation with retry mechanism |
| `createCheckpoint(taskId, step, attempt, snapshot)` | Create progress checkpoint |
| `loadCheckpoint(taskId)` | Load checkpoint for resume |
| `clearCheckpoint(taskId)` | Clear checkpoint (on success) |
| `escalate(taskId, workOrder, error)` | Escalate to Controller |
| `getCurrentCheckpoint()` | Get current checkpoint |
| `getRetryAttempts()` | Get all retry attempts |
| `getConfig()` | Get current configuration |

### Complete Example

```typescript
import { RetryHandler, OperationTimeoutError } from 'ad-sdlc';

const handler = new RetryHandler({
  workerId: 'worker-001',
  projectRoot: '/path/to/project',
  retryPolicy: {
    maxAttempts: 3,
    baseDelayMs: 1000,
    backoff: 'exponential',
    maxDelayMs: 30000,
    timeoutMs: 600000,
    byCategory: {
      transient: { retry: true, maxAttempts: 3 },
      recoverable: { retry: true, maxAttempts: 3, requireFixAttempt: true },
      fatal: { retry: false, escalateImmediately: true },
    },
  },
  onEscalation: async (report) => {
    console.error(`Escalation required for ${report.taskId}`);
    console.error(`Recommendation: ${report.recommendation}`);
    // Notify Controller
    await controllerAgent.handleEscalation(report);
  },
  verbose: true,
});

try {
  const result = await handler.executeWithRetry(
    async () => {
      // Perform code generation
      return await generateCode(workOrder);
    },
    {
      taskId: workOrder.orderId,
      step: 'code_generation',
      workOrder,
    }
  );

  if (result.success) {
    console.log('Code generation completed');
    console.log(`Attempts: ${result.attempts}`);
    console.log(`Duration: ${result.durationMs}ms`);
  }
} catch (error) {
  if (error instanceof OperationTimeoutError) {
    console.error(`Operation timed out after ${error.timeoutMs}ms`);
  }
}
```
