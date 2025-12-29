# Regression Tester Agent

The Regression Tester Agent validates that existing functionality is not broken by new changes. It identifies affected tests, runs regression test suites, and reports potential compatibility issues. This is a core component of the Enhancement Pipeline.

## Overview

The Regression Tester Agent is responsible for:

- **Affected Test Identification**: Detecting which tests may be impacted by code changes using file naming conventions and dependency graphs
- **Test Mapping**: Building mappings between source files and their corresponding test files
- **Regression Test Execution**: Running affected tests to verify functionality (when enabled)
- **Coverage Impact Analysis**: Analyzing how changes affect test coverage (when enabled)
- **Compatibility Verification**: Detecting potential breaking changes and API incompatibilities
- **Recommendation Generation**: Providing actionable suggestions based on analysis results

## Installation

The Regression Tester Agent is included in the main package:

```bash
npm install ad-sdlc
```

## Basic Usage

```typescript
import {
  RegressionTesterAgent,
  getRegressionTesterAgent,
  type ChangedFile,
} from 'ad-sdlc';

// Get singleton instance
const agent = getRegressionTesterAgent();

// Define changed files
const changedFiles: ChangedFile[] = [
  { path: 'src/services/userService.ts', changeType: 'modified', linesChanged: 25 },
  { path: 'src/controllers/authController.ts', changeType: 'modified', linesChanged: 10 },
];

// Start regression testing session
await agent.startSession('my-project', '/path/to/project', changedFiles);

// Run analysis
const result = await agent.analyze();

console.log('Analysis status:', result.report.summary.status);
console.log('Affected tests:', result.report.affectedTests.length);
console.log('Recommendations:', result.report.recommendations.length);
```

## API Reference

### RegressionTesterAgent

Main class for regression testing and analysis.

#### Constructor

```typescript
new RegressionTesterAgent(config?: Partial<RegressionTesterConfig>)
```

#### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `scratchpadBasePath` | `string` | `.ad-sdlc/scratchpad` | Base path for scratchpad outputs |
| `runTests` | `boolean` | `true` | Whether to actually run tests |
| `collectCoverage` | `boolean` | `true` | Whether to collect coverage data |
| `testTimeout` | `number` | `30000` | Timeout per test in milliseconds |
| `parallelTests` | `number` | `4` | Number of parallel test executions |
| `testPatterns` | `string[]` | Standard patterns | Glob patterns for test file discovery |
| `excludePatterns` | `string[]` | `['node_modules', ...]` | Patterns to exclude from analysis |
| `coverageThreshold` | `number` | `80` | Minimum coverage percentage |
| `detectBreakingChanges` | `boolean` | `true` | Detect breaking API changes |
| `maxTests` | `number` | `1000` | Maximum number of tests to run |

#### Methods

##### startSession

Starts a new regression testing session.

```typescript
async startSession(
  projectId: string,
  projectPath: string,
  changedFiles: ChangedFile[]
): Promise<RegressionTesterSession>
```

**Parameters:**
- `projectId`: Unique identifier for the project
- `projectPath`: Root path of the project
- `changedFiles`: Array of changed files to analyze

**Returns:** `RegressionTesterSession` object

**Throws:**
- `InvalidProjectPathError`: If project path doesn't exist
- `NoChangedFilesError`: If no changed files provided

##### analyze

Runs complete regression analysis.

```typescript
async analyze(): Promise<RegressionAnalysisResult>
```

**Returns:** `RegressionAnalysisResult` containing:
- `success`: Boolean indicating analysis success
- `projectId`: Project identifier
- `outputPath`: Path to generated report
- `report`: Complete regression report
- `stats`: Analysis statistics
- `warnings`: Any warnings generated

**Throws:**
- `NoActiveSessionError`: If no session is active
- `NoTestsFoundError`: If no test files are discovered

##### getCurrentSession

Gets the current session state.

```typescript
getCurrentSession(): RegressionTesterSession | null
```

##### getConfig

Gets the current configuration.

```typescript
getConfig(): RegressionTesterConfig
```

### Singleton Functions

```typescript
// Get singleton instance
getRegressionTesterAgent(config?: Partial<RegressionTesterConfig>): RegressionTesterAgent

// Reset singleton (useful for testing)
resetRegressionTesterAgent(): void
```

## Types

### ChangedFile

Represents a file that has been modified.

```typescript
interface ChangedFile {
  path: string;
  changeType: 'added' | 'modified' | 'deleted' | 'renamed';
  linesChanged: number;
  oldPath?: string;  // For renamed files
}
```

### RegressionReport

Complete regression analysis report.

```typescript
interface RegressionReport {
  analysisDate: string;
  projectId: string;
  changesAnalyzed: ChangesAnalyzed;
  testMapping: TestMappingSummary;
  affectedTests: AffectedTest[];
  testExecution: TestExecutionSummary;
  coverageImpact: CoverageImpact | null;
  compatibilityIssues: CompatibilityIssue[];
  recommendations: RegressionRecommendation[];
  summary: RegressionSummary;
}
```

