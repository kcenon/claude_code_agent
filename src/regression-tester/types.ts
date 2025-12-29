/**
 * Regression Tester Agent module type definitions
 *
 * Defines types for test mapping, affected test identification,
 * regression test execution, and compatibility verification.
 */

/**
 * Test execution status
 */
export type TestStatus = 'passed' | 'failed' | 'skipped' | 'error';

/**
 * Priority levels for affected tests
 */
export type TestPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Compatibility issue types
 */
export type CompatibilityIssueType = 'breaking_change' | 'deprecation' | 'behavior_change';

/**
 * Issue severity levels
 */
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Recommendation types
 */
export type RecommendationType = 'fix_required' | 'review_suggested' | 'acceptable';

/**
 * Overall regression status
 */
export type RegressionStatus = 'passed' | 'failed' | 'warning';

/**
 * File change types
 */
export type FileChangeType = 'modified' | 'added' | 'deleted' | 'renamed';

/**
 * Supported test frameworks
 */
export type TestFramework =
  | 'jest'
  | 'vitest'
  | 'mocha'
  | 'pytest'
  | 'junit'
  | 'go'
  | 'cargo'
  | 'other'
  | 'unknown';

/**
 * Session status
 */
export type RegressionSessionStatus =
  | 'mapping'
  | 'identifying'
  | 'executing'
  | 'analyzing'
  | 'completed'
  | 'failed';

/**
 * Changed file information
 */
export interface ChangedFile {
  /** File path relative to project root */
  readonly path: string;
  /** Type of change */
  readonly changeType: FileChangeType;
  /** Number of lines changed */
  readonly linesChanged: number;
  /** Old path if renamed */
  readonly oldPath?: string;
}

/**
 * Test file information
 */
export interface TestFile {
  /** Test file path */
  readonly path: string;
  /** Test framework detected */
  readonly framework: TestFramework;
  /** Number of test cases in file */
  readonly testCount: number;
  /** Source files this test covers */
  readonly coversFiles: readonly string[];
}

/**
 * Test case information
 */
export interface TestCase {
  /** Test file path */
  readonly file: string;
  /** Test name */
  readonly name: string;
  /** Test suite/describe block name */
  readonly suite?: string;
  /** Line number in test file */
  readonly line?: number;
}

/**
 * Test-to-code mapping entry
 */
export interface TestMapping {
  /** Source file path */
  readonly sourceFile: string;
  /** Test files that cover this source */
  readonly testFiles: readonly string[];
  /** Confidence of mapping (0.0 - 1.0) */
  readonly confidence: number;
  /** Mapping method used */
  readonly method: 'naming' | 'import' | 'dependency' | 'coverage';
}

/**
 * Test mapping summary
 */
export interface TestMappingSummary {
  /** Total test files found */
  readonly totalTestFiles: number;
  /** Total test cases found */
  readonly totalTestCases: number;
  /** Mapping coverage ratio (0.0 - 1.0) */
  readonly mappingCoverage: number;
  /** Source files without test mapping */
  readonly unmappedSourceFiles: readonly string[];
}

/**
 * Affected test entry
 */
export interface AffectedTest {
  /** Test file path */
  readonly testFile: string;
  /** Test name */
  readonly testName: string;
  /** Related changed files */
  readonly relatedChanges: readonly string[];
  /** Test priority */
  readonly priority: TestPriority;
  /** Reason for being affected */
  readonly reason: string;
}

/**
 * Changes analyzed summary
 */
export interface ChangesAnalyzed {
  /** Number of modified files */
  readonly filesModified: number;
  /** Number of added files */
  readonly filesAdded: number;
  /** Number of deleted files */
  readonly filesDeleted: number;
  /** Number of affected components */
  readonly componentsAffected: number;
}

/**
 * Individual test result
 */
