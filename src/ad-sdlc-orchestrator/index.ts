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
  ResolvedOrchestratorConfig,
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

// Approval policy and decision record vocabulary (#953)
export {
  APPROVAL_MODES,
  APPROVAL_BOUNDARIES,
  APPROVAL_BOUNDARY_DESCRIPTIONS,
  APPROVAL_EFFECTS,
  APPROVAL_EFFECT_DESCRIPTIONS,
  AGENT_APPROVAL_EFFECTS,
  APPROVAL_MODE_DEFINITIONS,
  APPROVAL_OUTCOMES,
  APPROVAL_BASES,
  PIPELINE_APPROVAL_STATUSES,
  UNATTENDED_APPROVAL_BEHAVIOR,
  ApprovalDecisionRecordSchema,
  agentApprovalEffects,
  stageApprovalEffects,
  stageApprovalBoundaries,
  approvalRequirement,
  approvalPolicySource,
  effectiveApprovalPolicy,
  approvalScopeFingerprint,
  reusableApprovalDecision,
  summarizePipelineApproval,
  parseApprovalDecisionRecord,
} from './approvalPolicy.js';

export type {
  ApprovalBoundary,
  ApprovalEffect,
  ApprovalDecider,
  ApprovalModeDefinition,
  ApprovalRequirement,
  ApprovalPolicySourceKind,
  ApprovalPolicySource,
  EffectiveApprovalPolicy,
  ApprovalOutcome,
  ApprovalBasis,
  ApprovalArtifactReference,
  ApprovalFinding,
  ApprovalScope,
  ApprovalRequest,
  ApprovalDecisionRecord,
  PipelineApprovalStatus,
  PipelineApprovalSummary,
} from './approvalPolicy.js';

export {
  buildApprovalRequest,
  evaluateApprovalGate,
  formatApprovalRequest,
  isInteractiveTerminal,
  promptForApproval,
  defaultCustomApproval,
} from './ApprovalGate.js';

export type {
  ApprovalAnswer,
  ApprovalGateContext,
  ApprovalPrompter,
  CustomApprovalFn,
} from './ApprovalGate.js';

export {
  approvalPolicyMatrix,
  renderApprovalPolicyBlock,
  replaceApprovalPolicyBlock,
} from './approvalMatrix.js';

export type { ApprovalMatrixRow } from './approvalMatrix.js';

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
