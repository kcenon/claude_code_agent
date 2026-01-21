/**
 * Agents - Agent Implementations
 *
 * This module exports all agent implementations for:
 * - Information collection
 * - Document writing (PRD, SRS, SDS)
 * - Document updating (PRD, SRS, SDS)
 * - Analysis (document, codebase, impact)
 * - Code generation (architecture, component, issue)
 * - Implementation (worker, CI, PR review)
 *
 * To avoid naming conflicts, some modules are exported as namespaces.
 * Import specific items or use the namespace:
 *
 * @example
 * ```typescript
 * // Direct import from specific module
 * import { CollectorAgent } from '@ad-sdlc/agents';
 *
 * // Using AgentFactory for unified agent instantiation
 * import { AgentFactory, AgentRegistry } from '@ad-sdlc/agents';
 * const factory = AgentFactory.getInstance();
 * const agent = await factory.create<CollectorAgent>('collector-agent');
 *
 * // Namespace import for modules with conflicts
 * import { IssueGen, CodeReader, Worker, CIFixer } from '@ad-sdlc/agents';
 * const issue: IssueGen.GeneratedIssue = ...;
 * ```
 *
 * @packageDocumentation
 */

// Re-export AgentFactory infrastructure
export {
  AgentFactory,
  AgentCreationError,
  AgentInitializationError,
  DependencyResolutionError as AgentDependencyResolutionError,
} from './AgentFactory.js';

export {
  AgentRegistry,
  AgentNotRegisteredError as AgentRegistryNotFoundError,
  AgentAlreadyRegisteredError,
  CircularDependencyError as AgentCircularDependencyError,
} from './AgentRegistry.js';

export { isAgent } from './types.js';

export type {
  IAgent,
  AgentLifecycle,
  AgentMetadata,
  AgentDependency,
  AgentDependencies,
  CreateAgentOptions,
  RegistrationResult,
} from './types.js';

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
} from '../collector/index.js';

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
} from '../collector/index.js';

// Re-export prd-writer module
export {
  PRDWriterAgent,
  getPRDWriterAgent,
  resetPRDWriterAgent,
  GapAnalyzer,
  ConsistencyChecker,
  TemplateProcessor,
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
} from '../prd-writer/index.js';

export type {
  GapAnalyzerOptions,
  ConsistencyCheckerOptions,
  TemplateProcessorOptions,
  PRDGenerationStatus,
  GapSeverity,
  GapCategory,
  ConsistencyIssueType,
  PRDSection,
  GapItem,
  GapAnalysisResult,
  ConsistencyIssue,
  ConsistencyCheckResult,
  PriorityDistribution,
  DependencyAnalysis,
  PRDMetadata,
  GeneratedPRD,
  PRDWriterAgentConfig,
  PRDGenerationSession,
  PRDGenerationResult,
  PRDGenerationStats,
  TemplateVariable as PRDTemplateVariable,
  TemplateProcessingResult as PRDTemplateProcessingResult,
} from '../prd-writer/index.js';

// Re-export srs-writer module
export {
  SRSWriterAgent,
  getSRSWriterAgent,
  resetSRSWriterAgent,
  PRDParser,
  FeatureDecomposer,
  TraceabilityBuilder,
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
} from '../srs-writer/index.js';

export type {
  PRDParserOptions,
  FeatureDecomposerOptions,
  TraceabilityBuilderOptions,
  TraceabilityValidationResult,
  TraceabilityIssue,
  SRSGenerationStatus,
  Priority as SRSPriority,
  ParsedPRD,
  ParsedPRDRequirement,
  ParsedNFR,
  ParsedConstraint,
  PRDDocumentMetadata,
  UserPersona,
  Goal,
  FeatureDecompositionResult,
  UseCaseInput,
  GeneratedUseCase,
  TraceabilityEntry as SRSTraceabilityEntry,
  TraceabilityMatrix as SRSWriterTraceabilityMatrix,
  SRSWriterAgentConfig,
  SRSGenerationSession,
  GeneratedSRS as SRSWriterGeneratedSRS,
  SRSGenerationResult,
  SRSGenerationStats,
  TemplateVariable as SRSTemplateVariable,
  TemplateProcessingResult as SRSTemplateProcessingResult,
} from '../srs-writer/index.js';

// Re-export sds-writer module
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
} from '../sds-writer/index.js';

