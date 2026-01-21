/**
 * PRD Updater Agent Module
 *
 * Provides incremental update functionality for PRD documents.
 * Supports adding, modifying, and deprecating requirements while
 * maintaining document consistency and version history.
 */

// Main agent class and singleton functions
export {
  PRDUpdaterAgent,
  getPRDUpdaterAgent,
  resetPRDUpdaterAgent,
  PRD_UPDATER_AGENT_ID,
} from './PRDUpdaterAgent.js';

// Error classes
export {
  PRDUpdaterError,
  NoActiveSessionError,
  PRDNotFoundError,
  RequirementNotFoundError,
  DuplicateRequirementError,
  ConflictingRequirementError,
  InvalidChangeRequestError,
  DocumentParseError,
  OutputWriteError,
  InvalidVersionError,
  FileSizeLimitError,
  PRDNotLoadedError,
} from './errors.js';

// Type exports
export type {
  ChangeRequestType,
  RequirementType,
  RequirementPriority,
  RequirementStatus,
  NewRequirement,
  RequirementModification,
  ChangeRequest,
  DocumentMetadata,
  ParsedRequirement,
  ParsedPRD,
  DocumentSection,
  AddedRequirement,
  ModifiedRequirement,
  DeprecatedRequirement,
  ConsistencyCheckResult,
  TraceabilityImpact,
  UpdateChanges,
  UpdateResult,
  SessionStatus,
  PRDUpdaterSession,
  PRDUpdateOperationResult,
  PRDUpdaterConfig,
} from './types.js';

// Default configuration
export { DEFAULT_PRD_UPDATER_CONFIG } from './types.js';
