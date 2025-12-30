# CI Fixer Agent Reference

> **Agent ID**: `ci-fixer`
> **Model**: Sonnet
> **Category**: Execution Pipeline (Quality)

## Overview

The CI Fixer Agent automatically diagnoses and fixes CI/CD pipeline failures. It is invoked by the PR Reviewer Agent when CI checks fail after implementation. The agent analyzes CI logs, identifies failure causes, applies appropriate fixes, and verifies the resolution through local checks.

---

## Configuration

### Agent Definition

**Location**: `.claude/agents/ci-fixer.md`

```markdown
---
name: ci-fixer
description: |
  Diagnoses and fixes CI failures automatically.
  Supports lint, type, test, and build error fixes.
  Delegates to subsequent agents if unable to resolve.
tools: Read, Write, Edit, Bash, Grep, Glob
model: sonnet
---
```

### YAML Configuration

```yaml
# .ad-sdlc/config/agents.yaml
ci-fixer:
  id: "ci-fixer"
  name: "CI Fixer Agent"
  model: sonnet
  timeout: 1800000  # 30 minutes

  capabilities:
    - ci_log_analysis
    - lint_fixing
    - type_error_fixing
    - test_fixing
    - build_fixing
    - git_operations

  tools:
    - Read
    - Write
    - Edit
    - Bash
    - Grep
    - Glob

  fix_strategies:
    enable_lint_fix: true
    enable_type_fix: true
    enable_test_fix: true
    enable_build_fix: true

  limits:
    max_fix_attempts: 3
    max_delegations: 3
    fix_timeout: 1800000      # 30 minutes
    ci_poll_interval: 10000   # 10 seconds
    ci_wait_timeout: 600000   # 10 minutes
```

---

## Input

### Source

Handoff document from PR Reviewer Agent via scratchpad.

### Handoff Document Schema

```yaml
# .ad-sdlc/scratchpad/ci-fix/handoff-PR{number}.yaml
prNumber: 123
prUrl: "https://github.com/org/repo/pull/123"
branch: "feature/new-feature"
originalIssue: "#100"

failedChecks:
  - name: "build"
    status: "failed"
    conclusion: "failure"
    logsUrl: "https://github.com/org/repo/actions/runs/12345/logs"
    runId: 12345

failureLogs:
  - "src/index.ts:10:5 - error TS2322: Type 'string' is not assignable to type 'number'."

attemptHistory: []

implementationSummary: "Added user authentication feature"
changedFiles:
  - "src/auth/login.ts"
  - "src/auth/session.ts"
testFiles:
  - "src/auth/login.test.ts"

maxFixAttempts: 3
currentAttempt: 1
escalationThreshold: 3
```

---

## Output

### Destination

Fix results are written to the scratchpad for tracking.

### Result Schema

```yaml
# .ad-sdlc/scratchpad/ci-fix/result-PR{number}-attempt{N}.yaml
prNumber: 123
attempt: 1

analysis:
  totalFailures: 3
  identifiedCauses:
    - category: "type"
      message: "Type 'string' is not assignable to type 'number'"
      file: "src/index.ts"
      line: 10
      autoFixable: true
  unidentifiedCauses: []
  analyzedAt: "2025-01-01T00:00:00Z"

fixesApplied:
  - type: "lint"
    file: "src/index.ts"
    description: "Applied ESLint auto-fix"
    success: true
  - type: "type"
    file: "src/utils.ts"
    description: "Fixed type annotation"
    success: true

verification:
  lintPassed: true
  typecheckPassed: true
  testsPassed: true
  buildPassed: true

outcome: "success"  # success | partial_success | failure

nextAction:
  type: "none"  # none | delegate | escalate
  reason: "All CI checks passed"

startedAt: "2025-01-01T00:00:00Z"
completedAt: "2025-01-01T00:10:00Z"
duration: 600000

commitHash: "abc123"
commitMessage: "fix(ci): auto-fix lint and type errors"
```

---

## Behavior

### Processing Steps

1. **Read Handoff Document**
   - Parse YAML handoff from PR Reviewer
   - Validate required fields

2. **Fetch and Analyze CI Logs**
   - Download CI logs from failed checks
   - Parse logs using pattern matching
   - Categorize failures (lint, type, test, build, security, dependency)

