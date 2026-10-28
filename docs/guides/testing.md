# Testing Guide

> Comprehensive guide for running and writing tests for Claude Code Agents

## Overview

This project uses [Vitest](https://vitest.dev/) as the test framework. Tests are
grouped into explicit lanes (#954). Every lane except the live acceptance lane
is offline: it needs no credentials and makes no paid SDK call. The offline
suite, integration, pipeline E2E, and package delivery lanes run on every pull
request into `develop` or `main` and on every push to those branches.

## Test Lanes

| Lane                                            | Command                                   | Selection                                                                                                | Credentials                                                 | CI check                                                                           |
| ----------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Offline suite (unit, integration, pipeline E2E) | `npm test`                                | `vitest.config.ts`: `tests/**/*.test.ts` except `tests/performance/**` and `tests/live/**`; 30 s timeout | none                                                        | `Test (ubuntu-latest)` (with coverage thresholds), `Test (windows-2022)`           |
| Offline integration                             | `npm run test:integration`                | `vitest.integration.config.ts`: `tests/integration/**/*.test.ts`                                         | none                                                        | `Integration Tests`                                                                |
| Offline pipeline E2E                            | `npm run test:e2e`                        | `vitest.e2e.config.ts`: `tests/e2e/**/*.test.ts`; 120 s timeout, no retry                                | none                                                        | `Pipeline E2E (offline)`                                                           |
| Package delivery                                | `npm run test:package`                    | `tests/package/asset-delivery.smoke.mjs` (packed tarball, production install)                            | none                                                        | `Package Asset Delivery (offline)`                                                 |
| Performance                                     | `npm run test:bench`, `npm run test:perf` | `vitest.bench.config.ts`, `vitest.perf.config.ts`: `tests/performance/**`                                | none                                                        | `Performance Tests` workflow (pushes and pull requests to `main`, manual dispatch) |
| Live acceptance                                 | `npm run test:live`                       | `vitest.live.config.ts`: `tests/live/**/*.live.test.ts`, run by `scripts/live-lane.ts`                   | `ANTHROPIC_API_KEY`, disposable GitHub repository and token | `Live Acceptance` (manual `workflow_dispatch` only)                                |

The offline pipeline E2E tests use a mocked SDK boundary (`MockBridge`,
`MockExecutionAdapter`) or template agents without an execution adapter. A
passing offline lane is never evidence of live SDK behavior. Only the live
acceptance lane executes the SDK, and only its metadata records an actual SDK
execution.

The E2E lane does not retry (`retry: 0`): the first failure of a selected test
fails the `Pipeline E2E (offline)` job, and a flaky test fails instead of
passing on a second attempt. The `Integration Tests` and
`Pipeline E2E (offline)` jobs depend only on `Lint`, so a failing lane test
fails the lane job itself. Behind `Test` or `Build` the job would be skipped
instead, and a skipped required check counts as passing.

### Duplicate Execution

`npm test` intentionally keeps `tests/integration/**` and `tests/e2e/**`, so
those files run twice on Ubuntu: once in `Test (ubuntu-latest)` and once in
their lane job (`Integration Tests`, `Pipeline E2E (offline)`). The reasons:

- Windows coverage for the integration and E2E tests comes only from
  `Test (windows-2022)`; moving them out of `npm test` would need two more
  Windows jobs and a rename of the `Integration Tests` check.
- The coverage thresholds in `vitest.config.ts` are measured over all offline
  suites. Measured on `develop` 51e6c2b (2026-10-23), excluding the two
  directories lowers coverage from 86.05 % to 85.89 % lines and from 72.77 %
  to 72.43 % branches: still above the thresholds, but with less margin.
- The lane jobs report each selection under its own check name and apply the
  lane settings (no retry, 120 s timeout for E2E).

The duplicated work is the two lane jobs' install step plus a few seconds of
test time. The live lane is never duplicated: `tests/live/**` is excluded from
every offline configuration.

## Running Tests

### All Offline Tests

```bash
# Run every offline suite (unit, integration, pipeline E2E)
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

### Live Acceptance Lane

```bash
# Paid: runs the real Claude Agent SDK and writes to the disposable GitHub
# repository. Without the settings it records "not executed" and exits 2
# without calling anything.
ANTHROPIC_API_KEY=... AD_SDLC_LIVE_GITHUB_REPO=owner/name \
  AD_SDLC_LIVE_GITHUB_TOKEN=... npm run test:live
```

See [Live Acceptance Lane](#live-acceptance-lane) for settings and metadata.

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
├── ci/                         # Offline guards for workflows and the live lane
│   ├── workflow-trigger-matrix.test.ts
│   ├── live-lane-guard.test.ts
│   └── import-fixture.test.ts  # Import live fixture and verdicts, offline
├── live/                       # Live acceptance lane only (npm run test:live)
│   ├── fixtures/               # Import target repository, issues, acceptance tests
│   ├── harness.ts
│   ├── importScenario.ts
│   ├── githubTarget.ts
│   ├── import-acceptance.live.test.ts
│   └── sdk-cli-smoke.live.test.ts
└── e2e/                        # Offline end-to-end tests
    ├── helpers/                # Shared test utilities
    │   ├── fixtures.ts
    │   ├── test-environment.ts
    │   ├── pipeline-runner.ts
    │   ├── verification.ts
    │   └── github-mock.ts      # GitHub API mock server
    ├── fixtures/               # Test fixtures
    │   └── scalability-fixtures.ts
    ├── analysis-pipeline/      # Analysis Pipeline E2E
    │   ├── analysis-fixtures.ts
    │   └── analysis-pipeline.e2e.test.ts
    ├── enhancement-pipeline/   # Enhancement Pipeline E2E
    │   ├── enhancement-fixtures.ts
    │   └── enhancement-pipeline.e2e.test.ts
    ├── pipelines/              # Pipeline integration E2E
    │   ├── greenfield-github.e2e.test.ts
    │   └── worker-failure.e2e.test.ts
    ├── scalability/            # Scalability E2E
    │   └── scalability.e2e.test.ts
    ├── pipeline.e2e.test.ts
    ├── recovery.e2e.test.ts
    ├── error-recovery-edge-cases.e2e.test.ts  # Error recovery & edge cases
    └── orchestration.e2e.test.ts
```

## Analysis Pipeline E2E Tests

The Analysis Pipeline E2E tests validate the complete flow:

```
Document Reader → Code Reader → Comparator → Issue Generator
```

### Test Scenarios

| Scenario         | Description                                  |
| ---------------- | -------------------------------------------- |
| Full Pipeline    | Complete analysis with docs and code         |
| Document-Only    | Analyze only documentation                   |
| Code-Only        | Analyze only source code                     |
| Gap Detection    | Identify discrepancies between docs and code |
| Issue Generation | Create issues from detected gaps             |
| Error Recovery   | Handle failures gracefully                   |

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
  includeGaps: true, // Add documented but unimplemented features
  includeOrphanCode: true, // Add undocumented code
});
```

## Enhancement Pipeline E2E Tests

The Enhancement Pipeline E2E tests validate incremental updates to existing projects:

```
Mode Detection → Document Reading → Impact Analysis
```

### Test Scenarios

| Scenario                 | Description                           |
| ------------------------ | ------------------------------------- |
| Mode Detection           | Detect greenfield vs enhancement mode |
| Document Reading         | Read and parse PRD/SRS/SDS documents  |
| Simple Feature Addition  | Add isolated new features             |
| Requirement Modification | Modify existing requirements          |
| Multi-Component Change   | Changes affecting multiple components |
| Error Handling           | Graceful error recovery               |
| Session Management       | Session lifecycle tracking            |
| Performance              | Timing benchmarks for each stage      |

### Running Enhancement Pipeline Tests

```bash
npm run test:e2e -- --run tests/e2e/enhancement-pipeline/
```

### Test Fixtures

The enhancement pipeline uses fixtures simulating existing e-commerce projects:

- **Documents**: PRD, SRS, SDS with linked requirements (FR-###)
- **Source Code**: AuthService, ProductService, CartService, OrderService, UserService
- **Build System**: package.json with scripts

```typescript
import { createEnhancementFixture, createCodeOnlyFixture } from './enhancement-fixtures.js';

