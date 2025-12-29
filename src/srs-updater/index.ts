/**
 * SRS Updater Agent Module
 *
 * Provides incremental update functionality for SRS documents.
 * Supports adding features and use cases, modifying existing items,
 * updating interfaces, and maintaining PRD→SRS traceability.
 */

// Main agent class and singleton functions
export { SRSUpdaterAgent, getSRSUpdaterAgent, resetSRSUpdaterAgent } from './SRSUpdaterAgent.js';

// Error classes
export {
  SRSUpdaterError,
  NoActiveSRSSessionError,
  SRSNotFoundError,
  FeatureNotFoundError,
  UseCaseNotFoundError,
  DuplicateFeatureError,
  DuplicateUseCaseError,
  InvalidTraceabilityError,
  InvalidSRSChangeRequestError,
  SRSDocumentParseError,
  SRSOutputWriteError,
  InvalidSRSVersionError,
  SRSFileSizeLimitError,
  SRSNotLoadedError,
} from './errors.js';

// Type exports
export type {
  SRSChangeRequestType,
  FeaturePriority,
  FeatureStatus,
  NewFeature,
  AlternativeFlow,
  ExceptionFlow,
  NewUseCase,
  ItemModification,
  TraceabilityUpdate,
  SRSChangeRequest,
  SRSDocumentMetadata,
  ParsedFeature,
  ParsedUseCase,
  DocumentSection,
  TraceabilityEntry,
  ParsedSRS,
  AddedFeature,
  AddedUseCase,
  ModifiedFeature,
  ModifiedUseCase,
  ModifiedInterface,
  ConsistencyCheckResult,
  SRSUpdateChanges,
  SRSUpdateResult,
  SRSSessionStatus,
  SRSUpdaterSession,
  SRSUpdateOperationResult,
  SRSUpdaterConfig,
} from './types.js';

// Default configuration
export { DEFAULT_SRS_UPDATER_CONFIG } from './types.js';
