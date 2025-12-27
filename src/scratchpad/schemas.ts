/**
 * Zod schemas for Scratchpad data entities
 *
 * Provides runtime validation and type inference for all
 * state entities used in the AD-SDLC system.
 *
 * @module scratchpad/schemas
 */

import { z } from 'zod';

// ============================================================
// Schema Version
// ============================================================

/**
 * Current schema version for migration support
 */
export const SCHEMA_VERSION = '1.0.0';

/**
 * Schema version field - included in all entities
 */
export const SchemaVersionSchema = z.object({
  schemaVersion: z.string().default(SCHEMA_VERSION),
});

// ============================================================
// Common Types
// ============================================================

/**
 * Priority levels
 */
export const PrioritySchema = z.enum(['P0', 'P1', 'P2', 'P3']);
export type Priority = z.infer<typeof PrioritySchema>;

/**
 * Requirement status
 */
export const RequirementStatusSchema = z.enum(['proposed', 'approved', 'implemented', 'rejected']);
export type RequirementStatus = z.infer<typeof RequirementStatusSchema>;

/**
 * Collection status
 */
export const CollectionStatusSchema = z.enum(['collecting', 'clarifying', 'completed']);
export type CollectionStatus = z.infer<typeof CollectionStatusSchema>;

/**
 * Implementation status
 */
export const ImplementationStatusSchema = z.enum(['completed', 'failed', 'blocked']);
export type ImplementationStatus = z.infer<typeof ImplementationStatusSchema>;

/**
 * Worker status
 */
export const WorkerStatusValueSchema = z.enum(['idle', 'working', 'error']);
export type WorkerStatusValue = z.infer<typeof WorkerStatusValueSchema>;

/**
 * File change type
 */
export const ChangeTypeSchema = z.enum(['create', 'modify', 'delete']);
export type ChangeType = z.infer<typeof ChangeTypeSchema>;

/**
 * Review decision
 */
export const ReviewDecisionSchema = z.enum(['approve', 'request_changes', 'reject']);
export type ReviewDecision = z.infer<typeof ReviewDecisionSchema>;

// ============================================================
// Acceptance Criterion Schema
// ============================================================

export const AcceptanceCriterionSchema = z.object({
  id: z.string().regex(/^AC-\d{3}$/, 'Must be in format AC-XXX'),
  description: z.string().min(1, 'Description is required'),
  testable: z.boolean().default(true),
});
export type AcceptanceCriterion = z.infer<typeof AcceptanceCriterionSchema>;

// ============================================================
// Functional Requirement Schema
// ============================================================

export const FunctionalRequirementSchema = z.object({
  id: z.string().regex(/^FR-\d{3}$/, 'Must be in format FR-XXX'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  priority: PrioritySchema,
  status: RequirementStatusSchema.optional().default('proposed'),
  acceptanceCriteria: z.array(AcceptanceCriterionSchema).optional().default([]),
  dependencies: z.array(z.string()).optional().default([]),
  source: z.string().optional(),
});
export type FunctionalRequirement = z.infer<typeof FunctionalRequirementSchema>;

// ============================================================
// Non-Functional Requirement Schema
// ============================================================

export const NonFunctionalRequirementSchema = z.object({
  id: z.string().regex(/^NFR-\d{3}$/, 'Must be in format NFR-XXX'),
  category: z.enum([
    'performance',
    'security',
    'scalability',
    'usability',
    'reliability',
    'maintainability',
  ]),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  metric: z.string().optional(),
  target: z.string().optional(),
  priority: PrioritySchema,
});
export type NonFunctionalRequirement = z.infer<typeof NonFunctionalRequirementSchema>;

// ============================================================
// Constraint Schema
// ============================================================

export const ConstraintSchema = z.object({
  id: z.string().regex(/^CON-\d{3}$/, 'Must be in format CON-XXX'),
  description: z.string().min(1, 'Description is required'),
  reason: z.string().optional(),
  type: z.enum(['technical', 'business', 'regulatory', 'resource']).optional(),
});
export type Constraint = z.infer<typeof ConstraintSchema>;

// ============================================================
// Assumption Schema
// ============================================================

export const AssumptionSchema = z.object({
  id: z.string().regex(/^ASM-\d{3}$/, 'Must be in format ASM-XXX'),
  description: z.string().min(1, 'Description is required'),
  riskIfWrong: z.string().optional(),
  validated: z.boolean().optional().default(false),
});
export type Assumption = z.infer<typeof AssumptionSchema>;

// ============================================================
// Dependency Schema
// ============================================================

export const DependencySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['api', 'library', 'service', 'tool']),
  version: z.string().optional(),
  purpose: z.string().optional(),
  required: z.boolean().optional().default(true),
});
export type Dependency = z.infer<typeof DependencySchema>;