// Full project with docs and code
const fixture = await createEnhancementFixture({
  name: 'my-test',
  includeTests: true, // Include test files
  partialDocs: false, // Include all doc types
  partialCode: false, // Include all source files
});

// Code-only project (no docs)
const codeOnlyFixture = await createCodeOnlyFixture('code-test');
```

### ModeDetector Thresholds

Note that `ModeDetector` requires:

- **minSourceFiles**: 5+ source files for `codebase.exists = true`
- **minLinesOfCode**: 100+ lines for substantial codebase detection

Fixtures must provide sufficient source files to meet these thresholds.

## Error Recovery and Edge Cases E2E Tests

The error recovery and edge cases tests ensure the system handles failures gracefully and can recover from unexpected situations.

### Test Categories

| Category             | Description                                                                      |
| -------------------- | -------------------------------------------------------------------------------- |
| Error Injection      | Tests for API rate limiting, network timeout, invalid input handling             |
| Edge Cases           | Empty input, large documents (100+ requirements), circular dependencies, unicode |
| Recovery Tests       | Mid-pipeline restart, partial completion resume, checkpoint restoration          |
| Graceful Degradation | Missing dependencies, resource exhaustion, fallback behavior                     |

### Running Error Recovery Tests

```bash
npm run test:e2e -- --run tests/e2e/error-recovery-edge-cases.e2e.test.ts
```

### Test Scenarios

#### Error Injection Tests

- **API Rate Limiting**: Validates `RateLimiter` behavior when limits are exceeded
- **Network Timeout Recovery**: Tests handling of long-running operations
- **Invalid Input Handling**: Tests for null-like inputs, special characters, control characters
- **Malformed Document Recovery**: Tests for corrupted YAML, empty files, binary content

#### Edge Case Tests

- **Empty Input**: Empty string, whitespace-only, newline-only input
- **Large Documents**: Documents with 100+ requirements
- **Circular Dependencies**: Detection using `DependencyGraphBuilder`
- **Unicode Handling**: CJK characters, emojis, RTL text, special symbols

#### Recovery Tests

- **Mid-Pipeline Restart**: Detecting incomplete pipeline state
- **Partial Completion Resume**: Identifying completed stages from filesystem
- **Checkpoint Restoration**: Creating and restoring checkpoints after each stage

#### Graceful Degradation Tests

- **Missing Dependencies**: Handling missing scratchpad directories
- **Concurrent Operations**: Multiple operations running simultaneously
- **Error Message Quality**: Clear and informative error messages

## Scalability E2E Tests

The scalability tests validate system behavior under scale conditions.

### Test Scenarios

| Scenario                | Description                      |
| ----------------------- | -------------------------------- |
| Large Issue Set         | Generate and handle 100+ issues  |
| Large Project Structure | Create projects with many files  |
| Memory Usage            | Monitor memory during processing |
| Concurrent Operations   | Parallel execution handling      |
| Performance Benchmarks  | Timing benchmarks for operations |

### Running Scalability Tests

```bash
npm run test:e2e -- --run tests/e2e/scalability/
```

### Scalability Fixtures

```typescript
import { generateLargeIssueSet, createLargeProject } from './fixtures/scalability-fixtures.js';

