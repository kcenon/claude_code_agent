/**
 * Type definitions for SRS Updater Agent
 */

// ============ Change Request Types ============

export type SRSChangeRequestType =
  | 'add_feature'
  | 'add_use_case'
  | 'modify_feature'
  | 'modify_use_case'
  | 'update_interface'
  | 'update_traceability';

export type FeaturePriority = 'P0' | 'P1' | 'P2' | 'P3';

export type FeatureStatus = 'active' | 'deprecated' | 'pending';

export interface NewFeature {
  readonly title: string;
  readonly description: string;
  readonly priority: FeaturePriority;
  readonly linkedPrdIds: readonly string[];
  readonly preconditions?: readonly string[] | undefined;
  readonly postconditions?: readonly string[] | undefined;
  readonly dependencies?: readonly string[] | undefined;
  readonly notes?: string | undefined;
}

export interface AlternativeFlow {
  readonly condition: string;
  readonly steps: readonly string[];
}

export interface ExceptionFlow {
  readonly condition: string;
  readonly steps: readonly string[];
}

export interface NewUseCase {
  readonly title: string;
  readonly description: string;
  readonly primaryActor: string;
  readonly featureId: string;
  readonly preconditions?: readonly string[] | undefined;
  readonly postconditions?: readonly string[] | undefined;
  readonly mainFlow: readonly string[];
  readonly alternativeFlows?: readonly AlternativeFlow[] | undefined;
  readonly exceptionFlows?: readonly ExceptionFlow[] | undefined;
  readonly notes?: string | undefined;
}

export interface ItemModification {
  readonly field: string;
  readonly oldValue?: string | undefined;
  readonly newValue: string;
}

export interface TraceabilityUpdate {
  readonly prdId: string;
  readonly srsIds: readonly string[];
}

export interface SRSChangeRequest {
  readonly type: SRSChangeRequestType;
  readonly targetSection?: string | undefined;

  // For add_feature
  readonly newFeature?: NewFeature | undefined;

  // For add_use_case
  readonly newUseCase?: NewUseCase | undefined;

  // For modify_feature and modify_use_case
  readonly itemId?: string | undefined;
  readonly modifications?: readonly ItemModification[] | undefined;

  // For update_interface
  readonly interfaceName?: string | undefined;
  readonly interfaceChanges?: string | undefined;

  // For update_traceability
  readonly traceabilityUpdates?: readonly TraceabilityUpdate[] | undefined;
}

// ============ Document Types ============

export interface SRSDocumentMetadata {
  readonly id?: string | undefined;
  readonly title: string;
  readonly version: string;
  readonly status?: string | undefined;
  readonly created?: string | undefined;
  readonly lastUpdated?: string | undefined;
}

export interface ParsedFeature {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly priority: FeaturePriority;
  readonly status: FeatureStatus;
  readonly linkedPrdIds: readonly string[];
  readonly preconditions?: readonly string[] | undefined;
  readonly postconditions?: readonly string[] | undefined;
  readonly dependencies?: readonly string[] | undefined;
  readonly notes?: string | undefined;
  readonly lineNumber: number;
  readonly rawContent: string;
}

export interface ParsedUseCase {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly primaryActor: string;
  readonly featureId: string;
  readonly status: FeatureStatus;
  readonly preconditions?: readonly string[] | undefined;
  readonly postconditions?: readonly string[] | undefined;
  readonly mainFlow: readonly string[];
  readonly alternativeFlows?: readonly AlternativeFlow[] | undefined;
  readonly exceptionFlows?: readonly ExceptionFlow[] | undefined;
  readonly notes?: string | undefined;
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

export interface TraceabilityEntry {
  readonly prdId: string;
  readonly srsIds: readonly string[];
}

export interface ParsedSRS {
  readonly path: string;
  readonly metadata: SRSDocumentMetadata;
  readonly rawContent: string;
  readonly features: readonly ParsedFeature[];
  readonly useCases: readonly ParsedUseCase[];
  readonly sections: readonly DocumentSection[];
  readonly traceabilityMatrix: readonly TraceabilityEntry[];
  readonly lastModified: string;
}

// ============ Update Result Types ============

export interface AddedFeature {
  readonly id: string;
  readonly title: string;
  readonly linkedPrd: string;
  readonly lineNumber: number;
}

export interface AddedUseCase {
  readonly id: string;
  readonly title: string;
  readonly feature: string;
  readonly lineNumber: number;
}

export interface ModifiedFeature {
  readonly id: string;
  readonly field: string;
  readonly oldValue: string;
  readonly newValue: string;
}

export interface ModifiedUseCase {
  readonly id: string;
  readonly field: string;
  readonly oldValue: string;
  readonly newValue: string;
}

export interface ModifiedInterface {
  readonly name: string;
  readonly changes: string;
}

export interface ConsistencyCheckResult {
  readonly passed: boolean;
  readonly issues: readonly string[];
}

export interface SRSUpdateChanges {
  readonly featuresAdded: readonly AddedFeature[];
  readonly useCasesAdded: readonly AddedUseCase[];
  readonly featuresModified: readonly ModifiedFeature[];
  readonly useCasesModified: readonly ModifiedUseCase[];
  readonly interfacesModified: readonly ModifiedInterface[];
}

export interface SRSUpdateResult {
  readonly document: string;
  readonly versionBefore: string;
  readonly versionAfter: string;
  readonly updatedAt: string;
  readonly changes: SRSUpdateChanges;
  readonly traceabilityUpdates: readonly TraceabilityEntry[];
  readonly consistencyCheck: ConsistencyCheckResult;
  readonly changelogEntry: string;
}

// ============ Session Types ============

export type SRSSessionStatus = 'idle' | 'loading' | 'updating' | 'completed' | 'failed';

export interface SRSUpdaterSession {
  readonly sessionId: string;
  readonly projectId: string;
  readonly status: SRSSessionStatus;
  readonly srsPath?: string | undefined;
  readonly parsedSRS?: ParsedSRS | undefined;
  readonly updateResult?: SRSUpdateResult | undefined;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}

// ============ Operation Result Types ============

export interface SRSUpdateOperationResult {
  readonly success: boolean;
  readonly projectId: string;
  readonly srsPath: string;
  readonly outputPath: string;
  readonly changelogPath: string;
  readonly updateResult: SRSUpdateResult;
  readonly warnings: readonly string[];
}

// ============ Configuration Types ============

export interface SRSUpdaterConfig {
  readonly docsBasePath?: string;
  readonly srsSubdir?: string;
  readonly scratchpadBasePath?: string;
  readonly maxFileSize?: number;
  readonly preserveFormatting?: boolean;
  readonly generateChangelog?: boolean;
}

export const DEFAULT_SRS_UPDATER_CONFIG: Required<SRSUpdaterConfig> = {
  docsBasePath: 'docs',
  srsSubdir: 'srs',
  scratchpadBasePath: '.ad-sdlc/scratchpad',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  preserveFormatting: true,
  generateChangelog: true,
};
