/**
 * SRS Writer Agent module
 *
 * Provides functionality for generating Software Requirements Specifications
 * from Product Requirements Documents. Includes feature decomposition,
 * use case generation, and traceability matrix creation.
 *
 * @example
 * ```typescript
 * import { getSRSWriterAgent } from './srs-writer';
 *
 * const agent = getSRSWriterAgent();
 * const result = await agent.generateFromProject('my-project');
 * console.log(`SRS generated at: ${result.publicPath}`);
 * ```
 */

// Main agent class and singleton functions
export {
  SRSWriterAgent,
  getSRSWriterAgent,
  resetSRSWriterAgent,
  SRS_WRITER_AGENT_ID,
} from './SRSWriterAgent.js';

// Component classes
export { PRDParser, type PRDParserOptions } from './PRDParser.js';
export { FeatureDecomposer, type FeatureDecomposerOptions } from './FeatureDecomposer.js';
export {
  TraceabilityBuilder,
  type TraceabilityBuilderOptions,
  type TraceabilityValidationResult,
  type TraceabilityIssue,
} from './TraceabilityBuilder.js';
export {
  UseCaseGenerator,
  type UseCaseGeneratorOptions,
  type UseCaseGenerationResult,
  type UseCaseCoverage,
} from './UseCaseGenerator.js';

// Error classes
export {
  SRSWriterError,
  PRDNotFoundError,
  PRDParseError,
  TemplateNotFoundError,
  TemplateProcessingError,
  FeatureDecompositionError,
  UseCaseGenerationError,
  LowCoverageError,
  SessionStateError,
  ValidationError,
  GenerationError,
  FileWriteError,
} from './errors.js';

// Type exports
export type {
  // Generation status and priority
  SRSGenerationStatus,
  Priority,

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

  // Use case types
  FlowStep,
  AlternativeFlow,
  ExceptionFlow,
  DetailedUseCase,

  // Traceability types
  TraceabilityEntry,
  TraceabilityMatrix,

  // Configuration types
  SRSWriterAgentConfig,

  // Session and result types
  SRSGenerationSession,
  GeneratedSRS,
  SRSGenerationResult,
  SRSGenerationStats,

  // Template types
  TemplateVariable,
  TemplateProcessingResult,

  // Re-exported types from architecture-generator
  SRSFeature,
  SRSUseCase,
  SRSMetadata,
  NonFunctionalRequirement,
  Constraint,
} from './types.js';
