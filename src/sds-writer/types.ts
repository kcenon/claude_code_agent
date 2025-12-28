/**
 * SDS Writer Agent module type definitions
 *
 * Defines types for Software Design Specification (SDS) generation from SRS documents,
 * component design, API specification, data modeling, and traceability.
 */

import type {
  SRSFeature,
  SRSUseCase,
  SRSMetadata,
  NonFunctionalRequirement,
  Constraint,
} from '../architecture-generator/types.js';

/**
 * SDS generation status
 */
export type SDSGenerationStatus =
  | 'pending'
  | 'parsing'
  | 'designing'
  | 'specifying'
  | 'generating'
  | 'completed'
  | 'failed';

/**
 * Priority level for components and features
 */
export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

/**
 * Document status
 */
export type DocumentStatus = 'Draft' | 'Review' | 'Approved';

/**
 * HTTP method for API endpoints
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Data type category
 */
export type DataTypeCategory = 'entity' | 'value_object' | 'aggregate' | 'enum';

/**
 * Security level
 */
export type SecurityLevel = 'public' | 'authenticated' | 'authorized' | 'admin';

// ============================================================================
// SRS Input Types (for parsing SRS documents)
// ============================================================================

/**
 * Parsed SRS document structure
 */
export interface ParsedSRS {
  /** Document metadata */
  readonly metadata: SRSDocumentMetadata;
  /** Product information */
  readonly productName: string;
  /** Product description */
  readonly productDescription: string;
  /** Software features */
  readonly features: readonly ParsedSRSFeature[];
  /** Non-functional requirements */
  readonly nfrs: readonly ParsedNFR[];
  /** Constraints */
  readonly constraints: readonly ParsedConstraint[];
  /** Assumptions */
  readonly assumptions: readonly string[];
  /** Use cases */
  readonly useCases: readonly ParsedUseCase[];
}

/**
 * SRS document metadata
 */
export interface SRSDocumentMetadata {
  /** Document ID (e.g., SRS-001) */
  readonly documentId: string;
  /** Source PRD reference */
  readonly sourcePRD: string;
  /** Version */
  readonly version: string;
  /** Status */
  readonly status: string;
  /** Project ID */
  readonly projectId: string;
  /** Created date */
  readonly createdDate?: string;
  /** Last updated date */
  readonly updatedDate?: string;
}

/**
 * Parsed SRS feature
 */
export interface ParsedSRSFeature {
  /** Feature ID (e.g., SF-001) */
  readonly id: string;
  /** Feature name */
  readonly name: string;
  /** Description */
  readonly description: string;
  /** Priority level */
  readonly priority: Priority;
  /** Source requirement IDs */
  readonly sourceRequirements: readonly string[];
  /** Associated use case IDs */
  readonly useCaseIds: readonly string[];
  /** Acceptance criteria */
  readonly acceptanceCriteria: readonly string[];
}

/**
 * Parsed NFR from SRS
 */
export interface ParsedNFR {
  /** NFR ID (e.g., NFR-001) */
  readonly id: string;
  /** Category (performance, security, etc.) */
  readonly category: string;
  /** Description */
  readonly description: string;
  /** Metric/target */
  readonly metric?: string;
  /** Priority */
  readonly priority: Priority;
}

/**
 * Parsed constraint from SRS
 */
export interface ParsedConstraint {
  /** Constraint ID */
  readonly id: string;
  /** Type (technical, business, etc.) */
  readonly type: string;
  /** Description */
  readonly description: string;
}

/**
 * Parsed use case from SRS
 */
export interface ParsedUseCase {
  /** Use case ID (e.g., UC-001) */
  readonly id: string;
  /** Use case name */
  readonly name: string;
  /** Primary actor */
  readonly primaryActor: string;
  /** Preconditions */
  readonly preconditions: readonly string[];
  /** Main success scenario (steps) */
  readonly mainScenario: readonly string[];
  /** Alternative scenarios */
  readonly alternativeScenarios: readonly AlternativeScenario[];
  /** Postconditions */
  readonly postconditions: readonly string[];
  /** Source feature ID */
  readonly sourceFeatureId: string;
}

