/**
 * SDS Updater Agent Module
 *
 * Exports the SDS Updater Agent and related types/utilities.
 */

export {
  SDSUpdaterAgent,
  getSDSUpdaterAgent,
  resetSDSUpdaterAgent,
  SDS_UPDATER_AGENT_ID,
} from './SDSUpdaterAgent.js';

export type {
  // Change Request Types
  SDSChangeRequestType,
  ComponentType,
  ComponentStatus,
  InterfaceMethod,
  ProvidedInterface,
  RequiredInterface,
  InternalDependency,
  ExternalDependency,
  NewComponent,
  ErrorResponse,
  NewAPI,
  ItemModification,
  DataChange,
  DataModelUpdate,
  ArchitectureChange,
  SDSTraceabilityUpdate,
  SDSChangeRequest,

  // Document Types
  SDSDocumentMetadata,
  ParsedComponent,
  ParsedAPI,
  DocumentSection,
  SDSTraceabilityEntry,
  ParsedSDS,

  // Update Result Types
  AddedComponent,
  AddedAPI,
  ModifiedComponent,
  ModifiedAPI,
  DataModelChange,
  ArchitectureModification,
  ConsistencyCheckResult,
  SDSUpdateChanges,
  SDSUpdateResult,

  // Session Types
  SDSSessionStatus,
  SDSUpdaterSession,

  // Operation Result Types
  SDSUpdateOperationResult,

  // Configuration Types
  SDSUpdaterConfig,
} from './types.js';

export { DEFAULT_SDS_UPDATER_CONFIG } from './types.js';

export {
  SDSUpdaterError,
  NoActiveSDSSessionError,
  SDSNotFoundError,
  ComponentNotFoundError,
  APINotFoundError,
  DuplicateComponentError,
  DuplicateAPIError,
  InvalidSDSTraceabilityError,
  InvalidSDSChangeRequestError,
  SDSDocumentParseError,
  SDSOutputWriteError,
  InvalidSDSVersionError,
  SDSFileSizeLimitError,
  SDSNotLoadedError,
  InterfaceIncompatibilityError,
  ArchitecturalConflictError,
} from './errors.js';
