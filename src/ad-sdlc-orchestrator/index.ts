/**
 * AD-SDLC Orchestrator Agent module exports
 *
 * Provides the top-level pipeline orchestrator for coordinating
 * Greenfield, Enhancement, and Import pipeline modes.
 * Implements SDS-001 CMP-025.
 */

// Main classes and singletons
export {
  AdsdlcOrchestratorAgent,
  getAdsdlcOrchestratorAgent,
  resetAdsdlcOrchestratorAgent,
  ADSDLC_ORCHESTRATOR_AGENT_ID,
} from './AdsdlcOrchestratorAgent.js';

// Type exports
export type {
  // Mode and strategy types
  PipelineMode,
  ExecutionStrategy,
  ApprovalMode,
  // Stage name types
  StageName,
  GreenfieldStageName,
  EnhancementStageName,
  ImportStageName,
  // Status types
  PipelineStageStatus,
  PipelineStatus,
  // Stage types
  PipelineStageDefinition,
  StageResult,
  // Pipeline types
  PipelineResult,
  PipelineRequest,
  AgentInvocation,
  // Session types
  OrchestratorSession,
  // Configuration types
  OrchestratorConfig,
  StageTimeoutConfig,
} from './types.js';

// Constants
export {
  DEFAULT_ORCHESTRATOR_CONFIG,
  GREENFIELD_STAGES,
} from './types.js';

// Error exports
export {
  OrchestratorError,
  NoActiveSessionError,
  PipelineInProgressError,
  InvalidProjectDirError,
  StageExecutionError,
  StageTimeoutError,
  StageDependencyError,
  UnsupportedModeError,
  PipelineFailedError,
  StatePersistenceError,
  InvalidPipelineStatusError,
} from './errors.js';
