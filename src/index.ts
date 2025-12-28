/**
 * AD-SDLC - Agent-Driven Software Development Lifecycle
 *
 * @packageDocumentation
 */

// Re-export security module
export * from './security/index.js';

// Re-export scratchpad module (with explicit handling of conflicts)
export {
  // Core
  Scratchpad,
  getScratchpad,
  resetScratchpad,
  // Schemas
  SCHEMA_VERSION,
  CollectedInfoSchema,
  WorkOrderSchema,
  ImplementationResultSchema,
  PRReviewResultSchema,
  ControllerStateSchema,
  FunctionalRequirementSchema,
  NonFunctionalRequirementSchema,
  ConstraintSchema,
  AssumptionSchema,
  DependencySchema,
  ClarificationSchema,
  SourceReferenceSchema,
  FileChangeSchema,
  TestInfoSchema,
  ReviewCommentSchema,
  QualityMetricsSchema,
  IssueQueueSchema,
  WorkerStatusSchema,
  WorkOrderContextSchema,
  RelatedFileSchema,
  DependencyStatusSchema,
  AcceptanceCriterionSchema,
  PrioritySchema,
  CollectionStatusSchema,
  ImplementationStatusSchema,
  ReviewDecisionSchema,
  // Validation
  validateCollectedInfo,
  validateWorkOrder,
  validateImplementationResult,
  validatePRReviewResult,
  validateControllerState,
  assertCollectedInfo,
  assertWorkOrder,
  assertImplementationResult,
  assertPRReviewResult,
  assertControllerState,
  getSchemaVersion,
  isCompatibleVersion,
  ensureSchemaVersion,
  SchemaValidationError,
} from './scratchpad/index.js';

export type {
  // Types from scratchpad/types.ts
  ScratchpadSection,
  ProgressSubsection,
  DocumentType,
  FileFormat,
  ScratchpadOptions,
  ProjectInfo,
  ClarificationEntry,
  FileLock,
  AtomicWriteOptions,
  ReadOptions,
  // Types from scratchpad/schemas.ts
  CollectedInfo,
  WorkOrder,
  ImplementationResult,
  PRReviewResult,
  ControllerState,
  FunctionalRequirement,
  NonFunctionalRequirement,
  Constraint,
  Assumption,
  Dependency,
  Clarification,
  SourceReference,
  FileChange,
  TestInfo,
  ReviewComment,
  QualityMetrics,
  IssueQueue,
  WorkerStatus,
  WorkOrderContext,
  RelatedFile,
  DependencyStatus,
  AcceptanceCriterion,
  CollectionStatus,
  ImplementationStatus,
  ReviewDecision,
  FieldError,
  SchemaValidationResult,
} from './scratchpad/index.js';

// Priority is exported with a different name to avoid conflict
export { PrioritySchema as ScratchpadPrioritySchema } from './scratchpad/index.js';
export type { Priority as ScratchpadPriority } from './scratchpad/index.js';

// Re-export issue-generator module
export * from './issue-generator/index.js';

// Re-export init module
export * from './init/index.js';

// Re-export controller module (with explicit handling of conflicts)
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
} from './controller/index.js';

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
} from './controller/index.js';

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
} from './state-manager/index.js';

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
} from './state-manager/index.js';

// Re-export agent-validator module
export {
  AGENT_SCHEMA_VERSION,
  VALID_TOOLS,
  VALID_MODELS,
  AgentFrontmatterSchema,
  AgentToolSchema,
  AgentModelSchema,
  RECOMMENDED_SECTIONS,
  AgentValidationException,
  AgentNotFoundError,
  FrontmatterParseError,
  FrontmatterValidationError,
  AgentNotRegisteredError,
  validateAgentFile,
  validateAllAgents,
  formatValidationReport,
} from './agent-validator/index.js';

export type {
  AgentTool,
  AgentModel,
  AgentFrontmatter,
  AgentDefinition,
  AgentValidationError,
  AgentValidationResult,
  AgentValidationReport,
  ValidateAgentOptions,
} from './agent-validator/index.js';

