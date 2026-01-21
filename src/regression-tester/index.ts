/**
 * Regression Tester Agent module exports
 *
 * Provides functionality for validating that existing functionality
 * is not broken by new changes through test mapping, execution,
 * and compatibility analysis.
 */

// Main classes and singletons
export {
  RegressionTesterAgent,
  getRegressionTesterAgent,
  resetRegressionTesterAgent,
  REGRESSION_TESTER_AGENT_ID,
} from './RegressionTesterAgent.js';

// Type exports
export type {
  // Status and priority types
  TestStatus,
  TestPriority,
  CompatibilityIssueType,
  IssueSeverity,
  RecommendationType,
  RegressionStatus,
  FileChangeType,
  TestFramework,
  RegressionSessionStatus,
  // Changed file types
  ChangedFile,
  // Test types
  TestFile,
  TestCase,
  TestMapping,
  TestMappingSummary,
  AffectedTest,
  // Execution types
  ChangesAnalyzed,
  TestResult,
  TestExecutionSummary,
  // Coverage types
  CoverageMetrics,
  UncoveredLines,
  CoverageImpact,
  // Issue types
  CompatibilityIssue,
  Recommendation,
  RegressionSummary,
  // Report types
  RegressionReport,
  // Session types
  RegressionTesterSession,
  // Configuration types
  RegressionTesterConfig,
  // Result types
  RegressionAnalysisResult,
  RegressionAnalysisStats,
  // Dependency graph types (from Codebase Analyzer)
  DependencyNode,
  DependencyEdge,
  DependencyGraph,
} from './types.js';

// Constants
export { DEFAULT_REGRESSION_TESTER_CONFIG } from './types.js';

// Error exports
export {
  RegressionTesterError,
  NoTestsFoundError,
  TestExecutionFailedError,
  TestFrameworkNotDetectedError,
  CoverageCalculationError,
  DependencyGraphNotFoundError,
  NoChangedFilesError,
  TestTimeoutError,
  NoActiveSessionError,
  InvalidSessionStateError,
  OutputWriteError,
  FileReadError,
  InvalidProjectPathError,
  TestMappingError,
  MaxTestsExceededError,
} from './errors.js';
