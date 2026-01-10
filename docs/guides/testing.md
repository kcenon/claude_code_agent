# Testing Guide

> Comprehensive guide for running and writing tests for Claude Code Agents

## Overview

This project uses [Vitest](https://vitest.dev/) as the test framework with three testing layers:

| Layer | Purpose | Timeout | Config File |
|-------|---------|---------|-------------|
| Unit Tests | Individual module testing | 15s | `vitest.config.ts` |
| Integration Tests | Cross-module interactions | 30s | `vitest.integration.config.ts` |
| E2E Tests | Complete pipeline validation | 120s | `vitest.e2e.config.ts` |

## Running Tests

### All Tests

```bash
# Run all unit tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Integration Tests

```bash
npm run test:integration
```

### E2E Tests

```bash
npm run test:e2e
```

### Specific Test Files

```bash
# Run specific test file
npm run test -- --run tests/collector/CollectorAgent.test.ts

# Run E2E tests for specific module
npm run test:e2e -- --run tests/e2e/analysis-pipeline/
```

## Test Structure

### Directory Layout

```
tests/
├── <module-name>/              # Unit tests mirroring src/
│   ├── <Agent>.test.ts
│   └── errors.test.ts
├── integration/                # Cross-module tests
│   └── security.integration.test.ts
└── e2e/                        # End-to-end tests
    ├── helpers/                # Shared test utilities
    │   ├── fixtures.ts
    │   ├── test-environment.ts
    │   ├── pipeline-runner.ts
    │   ├── verification.ts
    │   └── github-mock.ts      # GitHub API mock server
    ├── fixtures/               # Test fixtures
    │   └── scalability-fixtures.ts
    ├── analysis-pipeline/      # Analysis Pipeline E2E
    │   ├── analysis-fixtures.ts
    │   └── analysis-pipeline.e2e.test.ts
    ├── enhancement-pipeline/   # Enhancement Pipeline E2E
    │   ├── enhancement-fixtures.ts
    │   └── enhancement-pipeline.e2e.test.ts
    ├── pipelines/              # Pipeline integration E2E
    │   ├── greenfield-github.e2e.test.ts
    │   └── worker-failure.e2e.test.ts
    ├── scalability/            # Scalability E2E
    │   └── scalability.e2e.test.ts
    ├── pipeline.e2e.test.ts
    ├── recovery.e2e.test.ts
    ├── error-recovery-edge-cases.e2e.test.ts  # Error recovery & edge cases
    └── orchestration.e2e.test.ts
```

## Analysis Pipeline E2E Tests

The Analysis Pipeline E2E tests validate the complete flow:

```
Document Reader → Code Reader → Comparator → Issue Generator
```

### Test Scenarios

| Scenario | Description |
|----------|-------------|
| Full Pipeline | Complete analysis with docs and code |
| Document-Only | Analyze only documentation |
| Code-Only | Analyze only source code |
| Gap Detection | Identify discrepancies between docs and code |
| Issue Generation | Create issues from detected gaps |
| Error Recovery | Handle failures gracefully |

### Running Analysis Pipeline Tests

```bash
npm run test:e2e -- --run tests/e2e/analysis-pipeline/
```

### Test Fixtures

The analysis pipeline uses custom fixtures that create mini projects with:

- **Documents**: PRD, SRS, SDS files in `docs/` directory
- **Source Code**: TypeScript files in `src/` directory
- **Gap Scenarios**: Documented features without implementation

```typescript
import { createAnalysisFixture } from './analysis-fixtures.js';

const fixture = await createAnalysisFixture({
  name: 'my-test',
  includeGaps: true,        // Add documented but unimplemented features
  includeOrphanCode: true,  // Add undocumented code
});
```

## Enhancement Pipeline E2E Tests

The Enhancement Pipeline E2E tests validate incremental updates to existing projects:

```
Mode Detection → Document Reading → Impact Analysis
```

### Test Scenarios

| Scenario | Description |
|----------|-------------|
| Mode Detection | Detect greenfield vs enhancement mode |
| Document Reading | Read and parse PRD/SRS/SDS documents |
| Simple Feature Addition | Add isolated new features |
| Requirement Modification | Modify existing requirements |
| Multi-Component Change | Changes affecting multiple components |
| Error Handling | Graceful error recovery |
| Session Management | Session lifecycle tracking |
| Performance | Timing benchmarks for each stage |

### Running Enhancement Pipeline Tests

```bash
npm run test:e2e -- --run tests/e2e/enhancement-pipeline/
```

### Test Fixtures

The enhancement pipeline uses fixtures simulating existing e-commerce projects:

- **Documents**: PRD, SRS, SDS with linked requirements (FR-###)
- **Source Code**: AuthService, ProductService, CartService, OrderService, UserService
- **Build System**: package.json with scripts

```typescript
import { createEnhancementFixture, createCodeOnlyFixture } from './enhancement-fixtures.js';

// Full project with docs and code
const fixture = await createEnhancementFixture({
  name: 'my-test',
  includeTests: true,     // Include test files
  partialDocs: false,     // Include all doc types
  partialCode: false,     // Include all source files
});

// Code-only project (no docs)
const codeOnlyFixture = await createCodeOnlyFixture('code-test');
```

### ModeDetector Thresholds

Note that `ModeDetector` requires:
- **minSourceFiles**: 5+ source files for `codebase.exists = true`
- **minLinesOfCode**: 100+ lines for substantial codebase detection

Fixtures must provide sufficient source files to meet these thresholds.

## Error Recovery and Edge Cases E2E Tests

The error recovery and edge cases tests ensure the system handles failures gracefully and can recover from unexpected situations.

### Test Categories

| Category | Description |
|----------|-------------|
| Error Injection | Tests for API rate limiting, network timeout, invalid input handling |
| Edge Cases | Empty input, large documents (100+ requirements), circular dependencies, unicode |
| Recovery Tests | Mid-pipeline restart, partial completion resume, checkpoint restoration |
| Graceful Degradation | Missing dependencies, resource exhaustion, fallback behavior |

### Running Error Recovery Tests

```bash
npm run test:e2e -- --run tests/e2e/error-recovery-edge-cases.e2e.test.ts
```

### Test Scenarios

#### Error Injection Tests

- **API Rate Limiting**: Validates `RateLimiter` behavior when limits are exceeded
- **Network Timeout Recovery**: Tests handling of long-running operations
- **Invalid Input Handling**: Tests for null-like inputs, special characters, control characters
- **Malformed Document Recovery**: Tests for corrupted YAML, empty files, binary content

#### Edge Case Tests

- **Empty Input**: Empty string, whitespace-only, newline-only input
- **Large Documents**: Documents with 100+ requirements
- **Circular Dependencies**: Detection using `DependencyGraphBuilder`
- **Unicode Handling**: CJK characters, emojis, RTL text, special symbols

#### Recovery Tests

- **Mid-Pipeline Restart**: Detecting incomplete pipeline state
- **Partial Completion Resume**: Identifying completed stages from filesystem
- **Checkpoint Restoration**: Creating and restoring checkpoints after each stage

#### Graceful Degradation Tests

- **Missing Dependencies**: Handling missing scratchpad directories
- **Concurrent Operations**: Multiple operations running simultaneously
- **Error Message Quality**: Clear and informative error messages

## Scalability E2E Tests

The scalability tests validate system behavior under scale conditions.

### Test Scenarios

| Scenario | Description |
|----------|-------------|
| Large Issue Set | Generate and handle 100+ issues |
| Large Project Structure | Create projects with many files |
| Memory Usage | Monitor memory during processing |
| Concurrent Operations | Parallel execution handling |
| Performance Benchmarks | Timing benchmarks for operations |

### Running Scalability Tests

```bash
npm run test:e2e -- --run tests/e2e/scalability/
```

### Scalability Fixtures

```typescript
import { generateLargeIssueSet, createLargeProject } from './fixtures/scalability-fixtures.js';

// Generate 100 issues with dependencies
const issues = generateLargeIssueSet(100);

// Create large project structure
await createLargeProject({
  baseDir: '/tmp/test-project',
  issueCount: 100,
  componentCount: 10,
  sourceFileCount: 50,
});
```

## GitHub Integration E2E Tests

The GitHub integration tests validate pipeline interactions with GitHub API using a mock server.

### Test Scenarios

| Scenario | Description |
|----------|-------------|
| Issue Creation | Create issues via GitHub API |
| Pull Request Flow | Create, review, and merge PRs |
| CI Check Status | Retrieve and handle CI status |
| Error Handling | Handle API failures gracefully |
| Retry Logic | Transient failure recovery |

### Running GitHub Integration Tests

```bash
npm run test:e2e -- --run tests/e2e/pipelines/
```

### GitHub Mock Server

The `GitHubMock` class provides a mock HTTP server for GitHub API:

```typescript
import { GitHubMock, createTestGitHubMock } from './helpers/github-mock.js';

// Create and start mock server
const githubMock = createTestGitHubMock();
await githubMock.start();

// Simulate failures
githubMock.simulateFailure('create_pr', {
  times: 2,
  statusCode: 503,
  errorMessage: 'Service temporarily unavailable',
});

// Add mock data
githubMock.addIssue({
  number: 1,
  title: 'Test Issue',
  body: 'Test body',
  state: 'open',
  labels: [],
  assignees: [],
});

// Stop server
await githubMock.stop();
```

### Supported Endpoints

| Endpoint | Methods | Description |
|----------|---------|-------------|
| `/repos/:owner/:repo/issues` | GET, POST | List and create issues |
| `/repos/:owner/:repo/issues/:number` | GET | Get single issue |
| `/repos/:owner/:repo/pulls` | GET, POST | List and create PRs |
| `/repos/:owner/:repo/pulls/:number` | GET | Get single PR |
| `/repos/:owner/:repo/pulls/:number/merge` | PUT | Merge PR |
| `/repos/:owner/:repo/commits/:sha/check-runs` | GET | Get check runs |

## Worker Failure E2E Tests

Tests for worker execution failure handling and recovery.

### Test Scenarios

| Scenario | Description |
|----------|-------------|
| Transient Failures | Retry and recover from temporary failures |
| Permanent Failures | Fail fast on non-recoverable errors |
| Rate Limiting | Handle 429 errors appropriately |
| Parallel Failures | Isolate failures between workers |
| Recovery State | Track retry attempts and state |

### Running Worker Failure Tests

```bash
npm run test:e2e -- --run tests/e2e/pipelines/worker-failure.e2e.test.ts
```

## Writing Tests

### Unit Test Pattern

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('MyAgent', () => {
  let agent: MyAgent;

  beforeEach(() => {
    agent = new MyAgent();
  });

  afterEach(() => {
    resetMyAgent();
  });

  it('should perform expected action', async () => {
    const result = await agent.doSomething();
    expect(result.success).toBe(true);
  });
});
```

### E2E Test Pattern

```typescript
import { createAnalysisFixture, type AnalysisTestFixture } from './analysis-fixtures.js';

describe('E2E Test', () => {
  let fixture: AnalysisTestFixture;

  beforeEach(async () => {
    fixture = await createAnalysisFixture({ name: 'test' });
  });

  afterEach(async () => {
    await fixture.cleanup();
  });

  it('should complete pipeline', async () => {
    const agent = new AnalysisOrchestratorAgent();
    await agent.startAnalysis({ projectPath: fixture.rootDir });
    const result = await agent.execute();
    expect(result.success).toBe(true);
  });
});
```

## Best Practices

1. **Isolation**: Each test creates fresh temporary directories
2. **Cleanup**: Always cleanup resources in `afterEach`
3. **Reset Agents**: Call reset functions for singleton agents
4. **Async/Await**: Use async patterns consistently
5. **Descriptive Names**: Use clear test descriptions
6. **Timeout Awareness**: Long operations may need increased timeouts

## Coverage Requirements

| Metric | Minimum |
|--------|---------|
| Lines | 80% |
| Functions | 78% |
| Branches | 72% |
| Statements | 80% |

Run coverage report:

```bash
npm run test:coverage
```

---

*Part of [Claude Code Agent Documentation](../README.md)*
