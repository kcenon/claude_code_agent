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

// Pipeline checkpoint manager
export { PipelineCheckpointManager } from './PipelineCheckpointManager.js';

// Artifact validation
export {
  ArtifactValidator,
  GREENFIELD_ARTIFACTS,
  ENHANCEMENT_ARTIFACTS,
} from './ArtifactValidator.js';

export type {
  ArtifactSpec,
  ContentValidationResult,
  StageArtifactMap,
  ValidationResult,
} from './ArtifactValidator.js';

// Type exports
export type {
  // Mode and strategy types
  PipelineMode,
  ExecutionStrategy,
  ApprovalMode,
  ResumeMode,
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
  CheckpointConfig,
  // Checkpoint types
  PipelineCheckpoint,
  // Approval and monitoring types
  ApprovalDecision,
  PipelineMonitorSnapshot,
  StageSummary,
} from './types.js';

// Constants
export {
  DEFAULT_ORCHESTRATOR_CONFIG,
  GREENFIELD_STAGES,
  ENHANCEMENT_STAGES,
  IMPORT_STAGES,
  WORKER_SKILLS,
  PR_REVIEWER_SKILLS,
  CI_FIXER_SKILLS,
  GITHUB_MCP_SERVER,
  GITHUB_MCP_SERVERS,
  CI_FIXER_MCP_SERVERS,
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
  SessionNotFoundError,
  SessionCorruptedError,
} from './errors.js';
