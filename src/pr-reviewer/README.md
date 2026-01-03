# PR Reviewer Agent

Automated Pull Request creation, code review, quality gate enforcement, and feedback generation for the AD-SDLC pipeline.

## Overview

The PR Reviewer Agent is the final stage in the execution pipeline, responsible for:

1. **PR Creation** - Creates pull requests from Worker Agent implementation results
2. **Code Review** - Performs automated security, quality, and best practice checks
3. **Quality Gates** - Enforces configurable thresholds for coverage, complexity, and security
4. **Decision Making** - Determines whether to approve, request changes, or reject PRs
5. **Feedback Loop** - Provides actionable feedback to improve future implementations

## Installation

The PR Reviewer Agent is part of the `claude_code_agent` package:

```typescript
import { PRReviewerAgent, QualityGate, ReviewChecks } from './pr-reviewer';
```

## Quick Start

```typescript
import { PRReviewerAgent } from './pr-reviewer';

// Create reviewer with default configuration
const reviewer = new PRReviewerAgent();

// Review a work order
const result = await reviewer.review('WO-001');

console.log(`Decision: ${result.decision.action}`);
console.log(`PR #${result.pullRequest.number}: ${result.pullRequest.url}`);
```

## Configuration

### PRReviewerAgentConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `projectRoot` | string | ProjectContext or `process.cwd()` | Project root directory (uses ProjectContext if initialized) |
| `resultsPath` | string | `.ad-sdlc/scratchpad/progress` | Path to implementation results |
| `autoMerge` | boolean | `false` | Enable auto-merge on approval |
| `mergeStrategy` | 'merge' \| 'squash' \| 'rebase' | `'squash'` | Git merge strategy |
| `deleteBranchOnMerge` | boolean | `true` | Delete branch after merge |
| `coverageThreshold` | number | `80` | Minimum code coverage % |
| `maxComplexity` | number | `10` | Maximum complexity score |
| `ciTimeout` | number | `600000` | CI wait timeout (ms) |
| `ciPollInterval` | number | `10000` | CI poll interval (ms) |
| `ciPollIntervalMs` | number | `10000` | Initial CI poll interval (ms) |
| `maxCiPollIntervalMs` | number | `60000` | Max CI poll interval after backoff (ms) |
| `ciPollBackoffMultiplier` | number | `1.5` | Backoff multiplier for polling |
| `maxCiPolls` | number | `60` | Maximum number of poll attempts |
| `ciCircuitBreakerThreshold` | number | `3` | Failures before circuit opens |
| `ciCircuitBreakerResetMs` | number | `300000` | Time before circuit breaker reset (ms) |
| `ciFailFastOnTerminal` | boolean | `true` | Fast-fail on terminal errors |

### Example Configuration

```typescript
const reviewer = new PRReviewerAgent({
  autoMerge: true,
  mergeStrategy: 'squash',
  coverageThreshold: 85,
  maxComplexity: 8,
});
```

## Circuit Breaker and Intelligent CI Polling

The PR Reviewer Agent implements a circuit breaker pattern for CI/CD polling operations, providing:

### Circuit Breaker

Prevents continuous polling when CI is consistently failing:

- **CLOSED State**: Normal operation, CI checks pass through
- **OPEN State**: Circuit tripped after consecutive failures, requests fail immediately
- **HALF-OPEN State**: Testing recovery after timeout, limited requests allowed

```typescript
// Circuit breaker is automatically integrated
const reviewer = new PRReviewerAgent({
  ciCircuitBreakerThreshold: 3,  // Open after 3 failures
  ciCircuitBreakerResetMs: 300000, // Reset after 5 minutes
});

// Access circuit breaker for monitoring
const status = reviewer.getCircuitBreaker().getStatus();
console.log(`State: ${status.state}, Failures: ${status.failures}`);

