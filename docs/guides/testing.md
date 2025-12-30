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
    │   └── verification.ts
    ├── analysis-pipeline/      # Analysis Pipeline E2E
    │   ├── analysis-fixtures.ts
    │   └── analysis-pipeline.e2e.test.ts
    ├── pipeline.e2e.test.ts
    ├── recovery.e2e.test.ts
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
