/**
 * UI Specification Writer Agent module
 *
 * Generates UI screen specifications, user flow documents, and design
 * system references from SRS use cases for web/mobile projects.
 *
 * @module ui-spec-writer
 */

// Main agent class (singleton + constructor)
export {
  UISpecWriterAgent,
  getUISpecWriterAgent,
  resetUISpecWriterAgent,
  UI_SPEC_WRITER_AGENT_ID,
} from './UISpecWriterAgent.js';

// Helper modules
export { detectScreens, slugifyScreen } from './ScreenDetector.js';
export { mapFlows, slugifyFlow } from './FlowMapper.js';
export { generateDesignSystem, deriveComponents } from './DesignSystemGenerator.js';

// Error classes
export {
  UISpecWriterError,
  SRSNotFoundError,
  SessionStateError,
  GenerationError,
  FileWriteError,
} from './errors.js';

// Type exports
export type {
  // Status and config
  UISpecGenerationStatus,
  UISpecDocumentStatus,
  UISpecWriterAgentConfig,
  UISpecGenerationSession,
  UISpecGenerationResult,
  UISpecGenerationStats,
  ProjectType,

  // Parsed input types
  ParsedSRSForUI,
  ParsedUseCase,
  ParsedFeature,

  // Screen types
  ScreenSpec,
  UIElement,

  // Flow types
  FlowSpec,
  FlowStep,

  // Design system types
  DesignSystem,
  DesignToken,
  DesignComponent,
} from './types.js';