// Manual reset if needed
reviewer.resetCircuitBreaker();
```

### Intelligent Polling

Exponential backoff with jitter for efficient CI polling:

```typescript
const reviewer = new PRReviewerAgent({
  ciPollIntervalMs: 10000,      // Start at 10s
  maxCiPollIntervalMs: 60000,   // Max 60s between polls
  ciPollBackoffMultiplier: 1.5, // 1.5x increase per poll
  maxCiPolls: 60,               // Maximum 60 polls
});

// Poll CI status with full circuit breaker support
const result = await reviewer.pollCIStatus(prNumber);
if (!result.success) {
  console.log(`Polling failed: ${result.reason}`);
}
```

### Failure Classification

CI failures are classified for intelligent handling:

| Type | Description | Examples | Action |
|------|-------------|----------|--------|
| `terminal` | Cannot be auto-fixed | Config errors, auth failures | Fail fast |
| `transient` | May be auto-fixed | Test failures, lint errors | Retry/delegate |
| `persistent` | Needs investigation | Unknown failures | Circuit break |

```typescript
// Terminal failure patterns (fast-fail)
- Configuration errors
- Authorization/permission issues
- Syntax/parse errors
- Missing dependencies

// Transient failure patterns (can retry)
- Test failures
- Lint errors
- Build failures
- Timeout errors
```

### Circuit Breaker Error Handling

```typescript
import {
  CircuitOpenError,
  CIMaxPollsExceededError,
  CITerminalFailureError,
} from './pr-reviewer';

try {
  await reviewer.review('WO-001');
} catch (error) {
  if (error instanceof CircuitOpenError) {
    console.log(`Circuit open after ${error.failures} failures`);
    console.log(`Wait ${reviewer.getCircuitBreaker().getTimeUntilReset()}ms before retry`);
  } else if (error instanceof CITerminalFailureError) {
    console.log(`Terminal failure in ${error.checkName}: ${error.errorMessage}`);
  } else if (error instanceof CIMaxPollsExceededError) {
    console.log(`Exceeded ${error.pollCount} polls for PR #${error.prNumber}`);
  }
}
```

## Quality Gates

### Required Gates (Must Pass)

- **tests_pass** - All tests must pass
- **build_pass** - Build must succeed
- **lint_pass** - Linting must pass
- **no_critical_security** - No critical security issues
- **no_critical_issues** - No critical review comments
- **code_coverage** - Coverage must meet threshold (default: 80%)

### Recommended Gates (Warnings)

- **no_major_issues** - No major review comments
- **new_lines_coverage** - Coverage of new lines (default: 90%)
- **max_complexity** - Maximum complexity score (default: 10)
- **no_style_violations** - No style violations

## Review Checks

The agent performs comprehensive automated checks:

### Security Checks
- Hardcoded secrets detection
- SQL injection vulnerability scanning
- XSS vulnerability detection
- Input validation verification

### Quality Checks
- SOLID principles compliance
- Code duplication detection
- Error handling verification

### Performance Checks
- N+1 query pattern detection
- Data structure appropriateness

### Documentation Checks
- Public API documentation
- Complex logic explanation

## Review Decision Matrix

| Condition | Status | Action |
|-----------|--------|--------|
| All gates pass, no issues | `approved` | Merge PR |
| Gates pass, minor issues | `approved` | Merge with comments |
| Gates pass, major issues | `changes_requested` | Request fixes |
| Gates fail (fixable) | `changes_requested` | Request fixes |
| Critical issues found | `rejected` | Close PR |
| Security vulnerability | `rejected` | Close PR |

## API Reference

### PRReviewerAgent

```typescript
class PRReviewerAgent {
  constructor(config?: PRReviewerAgentConfig);

  // Main review method
  review(workOrderId: string, options?: PRReviewOptions): Promise<PRReviewResult>;

  // Review from file path
  reviewFromFile(resultPath: string, options?: PRReviewOptions): Promise<PRReviewResult>;

  // Create PR only (UC-014)
  createPROnly(workOrderId: string): Promise<PRCreateResult>;