/**
 * Alternative scenario for a use case
 */
export interface AlternativeScenario {
  /** Scenario name */
  readonly name: string;
  /** Steps */
  readonly steps: readonly string[];
}

// ============================================================================
// Mutable Builder Types (for internal parsing use only)
// ============================================================================

/**
 * Mutable feature for building during parsing
 * @internal
 */
export interface MutableParsedFeature {
  id: string;
  name: string;
  description?: string;
  priority: Priority;
  sourceRequirements: string[];
  useCaseIds: string[];
  acceptanceCriteria?: string[];
}

/**
 * Mutable use case for building during parsing
 * @internal
 */
export interface MutableParsedUseCase {
  id: string;
  name: string;
  primaryActor: string;
  preconditions?: string[];
  mainScenario?: string[];
  postconditions?: string[];
  alternativeScenarios?: AlternativeScenario[];
  sourceFeatureId: string;
}

/**
 * Mutable NFR for building during parsing
 * @internal
 */
export interface MutableParsedNFR {
  id: string;
  category: string;
  description?: string;
  metric?: string;
  priority: Priority;
}

/**
 * Mutable constraint for building during parsing
 * @internal
 */
export interface MutableParsedConstraint {
  id: string;
  type: string;
  description?: string;
}

// ============================================================================
// SDS Output Types (for generating SDS documents)
// ============================================================================

/**
 * SDS document metadata
 */
export interface SDSMetadata {
  /** Document ID (e.g., SDS-001) */
  readonly documentId: string;
  /** Source SRS reference */
  readonly sourceSRS: string;
  /** Source PRD reference (for full traceability) */
  readonly sourcePRD: string;
  /** Version */
  readonly version: string;
  /** Status */
  readonly status: DocumentStatus;
  /** Created date */
  readonly createdDate: string;
  /** Last updated date */
  readonly updatedDate: string;
}

/**
 * SDS component definition
 */
export interface SDSComponent {
  /** Component ID (e.g., CMP-001) */
  readonly id: string;
  /** Component name */
  readonly name: string;
  /** Responsibility (single responsibility description) */
  readonly responsibility: string;
  /** Source feature ID (SF-XXX) */
  readonly sourceFeature: string;
  /** Priority level */
  readonly priority: Priority;
  /** Detailed description */
  readonly description: string;
  /** Component interfaces */
  readonly interfaces: readonly SDSInterface[];
  /** Dependencies on other components */
  readonly dependencies: readonly string[];
  /** Implementation notes */
  readonly implementationNotes: string;
  /** Technology suggestions */
  readonly technology?: string;
}

/**
 * Interface definition for a component
 */
export interface SDSInterface {
  /** Interface name */
  readonly name: string;
  /** Methods in the interface */
  readonly methods: readonly SDSMethod[];
  /** Raw TypeScript code representation */
  readonly rawCode: string;
}

/**
 * Method definition in an interface
 */
export interface SDSMethod {
  /** Method name */
  readonly name: string;
  /** Full method signature */
  readonly signature: string;
  /** Return type */
  readonly returnType: string;
  /** Parameters */
  readonly parameters?: readonly MethodParameter[];
  /** Method description */
  readonly description?: string;
}

/**
 * Method parameter definition
 */
export interface MethodParameter {
  /** Parameter name */
  readonly name: string;
  /** Parameter type */
  readonly type: string;
  /** Whether parameter is optional */
  readonly optional: boolean;
  /** Description */
  readonly description?: string;
}

/**
 * Technology stack entry
 */
export interface TechnologyEntry {
  /** Layer (e.g., Frontend, Backend, Database) */
  readonly layer: string;
  /** Technology name */
  readonly technology: string;
  /** Version or version range */
  readonly version: string;
  /** Rationale for selection */
  readonly rationale: string;
}

/**
 * API endpoint specification
 */