// Re-export architecture-generator module
export {
  ArchitectureGenerator,
  getArchitectureGenerator,
  resetArchitectureGenerator,
  SRSParser,
  ArchitectureAnalyzer,
  DiagramGenerator,
  TechnologyStackGenerator,
  DirectoryStructureGenerator,
  ARCHITECTURE_SCHEMA_VERSION,
  ArchitectureGeneratorError,
  SRSParseError,
  SRSNotFoundError,
  SRSValidationError,
  ArchitectureAnalysisError,
  PatternDetectionError,
  DiagramGenerationError,
  TechnologyStackError,
  DirectoryStructureError,
  FeatureNotFoundError,
  OutputWriteError,
} from './architecture-generator/index.js';

export type {
  ArchitectureGeneratorConfig,
  ArchitecturePattern,
  TechnologyLayer,
  DiagramType,
  SRSFeature,
  SRSUseCase,
  ParsedSRS,
  SRSMetadata,
  NonFunctionalRequirement as ArchitectureNFR,
  NFRCategory,
  Constraint as ArchitectureConstraint,
  ConstraintType,
  ArchitectureAnalysis,
  PatternRecommendation,
  ArchitecturalConcern,
  TechnologyStack,
  TechnologyLayerEntry,
  TechnologyAlternative,
  MermaidDiagram,
  DiagramComponent,
  ComponentConnection,
  DirectoryStructure,
  DirectoryEntry,
  ArchitectureDesign,
  ArchitectureMetadata,
  ArchitectureGeneratorOptions,
  SRSParserOptions,
} from './architecture-generator/index.js';

// Re-export component-generator module (with explicit handling of conflicts)
export {
  ComponentGenerator,
  getComponentGenerator,
  resetComponentGenerator,
  InterfaceGenerator,
  APISpecificationGenerator,
  COMPONENT_SCHEMA_VERSION,
  COMPONENT_ID_PATTERN,
  INTERFACE_ID_PATTERN,
  FEATURE_ID_PATTERN,
  USE_CASE_ID_PATTERN,
  VALID_HTTP_METHODS,
  VALID_INTERFACE_TYPES,
  VALID_COMPONENT_LAYERS,
  VALID_DATA_TYPES,
  HTTP_STATUS_CODES,
  DEFAULT_ERROR_RESPONSES,
  DEFAULT_RATE_LIMIT,
  COMMON_HEADERS,
  LAYER_DESCRIPTIONS,
  INTERFACE_TYPE_PREFIXES,
  ComponentGeneratorError,
  FeatureNotFoundError as ComponentFeatureNotFoundError,
  ComponentGenerationError,
  InterfaceGenerationError,
  APISpecificationError,
  DependencyAnalysisError,
  CircularDependencyError as ComponentCircularDependencyError,
  TraceabilityError,
  TypeScriptGenerationError,
  OutputWriteError as ComponentOutputWriteError,
  InvalidSRSError,
} from './component-generator/index.js';

export type {
  ComponentGeneratorConfig,
  InterfaceType,
  HttpMethod,
  ComponentLayer,
  DataType,
  ComponentDefinition,
  InterfaceSpec,
  APIEndpoint,
  EventSpec,
  FileSpec,
  RequestSpec,
  ResponseSpec,
  SuccessResponse,
  ErrorResponse,
  HeaderSpec,
  ParamSpec,
  BodySchema,
  FieldSpec,
  RateLimitSpec,
  TraceabilityEntry,
  UseCaseMapping,
  ComponentDependency,
  ComponentDesign,
  ComponentDesignMetadata,
  ComponentGeneratorOptions,
  TypeScriptGeneratorOptions,
} from './component-generator/index.js';

// Re-export collector module
export {
  CollectorAgent,
  getCollectorAgent,
  resetCollectorAgent,
  InputParser,
  InformationExtractor,
  CollectorError,
  InputParseError,
  FileParseError,
  UrlFetchError,
  ExtractionError,
  MissingInformationError,
  ValidationError as CollectorValidationError,
  SessionStateError,
  UnsupportedFileTypeError,
  ProjectInitError,
} from './collector/index.js';

export type {
  InputSourceType,
  SupportedFileType,
  InputSource,
  ParsedInput,
  FileParseResult,
  UrlFetchResult,
  ExtractedRequirement,
  ExtractedConstraint,
  ExtractedAssumption,
  ExtractedDependency,
  ExtractionResult,
  ClarificationCategory,
  ClarificationQuestion,
  ClarificationAnswer,
  CollectionSession,
  CollectorAgentConfig,
  CollectionResult,
  CollectionStats,
  InputParserOptions,
  InformationExtractorOptions,
} from './collector/index.js';

