/**
 * Type definitions for SDS Updater Agent
 */

// ============ Change Request Types ============

export type SDSChangeRequestType =
  | 'add_component'
  | 'add_api'
  | 'modify_component'
  | 'modify_api'
  | 'update_data_model'
  | 'update_architecture'
  | 'update_traceability';

export type ComponentType = 'service' | 'controller' | 'repository' | 'utility' | 'middleware';

export type ComponentStatus = 'active' | 'deprecated' | 'pending';

export interface InterfaceMethod {
  readonly name: string;
  readonly parameters: readonly string[];
  readonly returnType: string;
  readonly async: boolean;
}

export interface ProvidedInterface {
  readonly name: string;
  readonly methods: readonly InterfaceMethod[];
}

export interface RequiredInterface {
  readonly component: string;
  readonly interface: string;
}

export interface InternalDependency {
  readonly componentId: string;
  readonly relationship: 'uses' | 'extends' | 'implements';
}

export interface ExternalDependency {
  readonly name: string;
  readonly version: string;
  readonly purpose: string;
}

export interface NewComponent {
  readonly name: string;
  readonly description: string;
  readonly type: ComponentType;
  readonly linkedSrsIds: readonly string[];
  readonly interfaces?: {
    readonly provided?: readonly ProvidedInterface[];
    readonly required?: readonly RequiredInterface[];
  };
  readonly dependencies?: {
    readonly internal?: readonly InternalDependency[];
    readonly external?: readonly ExternalDependency[];
  };
  readonly notes?: string;
}

export interface ErrorResponse {
  readonly code: string | number;
  readonly condition: string;
  readonly response: string;
}

export interface NewAPI {
  readonly endpoint: string;
  readonly componentId: string;
  readonly linkedUseCase?: string;
  readonly method?: string;
  readonly requestSchema?: Record<string, unknown>;
  readonly responseSchema?: Record<string, unknown>;
  readonly errorResponses?: readonly ErrorResponse[];
  readonly authentication?: string;
  readonly notes?: string;
}

export interface ItemModification {
  readonly field: string;
  readonly oldValue?: string;
  readonly newValue: string;
}

export interface DataChange {
  readonly type: 'add_field' | 'modify_field' | 'add_entity' | 'add_relationship';
  readonly details: Record<string, unknown>;
}

export interface DataModelUpdate {
  readonly entityName: string;
  readonly dataChanges: readonly DataChange[];
}

export interface ArchitectureChange {
  readonly type: 'add_pattern' | 'modify_deployment' | 'add_integration';
  readonly description: string;
  readonly rationale: string;
}

export interface SDSTraceabilityUpdate {
  readonly srsId: string;
  readonly sdsIds: readonly string[];
}

export interface SDSChangeRequest {
  readonly type: SDSChangeRequestType;
  readonly targetSection?: string;

  // For add_component
  readonly newComponent?: NewComponent;

  // For add_api
  readonly newAPI?: NewAPI;

  // For modify_component and modify_api
  readonly itemId?: string;
  readonly modifications?: readonly ItemModification[];

  // For update_data_model
  readonly dataModelUpdate?: DataModelUpdate;

  // For update_architecture
  readonly architectureChange?: ArchitectureChange;

  // For update_traceability
  readonly traceabilityUpdates?: readonly SDSTraceabilityUpdate[];
}

// ============ Document Types ============

export interface SDSDocumentMetadata {
  readonly id?: string;
  readonly title: string;
  readonly version: string;
  readonly sourceSrs?: string;
  readonly status?: string;
  readonly created?: string;
  readonly lastUpdated?: string;
}

export interface ParsedComponent {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly type: ComponentType;
  readonly status: ComponentStatus;
  readonly linkedSrsIds: readonly string[];
  readonly interfaces?: {
    readonly provided?: readonly ProvidedInterface[];
    readonly required?: readonly RequiredInterface[];
  };
  readonly dependencies?: {
    readonly internal?: readonly InternalDependency[];
    readonly external?: readonly ExternalDependency[];
  };
  readonly notes?: string;
  readonly lineNumber: number;
  readonly rawContent: string;
}