3. **Apply Fix Strategies**
   - **Lint Errors**: Run `npm run lint -- --fix`
   - **Type Errors**: Analyze and attempt AST-based fixes
   - **Test Errors**: Update snapshots if applicable
   - **Build Errors**: Clean install, resolve missing modules
   - **Dependency Errors**: Run `npm audit fix`

4. **Local Verification**
   - Run lint check
   - Run typecheck
   - Run tests
   - Run build

5. **Commit and Push**
   - Stage fixed files
   - Create commit with conventional format
   - Push to PR branch

6. **Determine Next Action**
   - **Success**: All checks pass - no further action
   - **Partial Success**: Some fixes applied - delegate to next agent
   - **Failure**: Unable to fix - escalate to human

### Decision Points

| Condition | Action |
|-----------|--------|
| All local checks pass | Mark success, no delegation |
| Some fixes succeeded | Create new handoff, delegate |
| No progress made | Check attempt count |
| Max attempts reached | Escalate to human |
| Security vulnerability | Always escalate (never auto-fix) |

---

## Error Handling

### Recoverable Errors

| Error | Recovery Action |
|-------|-----------------|
| CI logs not available | Wait and retry with exponential backoff |
| Partial fix success | Continue with remaining fixes |
| Git push conflict | Pull and retry |

### Non-Recoverable Errors

| Error | User Action Required |
|-------|---------------------|
| Max attempts exceeded | Manual intervention needed |
| Security vulnerability detected | Human review required |
| Handoff document missing | Check PR Reviewer output |

---

## Escalation Triggers

The CI Fixer will escalate to human intervention when:

1. **Max attempts reached** - After 3 consecutive fix attempts
2. **No progress** - Same failures persist after multiple attempts
3. **Security issues** - Any security vulnerability detected
4. **Complex errors** - Errors requiring architectural changes
5. **Max delegations** - Delegation chain limit exceeded

### Escalation Comment Format

```markdown
## CI Fix Agent Escalation

The CI Fix Agent was unable to automatically resolve all CI failures after 3 attempts.

### Unresolved Issues
- **type**: Type 'string' is not assignable to type 'number' (src/index.ts)

### Attempt History
- Attempt 1: 2/3 fixes succeeded
- Attempt 2: 0/1 fixes succeeded
- Attempt 3: 0/1 fixes succeeded

### Suggested Actions
- Manual fix required for: Type error in src/index.ts

Human intervention is required to resolve these issues.
```

---

## Examples

### Successful Fix

```bash
# CI Fixer receives handoff for PR #123 with lint errors
# 1. Analyzes CI logs
# 2. Detects ESLint errors
# 3. Runs: npm run lint -- --fix
# 4. Verifies locally: all checks pass
# 5. Commits: "fix(ci): auto-fix lint errors"
# 6. Pushes to feature branch
# Result: success
```

### Delegation Example

```bash
# CI Fixer receives handoff with type errors
# 1. Analyzes CI logs
# 2. Applies partial fix (1/3 errors fixed)
# 3. Local verification: typecheck still fails
# 4. Creates new handoff with remaining issues
# 5. Delegates to next CI Fixer instance
# Result: partial_success, action: delegate
```

### Escalation Example

```bash
# CI Fixer receives handoff for 3rd attempt
# 1. Analyzes CI logs
# 2. Same errors as previous attempts
# 3. No new fixes can be applied
# 4. Max attempts reached
# 5. Posts escalation comment on PR
# Result: failure, action: escalate
```

---

## Related Agents

### Dependencies
- **PR Reviewer**: Invokes CI Fixer when CI fails

### Dependents
- **CI Fixer** (self): Can delegate to another instance
- **Human**: Receives escalation when auto-fix fails

---

## Metrics

The CI Fixer tracks the following metrics:

| Metric | Description |
|--------|-------------|
| `ci_fix_attempts` | Total fix attempts |
| `ci_fix_success_rate` | Percentage of successful fixes |
| `ci_fix_duration` | Average time to fix |
| `ci_fix_escalation_rate` | Percentage escalated to human |
| `ci_fix_by_category` | Fixes by category (lint, type, etc.) |

---

*Part of [AD-SDLC Agent Reference Documentation](./README.md)*