// Re-export prd-writer module (with explicit handling of conflicts)
export {
  PRDWriterAgent,
  getPRDWriterAgent,
  resetPRDWriterAgent,
  GapAnalyzer,
  ConsistencyChecker,
  TemplateProcessor,
  // Error classes with aliases for conflicting names
  PRDWriterError,
  CollectedInfoNotFoundError,
  TemplateNotFoundError as PRDTemplateNotFoundError,
  TemplateProcessingError as PRDTemplateProcessingError,
  CriticalGapsError,
  ConsistencyError,
  SessionStateError as PRDSessionStateError,
  ValidationError as PRDValidationError,
  GenerationError as PRDGenerationError,
  FileWriteError as PRDFileWriteError,
} from './prd-writer/index.js';

export type {
  GapAnalyzerOptions,
  ConsistencyCheckerOptions,
  TemplateProcessorOptions,
  // Status types
  PRDGenerationStatus,
  GapSeverity,
  GapCategory,
  ConsistencyIssueType,
  PRDSection,
  // Gap analysis types
  GapItem,
  GapAnalysisResult,
  // Consistency types
  ConsistencyIssue,
  ConsistencyCheckResult,
  PriorityDistribution,
  DependencyAnalysis,
  // PRD types
  PRDMetadata,
  GeneratedPRD,
  // Session types
  PRDWriterAgentConfig,
  PRDGenerationSession,
  PRDGenerationResult,
  PRDGenerationStats,
  // Template types with aliases
  TemplateVariable as PRDTemplateVariable,
  TemplateProcessingResult as PRDTemplateProcessingResult,
} from './prd-writer/index.js';

// Re-export srs-writer module (with explicit handling of conflicts)
export {
  SRSWriterAgent,
  getSRSWriterAgent,
  resetSRSWriterAgent,
  PRDParser,
  FeatureDecomposer,
  TraceabilityBuilder,
  // Error classes with aliases for conflicting names
  SRSWriterError,
  PRDNotFoundError,
  PRDParseError,
  TemplateNotFoundError as SRSTemplateNotFoundError,
  TemplateProcessingError as SRSTemplateProcessingError,
  FeatureDecompositionError,
  UseCaseGenerationError,
  LowCoverageError,
  SessionStateError as SRSSessionStateError,
  ValidationError as SRSWriterValidationError,
  GenerationError as SRSGenerationError,
  FileWriteError as SRSFileWriteError,
} from './srs-writer/index.js';

export type {
  PRDParserOptions,
  FeatureDecomposerOptions,
  TraceabilityBuilderOptions,
  TraceabilityValidationResult,
  TraceabilityIssue,
  // Generation status and priority
  SRSGenerationStatus,
  Priority as SRSPriority,
  // PRD parsing types
  ParsedPRD,
  ParsedPRDRequirement,
  ParsedNFR,
  ParsedConstraint,
  PRDDocumentMetadata,
  UserPersona,
  Goal,
  // Decomposition types
  FeatureDecompositionResult,
  UseCaseInput,
  GeneratedUseCase,
  // Traceability types (with alias to avoid conflict with component-generator)
  TraceabilityEntry as SRSTraceabilityEntry,
  TraceabilityMatrix as SRSWriterTraceabilityMatrix,
  // Configuration types
  SRSWriterAgentConfig,
  // Session and result types
  SRSGenerationSession,
  GeneratedSRS as SRSWriterGeneratedSRS,
  SRSGenerationResult,
  SRSGenerationStats,
  // Template types with aliases
  TemplateVariable as SRSTemplateVariable,
  TemplateProcessingResult as SRSTemplateProcessingResult,
  // Note: SRSFeature, SRSUseCase, SRSMetadata are already exported from architecture-generator
  // Note: NonFunctionalRequirement and Constraint are re-exported from architecture-generator types
} from './srs-writer/index.js';

