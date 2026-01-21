/**
 * Codebase Analyzer Agent module exports
 *
 * Provides functionality for analyzing code structure, architecture patterns,
 * dependencies, and coding conventions.
 */

// Main classes and singletons
export {
  CodebaseAnalyzerAgent,
  getCodebaseAnalyzerAgent,
  resetCodebaseAnalyzerAgent,
  CODEBASE_ANALYZER_AGENT_ID,
} from './CodebaseAnalyzerAgent.js';

// Type exports
export type {
  // Architecture types
  ArchitectureType,
  ArchitectureOverview,
  DetectedPattern,
  PatternLocation,
  PatternType,
  // Structure types
  DirectoryStructure,
  SourceDirectory,
  TestDirectory,
  ConfigDirectory,
  BuildFile,
  BuildSystemInfo,
  BuildSystemType,
  // Dependency types
  DependencyGraph,
  DependencyNode,
  DependencyEdge,
  DependencyType,
  NodeType,
  DependencyGraphStats,
  ExternalDependency,
  PackageDependencyType,
  // Convention types
  CodingConventions,
  NamingConventions,
  NamingConvention,
  FileStructurePattern,
  TestPattern,
  // Metrics types
  CodeMetrics,
  LanguageStats,
  // Language types
  ProgrammingLanguage,
  // Session and result types
  CodebaseAnalysisSession,
  CodebaseAnalysisResult,
  CodebaseAnalysisStats,
  AnalysisSessionStatus,
  // Configuration types
  CodebaseAnalyzerConfig,
  // File types
  FileInfo,
  ImportInfo,
} from './types.js';

// Constants
export { DEFAULT_CODEBASE_ANALYZER_CONFIG } from './types.js';

// Error exports
export {
  CodebaseAnalyzerError,
  ProjectNotFoundError,
  NoSourceFilesError,
  UnsupportedLanguageError,
  BuildSystemNotDetectedError,
  CircularDependencyError,
  ImportParseError,
  FileSizeLimitError,
  NoActiveSessionError,
  InvalidSessionStateError,
  OutputWriteError,
  FileReadError,
  DirectoryScanError,
  MaxFilesExceededError,
} from './errors.js';
