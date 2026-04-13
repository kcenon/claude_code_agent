/**
 * SVP Writer Agent module
 *
 * Generates Software Verification Plan (SVP) documents from SRS (Software
 * Requirements Specification) inputs. The SVP automatically derives test
 * cases from use cases and non-functional requirements, classifies them by
 * verification level (Unit / Integration / System), and provides a
 * traceability matrix back to source requirements.
 *
 * @module svp-writer
 */

// Main agent class (singleton + constructor)
export {
  SVPWriterAgent,
  getSVPWriterAgent,
  resetSVPWriterAgent,
  SVP_WRITER_AGENT_ID,
} from './SVPWriterAgent.js';

// Error classes
export {
  SVPWriterError,
  SRSNotFoundError,
  SessionStateError,
  GenerationError,
  FileWriteError,
} from './errors.js';

// Test case derivation helpers (exported for fine-grained reuse and testing)
export {
  deriveTestCasesForUseCase,
  deriveTestCasesForUseCases,
  type DerivationContext,
} from './TestCaseDeriver.js';
export { generateNFRTestCases } from './NFRTestGenerator.js';

// Type exports
export type {
  // Status and config
  SVPGenerationStatus,
  SVPDocumentStatus,
  SVPWriterAgentConfig,
  SVPGenerationSession,
  SVPGenerationResult,
  SVPGenerationStats,

  // Test case domain types
  TestCase,
  TestCasePriority,
  TestCaseCategory,
  TraceabilityEntry,

  // Parsed input types
  ParsedUseCase,
  ParsedNFR,
  ParsedInterface,
  ParsedSRSExtract,
  ParsedSDSInterfaces,
  NFRCategory,

  // SVP output types
  SVPMetadata,
  GeneratedSVP,
} from './types.js';

// Enum exports
export { TestLevel } from './types.js';