export interface APIEndpoint {
  /** Endpoint path (e.g., /api/v1/users) */
  readonly path: string;
  /** HTTP method */
  readonly method: HttpMethod;
  /** Endpoint name/summary */
  readonly name: string;
  /** Description */
  readonly description: string;
  /** Source use case ID */
  readonly sourceUseCase: string;
  /** Source component ID */
  readonly sourceComponent: string;
  /** Request body schema */
  readonly requestBody?: DataSchema;
  /** Response schema */
  readonly responseBody: DataSchema;
  /** Path parameters */
  readonly pathParameters?: readonly APIParameter[];
  /** Query parameters */
  readonly queryParameters?: readonly APIParameter[];
  /** Security requirements */
  readonly security: SecurityLevel;
  /** Error responses */
  readonly errorResponses: readonly ErrorResponse[];
}

/**
 * API parameter definition
 */
export interface APIParameter {
  /** Parameter name */
  readonly name: string;
  /** Parameter type */
  readonly type: string;
  /** Whether required */
  readonly required: boolean;
  /** Description */
  readonly description: string;
}

/**
 * Error response definition
 */
export interface ErrorResponse {
  /** HTTP status code */
  readonly statusCode: number;
  /** Error code */
  readonly code: string;
  /** Error message */
  readonly message: string;
}

/**
 * Data schema definition
 */
export interface DataSchema {
  /** Schema name */
  readonly name: string;
  /** Schema type */
  readonly type: 'object' | 'array' | 'primitive';
  /** Properties (for object type) */
  readonly properties?: readonly DataProperty[];
  /** Array item type (for array type) */
  readonly itemType?: string;
  /** Primitive type (for primitive type) */
  readonly primitiveType?: string;
}

/**
 * Data property definition
 */
export interface DataProperty {
  /** Property name */
  readonly name: string;
  /** Property type */
  readonly type: string;
  /** Whether required */
  readonly required: boolean;
  /** Description */
  readonly description?: string;
  /** Validation rules */
  readonly validation?: readonly string[];
}

/**
 * Data model definition (for database design)
 */
export interface DataModel {
  /** Model ID */
  readonly id: string;
  /** Model name */
  readonly name: string;
  /** Category */
  readonly category: DataTypeCategory;
  /** Description */
  readonly description: string;
  /** Source component ID */
  readonly sourceComponent: string;
  /** Properties/fields */
  readonly properties: readonly DataProperty[];
  /** Relationships to other models */
  readonly relationships: readonly DataRelationship[];
  /** Indexes */
  readonly indexes?: readonly DataIndex[];
}

/**
 * Relationship between data models
 */
export interface DataRelationship {
  /** Target model name */
  readonly target: string;
  /** Relationship type */
  readonly type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  /** Foreign key field (if applicable) */
  readonly foreignKey?: string;
  /** Description */
  readonly description?: string;
}

/**
 * Database index definition
 */
export interface DataIndex {
  /** Index name */
  readonly name: string;
  /** Indexed fields */
  readonly fields: readonly string[];
  /** Whether unique */
  readonly unique: boolean;
}

/**
 * Security specification
 */
export interface SecuritySpec {
  /** Authentication mechanism */
  readonly authentication: AuthenticationSpec;
  /** Authorization rules */
  readonly authorization: AuthorizationSpec;
  /** Data protection measures */
  readonly dataProtection: readonly DataProtectionMeasure[];
}

/**
 * Authentication specification
 */
export interface AuthenticationSpec {
  /** Authentication type */
  readonly type: 'jwt' | 'oauth2' | 'api_key' | 'session' | 'none';
  /** Token expiry (if applicable) */
  readonly tokenExpiry?: string;
  /** Refresh mechanism */
  readonly refreshMechanism?: string;
  /** Additional notes */
  readonly notes?: string;
}

/**
 * Authorization specification
 */
export interface AuthorizationSpec {
  /** Authorization model */
  readonly model: 'rbac' | 'abac' | 'acl' | 'none';
  /** Roles (for RBAC) */
  readonly roles?: readonly RoleDefinition[];
  /** Permission rules */
  readonly permissions?: readonly PermissionRule[];
}