// ============================================================
// Clarification Schema
// ============================================================

export const ClarificationSchema = z.object({
  id: z.string(),
  category: z.enum(['requirement', 'constraint', 'assumption', 'priority']),
  question: z.string().min(1, 'Question is required'),
  answer: z.string().optional(),
  timestamp: z.iso.datetime().optional(),
  required: z.boolean().optional().default(false),
});
export type Clarification = z.infer<typeof ClarificationSchema>;

// ============================================================
// Source Reference Schema
// ============================================================

export const SourceReferenceSchema = z.object({
  type: z.enum(['file', 'url', 'conversation', 'document']),
  reference: z.string().min(1, 'Reference is required'),
  extractedAt: z.iso.datetime().optional(),
  summary: z.string().optional(),
});
export type SourceReference = z.infer<typeof SourceReferenceSchema>;

// ============================================================
// CollectedInfo Schema (collected_info.yaml)
// ============================================================

export const CollectedInfoSchema = z.object({
  schemaVersion: z.string().default(SCHEMA_VERSION),
  projectId: z.string().min(1, 'Project ID is required'),
  status: CollectionStatusSchema,
  project: z.object({
    name: z.string().min(1, 'Project name is required'),
    description: z.string().min(1, 'Project description is required'),
  }),
  requirements: z.object({
    functional: z.array(FunctionalRequirementSchema).optional().default([]),
    nonFunctional: z.array(NonFunctionalRequirementSchema).optional().default([]),
  }),
  constraints: z.array(ConstraintSchema).optional().default([]),
  assumptions: z.array(AssumptionSchema).optional().default([]),
  dependencies: z.array(DependencySchema).optional().default([]),
  clarifications: z.array(ClarificationSchema).optional().default([]),
  sources: z.array(SourceReferenceSchema).optional().default([]),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  completedAt: z.iso.datetime().optional(),
});
export type CollectedInfo = z.infer<typeof CollectedInfoSchema>;

// ============================================================
// RelatedFile Schema
// ============================================================

export const RelatedFileSchema = z.object({
  path: z.string().min(1, 'Path is required'),
  reason: z.string().min(1, 'Reason is required'),
});
export type RelatedFile = z.infer<typeof RelatedFileSchema>;

// ============================================================
// DependencyStatus Schema
// ============================================================

export const DependencyStatusSchema = z.object({
  issueId: z.string().min(1, 'Issue ID is required'),
  status: z.enum(['open', 'closed', 'in_progress']),
});
export type DependencyStatus = z.infer<typeof DependencyStatusSchema>;

// ============================================================
// WorkOrderContext Schema
// ============================================================

export const WorkOrderContextSchema = z.object({
  sdsComponent: z.string().optional(),
  srsFeature: z.string().optional(),
  prdRequirement: z.string().optional(),
  relatedFiles: z.array(RelatedFileSchema).optional().default([]),
  dependenciesStatus: z.array(DependencyStatusSchema).optional().default([]),
});
export type WorkOrderContext = z.infer<typeof WorkOrderContextSchema>;

// ============================================================
// WorkOrder Schema (work_order.yaml)
// ============================================================

export const WorkOrderSchema = z.object({
  schemaVersion: z.string().default(SCHEMA_VERSION),
  orderId: z.string().min(1, 'Order ID is required'),
  issueId: z.string().min(1, 'Issue ID is required'),
  issueUrl: z.url('Must be a valid URL'),
  createdAt: z.iso.datetime(),
  priority: z.number().int().min(0).max(3),
  context: WorkOrderContextSchema,
  acceptanceCriteria: z.array(z.string()).min(1, 'At least one acceptance criterion is required'),
});
export type WorkOrder = z.infer<typeof WorkOrderSchema>;

// ============================================================
// FileChange Schema
// ============================================================

export const FileChangeSchema = z.object({
  filePath: z.string().min(1, 'File path is required'),
  changeType: ChangeTypeSchema,
  linesAdded: z.number().int().min(0),
  linesRemoved: z.number().int().min(0),
});
export type FileChange = z.infer<typeof FileChangeSchema>;

// ============================================================
// TestInfo Schema
// ============================================================