export interface TestResult {
  /** Test file path */
  readonly testFile: string;
  /** Test name */
  readonly testName: string;
  /** Test status */
  readonly status: TestStatus;
  /** Duration in milliseconds */
  readonly durationMs: number;
  /** Error message if failed */
  readonly errorMessage: string | null;
  /** Related change that caused test to run */
  readonly relatedChange: string | null;
}

/**
 * Test execution summary
 */
export interface TestExecutionSummary {
  /** Total tests run */
  readonly totalTestsRun: number;
  /** Number of passed tests */
  readonly passed: number;
  /** Number of failed tests */
  readonly failed: number;
  /** Number of skipped tests */
  readonly skipped: number;
  /** Total duration in seconds */
  readonly durationSeconds: number;
  /** Individual test results */
  readonly results: readonly TestResult[];
}

/**
 * Coverage metrics
 */
export interface CoverageMetrics {
  /** Statement coverage percentage */
  readonly statements: number;
  /** Branch coverage percentage */
  readonly branches: number;
  /** Function coverage percentage */
  readonly functions: number;
  /** Line coverage percentage */
  readonly lines: number;
}

/**
 * Uncovered lines information
 */
export interface UncoveredLines {
  /** File path */
  readonly file: string;
  /** Uncovered line numbers */
  readonly lines: readonly number[];
}

/**
 * Coverage impact analysis
 */
export interface CoverageImpact {
  /** Coverage before changes */
  readonly before: CoverageMetrics;
  /** Coverage after changes */
  readonly after: CoverageMetrics;
  /** Coverage delta */
  readonly delta: CoverageMetrics;
  /** Newly uncovered lines */
  readonly uncoveredLines: readonly UncoveredLines[];
}

/**
 * Compatibility issue
 */
export interface CompatibilityIssue {
  /** Issue type */
  readonly type: CompatibilityIssueType;
  /** Issue severity */
  readonly severity: IssueSeverity;
  /** Description of the issue */
  readonly description: string;
  /** Affected code location */
  readonly affectedCode: string;
  /** Suggested action to fix */
  readonly suggestedAction: string;
}

/**
 * Recommendation entry
 */
export interface Recommendation {
  /** Recommendation type */
  readonly type: RecommendationType;
  /** Priority level */
  readonly priority: TestPriority;
  /** Recommendation message */
  readonly message: string;
  /** Related tests */
  readonly relatedTests: readonly string[];
}

/**
 * Regression report summary
 */
export interface RegressionSummary {
  /** Overall status */
  readonly status: RegressionStatus;
  /** Total issues found */
  readonly totalIssues: number;
  /** Number of blocking issues */
  readonly blockingIssues: number;
  /** Summary message */
  readonly message: string;
}

/**
 * Complete regression report
 */
export interface RegressionReport {
  /** Analysis timestamp */
  readonly analysisDate: string;
  /** Project identifier */
  readonly projectId: string;
  /** Changes analyzed summary */
  readonly changesAnalyzed: ChangesAnalyzed;
  /** Test mapping summary */
  readonly testMapping: TestMappingSummary;
  /** List of affected tests */
  readonly affectedTests: readonly AffectedTest[];
  /** Test execution summary */
  readonly testExecution: TestExecutionSummary;
  /** Coverage impact analysis */
  readonly coverageImpact: CoverageImpact | null;
  /** Compatibility issues found */
  readonly compatibilityIssues: readonly CompatibilityIssue[];
  /** Recommendations */
  readonly recommendations: readonly Recommendation[];
  /** Overall summary */
  readonly summary: RegressionSummary;
}

/**
 * Regression tester session
 */
export interface RegressionTesterSession {
  /** Session identifier */
  readonly sessionId: string;
  /** Project identifier */
  readonly projectId: string;
  /** Session status */
  readonly status: RegressionSessionStatus;
  /** Project root path */
  readonly projectPath: string;
  /** Changed files being analyzed */
  readonly changedFiles: readonly ChangedFile[];
  /** Test mapping result */
  readonly testMappings: readonly TestMapping[];
  /** Affected tests identified */
  readonly affectedTests: readonly AffectedTest[];
  /** Regression report result */
  readonly report: RegressionReport | null;
  /** Session start time */
  readonly startedAt: string;
  /** Session last update time */
  readonly updatedAt: string;
  /** Warnings during analysis */
  readonly warnings: readonly string[];
  /** Errors during analysis */
  readonly errors: readonly string[];
}

