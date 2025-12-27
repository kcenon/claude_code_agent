# Worker Module

The worker module provides code generation, test writing, and self-verification functionality for the Worker Agent.

## Overview

The module includes:

- **WorkerAgent** - Main class that processes Work Orders to implement code changes
- **TestGenerator** - Generates comprehensive unit tests from source code
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
  DEFAULT_WORKER_AGENT_CONFIG,
  DEFAULT_CODE_PATTERNS,
  DEFAULT_RETRY_POLICY,
  DEFAULT_TEST_GENERATOR_CONFIG,
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
