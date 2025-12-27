/**
 * Component Generator module type definitions
 *
 * Defines types for component definition, interface specification,
 * API endpoint design, and traceability mapping.
 */

import type { SRSFeature, SRSUseCase } from '../architecture-generator/types.js';

/**
 * Interface type categories
 */
export type InterfaceType = 'API' | 'Event' | 'File' | 'Message' | 'Callback';

/**
 * HTTP method types
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Component layer categories
 */
export type ComponentLayer =
  | 'presentation'
  | 'application'
  | 'domain'
  | 'infrastructure'
  | 'integration';

/**
 * Data type for API specifications
 */
export type DataType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'object'
  | 'array'
  | 'null'
  | 'date'
  | 'file';

/**
 * Component definition following SDS-001 template
 */
export interface ComponentDefinition {
  /** Component identifier (CMP-XXX) */
  readonly id: string;
  /** Component name */
  readonly name: string;
  /** Component responsibility description */
  readonly responsibility: string;
  /** Source feature ID (SF-XXX) */
  readonly sourceFeature: string;
  /** Interface specifications */
  readonly interfaces: readonly InterfaceSpec[];
  /** Component dependencies */
  readonly dependencies: readonly string[];
  /** Implementation notes */
  readonly implementationNotes: string;
  /** Component layer */
  readonly layer: ComponentLayer;
}

/**
 * Interface specification
 */
export interface InterfaceSpec {
  /** Interface identifier */
  readonly interfaceId: string;
  /** Interface type */
  readonly type: InterfaceType;
  /** Interface specification details */
  readonly specification: APIEndpoint | EventSpec | FileSpec;
  /** Source use case ID */
  readonly sourceUseCase: string;
}

/**
 * API endpoint specification
 */
export interface APIEndpoint {
  /** Endpoint path */
  readonly endpoint: string;
  /** HTTP method */
  readonly method: HttpMethod;
  /** Endpoint description */
  readonly description: string;
  /** Request specification */
  readonly request: RequestSpec;
  /** Response specifications */
  readonly response: ResponseSpec;
  /** Authentication required */
  readonly authenticated: boolean;
  /** Rate limiting configuration */
  readonly rateLimit?: RateLimitSpec;
}

/**
 * Request specification
 */
export interface RequestSpec {
  /** Request headers */
  readonly headers: readonly HeaderSpec[];
  /** Path parameters */
  readonly pathParams: readonly ParamSpec[];
  /** Query parameters */
  readonly queryParams: readonly ParamSpec[];
  /** Request body schema */
  readonly body?: BodySchema;
}

/**
 * Response specification
 */
export interface ResponseSpec {
  /** Success response */
  readonly success: SuccessResponse;
  /** Error responses */
  readonly errors: readonly ErrorResponse[];
}

/**
 * Success response specification
 */
export interface SuccessResponse {
  /** HTTP status code */
  readonly status: number;
  /** Response body schema */
  readonly body?: BodySchema;
  /** Response description */
  readonly description: string;
}

/**
 * Error response specification
 */
export interface ErrorResponse {
  /** HTTP status code */
  readonly status: number;
  /** Error message */
  readonly message: string;
  /** Error code */
  readonly code?: string;
}

/**
 * Header specification
 */
export interface HeaderSpec {
  /** Header name */
  readonly name: string;
  /** Header description */
  readonly description: string;
  /** Is required */
  readonly required: boolean;
  /** Example value */
  readonly example?: string;
}

/**
 * Parameter specification
 */
export interface ParamSpec {
  /** Parameter name */
  readonly name: string;
  /** Parameter type */
  readonly type: DataType;
  /** Parameter description */
  readonly description: string;
  /** Is required */
  readonly required: boolean;
  /** Default value */
  readonly default?: string;
  /** Validation pattern */
  readonly pattern?: string;
}

/**
 * Body schema specification
 */