/**
 * Regression tester configuration
 */
export interface RegressionTesterConfig {
  /** Base path for scratchpad (defaults to .ad-sdlc/scratchpad) */
  readonly scratchpadBasePath?: string;
  /** Test directory patterns */
  readonly testPatterns?: readonly string[];
  /** Files to exclude from analysis */
  readonly excludePatterns?: readonly string[];
  /** Whether to run tests */
  readonly runTests?: boolean;
  /** Whether to collect coverage */
  readonly collectCoverage?: boolean;
  /** Test timeout in milliseconds */
  readonly testTimeout?: number;
  /** Maximum tests to run (0 = unlimited) */
  readonly maxTests?: number;
  /** Coverage threshold for warnings */
  readonly coverageThreshold?: number;
  /** Whether to detect breaking changes */
  readonly detectBreakingChanges?: boolean;
}

/**
 * Default configuration values
 */
export const DEFAULT_REGRESSION_TESTER_CONFIG: Required<RegressionTesterConfig> = {
  scratchpadBasePath: '.ad-sdlc/scratchpad',
  testPatterns: [
    'test/**/*',
    'tests/**/*',
    '__tests__/**/*',
    '**/*.test.*',
    '**/*.spec.*',
    '**/test_*.py',
    '**/*_test.go',
  ],
  excludePatterns: ['node_modules', '.git', 'dist', 'build', 'coverage', '__pycache__', '.venv'],
  runTests: true,
  collectCoverage: true,
  testTimeout: 30000, // 30 seconds
  maxTests: 0, // unlimited
  coverageThreshold: 80, // 80%
  detectBreakingChanges: true,
} as const;

/**
 * Regression analysis result
 */
export interface RegressionAnalysisResult {
  /** Whether analysis was successful */
  readonly success: boolean;
  /** Project ID */
  readonly projectId: string;
  /** Path to regression_report.yaml */
  readonly outputPath: string;
  /** Regression report */
  readonly report: RegressionReport;
  /** Analysis statistics */
  readonly stats: RegressionAnalysisStats;
  /** Warnings during analysis */
  readonly warnings: readonly string[];
}

/**
 * Statistics about the regression analysis process
 */
export interface RegressionAnalysisStats {
  /** Number of files analyzed */
  readonly filesAnalyzed: number;
  /** Number of tests discovered */
  readonly testsDiscovered: number;
  /** Number of tests executed */
  readonly testsExecuted: number;
  /** Number of mappings created */
  readonly mappingsCreated: number;
  /** Total processing time in milliseconds */
  readonly processingTimeMs: number;
}

/**
 * Dependency graph node (from Codebase Analyzer)
 */
export interface DependencyNode {
  /** Node identifier */
  readonly id: string;
  /** Node type */
  readonly type: 'internal' | 'external';
  /** File path */
  readonly path?: string;
  /** Exported symbols */
  readonly exports: readonly string[];
}

/**
 * Dependency graph edge (from Codebase Analyzer)
 */
export interface DependencyEdge {
  /** Source node ID */
  readonly from: string;
  /** Target node ID */
  readonly to: string;
  /** Edge type */
  readonly type: 'import' | 'extends' | 'implements' | 'uses';
  /** Edge weight */
  readonly weight: number;
}

/**
 * Dependency graph (from Codebase Analyzer)
 */
export interface DependencyGraph {
  /** Graph nodes */
  readonly nodes: readonly DependencyNode[];
  /** Graph edges */
  readonly edges: readonly DependencyEdge[];
}
