/**
 * Control Plane - Orchestration and State Management
 *
 * This module exports components responsible for:
 * - Unified control-plane facade (ControlPlane class)
 * - Project state management
 * - Issue prioritization and analysis
 * - Pipeline orchestration
 * - Mode detection
 * - Agent lifecycle tracking
 * - Initialization
 *
 * The exports that load no optional subsystem live in `./core.ts`; this
 * module adds the ControlPlane facade and the controller re-exports.
 *
 * @packageDocumentation
 */

export * from './core.js';

// Control-Plane facade
export {
  ControlPlane,
  getControlPlane,
  resetControlPlane,
  ControlPlaneError,
  PipelineOperationError,
  AgentRegistryError,
} from './ControlPlane.js';

export type { AgentStatus, AgentInfo, ControlPlaneOptions } from './ControlPlane.js';

// Re-export controller module
export {
  PriorityAnalyzer,
  DEFAULT_PRIORITY_WEIGHTS as CONTROLLER_PRIORITY_WEIGHTS,
  DEFAULT_ANALYZER_CONFIG,
  ControllerError,
  GraphNotFoundError,
  GraphParseError,
  GraphValidationError,
  CircularDependencyError as ControllerCircularDependencyError,
  IssueNotFoundError,
  PriorityAnalysisError,
  EmptyGraphError,
} from '../controller/index.js';

export type {
  IssueStatus,
  PriorityWeights,
  IssueNode,
  DependencyEdge as ControllerDependencyEdge,
  RawDependencyGraph,
  AnalyzedIssue,
  ParallelGroup as ControllerParallelGroup,
  CriticalPath,
  PrioritizedQueue,
  GraphAnalysisResult,
  GraphStatistics,
  PriorityAnalyzerConfig,
  Priority as ControllerPriority,
} from '../controller/index.js';
