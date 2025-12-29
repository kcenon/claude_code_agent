/**
 * PRD Writer Agent module exports
 *
 * Provides functionality to generate Product Requirements Documents
 * from collected information, with gap analysis and consistency checking.
 *
 * @example
 * ```typescript
 * import { PRDWriterAgent } from './prd-writer';
 *
 * const writer = new PRDWriterAgent();
 * const result = await writer.generateFromProject('001');
 * console.log(result.publicPath);
 * ```
 */

// Main classes
export { PRDWriterAgent, getPRDWriterAgent, resetPRDWriterAgent } from './PRDWriterAgent.js';

export { GapAnalyzer } from './GapAnalyzer.js';
export type { GapAnalyzerOptions } from './GapAnalyzer.js';

export { ConsistencyChecker } from './ConsistencyChecker.js';
export type { ConsistencyCheckerOptions } from './ConsistencyChecker.js';

export { TemplateProcessor } from './TemplateProcessor.js';
export type { TemplateProcessorOptions } from './TemplateProcessor.js';

export {
  ApprovalWorkflow,
  getApprovalWorkflow,
  resetApprovalWorkflow,
} from './ApprovalWorkflow.js';

// Error classes
export {
  PRDWriterError,
  CollectedInfoNotFoundError,
  TemplateNotFoundError,
  TemplateProcessingError,
  CriticalGapsError,
  ConsistencyError,
  SessionStateError,
  ValidationError,
  GenerationError,
  FileWriteError,
  // Approval workflow errors
  DocumentNotFoundError,
  FeedbackRequiredError,
  ApprovalStateError,
  StateTransitionError,
} from './errors.js';

// Type exports
export type {
  // Status types
  PRDGenerationStatus,
  GapSeverity,
  GapCategory,
  ConsistencyIssueType,
  PRDSection,

  // Gap analysis types
  GapItem,
  GapAnalysisResult,

  // Consistency types
  ConsistencyIssue,
  ConsistencyCheckResult,
  PriorityDistribution,
  DependencyAnalysis,

  // PRD types
  PRDMetadata,
  GeneratedPRD,

  // Session types
  PRDWriterAgentConfig,
  PRDGenerationSession,
  PRDGenerationResult,
  PRDGenerationStats,

  // Template types
  TemplateVariable,
  TemplateProcessingResult,

  // Approval workflow types
  ApprovalDecision,
  ApprovableDocument,
  ApprovalRequest,
  ApprovalResult,
  ApprovalHistoryEntry,
  ApprovalWorkflowConfig,
  PRDRevision,
  ApprovalStatus,
} from './types.js';