/**
 * Role definition for RBAC
 */
export interface RoleDefinition {
  /** Role name */
  readonly name: string;
  /** Role description */
  readonly description: string;
  /** Permissions */
  readonly permissions: readonly string[];
}

/**
 * Permission rule
 */
export interface PermissionRule {
  /** Resource */
  readonly resource: string;
  /** Actions */
  readonly actions: readonly string[];
  /** Condition */
  readonly condition?: string;
}

/**
 * Data protection measure
 */
export interface DataProtectionMeasure {
  /** Measure type */
  readonly type: 'encryption' | 'masking' | 'hashing' | 'tokenization';
  /** Applies to */
  readonly appliesTo: readonly string[];
  /** Algorithm/method */
  readonly method: string;
  /** Notes */
  readonly notes?: string;
}

/**
 * Deployment architecture
 */
export interface DeploymentSpec {
  /** Deployment pattern */
  readonly pattern: 'monolith' | 'microservices' | 'serverless' | 'hybrid';
  /** Environment specifications */
  readonly environments: readonly EnvironmentSpec[];
  /** Scaling strategy */
  readonly scaling?: ScalingSpec;
}

/**
 * Environment specification
 */
export interface EnvironmentSpec {
  /** Environment name */
  readonly name: 'development' | 'staging' | 'production';
  /** Infrastructure notes */
  readonly infrastructure: string;
  /** Configuration notes */
  readonly configuration?: string;
}

/**
 * Scaling specification
 */
export interface ScalingSpec {
  /** Scaling type */
  readonly type: 'horizontal' | 'vertical' | 'auto';
  /** Metrics for auto-scaling */
  readonly metrics?: readonly string[];
  /** Min instances */
  readonly minInstances?: number;
  /** Max instances */
  readonly maxInstances?: number;
}

/**
 * Traceability entry (SRS -> SDS mapping)
 */
export interface TraceabilityEntry {
  /** Component ID */
  readonly componentId: string;
  /** SRS feature ID */
  readonly srsFeature: string;
  /** Use case IDs */
  readonly useCases: readonly string[];
  /** PRD requirement ID */
  readonly prdRequirement: string;
}

/**
 * Traceability matrix
 */
export interface TraceabilityMatrix {
  /** All entries */
  readonly entries: readonly TraceabilityEntry[];
  /** Forward coverage (SRS -> SDS) */
  readonly forwardCoverage: number;
  /** Orphan components (not traced to any feature) */
  readonly orphanComponents: readonly string[];
  /** Uncovered features */
  readonly uncoveredFeatures: readonly string[];
}

// ============================================================================
// Agent Configuration and Session Types
// ============================================================================

/**
 * SDS Writer Agent configuration options
 */
export interface SDSWriterAgentConfig {
  /** Base path for scratchpad (defaults to .ad-sdlc/scratchpad) */
  readonly scratchpadBasePath?: string;
  /** Path to SDS template (defaults to .ad-sdlc/templates/sds-template.md) */
  readonly templatePath?: string;
  /** Output directory for public SDS docs */
  readonly publicDocsPath?: string;
  /** Whether to generate API specifications */
  readonly generateAPIs?: boolean;
  /** Whether to generate data models */
  readonly generateDataModels?: boolean;
  /** Whether to generate security specifications */
  readonly generateSecuritySpecs?: boolean;
  /** Whether to fail on low traceability coverage */
  readonly failOnLowCoverage?: boolean;
  /** Minimum traceability coverage threshold (0-100) */
  readonly coverageThreshold?: number;
  /** Include traceability matrix in output */
  readonly includeTraceability?: boolean;
  /** Default technology stack suggestions */
  readonly defaultTechnologyStack?: readonly TechnologyEntry[];
}

/**
 * SDS generation session
 */
