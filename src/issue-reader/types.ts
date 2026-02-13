/**
 * Issue Reader module type definitions
 *
 * Defines types for GitHub issue importing, dependency extraction,
 * and conversion to AD-SDLC internal format.
 *
 * Implements SDS-001 CMP-028 (Section 3.28).
 */

import type { Priority, EffortSize } from '../issue-generator/types.js';

// Re-export shared types for convenience
export type { Priority, EffortSize };

/**
 * Issue import filter state
 */
export type IssueState = 'open' | 'closed' | 'all';

/**
 * Complexity estimate for imported issues
 */
export type IssueComplexity = 'small' | 'medium' | 'large';

/**
 * Session status
 */
export type ImportSessionStatus = 'pending' | 'importing' | 'completed' | 'failed';

/**
 * Dependency relationship direction
 */
export type DependencyDirection = 'depends_on' | 'blocks';

// ---------------------------------------------------------------------------
// Import Options
// ---------------------------------------------------------------------------

/**
 * Options for filtering and controlling issue import
 */
export interface IssueImportOptions {
  /** Filter by issue state */
  readonly state?: IssueState;
  /** Filter by labels */
  readonly labels?: readonly string[];
  /** Filter by milestone */
  readonly milestone?: string;
  /** Filter by assignee */
  readonly assignee?: string;
  /** Maximum number of issues to import */
  readonly limit?: number;
}

// ---------------------------------------------------------------------------
// Imported Issue
// ---------------------------------------------------------------------------

/**
 * A single GitHub issue converted to AD-SDLC internal format
 */
export interface ImportedIssue {
  /** Internal AD-SDLC issue identifier (e.g., ISS-001) */
  readonly id: string;
  /** GitHub issue number */
  readonly number: number;
  /** GitHub issue URL */
  readonly url: string;
  /** Issue title */
  readonly title: string;
  /** Parsed issue body */
  readonly body: string;
  /** Issue state */
  readonly state: string;
  /** Mapped labels */
  readonly labels: ImportedIssueLabels;
  /** GitHub milestone name */
  readonly milestone: string | null;
  /** Assigned users */
  readonly assignees: readonly string[];
  /** Detected dependencies (issue numbers) */
  readonly dependsOn: readonly number[];
  /** Issues this blocks */
  readonly blocks: readonly number[];
  /** Estimated complexity */
  readonly complexity: IssueComplexity;
  /** Estimated effort hours */
  readonly estimatedHours: number;
  /** ISO timestamp of creation */
  readonly createdAt: string;
  /** ISO timestamp of last update */
  readonly updatedAt: string;
}

/**
 * Mapped labels for an imported issue
 */
export interface ImportedIssueLabels {
  /** Raw GitHub label names */
  readonly raw: readonly string[];
  /** Mapped AD-SDLC priority */
  readonly priority: Priority;
  /** Detected issue type */
  readonly type: string;
  /** Detected effort size */
  readonly size: EffortSize;
}

// ---------------------------------------------------------------------------
// Dependency Graph
// ---------------------------------------------------------------------------

/**
 * Dependency graph for imported issues
 */
export interface ImportDependencyGraph {
  /** Schema version */
  readonly schemaVersion: string;
  /** Generation timestamp */
  readonly generatedAt: string;
  /** Graph nodes */
  readonly nodes: readonly ImportGraphNode[];
  /** Graph edges */
  readonly edges: readonly ImportGraphEdge[];
  /** Root node IDs (no incoming dependencies) */
  readonly roots: readonly string[];
  /** Leaf node IDs (no outgoing dependencies) */
  readonly leaves: readonly string[];
  /** Whether cycles were detected */
  readonly hasCycles: boolean;
  /** Topological execution order (empty if cycles exist) */
  readonly topologicalOrder: readonly string[];
}

/**
 * Node in the import dependency graph
 */
export interface ImportGraphNode {
  /** Internal AD-SDLC ID */
  readonly id: string;
  /** GitHub issue number */
  readonly githubNumber: number;
  /** Issue title */
  readonly title: string;
  /** Mapped priority */
  readonly priority: Priority;
  /** Estimated size */
  readonly size: EffortSize;
  /** Readiness status */
  readonly status: 'ready' | 'blocked' | 'in_cycle';
}

/**
 * Edge in the import dependency graph
 */
export interface ImportGraphEdge {
  /** Source node ID */
  readonly from: string;
  /** Target node ID */
  readonly to: string;
  /** Dependency direction */
  readonly type: DependencyDirection;
  /** Source GitHub issue number */
  readonly githubFrom: number;
  /** Target GitHub issue number */
  readonly githubTo: number;
}

