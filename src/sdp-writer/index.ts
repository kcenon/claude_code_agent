/**
 * SDP Writer Agent module
 *
 * Generates Software Development Plan (SDP) documents from
 * PRD and SRS inputs. The SDP captures lifecycle, tools, team,
 * V&V strategy, and delivery milestones for a project.
 *
 * @module sdp-writer
 */

// Main agent class (singleton + constructor)
export {
  SDPWriterAgent,
  getSDPWriterAgent,
  resetSDPWriterAgent,
  SDP_WRITER_AGENT_ID,
} from './SDPWriterAgent.js';

// Error classes
export {
  SDPWriterError,
  PRDNotFoundError,
  SRSNotFoundError,
  SessionStateError,
  GenerationError,
  FileWriteError,
} from './errors.js';

// Type exports
export type {
  // Status and config
  SDPGenerationStatus,
  SDPDocumentStatus,
  SDPWriterAgentConfig,
  SDPGenerationSession,
  SDPGenerationResult,
  SDPGenerationStats,

  // Parsed input types
  ParsedPRDExtract,
  ParsedSRSExtract,
  PRDTimelineEntry,

  // SDP output types
  SDPMetadata,
  SDPMilestone,
  SDPRisk,
  GeneratedSDP,
} from './types.js';
