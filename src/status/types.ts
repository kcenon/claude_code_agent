/**
 * Status Command type definitions
 *
 * Provides types for pipeline status display functionality.
 *
 * @module status/types
 */

import type { ProjectState } from '../state-manager/types.js';

/**
 * Stage status in the pipeline
 */
export type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/**
 * Output format options
 */
export type OutputFormat = 'text' | 'json';

/**
 * Status command options
 */
export interface StatusOptions {
  /** Output format (text or json) */
  readonly format?: OutputFormat;
  /** Specific project ID to show status for */
  readonly projectId?: string;
  /** Show verbose output with more details */
  readonly verbose?: boolean;
}

/**
 * Pipeline stage information
 */
export interface StageInfo {
  /** Stage name */
  readonly name: string;
  /** Stage status */
  readonly status: StageStatus;
  /** Duration in seconds (if completed or running) */
  readonly durationSeconds?: number;
  /** Error message (if failed) */
  readonly error?: string;
  /** Stage description */
  readonly description?: string;
}

/**
 * Issue status counts
 */
export interface IssueStatusCounts {
  /** Total number of issues */
  readonly total: number;
  /** Number of pending issues */
  readonly pending: number;
  /** Number of in-progress issues */
  readonly inProgress: number;
  /** Number of completed issues */
  readonly completed: number;
  /** Number of blocked issues */
  readonly blocked: number;
}

/**
 * Worker status information
 */
export interface WorkerStatus {
  /** Worker identifier */
  readonly id: string;
  /** Current issue being worked on */
  readonly currentIssue?: string;
  /** Progress percentage (0-100) */
  readonly progress?: number;
  /** Worker state */
  readonly state: 'idle' | 'working' | 'error';
}

/**
 * Activity log entry
 */
export interface ActivityEntry {
  /** Timestamp of the activity */
  readonly timestamp: string;
  /** Agent that performed the activity */
  readonly agent: string;
  /** Activity description */
  readonly description: string;
  /** Activity type */
  readonly type: 'info' | 'warning' | 'error' | 'success';
}

/**
 * Project status information
 */
export interface ProjectStatus {
  /** Project identifier */
  readonly projectId: string;
  /** Project name */
  readonly projectName?: string;
  /** Current pipeline phase/state */
  readonly currentState: ProjectState;
  /** Overall progress percentage (0-100) */
  readonly progressPercent: number;
  /** Pipeline stages information */
  readonly stages: readonly StageInfo[];
  /** Issue status counts */
  readonly issues: IssueStatusCounts;
  /** Active workers */
  readonly workers: readonly WorkerStatus[];
  /** Recent activity log */
  readonly recentActivity: readonly ActivityEntry[];
  /** Last updated timestamp */
  readonly lastUpdated: string;
  /** Started timestamp */
  readonly startedAt?: string;
}

/**
 * Overall pipeline status (may contain multiple projects)
 */
export interface PipelineStatus {
  /** List of project statuses */
  readonly projects: readonly ProjectStatus[];
  /** Total number of projects */
  readonly totalProjects: number;
  /** Number of active projects */
  readonly activeProjects: number;
  /** Timestamp of status retrieval */
  readonly timestamp: string;
}

/**
 * Status display result
 */
export interface StatusDisplayResult {
  /** Whether the display was successful */
  readonly success: boolean;
  /** Error message if failed */
  readonly error?: string;
  /** The status data (if successful) */
  readonly data?: PipelineStatus;
}
