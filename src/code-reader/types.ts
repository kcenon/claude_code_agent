/**
 * Code Reader Agent module type definitions
 *
 * Defines types for source code analysis, module extraction, and dependency mapping.
 */

/**
 * Visibility modifiers for class members
 */
export type Visibility = 'public' | 'private' | 'protected';

/**
 * Export types in modules
 */
export type ExportType = 'class' | 'function' | 'interface' | 'type' | 'const' | 'enum';

/**
 * Session status for code reading
 */
export type SessionStatus = 'analyzing' | 'processing' | 'completed' | 'failed';

/**
 * Circular dependency severity
 */
export type CircularDependencySeverity = 'warning' | 'error';

/**
 * Parameter information for functions and methods
 */
export interface ParameterInfo {
  /** Parameter name */
  readonly name: string;
  /** Parameter type */
  readonly type: string;
  /** Whether parameter is optional */
  readonly optional: boolean;
  /** Default value if any */
  readonly defaultValue?: string | undefined;
  /** Whether parameter is rest parameter */
  readonly isRest: boolean;
}

/**
 * Method information in a class
 */
export interface MethodInfo {
  /** Method name */
  readonly name: string;
  /** Method visibility */
  readonly visibility: Visibility;
  /** Whether method is static */
  readonly static: boolean;
  /** Whether method is async */
  readonly async: boolean;
  /** Whether method is abstract */
  readonly abstract: boolean;
  /** Method parameters */
  readonly parameters: readonly ParameterInfo[];
  /** Return type */
  readonly returnType: string;
  /** JSDoc description if available */
  readonly description?: string | undefined;
  /** Line number where method is defined */
  readonly lineNumber: number;
}

/**
 * Property information in a class or interface
 */
export interface PropertyInfo {
  /** Property name */
  readonly name: string;
  /** Property type */
  readonly type: string;
  /** Property visibility (for classes) */
  readonly visibility?: Visibility | undefined;
  /** Whether property is static (for classes) */
  readonly static?: boolean | undefined;
  /** Whether property is readonly */
  readonly readonly: boolean;
  /** Whether property is optional */
  readonly optional: boolean;
  /** Default value if any */
  readonly defaultValue?: string | undefined;
  /** JSDoc description if available */
  readonly description?: string | undefined;
}

/**
 * Class information extracted from source
 */
export interface ClassInfo {
  /** Class name */
  readonly name: string;
  /** Whether class is exported */
  readonly exported: boolean;
  /** Whether class is abstract */
  readonly abstract: boolean;
  /** Parent class if any */
  readonly extends: string | null;
  /** Implemented interfaces */
  readonly implements: readonly string[];
  /** Class methods */
  readonly methods: readonly MethodInfo[];
  /** Class properties */
  readonly properties: readonly PropertyInfo[];
  /** Whether class is default export */
  readonly isDefaultExport: boolean;
  /** JSDoc description if available */
  readonly description?: string | undefined;
  /** Line number where class is defined */
  readonly lineNumber: number;
}

/**
 * Function information extracted from source
 */
export interface FunctionInfo {
  /** Function name */
  readonly name: string;
  /** Whether function is exported */
  readonly exported: boolean;
  /** Whether function is async */
  readonly async: boolean;
  /** Whether function is generator */
  readonly generator: boolean;
  /** Function parameters */
  readonly parameters: readonly ParameterInfo[];
  /** Return type */
  readonly returnType: string;
  /** Whether function is default export */
  readonly isDefaultExport: boolean;
  /** JSDoc description if available */
  readonly description?: string | undefined;
  /** Line number where function is defined */
  readonly lineNumber: number;
}

/**
 * Interface information extracted from source
 */
export interface InterfaceInfo {
  /** Interface name */
  readonly name: string;
  /** Whether interface is exported */
  readonly exported: boolean;
  /** Extended interfaces */
  readonly extends: readonly string[];
  /** Interface properties */
  readonly properties: readonly PropertyInfo[];
  /** Interface methods (for callable interfaces) */
  readonly methods: readonly MethodInfo[];
  /** Whether interface is default export */
  readonly isDefaultExport: boolean;
  /** JSDoc description if available */
  readonly description?: string | undefined;
  /** Line number where interface is defined */
  readonly lineNumber: number;
}

/**
 * Type alias information extracted from source
 */
export interface TypeAliasInfo {
  /** Type alias name */
  readonly name: string;
  /** Whether type is exported */
  readonly exported: boolean;
  /** Type definition string */
  readonly definition: string;
  /** Whether type is default export */
  readonly isDefaultExport: boolean;
  /** JSDoc description if available */
  readonly description?: string | undefined;
  /** Line number where type is defined */
  readonly lineNumber: number;
}

