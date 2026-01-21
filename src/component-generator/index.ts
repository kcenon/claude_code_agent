/**
 * Component Generator module exports
 *
 * Provides functionality to generate component definitions,
 * interface specifications, and API designs from SRS documents.
 */

// Main classes
export {
  ComponentGenerator,
  getComponentGenerator,
  resetComponentGenerator,
  COMPONENT_GENERATOR_AGENT_ID,
} from './ComponentGenerator.js';
export type { ComponentGeneratorConfig } from './ComponentGenerator.js';

export { InterfaceGenerator } from './InterfaceGenerator.js';
export { APISpecificationGenerator } from './APISpecificationGenerator.js';

// Error classes
export {
  ComponentGeneratorError,
  FeatureNotFoundError,
  ComponentGenerationError,
  InterfaceGenerationError,
  APISpecificationError,
  DependencyAnalysisError,
  CircularDependencyError,
  TraceabilityError,
  TypeScriptGenerationError,
  OutputWriteError,
  InvalidSRSError,
} from './errors.js';

// Schema exports
export {
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
} from './schemas.js';

// Type exports
export type {
  // Interface types
  InterfaceType,
  HttpMethod,
  ComponentLayer,
  DataType,

  // Component types
  ComponentDefinition,
  InterfaceSpec,
  APIEndpoint,
  EventSpec,
  FileSpec,

  // Request/Response types
  RequestSpec,
  ResponseSpec,
  SuccessResponse,
  ErrorResponse,
  HeaderSpec,
  ParamSpec,
  BodySchema,
  FieldSpec,
  RateLimitSpec,

  // Traceability types
  TraceabilityEntry,
  UseCaseMapping,
  ComponentDependency,

  // Result types
  ComponentDesign,
  ComponentDesignMetadata,

  // Option types
  ComponentGeneratorOptions,
  TypeScriptGeneratorOptions,

  // Re-exported types
  SRSFeature,
  SRSUseCase,
} from './types.js';
