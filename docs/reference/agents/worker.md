# Worker Agent Reference

> **Agent ID**: `worker`
> **Model**: Sonnet
> **Category**: Execution Pipeline

## Overview

The Worker Agent implements code based on GitHub issues. It generates source code, writes unit tests, and performs self-verification (test, lint, build) before creating commits.

---

## Configuration

### Agent Definition

**Location**: `.claude/agents/worker.md`

```markdown
---
name: worker
description: |
  Implements code for assigned issues.
  Generates tests and verifies implementation.
  Creates feature branches and commits.
tools: Read, Write, Edit, Bash, Grep, Glob, LSP
model: sonnet
---
```

### YAML Configuration

```yaml
# .ad-sdlc/config/agents.yaml
worker:
  id: "worker"
  name: "Worker Agent"
  model: sonnet
  timeout: 1800000  # 30 minutes
  max_retries: 3

  capabilities:
    - code_generation
    - test_writing
    - self_verification
    - git_operations

  tools:
    - Read
    - Write
    - Edit
    - Bash
    - Grep
    - Glob
    - LSP

  verification:
    run_tests: true
    run_lint: true
    run_build: true
    coverage_threshold: 80

  git:
    branch_prefix: "feature/"
    commit_style: "conventional"
```

---

## Input

### Source

Work orders from Controller via scratchpad and GitHub issue details.

### Work Order Schema

```yaml
# .ad-sdlc/scratchpad/{project}/progress/work_orders.yaml
work_orders:
  - id: "WO-001"
    issue_number: 42
    issue_url: "https://github.com/org/repo/issues/42"
    title: "Implement user authentication service"
    priority: "P0"
    dependencies: []
    assigned_at: "2025-01-01T00:00:00Z"
    status: "assigned"

    # From SDS
    component_id: "CMP-001"
    component_name: "AuthService"

    # Implementation hints
    suggested_files:
      - "src/services/auth.ts"
      - "src/services/auth.test.ts"

    acceptance_criteria:
      - "User can register with email/password"
      - "User can login and receive JWT token"
      - "Invalid credentials return 401 error"
```

### GitHub Issue Content

```markdown
## Description
Implement the AuthService component for user authentication.

## Acceptance Criteria
- [ ] User can register with email/password
- [ ] User can login and receive JWT token
- [ ] Invalid credentials return 401 error

## Technical Notes
- Use bcrypt for password hashing
- JWT expiry: 24 hours
- Implement refresh token mechanism

## SDS Reference
Component: CMP-001 (AuthService)
API: API-001 (/api/auth/*)
```

---

## Output

### Generated Artifacts

| Artifact | Location | Description |
|----------|----------|-------------|
| Source Code | `src/**/*.ts` | Implementation files |
| Unit Tests | `tests/**/*.test.ts` | Test files |
| Git Branch | `feature/{issue-number}-*` | Feature branch |
| Git Commit | - | Conventional commit |

### Implementation Result

```yaml
# .ad-sdlc/scratchpad/{project}/progress/implementation_results.yaml
results:
  - work_order_id: "WO-001"
    issue_number: 42
    status: "success"
    completed_at: "2025-01-01T01:00:00Z"

    branch: "feature/42-implement-auth-service"
    commits:
      - sha: "abc123"
        message: "feat(auth): implement AuthService with JWT"

    files_created:
      - path: "src/services/auth.ts"
        lines: 150
      - path: "src/services/auth.test.ts"
        lines: 200
      - path: "src/types/auth.ts"
        lines: 30

    verification:
      tests:
        passed: 12
        failed: 0
        coverage: 85.5
      lint:
        errors: 0
        warnings: 2
      build:
        success: true
        duration_ms: 3500

    ready_for_pr: true
```

---

## Behavior

### Processing Steps

1. **Issue Analysis**
   - Fetch issue details from GitHub
   - Parse acceptance criteria
   - Understand technical requirements

2. **Codebase Understanding**
   - Analyze existing code structure
   - Identify patterns and conventions
   - Find related modules and dependencies

3. **Implementation Planning**
   - Determine files to create/modify
   - Plan implementation approach
   - Consider edge cases

4. **Code Generation**
   - Create/modify source files
   - Follow existing code style
   - Implement all acceptance criteria