export type {
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
  ParsedSRS as SDSParsedSRS,
  SRSDocumentMetadata,
  ParsedSRSFeature,
  ParsedNFR as SDSParsedNFR,
  ParsedConstraint as SDSParsedConstraint,
  ParsedUseCase as SDSParsedUseCase,
  AlternativeScenario,
  SDSMetadata,
  SDSComponent,
  SDSInterface,
  SDSMethod,
  MethodParameter,
  GeneratedSDS,
  TechnologyEntry,
  APIEndpoint as SDSAPIEndpoint,
  APIParameter as SDSAPIParameter,
  DataSchema,
  DataProperty,
  ErrorResponse as SDSErrorResponse,
  DataModel,
  DataRelationship,
  DataIndex,
  SecuritySpec,
  AuthenticationSpec,
  AuthorizationSpec,
  RoleDefinition,
  PermissionRule,
  DataProtectionMeasure,
  DeploymentSpec,
  EnvironmentSpec,
  ScalingSpec,
  TraceabilityEntry as SDSTraceabilityEntry,
  TraceabilityMatrix as SDSTraceabilityMatrix,
  ComponentDesignInput,
  APIDesignInput,
  DataModelDesignInput,
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
} from '../sds-writer/index.js';

// Re-export document-reader module
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
} from '../document-reader/index.js';

export type {
  DocumentReaderConfig,
  DocumentReadingSession,
  DocumentReadingResult,
  DocumentReadingStats,
  DocumentType as DocReaderDocumentType,
  ParsedDocument,
  DocumentMetadata,
  DocumentSection,
  DocumentInfo,
  FunctionalRequirement as DocReaderFunctionalRequirement,
  NonFunctionalRequirement as DocReaderNonFunctionalRequirement,
  RequirementStatus,
  RequirementPriority,
  NFRCategory as DocReaderNFRCategory,
  SystemFeature,
  UseCase as DocReaderUseCase,
  SystemComponent,
  ComponentType as DocReaderComponentType,
  APISpecification,
  PRDToSRSTrace,
  SRSToSDSTrace,
  CurrentState,
  SessionStatus,
} from '../document-reader/index.js';

// Re-export codebase-analyzer module
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
} from '../codebase-analyzer/index.js';

export type {
  ArchitectureType,
  ArchitectureOverview,
  DetectedPattern,
  PatternLocation,
  PatternType,
  DirectoryStructure as CodebaseDirectoryStructure,
  SourceDirectory,
  TestDirectory,
  ConfigDirectory,
  BuildFile,
  BuildSystemInfo,
  BuildSystemType,
  DependencyGraph,
  DependencyNode,
  DependencyEdge as CodebaseDependencyEdge,
  DependencyType as CodebaseDependencyType,
  NodeType,
  DependencyGraphStats,
  ExternalDependency,
  PackageDependencyType,
  CodingConventions,
  NamingConventions,
  NamingConvention,
  FileStructurePattern,
  TestPattern,
  CodeMetrics,
  LanguageStats,
  ProgrammingLanguage,
  CodebaseAnalysisSession,
  CodebaseAnalysisResult,
  CodebaseAnalysisStats,
  AnalysisSessionStatus,
  CodebaseAnalyzerConfig,
  FileInfo,
  ImportInfo,
} from '../codebase-analyzer/index.js';

// Re-export impact-analyzer module
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
} from '../impact-analyzer/index.js';

export type {
  ChangeType,
  ChangeSize,
  ChangeRequest,
  ChangeScope,
  ImpactType,
  ImpactLevel,
  ImpactPropagation,
  AffectedComponent,
  AffectedFile,
  AffectedRequirement,
  DependencyChainEntry,
  RiskLevel,
  RiskFactor,
  RiskAssessment,
  RegressionRisk,
  RecommendationType,
  Recommendation,
  CurrentState as ImpactCurrentState,
  ArchitectureOverview as ImpactArchitectureOverview,
  DependencyGraph as ImpactDependencyGraph,
  DependencyNode as ImpactDependencyNode,
  DependencyEdge as ImpactDependencyEdge,
  AvailableInputs,
  ImpactAnalysis,
  AnalysisStatistics as ImpactAnalysisStatistics,
  ImpactAnalysisResult,
  ImpactAnalysisSession,
  AnalysisSessionStatus as ImpactAnalysisSessionStatus,
  ImpactAnalyzerConfig,
  FileChangeType,
  RequirementImpact,
  RequirementType,
  ComponentSource,
} from '../impact-analyzer/index.js';

