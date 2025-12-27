/**
 * Controller module
 *
 * Provides dependency graph analysis and prioritization
 * for the Controller Agent orchestration.
 *
 * @module controller
 */

export { PriorityAnalyzer } from './PriorityAnalyzer.js';

export type {
  Priority,
  IssueStatus,
  PriorityWeights,
  IssueNode,
  DependencyEdge,
  RawDependencyGraph,
  AnalyzedIssue,
  ParallelGroup,
  CriticalPath,
  PrioritizedQueue,
  GraphAnalysisResult,
  GraphStatistics,
  PriorityAnalyzerConfig,
} from './types.js';

export { DEFAULT_PRIORITY_WEIGHTS, DEFAULT_ANALYZER_CONFIG } from './types.js';

export {
  ControllerError,
  GraphNotFoundError,
  GraphParseError,
  GraphValidationError,
  CircularDependencyError,
  IssueNotFoundError,
  PriorityAnalysisError,
  EmptyGraphError,
} from './errors.js';