// Re-export sds-writer module (with explicit handling of conflicts)
export {
  SDSWriterAgent,
  getSDSWriterAgent,
  resetSDSWriterAgent,
  SRSParser as SDSSRSParser,
  ComponentDesigner,
  APISpecifier,
  DataDesigner,
  TraceabilityMapper,
  SDSWriterError,
  SRSNotFoundError as SDSSRSNotFoundError,
  SRSParseError as SDSSRSParseError,
  TemplateNotFoundError as SDSTemplateNotFoundError,
  TemplateProcessingError as SDSTemplateProcessingError,
  ComponentDesignError,
  APISpecificationError as SDSAPISpecificationError,
  DataModelDesignError,
  SecuritySpecificationError,
  LowCoverageError as SDSLowCoverageError,
  SessionStateError as SDSSessionStateError,
  ValidationError as SDSValidationError,
  GenerationError as SDSGenerationError,
  FileWriteError as SDSFileWriteError,
  CircularDependencyError as SDSCircularDependencyError,
  InterfaceGenerationError as SDSInterfaceGenerationError,
} from './sds-writer/index.js';

export type {
  // Generation status and config
  SDSGenerationStatus,
  SDSWriterAgentConfig,
  SDSGenerationSession,
  SDSGenerationResult,
  SDSGenerationStats,
  Priority as SDSPriority,
  DocumentStatus,
  HttpMethod as SDSHttpMethod,
  DataTypeCategory,
  SecurityLevel,

  // SRS input types
  ParsedSRS as SDSParsedSRS,
  SRSDocumentMetadata,
  ParsedSRSFeature,
  ParsedNFR as SDSParsedNFR,
  ParsedConstraint as SDSParsedConstraint,
  ParsedUseCase as SDSParsedUseCase,
  AlternativeScenario,

  // SDS output types
  SDSMetadata,
  SDSComponent,
  SDSInterface,
  SDSMethod,
  MethodParameter,
  GeneratedSDS,

  // Technology stack
  TechnologyEntry,

  // API types
  APIEndpoint as SDSAPIEndpoint,
  APIParameter as SDSAPIParameter,
  DataSchema,
  DataProperty,
  ErrorResponse as SDSErrorResponse,

  // Data model types
  DataModel,
  DataRelationship,
  DataIndex,

  // Security types
  SecuritySpec,
  AuthenticationSpec,
  AuthorizationSpec,
  RoleDefinition,
  PermissionRule,
  DataProtectionMeasure,

  // Deployment types
  DeploymentSpec,
  EnvironmentSpec,
  ScalingSpec,

  // Traceability types
  TraceabilityEntry as SDSTraceabilityEntry,
  TraceabilityMatrix as SDSTraceabilityMatrix,

  // Design input types
  ComponentDesignInput,
  APIDesignInput,
  DataModelDesignInput,

  // Options types
  SRSParserOptions as SDSSRSParserOptions,
  ComponentDesignerOptions,
  ComponentDesignResult,
  APISpecifierOptions,
  APISpecificationResult,
  DataDesignerOptions,
  DataDesignResult,
  TraceabilityMapperOptions,
  TraceabilityAnalysis,
  TraceabilityStats,
} from './sds-writer/index.js';

// Re-export document-reader module (with explicit handling of conflicts)
export {
  DocumentReaderAgent,
  getDocumentReaderAgent,
  resetDocumentReaderAgent,
  DocumentReaderError,
  DocumentNotFoundError as DocReaderDocumentNotFoundError,
  DocumentParseError,
  InvalidRequirementIdError,
  UnsupportedFormatError,
  ExtractionError as DocReaderExtractionError,
  TraceabilityError as DocReaderTraceabilityError,
  NoActiveSessionError,
  InvalidSessionStateError,
  FileSizeLimitError,
  OutputWriteError as DocReaderOutputWriteError,
  DEFAULT_DOCUMENT_READER_CONFIG,
} from './document-reader/index.js';

export type {
  // Configuration
  DocumentReaderConfig,
  // Session and Result types
  DocumentReadingSession,
  DocumentReadingResult,
  DocumentReadingStats,
  // Document types (with alias for DocumentType to avoid conflict)
  DocumentType as DocReaderDocumentType,
  ParsedDocument,
  DocumentMetadata,
  DocumentSection,
  DocumentInfo,
  // Requirement types (with aliases to avoid conflicts)
  FunctionalRequirement as DocReaderFunctionalRequirement,
  NonFunctionalRequirement as DocReaderNonFunctionalRequirement,
  RequirementStatus,
  RequirementPriority,
  NFRCategory as DocReaderNFRCategory,
  // Feature types
  SystemFeature,
  UseCase as DocReaderUseCase,
  // Component types
  SystemComponent,
  ComponentType as DocReaderComponentType,
  APISpecification,
  // Traceability types
  PRDToSRSTrace,
  SRSToSDSTrace,
  // State types
  CurrentState,
  SessionStatus,
} from './document-reader/index.js';

