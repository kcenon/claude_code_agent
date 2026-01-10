# Error Handling

> **Version**: 1.0.0
> **Module**: `src/errors`

## Overview

The AD-SDLC system provides a standardized error handling library that all modules extend. This ensures consistent error reporting, serialization, and recovery across the entire system.

## Table of Contents

1. [Architecture](#architecture)
2. [AppError Base Class](#apperror-base-class)
3. [Error Codes](#error-codes)
4. [Error Categories](#error-categories)
5. [Module Errors](#module-errors)
6. [Usage Examples](#usage-examples)
7. [Error Handler Utility](#error-handler-utility)

---

## Architecture

```
src/errors/
├── index.ts          # Module exports
├── types.ts          # Type definitions (ErrorSeverity, ErrorCategory)
├── codes.ts          # Error code registry
├── AppError.ts       # Base error class
└── handler.ts        # ErrorHandler utility

Module Error Classes:
├── src/controller/errors.ts    → ControllerError extends AppError
├── src/worker/errors.ts        → WorkerError extends AppError
├── src/state-manager/errors.ts → StateManagerError extends AppError
└── src/pr-reviewer/errors.ts   → PRReviewerError extends AppError
```

---

## AppError Base Class

All application errors extend `AppError`, which provides:

- **Error codes**: Namespaced identifiers (e.g., `CTL-001`, `WRK-020`)
- **Severity levels**: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- **Categories**: `transient`, `recoverable`, `fatal`
- **Serialization**: `toJSON()` / `fromJSON()` for persistence
- **Formatting**: `format('log' | 'cli' | 'json')`
- **Retry logic**: `isRetryable()`, `requiresEscalation()`

### Constructor

```typescript
new AppError(code: string, message: string, options?: AppErrorOptions)

interface AppErrorOptions {
  severity?: ErrorSeverity;
  category?: ErrorCategory;
  context?: Record<string, unknown>;
  cause?: Error;
}
```

### Example

```typescript
import { AppError, ErrorCodes, ErrorSeverity } from './errors/index.js';

const error = new AppError(
  ErrorCodes.CTL_GRAPH_NOT_FOUND,
  'Dependency graph file not found',
  {
    severity: ErrorSeverity.HIGH,
    category: 'fatal',
    context: { path: '/path/to/graph.json' }
  }
);

console.log(error.format('log'));
// Output: [CTL-001] Dependency graph file not found

console.log(error.isRetryable());
// Output: false (fatal errors are not retryable)
```

---

## Error Codes

Error codes follow a namespaced pattern: `MODULE-NNN`

### Code Namespaces

| Prefix | Module | Range |
|--------|--------|-------|
| `CTL` | Controller | CTL-001 to CTL-099 |
| `WRK` | Worker | WRK-001 to WRK-099 |
| `STM` | State Manager | STM-001 to STM-099 |
| `PRR` | PR Reviewer | PRR-001 to PRR-099 |
| `GEN` | General | GEN-001 to GEN-099 |

### Using Error Codes

```typescript
import { ErrorCodes } from './errors/index.js';

// Error codes are typed constants
const code = ErrorCodes.CTL_GRAPH_NOT_FOUND;  // 'CTL-001'
const code2 = ErrorCodes.WRK_VERIFICATION_ERROR;  // 'WRK-040'
```

---

## Error Categories

Errors are categorized to determine handling strategy:

| Category | Meaning | Retryable | Examples |
|----------|---------|-----------|----------|
| `transient` | Temporary failures | Yes | Network timeout, rate limit |
| `recoverable` | Can be fixed and retried | Yes | Test failures, lint errors |
| `fatal` | Unrecoverable | No | Missing dependencies, invalid config |

---

## Module Errors

Each module defines its own error hierarchy extending the base class.

### Controller Errors

```typescript
import {
  GraphNotFoundError,
  CircularDependencyError,
  IssueNotFoundError
} from './controller/errors.js';

// Specific error with context
throw new GraphNotFoundError('/path/to/graph.json');
// Error code: CTL-001, Category: fatal

throw new CircularDependencyError(['A', 'B', 'C', 'A']);
// Message: "Circular dependency detected: A -> B -> C -> A"
```

### Worker Errors

```typescript
import {
  VerificationError,
  MaxRetriesExceededError,
  ImplementationBlockedError
} from './worker/errors.js';

// Recoverable verification error
throw new VerificationError('test', 'Test assertions failed');
// Error code: WRK-040, Category: recoverable

// Fatal blocked error
throw new ImplementationBlockedError('ISS-001', ['ISS-002', 'ISS-003']);
// Category: fatal (dependencies not met)
```

### State Manager Errors

```typescript
import {
  InvalidTransitionError,
  ProjectNotFoundError,
  CheckpointNotFoundError
} from './state-manager/errors.js';

throw new InvalidTransitionError('collecting', 'merged', 'project-001');
// Message: "Invalid state transition from 'collecting' to 'merged'"
```

### PR Reviewer Errors

```typescript
import {
  PRCreationError,
  CICheckFailedError,
  QualityGateFailedError
} from './pr-reviewer/errors.js';

throw new CICheckFailedError(123, ['tests', 'lint']);
// Message: "CI checks failed for PR #123: tests, lint"
```

---

## Usage Examples

### Throwing Module Errors

```typescript
import { WorkerError, ErrorCodes, ErrorSeverity } from './worker/errors.js';

function processWorkOrder(order: WorkOrder): void {
  if (!order.issueId) {
    throw new WorkerError(
      ErrorCodes.WRK_WORK_ORDER_PARSE_ERROR,
      'Work order missing issueId',
      { context: { orderId: order.orderId } }
    );
  }
}
```

### Catching and Handling Errors

```typescript
import { AppError, ErrorHandler } from './errors/index.js';

try {
  await processWorkOrder(order);
} catch (error) {
  const appError = AppError.normalize(error);

  if (appError.isRetryable()) {
    // Retry logic
    console.log('Retrying...', appError.format('log'));
  } else {
    // Escalate fatal errors
    ErrorHandler.handle(error, {
      rethrow: true,
      output: 'stderr'
    });
  }
}
```

### Error Serialization

```typescript
// Serialize for storage/transmission
const json = error.toJSON();
await saveError(json);

// Restore from JSON
const restored = AppError.fromJSON(json);
console.log(restored.code);  // Original error code preserved
```

---

## Error Handler Utility

The `ErrorHandler` class provides centralized error handling utilities:

### Methods

| Method | Description |
|--------|-------------|
| `handle(error, options)` | Log and optionally rethrow error |
| `categorize(error)` | Determine error category |
| `isRetryable(error)` | Check if error can be retried |
| `createErrorInfo(error)` | Create extended error info object |
| `assert(condition, code, message)` | Assert with typed error |

### Example Usage

```typescript
import { ErrorHandler, ErrorCodes } from './errors/index.js';

// Assert with automatic error creation
ErrorHandler.assert(
  config.basePath !== undefined,
  ErrorCodes.GEN_INVALID_ARGUMENT,
  'basePath is required'
);

// Centralized error handling
const appError = ErrorHandler.handle(unknownError, {
  output: 'stderr',
  rethrow: false
});

// Check if error should be retried
if (ErrorHandler.isRetryable(error)) {
  await retryOperation();
}
```

---

## Best Practices

1. **Use specific error classes** instead of generic `AppError` when available
2. **Include context** with relevant debugging information
3. **Check retryability** before implementing retry logic
4. **Serialize errors** for persistence in work order results
5. **Use ErrorHandler.assert** for precondition checks
6. **Log with format('log')** for consistent log output

---

## Migration Guide

When migrating from legacy error handling:

```typescript
// Before: Generic Error
throw new Error('Graph not found: /path/to/file');

// After: Specific AppError
import { GraphNotFoundError } from './controller/errors.js';
throw new GraphNotFoundError('/path/to/file');
```

The new approach provides:
- Type-safe error codes
- Consistent serialization
- Category-based retry logic
- Structured context for debugging