  // Create PR from file
  createPRFromFile(resultPath: string): Promise<PRCreateResult>;

  // Check merge readiness (UC-016)
  checkMergeReadiness(prNumber: number, implResult: ImplementationResult): Promise<MergeReadinessResult>;

  // Get PRCreator instance
  getPRCreator(): PRCreator;

  // Get MergeDecision instance
  getMergeDecision(): MergeDecision;

  // Get configuration
  getConfig(): Required<PRReviewerAgentConfig>;
}
```

### PRCreator (UC-014)

The PRCreator class handles PR creation from Worker Agent implementation results with:
- Branch naming convention validation
- Automatic label inference from changes
- Draft PR support for incomplete work
- Comprehensive PR description generation

```typescript
class PRCreator {
  constructor(config?: PRCreatorConfig);

  // Create PR from implementation result
  createFromImplementationResult(implResult: ImplementationResult): Promise<PRCreateResult>;

  // Validate branch naming convention
  validateBranchNaming(branchName: string): BranchValidationResult;

  // Infer labels from changes
  inferLabels(changes: FileChange[], branchName: string): LabelInferenceResult;

  // Check if PR should be draft
  shouldBeDraft(implResult: ImplementationResult): boolean;

  // Generate PR content
  generatePRContent(implResult: ImplementationResult, labels: string[], isDraft: boolean): PRCreateOptions;

  // Get configuration
  getConfig(): Required<PRCreatorConfig>;
}
```

### PRCreatorConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `projectRoot` | string | ProjectContext or `process.cwd()` | Project root directory (uses ProjectContext if initialized) |
| `baseBranch` | string | `'main'` | Base branch for PRs |
| `enableDraftPR` | boolean | `true` | Enable draft PR creation |
| `draftThreshold` | number | `70` | Coverage threshold for draft |
| `autoAssignLabels` | boolean | `true` | Auto-assign labels |
| `labelMapping` | Record | See below | Label mapping for prefixes |
| `prTemplate` | string \| null | `null` | Custom PR template path |

### Branch Naming Convention

Valid branch prefixes:
- `feature/` - New features (`enhancement` label)
- `fix/` - Bug fixes (`bug` label)
- `docs/` - Documentation (`documentation` label)
- `test/` - Test additions (`testing` label)
- `refactor/` - Refactoring (`refactoring` label)
- `chore/` - Maintenance
- `hotfix/` - Critical fixes (`bug` label)

Expected format: `{prefix}/{issue-number}-{description}`

Examples:
```
feature/ISS-001-implement-login
fix/123-null-pointer-exception
refactor/CMP-005-extract-utils
docs/update-readme
```

### Draft PR Creation

PRs are automatically created as drafts when:
- Coverage is below threshold (default: 70%)
- Tests are failing
- Lint errors exist
- Build is failing
- Implementation is blocked

### MergeDecision (UC-016)

The MergeDecision class handles quality gate enforcement and merge decision logic:
- Merge conflict detection via GitHub API
- Blocking review comments detection
- Detailed gate failure report generation
- Proper squash merge commit message formatting
- Merge readiness evaluation

```typescript
class MergeDecision {
  constructor(config?: MergeDecisionConfig);

  // Check for merge conflicts on a PR
  checkMergeConflicts(prNumber: number): Promise<MergeConflictInfo>;

  // Check for unresolved blocking reviews
  checkBlockingReviews(prNumber: number): Promise<readonly BlockingReview[]>;

  // Generate detailed gate failure report
  generateDetailedReport(
    prNumber: number,
    qualityGateResult: QualityGateResult,
    metrics: QualityMetrics,
    checks: CheckResults
  ): DetailedGateReport;

  // Check overall merge readiness
  checkMergeReadiness(
    prNumber: number,
    qualityGateResult: QualityGateResult,
    metrics: QualityMetrics,
    checks: CheckResults
  ): Promise<MergeReadinessResult>;

