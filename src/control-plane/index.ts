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
 * @packageDocumentation
 */

// Control-Plane facade
export {
  ControlPlane,
  getControlPlane,
  resetControlPlane,
  ControlPlaneError,
  PipelineOperationError,
  AgentRegistryError,
} from './ControlPlane.js';

export type {
  AgentStatus,
  AgentInfo,
  ControlPlaneOptions,
} from './ControlPlane.js';

// Re-export state-manager module
export {
  StateManager,
  getStateManager,
  resetStateManager,
  StateManagerError,
  InvalidTransitionError,
  StateNotFoundError,
  ProjectNotFoundError,
  ProjectExistsError,
  StateValidationError,
  LockAcquisitionError,
  HistoryError,
  WatchError,
} from '../state-manager/index.js';

export type {
  ProjectState,
  StateManagerOptions,
  StateChangeEvent,
  StateChangeCallback,
  StateWatcher,
  StateHistoryEntry,
  StateHistory,
  StateTransition,
  TransitionResult,
  ProjectStateSummary,
  ValidationResult,
  ValidationError as StateValidationErrorDetail,
  UpdateOptions,
  ReadStateOptions,
  StateWithMetadata,
} from '../state-manager/index.js';

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

// Re-export analysis-orchestrator module
export {
  AnalysisOrchestratorAgent,
  getAnalysisOrchestratorAgent,
  resetAnalysisOrchestratorAgent,
  AnalysisOrchestratorError,
  NoActiveSessionError as OrchestratorNoActiveSessionError,
  AnalysisInProgressError,
  InvalidProjectPathError,
  InvalidProjectStructureError,
  StageExecutionError,
  StageTimeoutError,
  InvalidPipelineStateError,
  StageDependencyError,
  OutputWriteError as OrchestratorOutputWriteError,
  StateReadError,
  ResumeError,
  AnalysisNotFoundError,
  PipelineFailedError,
  InvalidConfigurationError,
  SubAgentSpawnError,
  DEFAULT_ORCHESTRATOR_CONFIG,
} from '../analysis-orchestrator/index.js';

export type {
  AnalysisScope,
  PipelineStageName,
  PipelineStageStatus,
  PipelineStatus,
  AnalysisResultStatus,
  OutputFormat,
  PipelineStage,
  PipelineStatistics,
  PipelineState,
  DocumentAnalysisSummary,
  CodeAnalysisSummary,
  ComparisonSummary,
  IssuesSummary,
  AnalysisRecommendation,
  AnalysisReport,
  AnalysisOrchestratorConfig,
  AnalysisInput,
  AnalysisSession,
  AnalysisResult,
  StageResult,
  StageExecutor,
  ResumeOptions,
} from '../analysis-orchestrator/index.js';

// Re-export mode-detector module
export {
  ModeDetector,
  getModeDetector,
  resetModeDetector,
  ModeDetectorError,
  ProjectNotFoundError as ModeDetectorProjectNotFoundError,
  NoActiveSessionError as ModeDetectorNoActiveSessionError,
  InvalidSessionStateError as ModeDetectorInvalidSessionStateError,
  DocumentAnalysisError,
  CodebaseAnalysisError,
  InvalidConfigurationError as ModeDetectorInvalidConfigurationError,
  OutputWriteError as ModeDetectorOutputWriteError,
  DetectionTimeoutError as ModeDetectorDetectionTimeoutError,
  DEFAULT_MODE_DETECTOR_CONFIG,
  DEFAULT_GREENFIELD_KEYWORDS,
  DEFAULT_ENHANCEMENT_KEYWORDS,
  DEFAULT_DETECTION_RULES,
} from '../mode-detector/index.js';

export type {
  PipelineMode,
  ConfidenceLevel,
  DetectionStatus as ModeDetectionStatus,
  EvidenceSource,
  DetectionEvidence,
  DocumentEvidence,
  CodebaseEvidence,
  KeywordEvidence,
  UserOverride,
  DetectionScores,
  ModeDetectionResult,
  ModeDetectionSession,
  DetectionStats as ModeDetectionStats,
  DetectionRule,
  KeywordConfig,
  ScoreWeights,
  DetectionThresholds,
  ModeDetectorConfig,
} from '../mode-detector/index.js';

// Re-export init module (explicit exports to avoid conflicts)
export {
  CURRENT_TEMPLATE_VERSION,
  QUALITY_GATE_CONFIGS,
  TEMPLATE_CONFIGS,
  ConfigurationError,
  FileSystemError,
  GitHubError,
  InitError,
  PrerequisiteError,
  ProjectExistsError as InitProjectExistsError,
  TemplateMigrationError,
  TemplateNotFoundError as InitTemplateNotFoundError,
  TemplateVersionError,
  getPrerequisiteValidator,
  PrerequisiteValidator,
  resetPrerequisiteValidator,
  createProjectInitializer,
  ProjectInitializer,
  resetProjectInitializer,
  createInteractiveWizard,
  InteractiveWizard,
  clearMigrations,
  compareVersions,
  findMigrationPath,
  formatVersion,
  getCurrentVersion,
  getMigrations,
  isVersionCompatible,
  migrateTemplate,
  needsMigration,
  parseVersion,
  registerMigration,
  validateTemplateCompatibility,
  versionsEqual,
} from '../project-initializer/index.js';

export type {
  InitOptions,
  InitResult,
  PrerequisiteCheck,
  PrerequisiteResult,
  PrerequisiteValidationResult,
  QualityGateConfig as InitQualityGateConfig,
  QualityGateLevel,
  TechStack,
  TemplateCompatibilityResult,
  TemplateConfig,
  TemplateMigrationResult,
  TemplateMigrationStep,
  TemplateType,
  TemplateVersion,
  WorkflowConfig as InitWorkflowConfig,
} from '../project-initializer/index.js';
