/**
 * Type definitions for PRD Updater Agent
 */

// ============ Change Request Types ============

export type ChangeRequestType =
  | 'add_requirement'
  | 'modify_requirement'
  | 'deprecate_requirement'
  | 'extend_scope';

export type RequirementType = 'functional' | 'non_functional';

export type RequirementPriority = 'P0' | 'P1' | 'P2' | 'P3';

export type RequirementStatus = 'active' | 'deprecated' | 'pending';

export interface NewRequirement {
  readonly type: RequirementType;
  readonly title: string;
  readonly description: string;
  readonly priority: RequirementPriority;
  readonly userStory?: string | undefined;
  readonly acceptanceCriteria?: readonly string[] | undefined;
  readonly dependencies?: readonly string[] | undefined;
  readonly notes?: string | undefined;
}

export interface RequirementModification {
  readonly field: string;
  readonly oldValue?: string | undefined;
  readonly newValue: string;
}

export interface ChangeRequest {
  readonly type: ChangeRequestType;
  readonly targetSection?: string | undefined;

  // For add_requirement
  readonly newRequirement?: NewRequirement | undefined;

  // For modify_requirement and deprecate_requirement
  readonly requirementId?: string | undefined;

  // For modify_requirement
  readonly modifications?: readonly RequirementModification[] | undefined;

  // For deprecate_requirement
  readonly deprecationReason?: string | undefined;
  readonly replacementId?: string | undefined;

  // For extend_scope
  readonly scopeExtension?: string | undefined;
}

// ============ Document Types ============

export interface DocumentMetadata {
  readonly id?: string | undefined;
  readonly title: string;
  readonly version: string;
  readonly status?: string | undefined;
  readonly created?: string | undefined;
  readonly lastUpdated?: string | undefined;
}

export interface ParsedRequirement {
  readonly id: string;
  readonly title: string;
  readonly type: RequirementType;
  readonly description: string;
  readonly priority: RequirementPriority;
  readonly status: RequirementStatus;
  readonly userStory?: string | undefined;
  readonly acceptanceCriteria?: readonly string[] | undefined;
  readonly dependencies?: readonly string[] | undefined;
  readonly notes?: string | undefined;
  readonly lineNumber: number;
  readonly rawContent: string;
}

export interface ParsedPRD {
  readonly path: string;
  readonly metadata: DocumentMetadata;
  readonly rawContent: string;
  readonly requirements: readonly ParsedRequirement[];
  readonly sections: readonly DocumentSection[];
  readonly lastModified: string;
}

export interface DocumentSection {
  readonly title: string;
  readonly level: number;
  readonly content: string;
  readonly startLine: number;
  readonly endLine: number;
}

// ============ Update Result Types ============

export interface AddedRequirement {
  readonly id: string;
  readonly title: string;
  readonly section: string;
  readonly lineNumber: number;
}

export interface ModifiedRequirement {
  readonly id: string;
  readonly field: string;
  readonly oldValue: string;
  readonly newValue: string;
}

export interface DeprecatedRequirement {
  readonly id: string;
  readonly reason: string;
  readonly replacementId?: string | undefined;
}

export interface ConsistencyCheckResult {
  readonly passed: boolean;
  readonly issues: readonly string[];
}

export interface TraceabilityImpact {
  readonly affectedSrsIds: readonly string[];
  readonly affectedSdsIds: readonly string[];
}

export interface UpdateChanges {
  readonly added: readonly AddedRequirement[];
  readonly modified: readonly ModifiedRequirement[];
  readonly deprecated: readonly DeprecatedRequirement[];
}

export interface UpdateResult {
  readonly document: string;
  readonly versionBefore: string;
  readonly versionAfter: string;
  readonly updatedAt: string;
  readonly changes: UpdateChanges;
  readonly consistencyCheck: ConsistencyCheckResult;
  readonly changelogEntry: string;
  readonly traceabilityImpact: TraceabilityImpact;
}

// ============ Session Types ============

export type SessionStatus = 'idle' | 'loading' | 'updating' | 'completed' | 'failed';

export interface PRDUpdaterSession {
  readonly sessionId: string;
  readonly projectId: string;
  readonly status: SessionStatus;
  readonly prdPath?: string | undefined;
  readonly parsedPRD?: ParsedPRD | undefined;
  readonly updateResult?: UpdateResult | undefined;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
}

// ============ Operation Result Types ============

export interface PRDUpdateOperationResult {
  readonly success: boolean;
  readonly projectId: string;
  readonly prdPath: string;
  readonly outputPath: string;
  readonly changelogPath: string;
  readonly updateResult: UpdateResult;
  readonly warnings: readonly string[];
}

// ============ Configuration Types ============

export interface PRDUpdaterConfig {
  readonly docsBasePath?: string;
  readonly prdSubdir?: string;
  readonly scratchpadBasePath?: string;
  readonly maxFileSize?: number;
  readonly preserveFormatting?: boolean;
  readonly generateChangelog?: boolean;
}

export const DEFAULT_PRD_UPDATER_CONFIG: Required<PRDUpdaterConfig> = {
  docsBasePath: 'docs',
  prdSubdir: 'prd',
  scratchpadBasePath: '.ad-sdlc/scratchpad',
  maxFileSize: 10 * 1024 * 1024, // 10MB
  preserveFormatting: true,
  generateChangelog: true,
};
