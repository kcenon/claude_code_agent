# ADR-0004: Error Classification and Retry Strategy

## Status

Accepted

## Date

2024-03-01

## Context

The AD-SDLC system performs long-running operations that can fail for various reasons:

- **Transient failures**: Network timeouts, rate limits, temporary service unavailability
- **Recoverable failures**: Test failures, lint errors, compilation issues
- **Fatal failures**: Missing dependencies, permission denied, invalid configuration

Without a systematic approach:
- All errors trigger immediate failure, wasting recoverable work
- Retry logic is inconsistent across modules
- Error messages lack context for debugging
- No clear escalation path when retries exhaust

## Decision

Implement a **three-tier error classification system** with category-specific retry strategies:

### Error Categories

| Category | Description | Retryable | Strategy |
|----------|-------------|-----------|----------|
| `transient` | Temporary external failures | Yes | Retry with exponential backoff |
| `recoverable` | Fixable errors | Yes | Attempt self-fix, then retry |
| `fatal` | Unrecoverable failures | No | Fail fast, escalate immediately |

### AppError Base Class

All application errors extend `AppError`:

```typescript
class AppError extends Error {
  readonly code: string;           // e.g., 'WRK-040'
  readonly severity: ErrorSeverity; // LOW, MEDIUM, HIGH, CRITICAL
  readonly category: ErrorCategory; // transient, recoverable, fatal
  readonly context: Record<string, unknown>;
  readonly cause?: Error;

  isRetryable(): boolean;
  requiresEscalation(): boolean;
  toJSON(): SerializedError;
  format(style: 'log' | 'cli' | 'json'): string;
}
```

### Error Code Namespaces

| Prefix | Module | Example |
|--------|--------|---------|
| `CTL` | Controller | `CTL-001` Graph not found |
| `WRK` | Worker | `WRK-040` Verification failed |
| `STM` | State Manager | `STM-010` Invalid transition |
| `PRR` | PR Reviewer | `PRR-020` CI check failed |

### Retry Policy Configuration

```typescript
const retryPolicy: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  backoff: 'exponential',
  maxDelayMs: 30000,
  jitter: true,
  byCategory: {
    transient: { retry: true, maxAttempts: 5 },
    recoverable: { retry: true, maxAttempts: 3, requireFixAttempt: true },
    fatal: { retry: false, escalateImmediately: true },
  },
};
```

### Self-Fix Mechanism (Recoverable Errors)

For recoverable errors like lint failures:

```typescript
// Worker detects recoverable error
if (error.category === 'recoverable' && error.code === 'WRK-040') {
  // Attempt automatic fix
  await runCommand('npm run lint -- --fix');
  // Retry operation
  await verifyImplementation();
}
```

## Consequences

### Positive

- **Reduced manual intervention**: Transient errors auto-recover without human involvement
- **Clear error semantics**: Categories make retry decisions obvious
- **Consistent error handling**: All modules follow same patterns
- **Debuggable**: Error codes + context enable quick root cause analysis
- **Serializable**: Errors persist to work order results for later inspection
- **Self-healing**: Recoverable errors trigger automated fixes

### Negative

- **Classification complexity**: Must correctly categorize each error type
- **Retry delays**: Transient errors delay overall pipeline completion
- **Fix limitations**: Not all recoverable errors can be auto-fixed
- **Code overhead**: Every throw site must use appropriate error class

### Neutral

- **Error registry maintenance**: New error types require registry updates
- **Metrics opportunity**: Error codes enable aggregation and alerting

## Alternatives Considered

### Alternative 1: Retry Everything

**Description:** Retry all errors with exponential backoff, regardless of type.

**Pros:**
- Simple implementation
- Handles transient errors automatically
- No classification needed

**Cons:**
- Wastes time retrying fatal errors
- Delays reporting of unrecoverable issues
- No opportunity for targeted fixes

**Why rejected:** Retrying fatal errors (e.g., missing dependency) will never succeed. The system should fail fast on truly unrecoverable situations to save user time.

### Alternative 2: Never Retry (Fail Fast)

**Description:** Treat all errors as fatal and report immediately.

**Pros:**
- Fast feedback on any failure
- Simple error handling
- No complex retry logic

**Cons:**
- Transient failures cause unnecessary pipeline restarts
- Network blips disrupt long-running operations
- Poor user experience with intermittent issues

**Why rejected:** Long-running pipelines (hours) shouldn't fail due to a 5-second network timeout. Automatic retry for transient issues significantly improves reliability.

### Alternative 3: Generic Error with Tags

**Description:** Use a single error type with runtime tags for categorization.

**Pros:**
- Simpler class hierarchy
- Flexible tagging
- Easy to add new categories

**Cons:**
- No compile-time type safety
- Easy to misspell tags
- Category logic scattered across codebase

**Why rejected:** TypeScript's type system can enforce correct error usage. Specific error classes (e.g., `VerificationError`) provide better IDE support and documentation.

### Alternative 4: Circuit Breaker Only

**Description:** Use circuit breaker pattern without error categorization.

**Pros:**
- Prevents cascade failures
- Simple on/off semantics
- Good for external service protection

**Cons:**
- Doesn't distinguish error types
- Binary state (open/closed) too coarse
- Doesn't help with self-fixing errors

**Why rejected:** Circuit breaker is useful for external services but doesn't address the need to handle different error types differently. We use circuit breaker *in addition to* error classification for external API calls.

## References

- Related code: `src/errors/AppError.ts`
- Related code: `src/errors/codes.ts`
- Related documentation: `docs/error-handling.md`
- Related code: `src/error-handler/RetryHandler.ts`
- Related code: `src/error-handler/CircuitBreaker.ts`