// Generate 100 issues with dependencies
const issues = generateLargeIssueSet(100);

// Create large project structure
await createLargeProject({
  baseDir: '/tmp/test-project',
  issueCount: 100,
  componentCount: 10,
  sourceFileCount: 50,
});
```

## GitHub Integration E2E Tests

The GitHub integration tests validate pipeline interactions with GitHub API using a mock server.

### Test Scenarios

| Scenario          | Description                    |
| ----------------- | ------------------------------ |
| Issue Creation    | Create issues via GitHub API   |
| Pull Request Flow | Create, review, and merge PRs  |
| CI Check Status   | Retrieve and handle CI status  |
| Error Handling    | Handle API failures gracefully |
| Retry Logic       | Transient failure recovery     |

### Running GitHub Integration Tests

```bash
npm run test:e2e -- --run tests/e2e/pipelines/
```

### GitHub Mock Server

The `GitHubMock` class provides a mock HTTP server for GitHub API:

```typescript
import { GitHubMock, createTestGitHubMock } from './helpers/github-mock.js';

// Create and start mock server
const githubMock = createTestGitHubMock();
await githubMock.start();

// Simulate failures
githubMock.simulateFailure('create_pr', {
  times: 2,
  statusCode: 503,
  errorMessage: 'Service temporarily unavailable',
});

// Add mock data
githubMock.addIssue({
  number: 1,
  title: 'Test Issue',
  body: 'Test body',
  state: 'open',
  labels: [],
  assignees: [],
});