5. **Test Writing**
   - Generate unit tests for new code
   - Cover happy path and edge cases
   - Aim for >80% coverage

6. **Self-Verification**
   ```bash
   npm test          # Run tests
   npm run lint      # Run linter
   npm run build     # Verify build
   ```

7. **Git Operations**
   - Create feature branch
   - Stage changes
   - Create conventional commit

8. **Result Reporting**
   - Write implementation result to scratchpad
   - Update work order status

### Retry Logic

```typescript
interface RetryConfig {
  maxAttempts: 3;
  backoffBase: 5000;      // 5 seconds
  backoffMax: 60000;      // 1 minute
  retryableErrors: [
    'test_failure',       // Tests failed - fix and retry
    'lint_error',         // Lint errors - fix and retry
    'build_error'         // Build errors - fix and retry
  ];
}
```

### Decision Points

| Situation | Decision |
|-----------|----------|
| Tests fail | Analyze failure, fix code, retry |
| Lint errors | Auto-fix if possible, manual fix otherwise |
| Build error | Analyze error, fix imports/types, retry |
| Complex issue | Request Opus model escalation |
| Unclear requirements | Add TODO comments, proceed with best guess |

---

## Error Handling

### Recoverable Errors

| Error | Recovery Action |
|-------|-----------------|
| Test failure | Analyze, fix, retry (max 3 attempts) |
| Lint error | Auto-fix or manual fix, retry |
| Build error | Fix type/import errors, retry |
| Git conflict | Fetch latest, rebase, retry |

### Non-Recoverable Errors

| Error | User Action Required |
|-------|---------------------|
| Max retries exceeded | Review issue, provide clarification |
| Missing dependencies | Install required packages |
| Permission denied | Check file/git permissions |
| Issue not found | Verify issue number exists |

### Error Output

```yaml
# On failure
results:
  - work_order_id: "WO-001"
    issue_number: 42
    status: "failed"
    failed_at: "2025-01-01T01:00:00Z"

    error:
      type: "verification_failed"
      stage: "test"
      message: "3 tests failed after 3 retry attempts"
      details:
        - test: "AuthService.login should reject invalid password"
          error: "Expected 401, got 500"

    attempts: 3
    requires_human_review: true
```

---

## Examples

### Successful Implementation

**Work Order:**
```yaml
id: "WO-001"
issue_number: 42
title: "Implement user authentication service"
```

**Generated Code:**
```typescript
// src/services/auth.ts
import { hash, compare } from 'bcrypt';
import { sign, verify } from 'jsonwebtoken';
import { User } from '../types/auth';

export class AuthService {
  async register(email: string, password: string): Promise<User> {
    const hashedPassword = await hash(password, 10);
    // ... implementation
  }

  async login(email: string, password: string): Promise<string> {
    // ... implementation
    return sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: '24h'
    });
  }
}
```

**Generated Tests:**
```typescript
// tests/services/auth.test.ts
describe('AuthService', () => {
  describe('register', () => {
    it('should create user with hashed password', async () => {
      // ... test implementation
    });

    it('should reject duplicate email', async () => {
      // ... test implementation
    });
  });

  describe('login', () => {
    it('should return JWT for valid credentials', async () => {
      // ... test implementation
    });

    it('should reject invalid password', async () => {
      // ... test implementation
    });
  });
});
```

**Verification Output:**
```
✓ npm test: 12 passed, 0 failed (coverage: 85.5%)
✓ npm run lint: 0 errors, 2 warnings
✓ npm run build: success
```

---

## Related Agents

### Upstream
- **Controller**: Assigns work orders

### Downstream
- **PR Reviewer**: Reviews completed implementation

### Parallel
- **Regression Tester**: Runs alongside in Enhancement mode

---

## Configuration Reference

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `timeout` | number | 1800000 | Max execution time (ms) |
| `max_retries` | number | 3 | Retry attempts on failure |
| `coverage_threshold` | number | 80 | Min test coverage % |
| `branch_prefix` | string | "feature/" | Git branch prefix |
| `commit_style` | string | "conventional" | Commit message format |

---

*Part of [Agent Reference Documentation](./README.md)*