// Re-export codebase-analyzer module (with explicit handling of conflicts)
export {
  CodebaseAnalyzerAgent,
  getCodebaseAnalyzerAgent,
  resetCodebaseAnalyzerAgent,
  CodebaseAnalyzerError,
  ProjectNotFoundError as CodebaseProjectNotFoundError,
  NoSourceFilesError,
  UnsupportedLanguageError,
  BuildSystemNotDetectedError,
  CircularDependencyError as CodebaseCircularDependencyError,
  ImportParseError,
  FileSizeLimitError as CodebaseFileSizeLimitError,
  NoActiveSessionError as CodebaseNoActiveSessionError,
  InvalidSessionStateError as CodebaseInvalidSessionStateError,
  OutputWriteError as CodebaseOutputWriteError,
  FileReadError,
  DirectoryScanError,
  MaxFilesExceededError,
  DEFAULT_CODEBASE_ANALYZER_CONFIG,
} from './codebase-analyzer/index.js';

export type {
  // Architecture types
  ArchitectureType,
  ArchitectureOverview,
  DetectedPattern,
  PatternLocation,
  PatternType,
  // Structure types
  DirectoryStructure as CodebaseDirectoryStructure,
  SourceDirectory,
  TestDirectory,
  ConfigDirectory,
  BuildFile,
  BuildSystemInfo,
  BuildSystemType,
  // Dependency types
  DependencyGraph,
  DependencyNode,
  DependencyEdge as CodebaseDependencyEdge,
  DependencyType as CodebaseDependencyType,
  NodeType,
  DependencyGraphStats,
  ExternalDependency,
  PackageDependencyType,
  // Convention types
  CodingConventions,
  NamingConventions,
  NamingConvention,
  FileStructurePattern,
  TestPattern,
  // Metrics types
  CodeMetrics,
  LanguageStats,
  // Language types
  ProgrammingLanguage,
  // Session and result types
  CodebaseAnalysisSession,
  CodebaseAnalysisResult,
  CodebaseAnalysisStats,
  AnalysisSessionStatus,
  // Configuration types
  CodebaseAnalyzerConfig,
  // File types
  FileInfo,
  ImportInfo,
} from './codebase-analyzer/index.js';

// Re-export impact-analyzer module (with explicit handling of conflicts)
export {
  ImpactAnalyzerAgent,
  getImpactAnalyzerAgent,
  resetImpactAnalyzerAgent,
  ImpactAnalyzerError,
  InputNotFoundError,
  NoInputsAvailableError,
  ChangeRequestParseError,
  InvalidChangeRequestError,
  DependencyResolutionError,
  TraceabilityGapError,
  NoActiveSessionError as ImpactNoActiveSessionError,
  InvalidSessionStateError as ImpactInvalidSessionStateError,
  OutputWriteError as ImpactOutputWriteError,
  InputParseError as ImpactInputParseError,
  FileReadError as ImpactFileReadError,
  RiskCalculationError,
  MaxDependencyDepthExceededError,
  DEFAULT_IMPACT_ANALYZER_CONFIG,
} from './impact-analyzer/index.js';

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
  // Input types (with aliases for conflicts)
  CurrentState as ImpactCurrentState,
  ArchitectureOverview as ImpactArchitectureOverview,
  DependencyGraph as ImpactDependencyGraph,
  DependencyNode as ImpactDependencyNode,
  DependencyEdge as ImpactDependencyEdge,
  AvailableInputs,
  // Output types
  ImpactAnalysis,
  AnalysisStatistics as ImpactAnalysisStatistics,
  ImpactAnalysisResult,
  // Session types
  ImpactAnalysisSession,
  AnalysisSessionStatus as ImpactAnalysisSessionStatus,
  // Configuration types
  ImpactAnalyzerConfig,
  // Other types
  FileChangeType,
  RequirementImpact,
  RequirementType,
  ComponentSource,
} from './impact-analyzer/index.js';
