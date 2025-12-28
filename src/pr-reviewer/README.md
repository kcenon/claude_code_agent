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
const reviewer = new PRReviewerAgent({
  autoMerge: true,
  mergeStrategy: 'squash',
  coverageThreshold: 85,
  maxComplexity: 8,
});
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

  // Get configuration
  getConfig(): Required<PRReviewerAgentConfig>;
}
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
