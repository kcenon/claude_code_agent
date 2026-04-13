/**
 * Tech Decision Writer Agent module
 *
 * Generates Technology Decision (TD) comparison documents from SDS
 * (Software Design Specification) inputs. Each row in the SDS technology
 * stack table produces one TD document that evaluates candidate technologies
 * against weighted criteria and records the rationale for the chosen option.
 *
 * @module tech-decision-writer
 */

// Main agent class (singleton + constructor)
export {
  TechDecisionWriterAgent,
  getTechDecisionWriterAgent,
  resetTechDecisionWriterAgent,
  TECH_DECISION_WRITER_AGENT_ID,
} from './TechDecisionWriterAgent.js';

// Error classes
export {
  TechDecisionWriterError,
  SDSNotFoundError,
  SessionStateError,
  GenerationError,
  FileWriteError,
  InvalidCriteriaError,
} from './errors.js';

// Decision detection helpers (exported for fine-grained reuse and testing)
export {
  slugifyTopic,
  parseTechnologyStack,
  parseSDSComponents,
  parseNfrReferences,
  detectDecisions,
} from './DecisionDetector.js';

// Comparison generation helpers
export { DEFAULT_CRITERIA, validateCriteria, generateDecisions } from './ComparisonGenerator.js';

// Type exports
export type {
  // Status and config
  TechDecisionGenerationStatus,
  TechDecisionDocumentStatus,
  TechDecisionWriterAgentConfig,
  TechDecisionGenerationSession,
  TechDecisionGenerationResult,
  TechDecisionGenerationStats,

  // Decision domain types
  Candidate,
  EvaluationCriterion,
  EvaluationMatrix,
  EvaluationMatrixRow,
  Decision,
  Consequences,
  TechDecision,

  // Parsed input types
  ParsedTechStackRow,
  ParsedSDSComponentRef,
  ParsedSDSForDecisions,

  // Output types
  TechDecisionMetadata,
  GeneratedTechDecision,
} from './types.js';
