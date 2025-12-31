# ADR-003: Runtime JSON Schema Validation with Zod

**Status**: Accepted

**Date**: 2025-12-31

**Decision Makers**: Developer, Code Reviewer

---

## Context

Throughout the codebase, there were approximately 30+ locations using the unsafe pattern:

```typescript
const data = JSON.parse(jsonString) as SomeType;
```

This pattern has several problems:

1. **No runtime validation**: TypeScript's type assertion (`as T`) provides no runtime safety. Invalid data silently passes through.
2. **Silent failures**: Malformed data from external sources (GitHub CLI, npm audit, etc.) could cause subtle bugs.
3. **No error context**: When parsing fails, error messages lack context about what was being parsed.
4. **Inconsistent handling**: Each location handled parsing errors differently.

---

## Decision

Implement a centralized `SafeJsonParser` utility using Zod schemas for runtime JSON validation.

### Key Components

1. **SafeJsonParser utility** (`src/utils/SafeJsonParser.ts`)
   - `safeJsonParse<T>()` - Validates JSON against schema, throws on failure
   - `tryJsonParse<T>()` - Returns `undefined` on failure (graceful degradation)
   - `safeJsonParseFile<T>()` / `safeJsonParseFileSync<T>()` - File-based parsing
   - `lenientSchema()` / `partialSchema()` - Schema helpers

2. **Custom Error Classes**
   - `JsonValidationError` - Schema validation failures with field-level details
   - `JsonSyntaxError` - JSON syntax errors with context

3. **Centralized Schemas** (`src/schemas/`)
   - `github.ts` - GitHub CLI response schemas
   - `common.ts` - Common data structures (locks, states, logs, etc.)

### Usage Pattern

```typescript
// Before (unsafe)
const pr = JSON.parse(result.stdout) as GitHubPRData;

// After (safe)
import { safeJsonParse } from '../utils/SafeJsonParser.js';
import { GitHubPRDataSchema } from '../schemas/github.js';

const pr = safeJsonParse(result.stdout, GitHubPRDataSchema, {
  context: 'gh pr view output'
});
```

---

## Consequences

### Positive

- **Runtime type safety**: Invalid data is caught immediately with descriptive errors
- **Consistent error handling**: All JSON parsing uses the same error patterns
- **Better debugging**: Errors include context, field paths, and schema names
- **Schema reuse**: Common schemas can be shared across the codebase
- **Lenient parsing**: External API responses tolerate unknown fields via `.loose()`

### Negative

- **Bundle size**: Zod adds ~13KB minified/gzipped to the bundle
- **Schema maintenance**: Schemas must be kept in sync with expected data shapes
- **Migration effort**: Existing code required updates (completed in this PR)

### Neutral

- **Learning curve**: Developers need to understand Zod schema syntax
- **Type inference**: TypeScript types are now inferred from schemas (single source of truth)

---

## Alternatives Considered

### 1. io-ts

- **Pros**: Functional approach, good TypeScript integration
- **Cons**: Steeper learning curve, more verbose syntax

### 2. ajv (JSON Schema)

- **Pros**: Standard JSON Schema, widely used
- **Cons**: Less TypeScript-native, requires separate type definitions

### 3. Manual validation

- **Pros**: No dependencies
- **Cons**: Tedious, error-prone, no type inference

### Decision Rationale

Zod was chosen for:
- Excellent TypeScript integration with type inference
- Simple, fluent API
- Active community and maintenance
- Already a dependency in the project

---

## Related

- GitHub Issue: [#192 - Add Runtime JSON Schema Validation with Zod](https://github.com/kcenon/claude_code_agent/issues/192)
- Files Modified: See commit history on `refactor/192-zod-json-schema-validation` branch

---

## Notes

The migration covered:
- PR Reviewer modules (PRCreator, PRReviewerAgent, MergeDecision, ReviewChecks)
- Controller modules (WorkerPoolManager, ProgressMonitor)
- Worker modules (RetryHandler)
- Monitoring modules (Logger, AuditLogger)
- Scratchpad module

Some files with custom validation logic (e.g., `PriorityAnalyzer.validateGraph()`) were intentionally left unchanged as they have specialized validation needs.

---

## Implementation Notes (2025-12-31 Update)

### Zod 4.x Breaking Changes

The `z.record()` API changed in Zod 4.x:

```typescript
// Zod 3.x (deprecated)
z.record(z.string())  // key type was implicit

// Zod 4.x (current)
z.record(z.string(), z.string())  // explicit key and value schemas
```

All schemas using `z.record()` were updated to use the 2-argument form.

### Internal vs External Data Validation

**Key Distinction**: Schema validation is primarily valuable for **external data** where shape is unknown:

| Data Source | Validation Approach | Rationale |
|-------------|-------------------|-----------|
| GitHub CLI output | `safeJsonParse()` with schema | External API, shape may change |
| npm audit output | `safeJsonParse()` with schema | External tool output |
| File-based state persistence | `JSON.parse() as T` | Internal data, saved by the same class |
| Checkpoint files | `JSON.parse() as T` | Internal data format |

For internal data (state files written and read by the same class), schema validation adds overhead without benefit since the data format is controlled by the application.

### TypeScript `exactOptionalPropertyTypes` Compatibility

When using `exactOptionalPropertyTypes: true` in TypeScript config:

- Zod's `.optional()` produces `T | undefined`
- TypeScript's `prop?: T` means "T if present, but not undefined"

**Solution**: Use explicit `prop: T | undefined` instead of `prop?: T` when the property may explicitly hold `undefined`:

```typescript
// Instead of:
public readonly context?: string;

// Use:
public readonly context: string | undefined;
```

### Schema-Interface Alignment

Ensure Zod schemas match existing TypeScript interfaces. When schemas and interfaces diverge:

1. **Option A**: Update schema to match interface (preferred for external data)
2. **Option B**: Use `JSON.parse() as T` for internal data (preferred for internal persistence)

The choice depends on whether runtime validation provides value for the specific use case.
