/**
 * Code Reader Agent module exports
 *
 * Provides functionality for analyzing source code structure and extracting
 * classes, functions, interfaces, types, and dependency relationships.
 */

// Main classes and singletons
export {
  CodeReaderAgent,
  getCodeReaderAgent,
  resetCodeReaderAgent,
} from './CodeReaderAgent.js';

// Type exports
export type {
  // Configuration
  CodeReaderConfig,
  // Session and Result types
  CodeReadingSession,
  CodeReadingResult,
  CodeReadingStats,
  // Module types
  ParsedModule,
  ModuleStatistics,
  // Class types
  ClassInfo,
  MethodInfo,
  PropertyInfo,
  ParameterInfo,
  Visibility,
  // Function types
  FunctionInfo,
  // Interface types
  InterfaceInfo,
  // Type alias types
  TypeAliasInfo,
  // Enum types
  EnumInfo,
  EnumMemberInfo,
  // Export/Import types
  ExportInfo,
  ExportType,
  ImportInfo,
  // Dependency types
  DependencyAnalysis,
  InternalDependency,
  ExternalDependency,
  CircularDependency,
  CircularDependencySeverity,
  // Inventory types
  CodeInventory,
  CodeInventorySummary,
  CodeStatistics,
  // Status types
  SessionStatus,
} from './types.js';

// Constants
export { DEFAULT_CODE_READER_CONFIG } from './types.js';

// Error exports
export {
  CodeReaderError,
  SourceFileNotFoundError,
  SourceDirectoryNotFoundError,
  ParseError,
  NoActiveSessionError,
  InvalidSessionStateError,
  FileSizeLimitError,
  OutputWriteError,
  CircularDependencyError,
  TooManyParseErrorsError,
  InvalidTsConfigError,
} from './errors.js';
