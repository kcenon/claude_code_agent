/**
 * Issue Generator module exports
 *
 * Provides functionality to transform SDS documents into
 * actionable GitHub Issues with dependencies and estimates.
 */

// Main classes
export { IssueGenerator, getIssueGenerator, resetIssueGenerator } from './IssueGenerator.js';
export type { IssueGeneratorConfig } from './IssueGenerator.js';

export { SDSParser } from './SDSParser.js';
export { IssueTransformer } from './IssueTransformer.js';
export { EffortEstimator } from './EffortEstimator.js';
export type { EffortEstimatorOptions } from './EffortEstimator.js';
export { DependencyGraphBuilder } from './DependencyGraph.js';

// Error classes
export {
  IssueGeneratorError,
  SDSParseError,
  ComponentNotFoundError,
  CircularDependencyError,
  IssueTransformError,
  EstimationError,
  SDSNotFoundError,
  SDSValidationError,
} from './errors.js';

// Type exports
export type {
  // Effort types
  EffortSize,
  IssueType,
  Priority,
  DependencyType,

  // SDS types
  SDSComponent,
  SDSInterface,
  SDSMethod,
  ParsedSDS,
  SDSMetadata,
  TechnologyEntry,
  TraceabilityEntry,

  // Issue types
  GeneratedIssue,
  IssueLabels,
  IssueDependencies,
  IssueTraceability,
  IssueTechnical,
  IssueEstimation,
  EstimationFactors,

  // Graph types
  DependencyGraph,
  DependencyNode,
  DependencyEdge,
  ParallelGroup,

  // Result types
  IssueGenerationResult,
  GenerationSummary,

  // Option types
  IssueGeneratorOptions,
  SDSParserOptions,
  RelatedFileEntry,
} from './types.js';
