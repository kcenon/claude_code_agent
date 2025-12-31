/**
 * Zod schema definitions for runtime JSON validation
 *
 * This module exports all Zod schemas used throughout the codebase
 * for validating externally-sourced JSON data.
 *
 * @module schemas
 */

// GitHub API schemas
export {
  GitHubPRDataSchema,
  GitHubPRDataArraySchema,
  GitHubMergeInfoSchema,
  GitHubReviewSchema,
  GitHubReviewsResponseSchema,
  GitHubCheckResultSchema,
  GitHubCheckResultArraySchema,
  GitHubRepoInfoSchema,
  SecurityAuditResultSchema,
  GitHubRunDataSchema,
} from './github.js';

export type {
  GitHubPRData,
  GitHubMergeInfo,
  GitHubReview,
  GitHubReviewsResponse,
  GitHubCheckResult,
  GitHubRepoInfo,
  SecurityAuditResult,
  GitHubRunData,
} from './github.js';

// Common schemas
export {
  PackageJsonPartialSchema,
  PackageJsonVersionSchema,
  FileLockSchema,
  DependencyNodeSchema,
  DependencyGraphSchema,
  ProgressCheckpointSchema,
  ProgressReportSchema,
  IssueQueueSchema,
  WorkerStatusSchema,
  ControllerStateSchema,
  LogEntrySchema,
  AuditLogEntrySchema,
  PriorityAnalysisSchema,
} from './common.js';

export type {
  PackageJsonPartial,
  PackageJsonVersion,
  FileLock,
  DependencyNode,
  DependencyGraph,
  ProgressCheckpoint,
  ProgressReport,
  IssueQueue,
  WorkerStatus,
  ControllerState,
  LogEntry,
  AuditLogEntry,
  PriorityAnalysis,
} from './common.js';