  // Generate squash merge commit message
  generateSquashMessage(
    pullRequest: PullRequest,
    issueNumber?: number,
    summary?: string
  ): SquashMergeMessage;

  // Execute merge with proper commit message
  executeMerge(
    prNumber: number,
    message: SquashMergeMessage
  ): Promise<{ success: boolean; mergeCommit?: string; error?: string }>;
}
```

### MergeDecisionConfig

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `projectRoot` | string | ProjectContext or `process.cwd()` | Project root directory (uses ProjectContext if initialized) |
| `mergeStrategy` | 'merge' \| 'squash' \| 'rebase' | `'squash'` | Git merge strategy |
| `deleteBranchOnMerge` | boolean | `true` | Delete branch after merge |
| `commandTimeout` | number | `30000` | Command timeout (ms) |

### Detailed Gate Report Example

```markdown
## Quality Gate Report

**PR #123** - Generated at 2024-01-01T00:00:00Z

### Gate Status

| Gate | Threshold | Actual | Status |
|------|-----------|--------|--------|
| Tests Pass | pass | pass | ✅ PASSED |
| Build Pass | pass | pass | ✅ PASSED |
| Code Coverage | ≥80 | 75 | ❌ FAILED |
| Complexity | ≤10 | 8 | ✅ PASSED |

### Required Actions

1. Increase test coverage to at least 80% (current: 75%)

### Recommendations

- Consider improving test coverage for new code
```

### PRReviewOptions

```typescript
interface PRReviewOptions {
  skipCIWait?: boolean;       // Skip waiting for CI
  skipSecurityScan?: boolean; // Skip security scanning
  qualityGate?: Partial<QualityGateConfig>; // Custom gates
  forceApprove?: boolean;     // Bypass quality gates
  dryRun?: boolean;           // Don't actually merge/comment
}
```

### PRReviewResult

```typescript
interface PRReviewResult {
  workOrderId: string;
  issueId: string;
  githubIssue?: number;
  pullRequest: PullRequest;
  review: Review;
  qualityMetrics: QualityMetrics;
  checks: CheckResults;
  qualityGate: QualityGateResult;
  decision: Decision;
  feedbackForWorker: WorkerFeedback;
  startedAt: string;
  completedAt: string;
}
```

## File Locations

### Input
```
.ad-sdlc/scratchpad/progress/{project_id}/results/WO-XXX-result.yaml
```

### Output
```
.ad-sdlc/scratchpad/progress/{project_id}/reviews/PR-XXX-review.yaml
```

## Error Handling

The module provides specific error classes for different failure modes:

```typescript
import {
  PRCreationError,
  PRMergeError,
  QualityGateFailedError,
  CITimeoutError,
  SecurityVulnerabilityError,
} from './pr-reviewer';

try {
  await reviewer.review('WO-001');
} catch (error) {
  if (error instanceof CITimeoutError) {
    console.log(`CI timed out after ${error.timeoutMs}ms`);
  }
}
```

## Integration with Worker Agent

The PR Reviewer works with Worker Agent output:

```typescript
import { WorkerAgent } from './worker';
import { PRReviewerAgent } from './pr-reviewer';

// Worker implements the issue
const worker = new WorkerAgent();
const implResult = await worker.implement(workOrder);

// Reviewer creates and reviews the PR
const reviewer = new PRReviewerAgent();
const reviewResult = await reviewer.review(implResult.workOrderId);

// Access feedback for future improvements
console.log(reviewResult.feedbackForWorker.improvements);
```

## CLI Usage

```bash
# Review a specific work order
ad-sdlc review WO-001

# Review with auto-merge
ad-sdlc review WO-001 --auto-merge

# Dry run (no actual PR actions)
ad-sdlc review WO-001 --dry-run
```

## Dependencies

- `yaml` - YAML parsing and serialization
- `gh` CLI - GitHub CLI for PR operations

## Related Modules

- `worker` - Produces implementation results for review
- `controller` - Coordinates work order dispatch
- `issue-generator` - Creates issues that lead to implementations
