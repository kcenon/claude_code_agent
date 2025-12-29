/**
 * SDS Writer Agent module
 *
 * Generates Software Design Specification (SDS) documents from
 * Software Requirements Specification (SRS) documents.
 *
 * @module sds-writer
 */

// Main agent class (singleton + constructor)
export { SDSWriterAgent, getSDSWriterAgent, resetSDSWriterAgent } from './SDSWriterAgent.js';

// Component classes
export { SRSParser } from './SRSParser.js';
export type { SRSParserOptions } from './SRSParser.js';

export { ComponentDesigner } from './ComponentDesigner.js';
export type { ComponentDesignerOptions, ComponentDesignResult } from './ComponentDesigner.js';

export { APISpecifier } from './APISpecifier.js';
export type { APISpecifierOptions, APISpecificationResult } from './APISpecifier.js';

export { DataDesigner } from './DataDesigner.js';
export type { DataDesignerOptions, DataDesignResult } from './DataDesigner.js';

export { DeploymentDesigner } from './DeploymentDesigner.js';
export type {
  DeploymentDesignerOptions,
  DeploymentDesignResult,
  ConfigurationSpec,
} from './DeploymentDesigner.js';

export { TraceabilityMapper } from './TraceabilityMapper.js';
export type {
  TraceabilityMapperOptions,
  TraceabilityAnalysis,
  TraceabilityStats,
} from './TraceabilityMapper.js';

// Error classes
export {
  SDSWriterError,
  SRSNotFoundError,
  SRSParseError,
  TemplateNotFoundError,
  TemplateProcessingError,
  ComponentDesignError,
  APISpecificationError,
  DataModelDesignError,
  SecuritySpecificationError,
  LowCoverageError,
  SessionStateError,
  ValidationError,
  GenerationError,
  FileWriteError,
  CircularDependencyError,
  InterfaceGenerationError,
} from './errors.js';

// Type exports
export type {
  // Generation status and config
  SDSGenerationStatus,
  SDSWriterAgentConfig,
  SDSGenerationSession,
  SDSGenerationResult,
  SDSGenerationStats,
  Priority,
  DocumentStatus,
  HttpMethod,
  DataTypeCategory,
  SecurityLevel,

  // SRS input types
  ParsedSRS,
  SRSDocumentMetadata,
  ParsedSRSFeature,
  ParsedNFR,
  ParsedConstraint,
  ParsedUseCase,
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
  APIEndpoint,
  APIParameter,
  DataSchema,
  DataProperty,
  ErrorResponse,

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
  TraceabilityEntry,
  TraceabilityMatrix,

  // Design input types
  ComponentDesignInput,
  APIDesignInput,
  DataModelDesignInput,

  // Re-exported from architecture-generator
  SRSFeature,
  SRSUseCase,
  SRSMetadata,
  NonFunctionalRequirement,
  Constraint,
} from './types.js';
