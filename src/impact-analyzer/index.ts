/**
 * Impact Analyzer Agent module exports
 *
 * Provides functionality for analyzing change impact on codebase
 * and documentation, risk assessment, and regression prediction.
 */

// Main classes and singletons
export {
  ImpactAnalyzerAgent,
  getImpactAnalyzerAgent,
  resetImpactAnalyzerAgent,
} from './ImpactAnalyzerAgent.js';

// Type exports
export type {
  // Change types
  ChangeType,
  ChangeSize,
  ChangeRequest,
  ChangeScope,
  // Impact types
  ImpactType,
  ImpactLevel,
  ImpactPropagation,
  AffectedComponent,
  AffectedFile,
  AffectedRequirement,
  DependencyChainEntry,
  // Risk types
  RiskLevel,
  RiskFactor,
  RiskAssessment,
  RegressionRisk,
  // Recommendation types
  RecommendationType,
  Recommendation,
  // Input types
  CurrentState,
  ArchitectureOverview,
  DependencyGraph,
  DependencyNode,
  DependencyEdge,
  AvailableInputs,
  // Output types
  ImpactAnalysis,
  AnalysisStatistics,
  ImpactAnalysisResult,
  // Session types
  ImpactAnalysisSession,
  AnalysisSessionStatus,
  // Configuration types
  ImpactAnalyzerConfig,
  // Other types
  FileChangeType,
  RequirementImpact,
  RequirementType,
  ComponentSource,
} from './types.js';

// Constants
export { DEFAULT_IMPACT_ANALYZER_CONFIG } from './types.js';

// Error exports
export {
  ImpactAnalyzerError,
  InputNotFoundError,
  NoInputsAvailableError,
  ChangeRequestParseError,
  InvalidChangeRequestError,
  DependencyResolutionError,
  TraceabilityGapError,
  NoActiveSessionError,
  InvalidSessionStateError,
  OutputWriteError,
  InputParseError,
  FileReadError,
  RiskCalculationError,
  MaxDependencyDepthExceededError,
} from './errors.js';
