/**
 * Issue Reader module exports
 *
 * Provides functionality to import existing GitHub issues
 * and convert them to AD-SDLC internal format with dependency graphs.
 *
 * Implements SDS-001 CMP-028 (Section 3.28).
 */

// Main classes and singletons
export {
  IssueReaderAgent,
  getIssueReaderAgent,
  resetIssueReaderAgent,
  ISSUE_READER_AGENT_ID,
} from './IssueReaderAgent.js';

// Error classes
export {
  IssueReaderError,
  GhAuthError,
  RepositoryNotFoundError,
  IssueFetchError,
  CircularDependencyError,
  OutputWriteError,
} from './errors.js';

// Type exports
export type {
  // Filter types
  IssueState,
  IssueComplexity,
  ImportSessionStatus,
  DependencyDirection,

  // Import types
  IssueImportOptions,
  ImportedIssue,
  ImportedIssueLabels,

  // Graph types
  ImportDependencyGraph,
  ImportGraphNode,
  ImportGraphEdge,

  // Result types
  IssueImportResult,
  ImportStats,

  // Session types
  IssueReaderSession,

  // Config types
  IssueReaderConfig,

  // Re-exported types
  Priority,
  EffortSize,
} from './types.js';

// Constants
export {
  DEFAULT_ISSUE_READER_CONFIG,
  PRIORITY_LABEL_MAP,
  DEFAULT_PRIORITY,
  EFFORT_LABEL_MAP,
  DEFAULT_EFFORT_SIZE,
  EFFORT_HOURS,
  TYPE_LABEL_KEYWORDS,
  DEFAULT_ISSUE_TYPE,
} from './types.js';