/**
 * Enum information extracted from source
 */
export interface EnumInfo {
  /** Enum name */
  readonly name: string;
  /** Whether enum is exported */
  readonly exported: boolean;
  /** Whether enum is const */
  readonly isConst: boolean;
  /** Enum members */
  readonly members: readonly EnumMemberInfo[];
  /** Whether enum is default export */
  readonly isDefaultExport: boolean;
  /** JSDoc description if available */
  readonly description?: string | undefined;
  /** Line number where enum is defined */
  readonly lineNumber: number;
}

/**
 * Enum member information
 */
export interface EnumMemberInfo {
  /** Member name */
  readonly name: string;
  /** Member value if explicit */
  readonly value?: string | number | undefined;
}

/**
 * Export information
 */
export interface ExportInfo {
  /** Export name */
  readonly name: string;
  /** Export type */
  readonly type: ExportType;
  /** Whether it's a default export */
  readonly isDefault: boolean;
  /** Whether it's a re-export */
  readonly isReExport: boolean;
  /** Source module for re-exports */
  readonly sourceModule?: string | undefined;
}

/**
 * Import information
 */
export interface ImportInfo {
  /** Source module */
  readonly source: string;
  /** Imported items */
  readonly items: readonly string[];
  /** Whether import is from external package */
  readonly isExternal: boolean;
  /** Whether it's a namespace import */
  readonly isNamespaceImport: boolean;
  /** Namespace name if namespace import */
  readonly namespace?: string | undefined;
  /** Whether it's a default import */
  readonly hasDefaultImport: boolean;
  /** Default import name */
  readonly defaultImportName?: string | undefined;
}

/**
 * Module statistics
 */
export interface ModuleStatistics {
  /** Lines of code */
  readonly linesOfCode: number;
  /** Number of classes */
  readonly classCount: number;
  /** Number of functions */
  readonly functionCount: number;
  /** Number of interfaces */
  readonly interfaceCount: number;
  /** Number of type aliases */
  readonly typeCount: number;
  /** Number of enums */
  readonly enumCount: number;
  /** Number of exports */
  readonly exportCount: number;
  /** Number of imports */
  readonly importCount: number;
}

/**
 * Parsed module information
 */
export interface ParsedModule {
  /** Module name (directory name) */
  readonly name: string;
  /** Module path relative to source root */
  readonly path: string;
  /** Description from package.json or README */
  readonly description?: string | undefined;
  /** List of source files in module */
  readonly sourceFiles: readonly string[];
  /** Extracted classes */
  readonly classes: readonly ClassInfo[];
  /** Extracted functions */
  readonly functions: readonly FunctionInfo[];
  /** Extracted interfaces */
  readonly interfaces: readonly InterfaceInfo[];
  /** Extracted type aliases */
  readonly types: readonly TypeAliasInfo[];
  /** Extracted enums */
  readonly enums: readonly EnumInfo[];
  /** Module exports */
  readonly exports: readonly ExportInfo[];
  /** Module imports */
  readonly imports: readonly ImportInfo[];
  /** Module statistics */
  readonly statistics: ModuleStatistics;
}

/**
 * Internal dependency between modules
 */
export interface InternalDependency {
  /** Source module */
  readonly from: string;
  /** Target module */
  readonly to: string;
  /** Imported items */
  readonly imports: readonly string[];
}

/**
 * External dependency (npm package)
 */
export interface ExternalDependency {
  /** Package name */
  readonly module: string;
  /** Number of imports from this package */
  readonly importCount: number;
  /** Files that import this package */
  readonly importedBy: readonly string[];
}

/**
 * Circular dependency detection result
 */
export interface CircularDependency {
  /** Modules involved in circular dependency */
  readonly modules: readonly string[];
  /** Severity level */
  readonly severity: CircularDependencySeverity;
}

/**
 * Dependency analysis result
 */
export interface DependencyAnalysis {
  /** Internal module dependencies */
  readonly internal: readonly InternalDependency[];
  /** External package dependencies */
  readonly external: readonly ExternalDependency[];
  /** Detected circular dependencies */
  readonly circular: readonly CircularDependency[];
}

/**
 * Overall code statistics
 */
export interface CodeStatistics {
  /** Statistics by module */
  readonly byModule: readonly {
    readonly name: string;
    readonly loc: number;
    readonly classes: number;
    readonly functions: number;
    readonly interfaces: number;
    readonly types: number;
  }[];
  /** Total statistics */
  readonly totals: {
    readonly filesAnalyzed: number;
    readonly totalLoc: number;
    readonly avgLocPerFile: number;
    readonly totalClasses: number;
    readonly totalFunctions: number;
    readonly totalInterfaces: number;
    readonly totalTypes: number;
    readonly totalEnums: number;
  };
}

