# PR Reviewer Module

The PR Reviewer module provides automated Pull Request creation, code review, quality gate enforcement, and feedback generation for the AD-SDLC pipeline.

## Overview

The module includes:

- **PRReviewerAgent** - Main class that creates PRs, performs reviews, and enforces quality gates
- **QualityGate** - Enforces configurable thresholds for coverage, complexity, and security
- **ReviewChecks** - Performs automated security, quality, performance, and documentation checks
- **Error Classes** - Specific error types for different failure modes

## Installation

The PR Reviewer module is included in the main `ad-sdlc` package:

```typescript
import {
  PRReviewerAgent,
  QualityGate,
  ReviewChecks,
  getPRReviewerAgent,
  resetPRReviewerAgent,
  DEFAULT_PR_REVIEWER_CONFIG,
  DEFAULT_QUALITY_GATE_CONFIG,
} from 'ad-sdlc';
```

## PRReviewerAgent

Main class for creating and reviewing Pull Requests from Worker Agent implementation results.

### Basic Usage

```typescript
import { PRReviewerAgent } from 'ad-sdlc';

// Create agent with default configuration
const agent = new PRReviewerAgent();

// Review a work order
const result = await agent.review('WO-001');

console.log(`Decision: ${result.decision.action}`);
console.log(`PR #${result.pullRequest.number}: ${result.pullRequest.url}`);
```

### Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `projectRoot` | string | `process.cwd()` | Project root directory |
| `resultsPath` | string | `.ad-sdlc/scratchpad/progress` | Path to implementation results |
| `autoMerge` | boolean | `false` | Enable auto-merge on approval |
| `mergeStrategy` | 'merge' \| 'squash' \| 'rebase' | `'squash'` | Git merge strategy |
| `deleteBranchOnMerge` | boolean | `true` | Delete branch after merge |
| `coverageThreshold` | number | `80` | Minimum code coverage % |
| `maxComplexity` | number | `10` | Maximum complexity score |
| `ciTimeout` | number | `600000` | CI wait timeout (ms) |
| `ciPollInterval` | number | `10000` | CI poll interval (ms) |

### Example Configuration

```typescript
const agent = new PRReviewerAgent({
  autoMerge: true,
  mergeStrategy: 'squash',
  coverageThreshold: 85,
  maxComplexity: 8,
});
```

## QualityGate

Evaluates quality metrics and check results against configurable thresholds.

### Basic Usage

```typescript
import { QualityGate } from 'ad-sdlc';

const gate = new QualityGate({
  config: {
    required: { codeCoverage: 90 },
    recommended: { maxComplexity: 5 },
  },
});

const result = gate.evaluate(metrics, checks, comments);

console.log(`Passed: ${result.passed}`);
console.log(`Failures: ${result.failures.join(', ')}`);
console.log(`Warnings: ${result.warnings.join(', ')}`);
```

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

## ReviewChecks

Performs automated code review checks on changed files.

### Basic Usage

```typescript
import { ReviewChecks } from 'ad-sdlc';

const checks = new ReviewChecks({
  projectRoot: '/path/to/project',
  enableSecurityScan: true,
  enableTestingChecks: true,
});

const result = await checks.runAllChecks(fileChanges);

console.log(`Comments: ${result.comments.length}`);
console.log(`Metrics: Coverage ${result.metrics.codeCoverage}%`);
```

### Security Checks

- **Hardcoded secrets detection** - API keys, passwords, tokens
- **SQL injection vulnerability** - Template literal interpolation in queries
- **XSS vulnerability** - innerHTML, dangerouslySetInnerHTML, eval usage
- **Input validation** - Request body/query/params without validation

### Quality Checks

- **SOLID principles** - Large class detection, parameter count
- **Code duplication** - Repeated code patterns
- **Error handling** - Empty catch blocks, missing try-catch

### Performance Checks

- **N+1 query patterns** - Async operations in forEach/map loops
- **Data structure usage** - Appropriate data structure selection

### Documentation Checks

- **Public API documentation** - JSDoc for exported functions/classes
- **Complex logic explanation** - Comments for complex code

## Review Decision Matrix

| Condition | Status | Action |
|-----------|--------|--------|
| All gates pass, no issues | `approved` | Merge PR |
| Gates pass, minor issues | `approved` | Merge with comments |
| Gates pass, major issues | `changes_requested` | Request fixes |
| Gates fail (fixable) | `changes_requested` | Request fixes |
| Critical issues found | `rejected` | Close PR |
| Security vulnerability | `rejected` | Close PR |

## Error Handling

The module provides specific error classes:

```typescript
import {
  PRReviewerError,
  PRCreationError,
  PRMergeError,
  QualityGateFailedError,
  CITimeoutError,
  SecurityVulnerabilityError,
  ImplementationResultNotFoundError,
  ReviewCommentError,
  BranchNotFoundError,
} from 'ad-sdlc';

try {
  await reviewer.review('WO-001');
} catch (error) {
  if (error instanceof CITimeoutError) {
    console.log(`CI timed out after ${error.timeoutMs}ms`);
  } else if (error instanceof QualityGateFailedError) {
    console.log(`Quality gate failed: ${error.failures.join(', ')}`);
  }
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

## Integration with Worker Agent

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

## Singleton Pattern

For shared state across the application:

```typescript
import { getPRReviewerAgent, resetPRReviewerAgent } from 'ad-sdlc';

// Get singleton instance
const agent = getPRReviewerAgent();

// Reset singleton (for testing)
resetPRReviewerAgent();
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

- `js-yaml` - YAML parsing and serialization
- `gh` CLI - GitHub CLI for PR operations

## Related Modules

- `worker` - Produces implementation results for review
- `controller` - Coordinates work order dispatch
- `issue-generator` - Creates issues that lead to implementations