export interface SDSGenerationSession {
  /** Session identifier */
  readonly sessionId: string;
  /** Project identifier */
  readonly projectId: string;
  /** Current generation status */
  readonly status: SDSGenerationStatus;
  /** Parsed SRS input */
  readonly parsedSRS: ParsedSRS;
  /** Designed components */
  readonly components?: readonly SDSComponent[];
  /** API specifications */
  readonly apis?: readonly APIEndpoint[];
  /** Data models */
  readonly dataModels?: readonly DataModel[];
  /** Traceability matrix */
  readonly traceabilityMatrix?: TraceabilityMatrix;
  /** Generated SDS (when completed) */
  readonly generatedSDS?: GeneratedSDS;
  /** Session start time */
  readonly startedAt: string;
  /** Session last update time */
  readonly updatedAt: string;
  /** Error message if failed */
  readonly errorMessage?: string;
}

/**
 * Generated SDS document
 */
export interface GeneratedSDS {
  /** SDS metadata */
  readonly metadata: SDSMetadata;
  /** Raw markdown content */
  readonly content: string;
  /** Components in the SDS */
  readonly components: readonly SDSComponent[];
  /** Technology stack */
  readonly technologyStack: readonly TechnologyEntry[];
  /** API endpoints */
  readonly apis: readonly APIEndpoint[];
  /** Data models */
  readonly dataModels: readonly DataModel[];
  /** Security specification */
  readonly security?: SecuritySpec;
  /** Deployment specification */
  readonly deployment?: DeploymentSpec;
  /** Traceability matrix */
  readonly traceabilityMatrix: TraceabilityMatrix;
}

/**
 * SDS generation result
 */
export interface SDSGenerationResult {
  /** Whether generation was successful */
  readonly success: boolean;
  /** Project ID */
  readonly projectId: string;
  /** Path to the generated SDS in scratchpad */
  readonly scratchpadPath: string;
  /** Path to the public SDS document */
  readonly publicPath: string;
  /** Generated SDS content */
  readonly generatedSDS: GeneratedSDS;
  /** Generation statistics */
  readonly stats: SDSGenerationStats;
}

/**
 * Statistics about the SDS generation process
 */
export interface SDSGenerationStats {
  /** Number of SRS features processed */
  readonly srsFeatureCount: number;
  /** Number of SDS components generated */
  readonly componentsGenerated: number;
  /** Number of interfaces generated */
  readonly interfacesGenerated: number;
  /** Number of API endpoints generated */
  readonly apisGenerated: number;
  /** Number of data models generated */
  readonly dataModelsGenerated: number;
  /** Traceability coverage percentage */
  readonly traceabilityCoverage: number;
  /** Total processing time in milliseconds */
  readonly processingTimeMs: number;
}

/**
 * Component design input (for ComponentDesigner)
 */
export interface ComponentDesignInput {
  /** Feature to design component for */
  readonly feature: ParsedSRSFeature;
  /** Related use cases */
  readonly useCases: readonly ParsedUseCase[];
  /** NFRs to consider */
  readonly nfrs: readonly ParsedNFR[];
  /** Constraints to consider */
  readonly constraints: readonly ParsedConstraint[];
  /** Component index for ID generation */
  readonly componentIndex: number;
}

/**
 * API design input (for APISpecifier)
 */
export interface APIDesignInput {
  /** Component this API belongs to */
  readonly component: SDSComponent;
  /** Use case this API implements */
  readonly useCase: ParsedUseCase;
  /** NFRs to consider (especially performance) */
  readonly nfrs: readonly ParsedNFR[];
  /** API index for path generation */
  readonly apiIndex: number;
}

/**
 * Data model design input (for DataDesigner)
 */
export interface DataModelDesignInput {
  /** Component this data model belongs to */
  readonly component: SDSComponent;
  /** Related features */
  readonly features: readonly ParsedSRSFeature[];
  /** Model index for ID generation */
  readonly modelIndex: number;
}

// Re-export types from architecture-generator for convenience
export type { SRSFeature, SRSUseCase, SRSMetadata, NonFunctionalRequirement, Constraint };