export interface ParsedAPI {
  readonly endpoint: string;
  readonly method: string;
  readonly componentId: string;
  readonly linkedUseCase?: string;
  readonly status: ComponentStatus;
  readonly requestSchema?: Record<string, unknown>;
  readonly responseSchema?: Record<string, unknown>;
  readonly errorResponses?: readonly ErrorResponse[];
  readonly authentication?: string;
  readonly notes?: string;
  readonly lineNumber: number;
  readonly rawContent: string;
}

export interface DocumentSection {
  readonly title: string;
  readonly level: number;
  readonly content: string;
  readonly startLine: number;
  readonly endLine: number;
}

export interface SDSTraceabilityEntry {
  readonly srsId: string;
  readonly sdsIds: readonly string[];
}

export interface ParsedSDS {
  readonly path: string;
  readonly metadata: SDSDocumentMetadata;
  readonly rawContent: string;
  readonly components: readonly ParsedComponent[];
  readonly apis: readonly ParsedAPI[];
  readonly sections: readonly DocumentSection[];
  readonly traceabilityMatrix: readonly SDSTraceabilityEntry[];
  readonly lastModified: string;
}

// ============ Update Result Types ============

export interface AddedComponent {
  readonly id: string;
  readonly name: string;
  readonly linkedSrs: string;
  readonly lineNumber: number;
}

export interface AddedAPI {
  readonly endpoint: string;
  readonly component: string;
  readonly useCase?: string;
  readonly lineNumber: number;
}

export interface ModifiedComponent {
  readonly id: string;
  readonly field: string;
  readonly oldValue: string;
  readonly newValue: string;
}

export interface ModifiedAPI {
  readonly endpoint: string;
  readonly field: string;
  readonly oldValue: string;
  readonly newValue: string;
}

export interface DataModelChange {
  readonly entity: string;
  readonly changeType: string;
  readonly details: string;
}

export interface ArchitectureModification {
  readonly type: string;
  readonly description: string;
}

export interface ConsistencyCheckResult {
  readonly passed: boolean;
  readonly issues: readonly string[];
}

export interface SDSUpdateChanges {
  readonly componentsAdded: readonly AddedComponent[];
  readonly apisAdded: readonly AddedAPI[];
  readonly componentsModified: readonly ModifiedComponent[];
  readonly apisModified: readonly ModifiedAPI[];
  readonly dataModelsChanged: readonly DataModelChange[];
  readonly architectureChanges: readonly ArchitectureModification[];
}

export interface SDSUpdateResult {
  readonly document: string;
  readonly versionBefore: string;
  readonly versionAfter: string;
  readonly updatedAt: string;
  readonly changes: SDSUpdateChanges;
  readonly traceabilityUpdates: readonly SDSTraceabilityEntry[];
  readonly consistencyCheck: ConsistencyCheckResult;
  readonly changelogEntry: string;
}

// ============ Session Types ============

export type SDSSessionStatus = 'idle' | 'loading' | 'updating' | 'completed' | 'failed';

export interface SDSUpdaterSession {
  readonly sessionId: string;
  readonly projectId: string;
  readonly status: SDSSessionStatus;
  readonly sdsPath?: string;
  readonly parsedSDS?: ParsedSDS;
  readonly updateResult?: SDSUpdateResult;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}

// ============ Operation Result Types ============

export interface SDSUpdateOperationResult {
  readonly success: boolean;
  readonly projectId: string;
  readonly sdsPath: string;
  readonly outputPath: string;
  readonly changelogPath: string;
  readonly updateResult: SDSUpdateResult;
  readonly warnings: readonly string[];
}

// ============ Configuration Types ============

export interface SDSUpdaterConfig {
  readonly docsBasePath?: string;
  readonly sdsSubdir?: string;
  readonly scratchpadBasePath?: string;
  readonly maxFileSize?: number;
  readonly preserveFormatting?: boolean;
  readonly generateChangelog?: boolean;
}

export const DEFAULT_SDS_UPDATER_CONFIG: Required<SDSUpdaterConfig> = {
  docsBasePath: 'docs',
  sdsSubdir: 'sds',
  scratchpadBasePath: '.ad-sdlc/scratchpad',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  preserveFormatting: true,
  generateChangelog: true,
};