// Re-export regression-tester module
export {
  RegressionTesterAgent,
  getRegressionTesterAgent,
  resetRegressionTesterAgent,
  RegressionTesterError,
  NoTestsFoundError,
  TestExecutionFailedError,
  TestFrameworkNotDetectedError,
  CoverageCalculationError,
  DependencyGraphNotFoundError,
  NoChangedFilesError,
  TestTimeoutError,
  NoActiveSessionError as RegressionNoActiveSessionError,
  InvalidSessionStateError as RegressionInvalidSessionStateError,
  OutputWriteError as RegressionOutputWriteError,
  FileReadError as RegressionFileReadError,
  InvalidProjectPathError as RegressionInvalidProjectPathError,
  TestMappingError,
  MaxTestsExceededError,
  DEFAULT_REGRESSION_TESTER_CONFIG,
} from '../regression-tester/index.js';

export type {
  RegressionTesterConfig,
  RegressionTesterSession,
  RegressionSessionStatus,
  RegressionReport,
  Recommendation as RegressionRecommendation,
  RegressionSummary,
  RecommendationType as RegressionRecommendationType,
  RegressionStatus,
  RegressionAnalysisResult,
  RegressionAnalysisStats,
  ChangedFile,
  FileChangeType as RegressionChangeType,
  TestFile,
  TestMapping,
  TestMappingSummary,
  TestCase,
  AffectedTest,
  TestPriority,
  ChangesAnalyzed,
  TestExecutionSummary,
  TestResult,
  TestStatus,
  CoverageImpact,
  CoverageMetrics,
  UncoveredLines,
  CompatibilityIssue,
  CompatibilityIssueType,
  IssueSeverity,
  TestFramework,
  DependencyGraph as RegressionDependencyGraph,
  DependencyNode as RegressionDependencyNode,
  DependencyEdge as RegressionDependencyEdge,
} from '../regression-tester/index.js';

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
} from '../architecture-generator/index.js';

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
} from '../architecture-generator/index.js';

// Re-export component-generator module
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
} from '../component-generator/index.js';

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
} from '../component-generator/index.js';

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
} from '../agent-validator/index.js';

export type {
  AgentTool,
  AgentModel,
  AgentFrontmatter,
  AgentDefinition,
  AgentValidationError,
  AgentValidationResult,
  AgentValidationReport,
  ValidateAgentOptions,
} from '../agent-validator/index.js';

// Re-export repo-detector module
export {
  RepoDetector,
  getRepoDetector,
  resetRepoDetector,
  RepoDetectorError,
  ProjectNotFoundError as RepoDetectorProjectNotFoundError,
  NoActiveSessionError as RepoDetectorNoActiveSessionError,
  InvalidSessionStateError as RepoDetectorInvalidSessionStateError,
  GitCommandError,
  GitCommandTimeoutError,
  GitHubAuthenticationError,
  GitHubCommandError,
  GitHubNotAccessibleError,
  OutputWriteError as RepoDetectorOutputWriteError,
  DetectionTimeoutError as RepoDetectorDetectionTimeoutError,
  DEFAULT_REPO_DETECTOR_CONFIG,
  DEFAULT_TIMEOUT_CONFIG,
  DEFAULT_GITHUB_CONFIG,
  DEFAULT_DETECTION_CONFIG,
} from '../repo-detector/index.js';

export type {
  RepositoryMode,
  DetectionStatus as RepoDetectionStatus,
  RemoteType,
  RepositoryVisibility,
  GitStatus,
  RemoteStatus,
  GitHubStatus,
  DetectionRecommendation,
  RepoDetectionResult,
  RepoDetectionSession,
  DetectionStats as RepoDetectionStats,
  TimeoutConfig as RepoTimeoutConfig,
  GitHubConfig,
  DetectionConfig,
  RepoDetectorConfig,
} from '../repo-detector/index.js';

// Modules with naming conflicts are exported as namespaces
// Use these namespaces to access their exports without conflicts

// Issue Generator - has conflicts with code-reader, worker
export * as IssueGen from '../issue-generator/index.js';

// Code Reader - has conflicts with issue-generator, worker
export * as CodeReader from '../code-reader/index.js';

// Doc-Code Comparator
export * as DocCodeComparator from '../doc-code-comparator/index.js';

// PRD Updater
export * as PRDUpdater from '../prd-updater/index.js';

// SRS Updater - has conflicts with sds-writer
export * as SRSUpdater from '../srs-updater/index.js';

// SDS Updater
export * as SDSUpdater from '../sds-updater/index.js';

// Worker - has conflicts with issue-generator, code-reader, ci-fixer
export * as Worker from '../worker/index.js';

// CI Fixer - has conflicts with worker
export * as CIFixer from '../ci-fixer/index.js';

// PR Reviewer
export * as PRReviewer from '../pr-reviewer/index.js';
