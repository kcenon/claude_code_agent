/**
 * Zod schemas for common data structures
 *
 * Provides runtime validation for package.json, lock files,
 * and other commonly parsed JSON structures.
 *
 * @module schemas/common
 */

import { z } from 'zod';

// ============================================================
// Package.json Schemas
// ============================================================

/**
 * Partial package.json schema for commonly used fields
 *
 * Uses .loose() to allow unknown fields since package.json
 * can contain many tool-specific configurations.
 */
export const PackageJsonPartialSchema = z
  .object({
    name: z.string().optional(),
    version: z.string().optional(),
    description: z.string().optional(),
    main: z.string().optional(),
    scripts: z.record(z.string(), z.string()).optional(),
    dependencies: z.record(z.string(), z.string()).optional(),
    devDependencies: z.record(z.string(), z.string()).optional(),
    peerDependencies: z.record(z.string(), z.string()).optional(),
    engines: z.record(z.string(), z.string()).optional(),
    type: z.enum(['module', 'commonjs']).optional(),
  })
  .loose()
  .describe('PackageJsonPartial');

export type PackageJsonPartial = z.infer<typeof PackageJsonPartialSchema>;

/**
 * Minimal package.json schema - just version field
 *
 * Used in: CodebaseAnalyzerAgent for version detection
 */
export const PackageJsonVersionSchema = z
  .object({
    version: z.string().optional(),
  })
  .loose()
  .describe('PackageJsonVersion');

export type PackageJsonVersion = z.infer<typeof PackageJsonVersionSchema>;

// ============================================================
// File Lock Schemas
// ============================================================

/**
 * File lock structure for concurrent access control
 *
 * Used in: Scratchpad
 */
export const FileLockSchema = z
  .object({
    lockedBy: z.string(),
    lockedAt: z.string(),
    operation: z.string(),
    expiresAt: z.string().optional(),
  })
  .describe('FileLock');

export type FileLock = z.infer<typeof FileLockSchema>;

// ============================================================
// Dependency Graph Schemas
// ============================================================

/**
 * Dependency graph node
 */
export const DependencyNodeSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
});

export type DependencyNode = z.infer<typeof DependencyNodeSchema>;

/**
 * Dependency graph structure
 *
 * Used in: ImpactAnalyzer, RegressionTester
 */
export const DependencyGraphSchema = z
  .object({
    nodes: z.record(z.string(), DependencyNodeSchema).optional(),
    edges: z
      .array(
        z.object({
          from: z.string(),
          to: z.string(),
        })
      )
      .optional(),
    root: z.string().optional(),
  })
  .loose()
  .describe('DependencyGraph');

export type DependencyGraph = z.infer<typeof DependencyGraphSchema>;

// ============================================================
// Progress/State Schemas
// ============================================================

/**
 * Progress checkpoint for retry handling
 *
 * Used in: RetryHandler
 */
export const ProgressCheckpointSchema = z
  .object({
    orderId: z.string(),
    issueId: z.string(),
    step: z.string(),
    completedSteps: z.array(z.string()).optional(),
    lastUpdated: z.string(),
    retryCount: z.number().optional(),
    error: z.string().optional(),
  })
  .loose()
  .describe('ProgressCheckpoint');

export type ProgressCheckpoint = z.infer<typeof ProgressCheckpointSchema>;

/**
 * Progress report structure
 *
 * Used in: ProgressMonitor
 */
export const ProgressReportSchema = z
  .object({
    sessionId: z.string().optional(),
    projectId: z.string().optional(),
    currentPhase: z.string().optional(),
    progress: z.number().optional(),
    completedTasks: z.number().optional(),
    totalTasks: z.number().optional(),
    errors: z.array(z.string()).optional(),
    lastUpdated: z.string().optional(),
  })
  .loose()
  .describe('ProgressReport');

export type ProgressReport = z.infer<typeof ProgressReportSchema>;

// ============================================================
// Controller State Schemas
// ============================================================

/**
 * Issue queue structure
 */
export const IssueQueueSchema = z.object({
  pending: z.array(z.string()).optional().default([]),
  inProgress: z.array(z.string()).optional().default([]),
  completed: z.array(z.string()).optional().default([]),
  blocked: z.array(z.string()).optional().default([]),
});

export type IssueQueue = z.infer<typeof IssueQueueSchema>;

/**
 * Worker status structure
 */
export const WorkerStatusSchema = z.object({
  id: z.string(),
  status: z.enum(['idle', 'working', 'error']),
  currentIssue: z.string().nullable(),
  startedAt: z.string().nullable(),
  completedTasks: z.number().default(0),
});

export type WorkerStatus = z.infer<typeof WorkerStatusSchema>;

/**
 * Controller state structure
 *
 * Used in: WorkerPoolManager
 */
export const ControllerStateSchema = z
  .object({
    schemaVersion: z.string().optional(),
    sessionId: z.string(),
    projectId: z.string(),
    currentPhase: z.string(),
    startedAt: z.string(),
    updatedAt: z.string(),
    queue: IssueQueueSchema,
    workers: z.array(WorkerStatusSchema).optional().default([]),
    totalIssues: z.number(),
    completedIssues: z.number().optional().default(0),
    failedIssues: z.number().optional().default(0),
  })
  .loose()
  .describe('ControllerState');

export type ControllerState = z.infer<typeof ControllerStateSchema>;

// ============================================================
// Log Entry Schemas
// ============================================================

/**
 * Structured log entry
 *
 * Used in: Logger
 */
export const LogEntrySchema = z
  .object({
    timestamp: z.string(),
    level: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']),
    message: z.string(),
    correlationId: z.string(),
    agent: z.string().optional(),
    stage: z.string().optional(),
    projectId: z.string().optional(),
    durationMs: z.number().optional(),
    context: z.record(z.string(), z.unknown()).optional(),
    error: z
      .object({
        name: z.string(),
        message: z.string(),
        stack: z.string().optional(),
      })
      .optional(),
  })
  .loose()
  .describe('LogEntry');

export type LogEntry = z.infer<typeof LogEntrySchema>;

/**
 * Audit log entry
 *
 * Used in: AuditLogger
 */
export const AuditLogEntrySchema = z
  .object({
    type: z.enum([
      'api_key_used',
      'github_issue_created',
      'github_pr_created',
      'github_pr_merged',
      'file_created',
      'file_deleted',
      'file_modified',
      'secret_accessed',
      'validation_failed',
      'security_violation',
    ]),
    actor: z.string(),
    resource: z.string(),
    action: z.string(),
    result: z.enum(['success', 'failure', 'blocked']),
    details: z.record(z.string(), z.unknown()).optional(),
    timestamp: z.string(),
    correlationId: z.string(),
    sessionId: z.string().optional(),
  })
  .loose()
  .describe('AuditLogEntry');

export type AuditLogEntry = z.infer<typeof AuditLogEntrySchema>;

// ============================================================
// Priority Analysis Schemas
// ============================================================

/**
 * Priority analysis result
 *
 * Used in: PriorityAnalyzer
 */
export const PriorityAnalysisSchema = z
  .object({
    issueId: z.string().optional(),
    priority: z.number().optional(),
    score: z.number().optional(),
    factors: z.record(z.string(), z.number()).optional(),
    dependencies: z.array(z.string()).optional(),
  })
  .loose()
  .describe('PriorityAnalysis');

export type PriorityAnalysis = z.infer<typeof PriorityAnalysisSchema>;
