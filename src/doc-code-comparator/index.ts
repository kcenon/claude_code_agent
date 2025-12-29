/**
 * Doc-Code Comparator Agent module
 *
 * Exports the agent class, types, and error classes for comparing
 * documentation specifications against code implementations.
 */

// Main classes and singletons
export {
  DocCodeComparatorAgent,
  getDocCodeComparatorAgent,
  resetDocCodeComparatorAgent,
} from './DocCodeComparatorAgent.js';

// Type exports - Configuration
export type { DocCodeComparatorConfig } from './types.js';

// Type exports - Session and Result types
export type {
  ComparisonSession,
  ComparisonResult,
  DocCodeComparisonResult,
  ComparisonStats,
  ComparisonStatistics,
} from './types.js';

// Type exports - Mapping types
export type {
  AgentMapping,
  MappingResult,
  MappingStatus,
} from './types.js';

// Type exports - Gap types
export type {
  GapItem,
  GapType,
  GapPriority,
  GapSummary,
  GeneratedIssue,
} from './types.js';

// Type exports - Inventory types
export type {
  DocumentItem,
  CodeItem,
} from './types.js';

// Type exports - Session status
export type {
  SessionStatus,
  MatchConfidence,
} from './types.js';

// Constants
export { DEFAULT_DOC_CODE_COMPARATOR_CONFIG } from './types.js';

// Error exports
export {
  DocCodeComparatorError,
  NoActiveSessionError,
  DocumentInventoryNotFoundError,
  CodeInventoryNotFoundError,
  InvalidInventoryError,
  OutputWriteError,
  ComparisonError,
  GapAnalysisError,
  IssueGenerationError,
} from './errors.js';