export const TestInfoSchema = z.object({
  filePath: z.string().min(1, 'File path is required'),
  testCount: z.number().int().min(0),
  passed: z.number().int().min(0).optional(),
  failed: z.number().int().min(0).optional(),
});
export type TestInfo = z.infer<typeof TestInfoSchema>;

// ============================================================
// ImplementationResult Schema (implementation_result.yaml)
// ============================================================

export const ImplementationResultSchema = z.object({
  schemaVersion: z.string().default(SCHEMA_VERSION),
  orderId: z.string().min(1, 'Order ID is required'),
  issueId: z.string().min(1, 'Issue ID is required'),
  status: ImplementationStatusSchema,
  branchName: z.string().min(1, 'Branch name is required'),
  changes: z.array(FileChangeSchema).optional().default([]),
  testsAdded: z.array(TestInfoSchema).optional().default([]),
  completedAt: z.iso.datetime(),
  errorMessage: z.string().optional(),
  commitHash: z.string().optional(),
});
export type ImplementationResult = z.infer<typeof ImplementationResultSchema>;

// ============================================================
// ReviewComment Schema
// ============================================================

export const ReviewCommentSchema = z.object({
  filePath: z.string().min(1, 'File path is required'),
  line: z.number().int().min(1),
  severity: z.enum(['error', 'warning', 'suggestion', 'info']),
  message: z.string().min(1, 'Message is required'),
  category: z.enum(['security', 'performance', 'style', 'logic', 'test']).optional(),
});
export type ReviewComment = z.infer<typeof ReviewCommentSchema>;

// ============================================================
// QualityMetrics Schema
// ============================================================

export const QualityMetricsSchema = z.object({
  testCoverage: z.number().min(0).max(100).optional(),
  lintErrors: z.number().int().min(0).optional(),
  lintWarnings: z.number().int().min(0).optional(),
  securityIssues: z.number().int().min(0).optional(),
  complexity: z.number().min(0).optional(),
});
export type QualityMetrics = z.infer<typeof QualityMetricsSchema>;

// ============================================================
// PRReviewResult Schema (pr_review_result.yaml)
// ============================================================

export const PRReviewResultSchema = z.object({
  schemaVersion: z.string().default(SCHEMA_VERSION),
  reviewId: z.string().min(1, 'Review ID is required'),
  prNumber: z.number().int().min(1, 'PR number is required'),
  prUrl: z.url('Must be a valid URL'),
  orderId: z.string().min(1, 'Order ID is required'),
  issueId: z.string().min(1, 'Issue ID is required'),
  decision: ReviewDecisionSchema,
  comments: z.array(ReviewCommentSchema).optional().default([]),
  qualityMetrics: QualityMetricsSchema.optional(),
  reviewedAt: z.iso.datetime(),
  mergedAt: z.iso.datetime().optional(),
  reviewerNotes: z.string().optional(),
});
export type PRReviewResult = z.infer<typeof PRReviewResultSchema>;

// ============================================================
// IssueQueue Schema
// ============================================================

export const IssueQueueSchema = z.object({
  pending: z.array(z.string()).optional().default([]),
  inProgress: z.array(z.string()).optional().default([]),
  completed: z.array(z.string()).optional().default([]),
  blocked: z.array(z.string()).optional().default([]),
});
export type IssueQueue = z.infer<typeof IssueQueueSchema>;

// ============================================================
// WorkerStatus Schema
// ============================================================

export const WorkerStatusSchema = z.object({
  id: z.string().min(1, 'Worker ID is required'),
  status: WorkerStatusValueSchema,
  currentIssue: z.string().nullable(),
  startedAt: z.iso.datetime().nullable(),
  completedTasks: z.number().int().min(0),
});
export type WorkerStatus = z.infer<typeof WorkerStatusSchema>;

// ============================================================
// ControllerState Schema (controller_state.yaml)
// ============================================================

export const ControllerStateSchema = z.object({
  schemaVersion: z.string().default(SCHEMA_VERSION),
  sessionId: z.string().min(1, 'Session ID is required'),
  projectId: z.string().min(1, 'Project ID is required'),
  currentPhase: z.string().min(1, 'Current phase is required'),
  startedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  queue: IssueQueueSchema,
  workers: z.array(WorkerStatusSchema).optional().default([]),
  totalIssues: z.number().int().min(0),
  completedIssues: z.number().int().min(0).optional().default(0),
  failedIssues: z.number().int().min(0).optional().default(0),
});
export type ControllerState = z.infer<typeof ControllerStateSchema>;
