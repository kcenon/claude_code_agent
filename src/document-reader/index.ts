/**
 * Document Reader Agent module exports
 *
 * Provides functionality for parsing and analyzing existing PRD/SRS/SDS documents.
 */

// Main classes and singletons
export {
  DocumentReaderAgent,
  getDocumentReaderAgent,
  resetDocumentReaderAgent,
  DOCUMENT_READER_AGENT_ID,
} from './DocumentReaderAgent.js';

// Type exports
export type {
  // Configuration
  DocumentReaderConfig,
  // Session and Result types
  DocumentReadingSession,
  DocumentReadingResult,
  DocumentReadingStats,
  // Document types
  DocumentType,
  ParsedDocument,
  DocumentMetadata,
  DocumentSection,
  DocumentInfo,
  // Requirement types
  FunctionalRequirement,
  NonFunctionalRequirement,
  RequirementStatus,
  RequirementPriority,
  NFRCategory,
  // Feature types
  SystemFeature,
  UseCase,
  // Component types
  SystemComponent,
  ComponentType,
  APISpecification,
  // Traceability types
  PRDToSRSTrace,
  SRSToSDSTrace,
  // State types
  CurrentState,
  SessionStatus,
} from './types.js';

// Constants
export { DEFAULT_DOCUMENT_READER_CONFIG } from './types.js';

// Error exports
export {
  DocumentReaderError,
  DocumentNotFoundError,
  DocumentParseError,
  InvalidRequirementIdError,
  UnsupportedFormatError,
  ExtractionError,
  TraceabilityError,
  NoActiveSessionError,
  InvalidSessionStateError,
  FileSizeLimitError,
  OutputWriteError,
} from './errors.js';