/**
 * Code inventory summary
 */
export interface CodeInventorySummary {
  /** Total number of modules */
  readonly totalModules: number;
  /** Total number of classes */
  readonly totalClasses: number;
  /** Total number of functions */
  readonly totalFunctions: number;
  /** Total number of interfaces */
  readonly totalInterfaces: number;
  /** Total number of type aliases */
  readonly totalTypes: number;
  /** Total number of enums */
  readonly totalEnums: number;
  /** Total lines of code */
  readonly totalLines: number;
}

/**
 * Complete code inventory
 */
export interface CodeInventory {
  /** Project information */
  readonly project: {
    readonly name: string;
    readonly analyzedAt: string;
    readonly rootPath: string;
  };
  /** Summary statistics */
  readonly summary: CodeInventorySummary;
  /** Analyzed modules */
  readonly modules: readonly ParsedModule[];
  /** Dependency analysis */
  readonly dependencies: DependencyAnalysis;
  /** Overall statistics */
  readonly statistics: CodeStatistics;
}

/**
 * Code reading session
 */
export interface CodeReadingSession {
  /** Session identifier */
  readonly sessionId: string;
  /** Project identifier */
  readonly projectId: string;
  /** Session status */
  readonly status: SessionStatus;
  /** Analyzed modules */
  readonly modules: readonly ParsedModule[];
  /** Code inventory result */
  readonly inventory: CodeInventory | null;
  /** Session start time */
  readonly startedAt: string;
  /** Session last update time */
  readonly updatedAt: string;
  /** Files processed count */
  readonly filesProcessed: number;
  /** Files with errors */
  readonly filesWithErrors: readonly string[];
  /** Warnings during processing */
  readonly warnings: readonly string[];
  /** Errors during processing */
  readonly errors: readonly string[];
}

/**
 * Code Reader Agent configuration
 */
export interface CodeReaderConfig {
  /** Source root path (defaults to src) */
  readonly sourceRoot?: string;
  /** Base path for scratchpad (defaults to .ad-sdlc/scratchpad) */
  readonly scratchpadBasePath?: string;
  /** Glob patterns for source files */
  readonly includePatterns?: readonly string[];
  /** Glob patterns to exclude */
  readonly excludePatterns?: readonly string[];
  /** Whether to extract private members */
  readonly extractPrivate?: boolean;
  /** Whether to include JSDoc comments */
  readonly includeComments?: boolean;
  /** Whether to analyze dependencies */
  readonly analyzeDependencies?: boolean;
  /** Maximum file size to process (in bytes) */
  readonly maxFileSize?: number;
  /** Maximum files to process at once (for memory management) */
  readonly batchSize?: number;
  /** Maximum allowed ratio of files with parse errors (0.0–1.0, default 0.5) */
  readonly parseErrorThreshold?: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_CODE_READER_CONFIG: Required<CodeReaderConfig> = {
  sourceRoot: 'src',
  scratchpadBasePath: '.ad-sdlc/scratchpad',
  includePatterns: ['**/*.ts', '**/*.tsx'],
  excludePatterns: [
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/*.test.tsx',
    '**/*.spec.tsx',
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/*.d.ts',
  ],
  extractPrivate: false,
  includeComments: true,
  analyzeDependencies: true,
  maxFileSize: 5 * 1024 * 1024, // 5MB
  batchSize: 100,
  parseErrorThreshold: 0.5,
} as const;

/**
 * Code reading result
 */
export interface CodeReadingResult {
  /** Whether reading was successful */
  readonly success: boolean;
  /** Project ID */
  readonly projectId: string;
  /** Path to the code_inventory.yaml file */
  readonly outputPath: string;
  /** The code inventory */
  readonly inventory: CodeInventory;
  /** Reading statistics */
  readonly stats: CodeReadingStats;
  /** Warnings during reading */
  readonly warnings: readonly string[];
}

/**
 * Statistics about the code reading process
 */
export interface CodeReadingStats {
  /** Number of files processed */
  readonly filesProcessed: number;
  /** Number of files with parse errors */
  readonly filesWithErrors: number;
  /** Number of modules discovered */
  readonly modulesDiscovered: number;
  /** Number of classes extracted */
  readonly classesExtracted: number;
  /** Number of functions extracted */
  readonly functionsExtracted: number;
  /** Number of interfaces extracted */
  readonly interfacesExtracted: number;
  /** Number of types extracted */
  readonly typesExtracted: number;
  /** Number of dependencies mapped */
  readonly dependenciesMapped: number;
  /** Total processing time in milliseconds */
  readonly processingTimeMs: number;
}
