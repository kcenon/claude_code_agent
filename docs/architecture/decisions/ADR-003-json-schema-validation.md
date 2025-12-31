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