// Stop server
await githubMock.stop();
```

### Supported Endpoints

| Endpoint                                      | Methods   | Description            |
| --------------------------------------------- | --------- | ---------------------- |
| `/repos/:owner/:repo/issues`                  | GET, POST | List and create issues |
| `/repos/:owner/:repo/issues/:number`          | GET       | Get single issue       |
| `/repos/:owner/:repo/pulls`                   | GET, POST | List and create PRs    |
| `/repos/:owner/:repo/pulls/:number`           | GET       | Get single PR          |
| `/repos/:owner/:repo/pulls/:number/merge`     | PUT       | Merge PR               |
| `/repos/:owner/:repo/commits/:sha/check-runs` | GET       | Get check runs         |

## Worker Failure E2E Tests

Tests for worker execution failure handling and recovery.

### Test Scenarios

| Scenario           | Description                               |
| ------------------ | ----------------------------------------- |
| Transient Failures | Retry and recover from temporary failures |
| Permanent Failures | Fail fast on non-recoverable errors       |
| Rate Limiting      | Handle 429 errors appropriately           |
| Parallel Failures  | Isolate failures between workers          |
| Recovery State     | Track retry attempts and state            |

### Running Worker Failure Tests

```bash
npm run test:e2e -- --run tests/e2e/pipelines/worker-failure.e2e.test.ts
```

## Live Acceptance Lane

The live lane is the only lane that executes the real Claude Agent SDK. It
drives the production path: the `ad-sdlc init` and `ad-sdlc run` CLI commands
(`src/cli.ts`, loaded through tsx), the orchestrator, and
`SdkExecutionAdapter`. `npm run test:live` runs `scripts/live-lane.ts`, which:

1. Checks the settings below. When a required setting is missing or a budget
   is invalid, it starts no test and makes no SDK call, records the status
   `not-executed` with the reason, and exits 2.
2. Otherwise runs `vitest.live.config.ts`. The run passes only when Vitest
   exits 0 and every selected live test passed; a failed, skipped, or empty
   run exits 1.
3. Writes `live-lane.json` (execution metadata) and `live-lane-summary.md` to
   the output directory, and appends the summary to `$GITHUB_STEP_SUMMARY`
   when that variable is set.

Selecting the live suite directly (`vitest run --config vitest.live.config.ts`)
without the settings fails the test instead of skipping it.

| Setting                     | Required  | Default   | Accepted values                                                                                                             |
| --------------------------- | --------- | --------- | --------------------------------------------------------------------------------------------------------------------------- |
| `AD_SDLC_LIVE_AUTH`         | no        | `secrets` | `secrets`: the API key and token below; `local-login`: the machine's Claude Code login and the account `gh` is logged in to |
| `ANTHROPIC_API_KEY`         | `secrets` | —         | Non-empty API key                                                                                                           |
| `AD_SDLC_LIVE_GITHUB_REPO`  | yes       | —         | `owner/name` of the disposable target repository of the Import scenarios (see below)                                        |
| `AD_SDLC_LIVE_GITHUB_TOKEN` | `secrets` | —         | GitHub token scoped to that repository only                                                                                 |

`local-login` is for a run on a developer machine. Each run gets an isolated
Claude configuration directory holding only a copy of the login's
`.credentials.json`, so the user's settings, hooks, and plugins do not reach
the run; the run refuses to start unless the login stays valid for two more
hours, so the copy never refreshes it, and the copy is deleted afterwards.
Because no API key or session marker is visible to the CLI, the runs pass
`--allow-stub`, which only skips that detection: every stage still runs through
the SDK adapter. GitHub calls use the account `gh` is logged in to. On Windows,
npm runs the package scripts in Git for Windows' bash.
| `AD_SDLC_LIVE_MAX_TURNS` | no | `8` | Integer 1 to 30: the turn budget, written as `maxTurns` into the stage agent's definition, which the adapter passes to the SDK |
| `AD_SDLC_LIVE_STAGE_TIMEOUT_MS` | no | `240000` | Integer 10000 to 1200000: passed as `--stage-timeout-ms`, the total time budget of the stage |
| `AD_SDLC_LIVE_OUTPUT_DIR` | no | `test-output/live` | Directory for the metadata, summary, Vitest report, and smoke evidence |

The stage time budget is the hard limit: the orchestrator aborts the SDK query
when it expires, and the workflow's job timeout bounds the whole run.

The metadata (`schemaVersion` 1) records `lane`, `executed`, `status`
(`passed`, `failed`, or `not-executed`), `reason`, `missingSettings`,
`invalidSettings`, `budget`, the SDK package with its declared range and
installed version, the `ad-sdlc` version, the Node.js version and platform,
`startedAt`, `finishedAt`, `durationMs`, test counts, `exitCode`, the smoke's
stage evidence (SDK session ID, turn count, token usage, stage status), the
outcome of each Import scenario (`importScenarios`), and the GitHub Actions run
URL, SHA, and ref when available. Setting values are never written; only the
names of missing settings are.

The live suite has two files:

- `tests/live/sdk-cli-smoke.live.test.ts`, the plumbing smoke: it initializes a
  project, runs only the `initialization` stage with one attempt and the lane
  budget, and asserts that the stage completed through the execution adapter
  with an SDK session and token usage.
- `tests/live/import-acceptance.live.test.ts`, the Import acceptance scenarios
  (#955). It installs the packed npm package (`npm pack`, production
  install) in a separate directory, puts the fixture `tests/live/fixtures/import-target`
  on the target repository's default branch, and for each scenario seeds
  issues from `tests/live/fixtures/import-issues.json` under a run-specific
  label, runs `ad-sdlc init . --quick` and
  `ad-sdlc run "<requirements>" --mode import --vnv-profile delivery` in a
  clone (one attempt per stage, the lane's turn budget on every Import agent),
  and judges the result:
  - **delivery**: the run completes and opens a pull request that links every
    seeded issue, stays open and unmerged, and passes the independent
    acceptance tests (`tests/live/fixtures/import-acceptance`, run on the pull
    request's head commit; AD-SDLC never sees them);
  - **required-fail**: with `AD_SDLC_FIXTURE_REQUIRED_FAIL=1` the target's
    required test fails, and the run must not report delivery or open a pull
    request;
  - **resume**: a run stopped after `validation-agent` resumes from its saved
    session without re-running completed stages, and a second resume of the
    completed session makes no SDK attempt and changes no issue, pull request,
    or commit;
  - **report**: `import-acceptance-report.json` and `.md` list every scenario,
    invocation, stage, and attempt (SDK session, model, token usage, outcome),
    including the unsuccessful and restored ones.

  Each scenario removes what it created, and only that: it closes its pull
  requests without merging, deletes its new branches, closes its issues, and
  deletes its label.

The target repository must be disposable and prepared once:

- it carries the topic `ad-sdlc-live-target` (the suite refuses to write to a
  repository without it);
- where the plan allows it (a public repository, or GitHub Pro for a private
  one), a rule on its default branch requires an approving pull request review,
  so a pull request the run opens cannot be merged with the run's own account;
  without it the requirements still tell the reviewer to leave the pull request
  open, and a merged pull request fails the scenario;
- in `secrets` mode, the token is a fine-grained token for that repository
  only, with read/write access to contents, issues, and pull requests (and read
  access to metadata).

Before each scenario the suite resets the default branch to the fixture when
it differs.
`tests/ci/import-fixture.test.ts` validates the fixture, the issue corpus, the
CLI invocation, and the scenario verdicts offline on every pull request.

The `Live Acceptance` workflow (`.github/workflows/live-acceptance.yml`) runs
the lane on a manual `workflow_dispatch` only, with inputs `max_turns` and
`stage_timeout_ms`, `contents: read` permissions, a 60 minute job timeout, and
one run at a time. It never runs on pull requests (including forks), pushes,
or schedules. It uploads the output directory as the
`live-acceptance-metadata` artifact. GitHub dispatches a workflow only from a
file on the default branch (`develop`). It reads the target repository from the
`AD_SDLC_LIVE_GITHUB_REPO` repository variable and its token from the
`AD_SDLC_LIVE_GITHUB_TOKEN` secret. Without them, or without an
`ANTHROPIC_API_KEY` (or `CLAUDE_API_KEY`) repository secret, a dispatched run
reports `not-executed` and fails.

## CI Trigger Matrix and Required Checks

The tables below are generated from `.github/workflows/*.yml` by
`scripts/ci/trigger-matrix.ts`, which evaluates each workflow's `on:` filters
and job-level `if:` conditions for the listed events.
`tests/ci/workflow-trigger-matrix.test.ts` fails when the tables differ from
the workflows, when a job's `if:` can never be true under its workflow's own
triggers, when a required check stops reporting on every pull request, or when
a workflow other than `live-acceptance.yml` references Anthropic credentials.
After changing a workflow, regenerate the tables:

```bash
npm run ci:trigger-matrix -- --write
npx prettier --write docs/guides/testing.md
```

A path-filtered workflow (`docs-check.yml`, `doc-audit.yml`, `docker.yml`)
reports only when a changed file matches its filter, so its checks must not be
required: a pull request that changes no matching file would wait for them
forever. "Changed-path filter: yes" marks those rows.

<!-- BEGIN GENERATED: workflow-trigger-matrix (npm run ci:trigger-matrix -- --write) -->

#### Trigger matrix

| Event / ref                                              | Workflow                                | Changed-path filter | Checks that run                                                                                                                                                                       | Checks skipped by `if:`          |
| -------------------------------------------------------- | --------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `pull_request` → `develop`                               | CI (`ci.yml`)                           | no                  | `Lint`, `Test (ubuntu-latest)`, `Test (windows-2022)`, `Build`, `Package Asset Delivery (offline)`, `Integration Tests`, `Pipeline E2E (offline)`, `Security Scan`                    | `CodeQL Analysis`                |
| `pull_request` → `develop`                               | Documentation Audit (`doc-audit.yml`)   | yes                 | `README lint`                                                                                                                                                                         | —                                |
| `pull_request` → `develop`                               | Document Checks (`docs-check.yml`)      | yes                 | `Validate Documentation Against Code`, `Validate .claude/agents Frontmatter`, `Validate Traceability Matrix`, `Check Document Cascade Updates`                                        | —                                |
| `pull_request` → `develop`                               | Security Scan (`security.yml`)          | no                  | `Dependency Audit`, `Secret Scanning`, `License Check`, `Security Best Practices Check`, `Security Summary`                                                                           | `CodeQL Analysis`                |
| `pull_request` → `main`                                  | CI (`ci.yml`)                           | no                  | `Lint`, `Test (ubuntu-latest)`, `Test (windows-2022)`, `Build`, `Package Asset Delivery (offline)`, `Integration Tests`, `Pipeline E2E (offline)`, `Security Scan`                    | `CodeQL Analysis`                |
| `pull_request` → `main`                                  | Documentation Audit (`doc-audit.yml`)   | yes                 | `README lint`                                                                                                                                                                         | —                                |
| `pull_request` → `main`                                  | Docker (`docker.yml`)                   | yes                 | `Build Docker Image`                                                                                                                                                                  | —                                |
| `pull_request` → `main`                                  | Document Checks (`docs-check.yml`)      | yes                 | `Validate Documentation Against Code`, `Validate .claude/agents Frontmatter`, `Validate Traceability Matrix`, `Check Document Cascade Updates`                                        | —                                |
| `pull_request` → `main`                                  | Performance Tests (`performance.yml`)   | no                  | `benchmark`, `memory-profile`, `scalability`                                                                                                                                          | —                                |
| `pull_request` → `main`                                  | Security Scan (`security.yml`)          | no                  | `Dependency Audit`, `Secret Scanning`, `License Check`, `Security Best Practices Check`, `Security Summary`                                                                           | `CodeQL Analysis`                |
| `pull_request` → `feature/example`                       | Document Checks (`docs-check.yml`)      | yes                 | `Validate Documentation Against Code`, `Validate .claude/agents Frontmatter`, `Validate Traceability Matrix`, `Check Document Cascade Updates`                                        | —                                |
| `push` → `develop`                                       | CI (`ci.yml`)                           | no                  | `Lint`, `Test (ubuntu-latest)`, `Test (windows-2022)`, `Build`, `Package Asset Delivery (offline)`, `Integration Tests`, `Pipeline E2E (offline)`, `Security Scan`, `CodeQL Analysis` | —                                |
| `push` → `develop`                                       | Documentation Audit (`doc-audit.yml`)   | yes                 | `README lint`                                                                                                                                                                         | —                                |
| `push` → `develop`                                       | Docker (`docker.yml`)                   | yes                 | `Build Docker Image`                                                                                                                                                                  | —                                |
| `push` → `develop`                                       | Document Checks (`docs-check.yml`)      | yes                 | `Validate Documentation Against Code`, `Validate .claude/agents Frontmatter`, `Validate Traceability Matrix`                                                                          | `Check Document Cascade Updates` |
| `push` → `develop`                                       | Security Scan (`security.yml`)          | no                  | `Dependency Audit`, `CodeQL Analysis`, `Secret Scanning`, `License Check`, `Security Best Practices Check`, `Security Summary`                                                        | —                                |
| `push` → `main`                                          | CI (`ci.yml`)                           | no                  | `Lint`, `Test (ubuntu-latest)`, `Test (windows-2022)`, `Build`, `Package Asset Delivery (offline)`, `Integration Tests`, `Pipeline E2E (offline)`, `Security Scan`, `CodeQL Analysis` | —                                |
| `push` → `main`                                          | Documentation Audit (`doc-audit.yml`)   | yes                 | `README lint`                                                                                                                                                                         | —                                |
| `push` → `main`                                          | Docker (`docker.yml`)                   | yes                 | `Build Docker Image`                                                                                                                                                                  | —                                |
| `push` → `main`                                          | Document Checks (`docs-check.yml`)      | yes                 | `Validate Documentation Against Code`, `Validate .claude/agents Frontmatter`, `Validate Traceability Matrix`                                                                          | `Check Document Cascade Updates` |
| `push` → `main`                                          | Performance Tests (`performance.yml`)   | no                  | `benchmark`, `memory-profile`, `scalability`                                                                                                                                          | —                                |
| `push` → `main`                                          | Security Scan (`security.yml`)          | no                  | `Dependency Audit`, `CodeQL Analysis`, `Secret Scanning`, `License Check`, `Security Best Practices Check`, `Security Summary`                                                        | —                                |
| `push` → `release/example`                               | —                                       | —                   | nothing runs                                                                                                                                                                          | —                                |
| `push` → tag `v0.1.0`                                    | Release (`release.yml`)                 | no                  | `Validate Release`, `Run Tests`, `Build`, `Publish to NPM`, `Create GitHub Release`                                                                                                   | —                                |
| `schedule` (`develop`)                                   | Security Scan (`security.yml`)          | no                  | `Dependency Audit`, `CodeQL Analysis`, `Secret Scanning`, `License Check`, `Security Best Practices Check`, `Security Summary`                                                        | —                                |
| `workflow_dispatch` of `live-acceptance.yml` (`develop`) | Live Acceptance (`live-acceptance.yml`) | no                  | `Live Acceptance`                                                                                                                                                                     | —                                |
| `workflow_dispatch` of `performance.yml` (`develop`)     | Performance Tests (`performance.yml`)   | no                  | `benchmark`, `memory-profile`, `scalability`                                                                                                                                          | —                                |

#### Workflow trigger filters

| Workflow              | Event               | Branch / tag filter         | `paths`                                                                                                                                                                                                                                                                                                                                                                  | `paths-ignore` |
| --------------------- | ------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| `ci.yml`              | `pull_request`      | branches: `main`, `develop` | —                                                                                                                                                                                                                                                                                                                                                                        | —              |
| `ci.yml`              | `push`              | branches: `main`, `develop` | —                                                                                                                                                                                                                                                                                                                                                                        | —              |
| `doc-audit.yml`       | `pull_request`      | branches: `develop`, `main` | `README.md`, `package.json`, `docs/**`, `scripts/readme_lint.py`, `scripts/tests/**`, `.github/workflows/**`                                                                                                                                                                                                                                                             | —              |
| `doc-audit.yml`       | `push`              | branches: `develop`, `main` | `README.md`, `package.json`, `docs/**`, `scripts/readme_lint.py`, `scripts/tests/**`, `.github/workflows/**`                                                                                                                                                                                                                                                             | —              |
| `docker.yml`          | `pull_request`      | branches: `main`            | `docker/**`, `.github/workflows/docker.yml`                                                                                                                                                                                                                                                                                                                              | —              |
| `docker.yml`          | `push`              | branches: `main`, `develop` | `docker/**`, `.github/workflows/docker.yml`                                                                                                                                                                                                                                                                                                                              | —              |
| `docs-check.yml`      | `pull_request`      | any                         | `README.md`, `docs/**`, `doc-sync-points.yaml`, `.claude/agents/**`, `.claude/commands/**`, `agent-assets.manifest.json`, `scripts/agent-assets.ts`, `scripts/audit-docs.ts`, `tests/package/**`, `tests/project-initializer/**`, `tests/cli/**`, `.github/workflows/**`, `src/**`, `scripts/ci/validate-doc-*.ts`, `package.json`, `package-lock.json`, `tsconfig.json` | —              |
| `docs-check.yml`      | `push`              | branches: `develop`, `main` | `README.md`, `docs/**`, `doc-sync-points.yaml`, `.claude/agents/**`, `.claude/commands/**`, `agent-assets.manifest.json`, `scripts/agent-assets.ts`, `scripts/audit-docs.ts`, `tests/package/**`, `tests/project-initializer/**`, `tests/cli/**`, `.github/workflows/**`, `src/**`, `scripts/ci/validate-doc-*.ts`, `package.json`, `package-lock.json`, `tsconfig.json` | —              |
| `live-acceptance.yml` | `workflow_dispatch` | default branch (`develop`)  | —                                                                                                                                                                                                                                                                                                                                                                        | —              |
| `performance.yml`     | `pull_request`      | branches: `main`            | —                                                                                                                                                                                                                                                                                                                                                                        | —              |
| `performance.yml`     | `push`              | branches: `main`            | —                                                                                                                                                                                                                                                                                                                                                                        | —              |
| `performance.yml`     | `workflow_dispatch` | default branch (`develop`)  | —                                                                                                                                                                                                                                                                                                                                                                        | —              |
| `release.yml`         | `push`              | tags: `v*`                  | —                                                                                                                                                                                                                                                                                                                                                                        | —              |
| `security.yml`        | `pull_request`      | branches: `main`, `develop` | —                                                                                                                                                                                                                                                                                                                                                                        | —              |
| `security.yml`        | `push`              | branches: `main`, `develop` | —                                                                                                                                                                                                                                                                                                                                                                        | —              |
| `security.yml`        | `schedule`          | default branch (`develop`)  | —                                                                                                                                                                                                                                                                                                                                                                        | —              |

#### Check names and required status

| Check                                 | Workflow              | PR → `develop` | PR → `main`    | Push → `develop` | Required (#970) | Note                                                                                                  |
| ------------------------------------- | --------------------- | -------------- | -------------- | ---------------- | --------------- | ----------------------------------------------------------------------------------------------------- |
| `Lint`                                | `ci.yml`              | every run      | every run      | every run        | yes             | —                                                                                                     |
| `Test (ubuntu-latest)`                | `ci.yml`              | every run      | every run      | every run        | yes             | —                                                                                                     |
| `Test (windows-2022)`                 | `ci.yml`              | every run      | every run      | every run        | yes             | —                                                                                                     |
| `Build`                               | `ci.yml`              | every run      | every run      | every run        | yes             | —                                                                                                     |
| `Package Asset Delivery (offline)`    | `ci.yml`              | every run      | every run      | every run        | yes             | —                                                                                                     |
| `Integration Tests`                   | `ci.yml`              | every run      | every run      | every run        | yes             | —                                                                                                     |
| `Pipeline E2E (offline)`              | `ci.yml`              | every run      | every run      | every run        | yes             | —                                                                                                     |
| `Security Scan`                       | `ci.yml`              | every run      | every run      | every run        | yes             | —                                                                                                     |
| `CodeQL Analysis`                     | `ci.yml`              | skipped by if: | skipped by if: | every run        | no              | Skipped on pull requests by its job-level if:.                                                        |
| `README lint`                         | `doc-audit.yml`       | path-filtered  | path-filtered  | path-filtered    | no              | Path-filtered: does not report on every PR, so it must not be required.                               |
| `Build Docker Image`                  | `docker.yml`          | not triggered  | path-filtered  | path-filtered    | no              | Path-filtered, pull requests into main only: does not report on every PR, so it must not be required. |
| `Validate Documentation Against Code` | `docs-check.yml`      | path-filtered  | path-filtered  | path-filtered    | no              | Path-filtered: does not report on every PR, so it must not be required.                               |
| `Validate .claude/agents Frontmatter` | `docs-check.yml`      | path-filtered  | path-filtered  | path-filtered    | no              | Path-filtered: does not report on every PR, so it must not be required.                               |
| `Validate Traceability Matrix`        | `docs-check.yml`      | path-filtered  | path-filtered  | path-filtered    | no              | Path-filtered: does not report on every PR, so it must not be required.                               |
| `Check Document Cascade Updates`      | `docs-check.yml`      | path-filtered  | path-filtered  | skipped by if:   | no              | Path-filtered: does not report on every PR, so it must not be required.                               |
| `Live Acceptance`                     | `live-acceptance.yml` | not triggered  | not triggered  | not triggered    | no              | Does not run on pull requests.                                                                        |
| `benchmark`                           | `performance.yml`     | not triggered  | every run      | not triggered    | no              | Pull requests into main only; not part of the shared develop and main set.                            |
| `memory-profile`                      | `performance.yml`     | not triggered  | every run      | not triggered    | no              | Pull requests into main only; not part of the shared develop and main set.                            |
| `scalability`                         | `performance.yml`     | not triggered  | every run      | not triggered    | no              | Pull requests into main only; not part of the shared develop and main set.                            |
| `Validate Release`                    | `release.yml`         | not triggered  | not triggered  | not triggered    | no              | Does not run on pull requests.                                                                        |
| `Run Tests`                           | `release.yml`         | not triggered  | not triggered  | not triggered    | no              | Does not run on pull requests.                                                                        |
| `Build`                               | `release.yml`         | not triggered  | not triggered  | not triggered    | no              | Does not run on pull requests.                                                                        |
| `Publish to NPM`                      | `release.yml`         | not triggered  | not triggered  | not triggered    | no              | Does not run on pull requests.                                                                        |
| `Create GitHub Release`               | `release.yml`         | not triggered  | not triggered  | not triggered    | no              | Does not run on pull requests.                                                                        |
| `Dependency Audit`                    | `security.yml`        | every run      | every run      | every run        | yes             | —                                                                                                     |
| `CodeQL Analysis`                     | `security.yml`        | skipped by if: | skipped by if: | every run        | no              | Skipped on pull requests by its job-level if:.                                                        |
| `Secret Scanning`                     | `security.yml`        | every run      | every run      | every run        | no              | Gitleaks runs with continue-on-error, so the job cannot fail.                                         |
| `License Check`                       | `security.yml`        | every run      | every run      | every run        | yes             | —                                                                                                     |
| `Security Best Practices Check`       | `security.yml`        | every run      | every run      | every run        | no              | Reports grep findings as warnings only; the job cannot fail.                                          |
| `Security Summary`                    | `security.yml`        | every run      | every run      | every run        | no              | Writes a summary table with if: always(); the job cannot fail.                                        |

Required check names for the #970 rulesets on `develop` and `main`:

- `Lint` (`ci.yml`)
- `Test (ubuntu-latest)` (`ci.yml`)
- `Test (windows-2022)` (`ci.yml`)
- `Build` (`ci.yml`)
- `Package Asset Delivery (offline)` (`ci.yml`)
- `Integration Tests` (`ci.yml`)
- `Pipeline E2E (offline)` (`ci.yml`)
- `Security Scan` (`ci.yml`)
- `Dependency Audit` (`security.yml`)
- `License Check` (`security.yml`)

<!-- END GENERATED: workflow-trigger-matrix -->

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

The thresholds in `vitest.config.ts`, enforced by `npm test -- --coverage` in
the `Test (ubuntu-latest)` check:

| Metric     | Minimum |
| ---------- | ------- |
| Lines      | 80%     |
| Functions  | 78%     |
| Branches   | 70%     |
| Statements | 80%     |

Run coverage report:

```bash
npm run test:coverage
```

---

_Part of [Claude Code Agent Documentation](../README.md)_
