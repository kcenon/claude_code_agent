/**
 * Collector Agent module exports
 *
 * Provides functionality to collect, parse, and extract information
 * from various input sources (text, files, URLs) for downstream
 * document generation agents.
 *
 * @example
 * ```typescript
 * import { CollectorAgent } from './collector';
 *
 * const collector = new CollectorAgent();
 * await collector.startSession('MyProject');
 * collector.addTextInput('The system must support user authentication...');
 * const result = await collector.finalize();
 * console.log(result.outputPath);
 * ```
 */

// Main classes
export {
  CollectorAgent,
  getCollectorAgent,
  resetCollectorAgent,
  COLLECTOR_AGENT_ID,
} from './CollectorAgent.js';

export { InputParser } from './InputParser.js';
export type { InputParserOptions } from './InputParser.js';

export { InformationExtractor } from './InformationExtractor.js';
export type { InformationExtractorOptions } from './InformationExtractor.js';

export { LLMExtractor } from './LLMExtractor.js';

// Error classes
export {
  CollectorError,
  InputParseError,
  FileParseError,
  UrlFetchError,
  ExtractionError,
  MissingInformationError,
  ValidationError,
  SessionStateError,
  UnsupportedFileTypeError,
  ProjectInitError,
} from './errors.js';

// Type exports
export type {
  // Input types
  InputSourceType,
  SupportedFileType,
  InputSource,
  ParsedInput,
  FileParseResult,
  UrlFetchResult,

  // Extraction types
  ExtractedRequirement,
  ExtractedConstraint,
  ExtractedAssumption,
  ExtractedDependency,
  ExtractionResult,

  // Clarification types
  ClarificationCategory,
  ClarificationQuestion,
  ClarificationAnswer,

  // Session types
  CollectionSession,
  CollectorAgentConfig,
  CollectionResult,
  CollectionStats,

  // Batch input types
  BatchInputItem,
  BatchInputOptions,
  BatchInputResult,
} from './types.js';
