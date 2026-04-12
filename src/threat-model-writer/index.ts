/**
 * Threat Model Writer Agent module
 *
 * Generates Threat Model (TM) documents from SDS (Software Design
 * Specification) inputs. The Threat Model identifies security threats
 * using STRIDE categorization and scores risks using the DREAD model.
 *
 * @module threat-model-writer
 */

// Main agent class (singleton + constructor)
export {
  ThreatModelWriterAgent,
  getThreatModelWriterAgent,
  resetThreatModelWriterAgent,
  THREAT_MODEL_WRITER_AGENT_ID,
} from './ThreatModelWriterAgent.js';

// Error classes
export {
  ThreatModelWriterError,
  SDSNotFoundError,
  SessionStateError,
  GenerationError,
  FileWriteError,
} from './errors.js';

// Type exports
export type {
  // Status and config
  ThreatModelGenerationStatus,
  ThreatModelDocumentStatus,
  ThreatModelWriterAgentConfig,
  ThreatModelGenerationSession,
  ThreatModelGenerationResult,
  ThreatModelGenerationStats,

  // STRIDE + DREAD domain types
  DreadScore,
  ThreatEntry,

  // Parsed input types
  ParsedSDSComponent,
  ParsedSDSExtract,

  // Threat Model output types
  ThreatModelMetadata,
  GeneratedThreatModel,
} from './types.js';

// Enum exports (re-exported as value, not type-only)
export { StrideCategory } from './types.js';
