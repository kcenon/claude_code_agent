/**
 * Architecture Generator module exports
 *
 * Provides functionality to analyze SRS documents and generate
 * system architecture designs including patterns, technology stack,
 * diagrams, and directory structure.
 */

// Main classes
export {
  ArchitectureGenerator,
  getArchitectureGenerator,
  resetArchitectureGenerator,
  ARCHITECTURE_GENERATOR_AGENT_ID,
} from './ArchitectureGenerator.js';
export type { ArchitectureGeneratorConfig } from './ArchitectureGenerator.js';

export { SRSParser } from './SRSParser.js';
export { ArchitectureAnalyzer } from './ArchitectureAnalyzer.js';
export { DiagramGenerator } from './DiagramGenerator.js';
export { TechnologyStackGenerator } from './TechnologyStackGenerator.js';
export { DirectoryStructureGenerator } from './DirectoryStructureGenerator.js';

// Error classes
export {
  ArchitectureGeneratorError,
  SRSParseError,
  SRSNotFoundError,
  SRSValidationError,
  ArchitectureAnalysisError,
  PatternDetectionError,
  DiagramGenerationError,
  TechnologyStackError,
  DirectoryStructureError,
  FeatureNotFoundError,
  OutputWriteError,
} from './errors.js';

// Schema exports
export { ARCHITECTURE_SCHEMA_VERSION } from './schemas.js';

// Type exports
export type {
  // Architecture patterns
  ArchitecturePattern,
  TechnologyLayer,
  DiagramType,

  // SRS types
  SRSFeature,
  SRSUseCase,
  ParsedSRS,
  SRSMetadata,
  NonFunctionalRequirement,
  NFRCategory,
  Constraint,
  ConstraintType,

  // Analysis types
  ArchitectureAnalysis,
  PatternRecommendation,
  ArchitecturalConcern,

  // Technology types
  TechnologyStack,
  TechnologyLayerEntry,
  TechnologyAlternative,

  // Diagram types
  MermaidDiagram,
  DiagramComponent,
  ComponentConnection,

  // Directory types
  DirectoryStructure,
  DirectoryEntry,

  // Result types
  ArchitectureDesign,
  ArchitectureMetadata,

  // Option types
  ArchitectureGeneratorOptions,
  SRSParserOptions,
} from './types.js';
