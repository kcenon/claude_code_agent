/**
 * Analysis Orchestrator Agent module exports
 *
 * Provides functionality for coordinating the complete analysis pipeline
 * from user input to issue generation.
 */

// Main classes and singletons
export {
  AnalysisOrchestratorAgent,
  getAnalysisOrchestratorAgent,
  resetAnalysisOrchestratorAgent,
} from './AnalysisOrchestratorAgent.js';

// Type exports
export type {
  // Scope and status types
  AnalysisScope,
  PipelineStageName,
  PipelineStageStatus,
  PipelineStatus,
  AnalysisResultStatus,
  OutputFormat,
  // Stage types
  PipelineStage,
  PipelineStatistics,
  PipelineState,
  // Summary types
  DocumentAnalysisSummary,
  CodeAnalysisSummary,
  ComparisonSummary,
  IssuesSummary,
  AnalysisRecommendation,
  // Report types
  AnalysisReport,
  // Configuration types
  AnalysisOrchestratorConfig,
  // Input types
  AnalysisInput,
  // Session types
  AnalysisSession,
  // Result types
  AnalysisResult,
  StageResult,
  StageExecutor,
  // Resume types
  ResumeOptions,
} from './types.js';

// Constants
export { DEFAULT_ORCHESTRATOR_CONFIG } from './types.js';

// Error exports
export {
  AnalysisOrchestratorError,
  NoActiveSessionError,
  AnalysisInProgressError,
  InvalidProjectPathError,
  InvalidProjectStructureError,
  StageExecutionError,
  StageTimeoutError,
  InvalidPipelineStateError,
  StageDependencyError,
  OutputWriteError,
  StateReadError,
  ResumeError,
  AnalysisNotFoundError,
  PipelineFailedError,
  InvalidConfigurationError,
  SubAgentSpawnError,
} from './errors.js';
