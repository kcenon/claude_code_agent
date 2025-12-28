/**
 * Status module - Pipeline status display
 *
 * Provides functionality to display current pipeline status
 * including project state, stage progress, issues, and workers.
 *
 * @module status
 */

export { StatusService, getStatusService, resetStatusService } from './StatusService.js';

export type {
  StatusOptions,
  OutputFormat,
  StageStatus,
  StageInfo,
  IssueStatusCounts,
  WorkerStatus,
  ActivityEntry,
  ProjectStatus,
  PipelineStatus,
  StatusDisplayResult,
} from './types.js';