export interface BodySchema {
  /** Content type */
  readonly contentType: string;
  /** Schema fields */
  readonly fields: readonly FieldSpec[];
  /** Example value */
  readonly example?: Record<string, unknown>;
}

/**
 * Field specification
 */
export interface FieldSpec {
  /** Field name */
  readonly name: string;
  /** Field type */
  readonly type: DataType;
  /** Field description */
  readonly description: string;
  /** Is required */
  readonly required: boolean;
  /** Nested fields (for object type) */
  readonly fields?: readonly FieldSpec[];
  /** Array item type (for array type) */
  readonly items?: DataType | readonly FieldSpec[];
}

/**
 * Rate limit specification
 */
export interface RateLimitSpec {
  /** Requests per window */
  readonly requests: number;
  /** Window duration in seconds */
  readonly window: number;
}

/**
 * Event specification
 */
export interface EventSpec {
  /** Event name */
  readonly name: string;
  /** Event description */
  readonly description: string;
  /** Event payload schema */
  readonly payload: BodySchema;
  /** Event trigger conditions */
  readonly triggers: readonly string[];
}

/**
 * File specification
 */
export interface FileSpec {
  /** File path pattern */
  readonly pathPattern: string;
  /** File format */
  readonly format: string;
  /** File description */
  readonly description: string;
  /** Schema for file content */
  readonly schema?: BodySchema;
}

/**
 * Traceability entry mapping SF to CMP
 */
export interface TraceabilityEntry {
  /** Feature ID (SF-XXX) */
  readonly featureId: string;
  /** Feature name */
  readonly featureName: string;
  /** Component ID (CMP-XXX) */
  readonly componentId: string;
  /** Component name */
  readonly componentName: string;
  /** Associated use cases */
  readonly useCases: readonly UseCaseMapping[];
  /** Associated interfaces */
  readonly interfaces: readonly string[];
}

/**
 * Use case to interface mapping
 */
export interface UseCaseMapping {
  /** Use case ID (UC-XXX) */
  readonly useCaseId: string;
  /** Use case name */
  readonly useCaseName: string;
  /** Generated interface IDs */
  readonly interfaceIds: readonly string[];
}

/**
 * Component dependency specification
 */
export interface ComponentDependency {
  /** Source component ID */
  readonly sourceId: string;
  /** Target component ID */
  readonly targetId: string;
  /** Dependency type */
  readonly type: 'uses' | 'extends' | 'implements' | 'calls';
  /** Dependency description */
  readonly description: string;
}

/**
 * Complete component design result
 */
export interface ComponentDesign {
  /** Component definitions */
  readonly components: readonly ComponentDefinition[];
  /** API specification table */
  readonly apiSpecification: readonly APIEndpoint[];
  /** Traceability matrix */
  readonly traceabilityMatrix: readonly TraceabilityEntry[];
  /** Component dependencies */
  readonly dependencies: readonly ComponentDependency[];
  /** Design metadata */
  readonly metadata: ComponentDesignMetadata;
}

/**
 * Component design metadata
 */
export interface ComponentDesignMetadata {
  /** Source SRS document ID */
  readonly sourceSRS: string;
  /** Generation timestamp */
  readonly generatedAt: string;
  /** Generator version */
  readonly version: string;
}

/**
 * Component generator options
 */
export interface ComponentGeneratorOptions {
  /** Default component layer */
  readonly defaultLayer?: ComponentLayer;
  /** Generate API specifications */
  readonly generateAPISpecs?: boolean;
  /** Include implementation notes */
  readonly includeNotes?: boolean;
  /** Verbose output */
  readonly verbose?: boolean;
}

/**
 * TypeScript interface generation options
 */
export interface TypeScriptGeneratorOptions {
  /** Add JSDoc comments */
  readonly addJSDoc?: boolean;
  /** Use readonly modifiers */
  readonly useReadonly?: boolean;
  /** Export interfaces */
  readonly exportInterfaces?: boolean;
}

/**
 * Re-export types from architecture-generator for convenience
 */
export type { SRSFeature, SRSUseCase };