// ---------------------------------------------------------------------------
// Import Result
// ---------------------------------------------------------------------------

/**
 * Result of an issue import operation
 */
export interface IssueImportResult {
  /** Source repository */
  readonly repository: string;
  /** Import timestamp */
  readonly importedAt: string;
  /** Filter criteria used */
  readonly filterCriteria: IssueImportOptions;
  /** Imported issues in AD-SDLC format */
  readonly issues: readonly ImportedIssue[];
  /** Dependency graph */
  readonly dependencyGraph: ImportDependencyGraph;
  /** Import statistics */
  readonly stats: ImportStats;
}

/**
 * Import statistics
 */
export interface ImportStats {
  /** Total issues fetched from GitHub */
  readonly total: number;
  /** Issues successfully imported */
  readonly imported: number;
  /** Issues skipped */
  readonly skipped: number;
  /** Issues with detected dependencies */
  readonly withDependencies: number;
  /** Issues by priority */
  readonly byPriority: Record<Priority, number>;
  /** Total estimated hours */
  readonly totalEstimatedHours: number;
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

/**
 * Issue reader session state
 */
export interface IssueReaderSession {
  /** Session identifier */
  readonly sessionId: string;
  /** Target repository */
  readonly repository: string;
  /** Session status */
  readonly status: ImportSessionStatus;
  /** Import result (null until completed) */
  readonly result: IssueImportResult | null;
  /** Session start time */
  readonly startedAt: string;
  /** Last update time */
  readonly updatedAt: string;
  /** Accumulated errors */
  readonly errors: readonly string[];
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Issue reader agent configuration
 */
export interface IssueReaderConfig {
  /** Base path for scratchpad output */
  readonly scratchpadBasePath?: string;
  /** gh CLI command timeout (ms) */
  readonly ghCommandTimeoutMs?: number;
  /** Default issue state filter */
  readonly defaultState?: IssueState;
  /** Maximum issues to fetch */
  readonly maxIssues?: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_ISSUE_READER_CONFIG: Required<IssueReaderConfig> = {
  scratchpadBasePath: '.ad-sdlc/scratchpad',
  ghCommandTimeoutMs: 30_000,
  defaultState: 'open',
  maxIssues: 500,
};

// ---------------------------------------------------------------------------
// Priority and Effort Mapping
// ---------------------------------------------------------------------------

/**
 * Maps GitHub label names to AD-SDLC priority levels.
 * Checked in order; first match wins.
 */
export const PRIORITY_LABEL_MAP: Readonly<Record<string, Priority>> = {
  critical: 'P0',
  'priority-p0': 'P0',
  'priority/critical': 'P0',
  high: 'P1',
  'priority-p1': 'P1',
  'priority/high': 'P1',
  medium: 'P2',
  'priority-p2': 'P2',
  'priority/medium': 'P2',
  low: 'P3',
  'priority-p3': 'P3',
  'priority/low': 'P3',
};

/**
 * Default priority when no matching label is found
 */
export const DEFAULT_PRIORITY: Priority = 'P2';

/**
 * Maps GitHub label names to effort size.
 */
export const EFFORT_LABEL_MAP: Readonly<Record<string, EffortSize>> = {
  'size:XS': 'XS',
  'size:S': 'S',
  'size:M': 'M',
  'size:L': 'L',
  'size:XL': 'XL',
  'effort:XS': 'XS',
  'effort:S': 'S',
  'effort:M': 'M',
  'effort:L': 'L',
  'effort:XL': 'XL',
};

/**
 * Default effort size when no matching label is found
 */
export const DEFAULT_EFFORT_SIZE: EffortSize = 'M';

/**
 * Estimated hours by effort size
 */
export const EFFORT_HOURS: Readonly<Record<EffortSize, number>> = {
  XS: 2,
  S: 4,
  M: 6,
  L: 12,
  XL: 20,
};

/**
 * Issue type label keywords (lowercase)
 */
export const TYPE_LABEL_KEYWORDS: Readonly<Record<string, string>> = {
  feature: 'feature',
  enhancement: 'enhancement',
  bug: 'bug',
  fix: 'bug',
  docs: 'docs',
  documentation: 'docs',
  chore: 'chore',
  refactor: 'refactor',
};

/**
 * Default issue type
 */
export const DEFAULT_ISSUE_TYPE = 'feature';