### AffectedTest

Represents a test affected by changes.

```typescript
interface AffectedTest {
  testFile: string;
  testName: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  reason: string;
  relatedChanges: string[];
  estimatedDuration: number;
}
```

## Test Discovery

The agent uses configurable glob patterns to discover test files:

**Default Patterns:**
- `tests/**/*.test.ts`
- `tests/**/*.spec.ts`
- `test/**/*.test.ts`
- `test/**/*.spec.ts`
- `**/__tests__/**/*.ts`
- `**/*.test.ts`
- `**/*.spec.ts`

**Excluded Directories:**
- `node_modules`
- `dist`
- `build`
- `.git`
- `coverage`

## Test Mapping Strategies

### 1. Naming Convention

Maps source files to tests based on naming:
- `src/services/userService.ts` → `tests/services/userService.test.ts`
- `src/utils/helpers.ts` → `tests/utils/helpers.spec.ts`

### 2. Directory Structure

Mirrors source directory structure in test directories:
- `src/**/*.ts` → `tests/**/*.test.ts`

### 3. Dependency Graph

Uses the dependency graph from Codebase Analyzer to find tests that:
- Import the changed file directly
- Import files that depend on the changed file (transitive)

## Integration with Other Agents

### Codebase Analyzer

The Regression Tester uses the dependency graph generated by Codebase Analyzer:

```typescript
// Dependency graph is loaded from:
// .ad-sdlc/scratchpad/analysis/{projectId}/dependency_graph.json
```

### Worker Agent

After code changes, the Worker Agent can trigger regression testing:

```typescript
// Worker completes implementation
const changedFiles = workerResult.modifiedFiles;

// Start regression testing
await regressionTester.startSession(projectId, projectPath, changedFiles);
const result = await regressionTester.analyze();
```

### PR Reviewer

Regression test results are included in PR review:

```typescript
// Regression report is saved to:
// .ad-sdlc/scratchpad/regression/{projectId}/regression_report.yaml
```

## Output Format

The agent generates a YAML report with the following structure:

```yaml
analysisDate: "2024-01-15T10:30:00.000Z"
projectId: "my-project"
changesAnalyzed:
  totalFiles: 5
  filesModified: 3
  filesAdded: 1
  filesDeleted: 1
  totalLinesChanged: 150

testMapping:
  totalTestFiles: 25
  mappedFiles: 20
  unmappedFiles: 5
  mappingCoverage: 0.8

affectedTests:
  - testFile: "tests/services/userService.test.ts"
    testName: "UserService"
    priority: "critical"
    reason: "direct_import"
    relatedChanges:
      - "src/services/userService.ts"

summary:
  status: "passed"
  message: "All affected tests passed"
  totalIssues: 0
  blockingIssues: 0
```

## Error Handling

The agent throws specific errors for different failure conditions:

| Error | Cause |
|-------|-------|
| `NoActiveSessionError` | analyze() called without startSession() |
| `NoChangedFilesError` | Empty changed files array |
| `InvalidProjectPathError` | Project path doesn't exist |
| `NoTestsFoundError` | No test files found |
| `TestTimeoutError` | Test exceeded timeout |
| `MaxTestsExceededError` | Too many tests found |
| `DependencyGraphNotFoundError` | Dependency graph missing |

## Best Practices

1. **Run Codebase Analyzer First**: Ensure dependency graph is available for better accuracy
2. **Configure Test Patterns**: Customize patterns to match your project structure
3. **Set Appropriate Timeouts**: Adjust `testTimeout` based on your test suite
4. **Review Recommendations**: Check generated recommendations for coverage gaps
5. **Monitor Coverage Threshold**: Keep coverage above the configured threshold

## Example: Complete Workflow

```typescript
import {
  getCodebaseAnalyzerAgent,
  getRegressionTesterAgent,
} from 'ad-sdlc';

async function runRegressionTests(projectId: string, projectPath: string, changedFiles: ChangedFile[]) {
  // Step 1: Ensure codebase is analyzed (for dependency graph)
  const codebaseAnalyzer = getCodebaseAnalyzerAgent();
  await codebaseAnalyzer.startSession(projectId, projectPath);
  await codebaseAnalyzer.analyze();

  // Step 2: Run regression tests
  const regressionTester = getRegressionTesterAgent({
    runTests: true,
    collectCoverage: true,
    coverageThreshold: 80,
  });

  await regressionTester.startSession(projectId, projectPath, changedFiles);
  const result = await regressionTester.analyze();

  // Step 3: Check results
  if (result.report.summary.status === 'failed') {
    console.error('Regression tests failed!');
    console.error('Blocking issues:', result.report.summary.blockingIssues);
    return false;
  }

  console.log('Regression tests passed!');
  return true;
}
```

## Related Documentation

- [Codebase Analyzer](./codebase-analyzer.md) - Generates dependency graphs
- [Worker Agent](./worker.md) - Implements code changes
- [PR Reviewer](./pr-reviewer.md) - Reviews regression test results
- [System Architecture](./system-architecture.md) - Overall system design
