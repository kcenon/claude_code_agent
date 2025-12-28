/**
 * Codebase Analyzer Agent module type definitions
 *
 * Defines types for code structure analysis, dependency graphing,
 * architecture detection, and convention recognition.
 */

/**
 * Architecture types that can be detected
 */
export type ArchitectureType =
  | 'layered'
  | 'microservices'
  | 'monolith'
  | 'modular'
  | 'unknown';

/**
 * Pattern types
 */
export type PatternType = 'architectural' | 'design' | 'structural';

/**
 * Dependency edge types
 */
export type DependencyType = 'import' | 'extends' | 'implements' | 'uses';

/**
 * Node types in dependency graph
 */
export type NodeType = 'internal' | 'external';

/**
 * Package dependency types
 */
export type PackageDependencyType = 'production' | 'development';

/**
 * Naming convention types
 */
export type NamingConvention =
  | 'camelCase'
  | 'snake_case'
  | 'PascalCase'
  | 'kebab-case'
  | 'SCREAMING_SNAKE_CASE'
  | 'mixed';

/**
 * Supported programming languages
 */
export type ProgrammingLanguage =
  | 'typescript'
  | 'javascript'
  | 'python'
  | 'java'
  | 'kotlin'
  | 'go'
  | 'rust'
  | 'cpp'
  | 'c'
  | 'csharp'
  | 'ruby'
  | 'php'
  | 'swift'
  | 'other';

/**
 * Build system types
 */
export type BuildSystemType =
  | 'npm'
  | 'yarn'
  | 'pnpm'
  | 'gradle'
  | 'maven'
  | 'cmake'
  | 'make'
  | 'cargo'
  | 'go'
  | 'pip'
  | 'poetry'
  | 'other'
  | 'unknown';

/**
 * Analysis session status
 */
export type AnalysisSessionStatus =
  | 'scanning'
  | 'analyzing'
  | 'completed'
  | 'failed';

/**
 * Detected pattern in the codebase
 */
export interface DetectedPattern {
  /** Pattern name */
  readonly name: string;
  /** Pattern type */
  readonly type: PatternType;
  /** Locations where pattern is found */
  readonly locations: readonly PatternLocation[];
  /** Detection confidence (0.0 - 1.0) */
  readonly confidence: number;
}

/**
 * Pattern location in the codebase
 */
export interface PatternLocation {
  /** File or directory path */
  readonly path: string;
  /** Description of how pattern manifests here */
  readonly description: string;
}

/**
 * Source directory information
 */
export interface SourceDirectory {
  /** Directory path */
  readonly path: string;
  /** Directory purpose */
  readonly purpose: string;
  /** Number of files */
  readonly fileCount: number;
  /** Primary language in this directory */
  readonly primaryLanguage?: ProgrammingLanguage | undefined;
}

/**
 * Test directory information
 */
export interface TestDirectory {
  /** Directory path */
  readonly path: string;
  /** Test framework detected */
  readonly framework?: string | undefined;
  /** Number of test files */
  readonly testFileCount: number;
}

/**
 * Configuration directory information
 */
export interface ConfigDirectory {
  /** Directory path */
  readonly path: string;
  /** Configuration type */
  readonly type: string;
}

/**
 * Build file information
 */
export interface BuildFile {
  /** File path */
  readonly path: string;
  /** Build system type */
  readonly type: BuildSystemType;
}

/**
 * Directory structure analysis
 */
export interface DirectoryStructure {
  /** Source directories */
  readonly sourceDirs: readonly SourceDirectory[];
  /** Test directories */
  readonly testDirs: readonly TestDirectory[];
  /** Configuration directories */
  readonly configDirs: readonly ConfigDirectory[];
  /** Build files found */
  readonly buildFiles: readonly BuildFile[];
}

/**
 * Naming conventions detected
 */
export interface NamingConventions {
  /** Variable naming convention */
  readonly variables: NamingConvention;
  /** File naming convention */
  readonly files: NamingConvention;
  /** Class naming convention */
  readonly classes: NamingConvention;
  /** Function naming convention */
  readonly functions: NamingConvention;
  /** Constant naming convention */
  readonly constants: NamingConvention;
}

/**
 * File structure pattern
 */
export interface FileStructurePattern {
  /** Pattern description */
  readonly pattern: string;
  /** Example files following this pattern */
  readonly examples: readonly string[];
}

/**
 * Test pattern information
 */
export interface TestPattern {
  /** Test file naming pattern */
  readonly naming: string;
  /** Test file location relative to source */
  readonly location: string;
  /** Test framework detected */
  readonly framework?: string | undefined;
}

/**
 * Coding conventions detected
 */
export interface CodingConventions {
  /** Naming conventions */
  readonly naming: NamingConventions;
  /** File structure patterns */
  readonly fileStructure: FileStructurePattern;
  /** Test patterns */
  readonly testPattern: TestPattern;
}

/**
 * Language statistics
 */
export interface LanguageStats {
  /** Language name */
  readonly name: ProgrammingLanguage;
  /** Number of files */
  readonly files: number;
  /** Number of lines */
  readonly lines: number;
  /** Percentage of codebase */
  readonly percentage: number;
}

/**
 * Code metrics
 */
export interface CodeMetrics {
  /** Total number of files */
  readonly totalFiles: number;
  /** Total lines of code */
  readonly totalLines: number;
  /** Total source files (excluding tests) */
  readonly totalSourceFiles: number;
  /** Total test files */
  readonly totalTestFiles: number;
  /** Language distribution */
  readonly languages: readonly LanguageStats[];
}

/**
 * Build system information
 */
export interface BuildSystemInfo {
  /** Build system type */
  readonly type: BuildSystemType;
  /** Version if detectable */
  readonly version?: string | undefined;
  /** Available scripts/targets */
  readonly scripts: readonly string[];
  /** Lock file present */
  readonly hasLockFile: boolean;
}

/**
 * Architecture overview output
 */
export interface ArchitectureOverview {
  /** Detected architecture type */
  readonly type: ArchitectureType;
  /** Confidence level (0.0 - 1.0) */
  readonly confidence: number;
  /** Detected patterns */
  readonly patterns: readonly DetectedPattern[];
  /** Directory structure */
  readonly structure: DirectoryStructure;
  /** Coding conventions */
  readonly conventions: CodingConventions;
  /** Code metrics */
  readonly metrics: CodeMetrics;
  /** Build system information */
  readonly buildSystem: BuildSystemInfo;
}

/**
 * Dependency graph node
 */
export interface DependencyNode {
  /** Unique node identifier */
  readonly id: string;
  /** Node type (internal or external) */
  readonly type: NodeType;
  /** File path for internal modules */
  readonly path?: string;
  /** Programming language */
  readonly language?: ProgrammingLanguage;
  /** Exported symbols */
  readonly exports: readonly string[];
}

/**
 * Dependency graph edge
 */
export interface DependencyEdge {
  /** Source node ID */
  readonly from: string;
  /** Target node ID */
  readonly to: string;
  /** Dependency type */
  readonly type: DependencyType;
  /** Edge weight (number of imports) */
  readonly weight: number;
}

/**
 * External package dependency
 */
export interface ExternalDependency {
  /** Package name */
  readonly name: string;
  /** Version specification */
  readonly version: string;
  /** Dependency type */
  readonly type: PackageDependencyType;
  /** Modules that use this package */
  readonly usedBy: readonly string[];
}

/**
 * Dependency graph statistics
 */
export interface DependencyGraphStats {
  /** Total number of nodes */
  readonly totalNodes: number;
  /** Total number of edges */
  readonly totalEdges: number;
  /** Number of external packages */
  readonly externalPackages: number;
  /** Average dependencies per module */
  readonly avgDependenciesPerModule: number;
  /** Most depended-on modules */
  readonly mostDependedOn: readonly string[];
  /** Circular dependencies detected */
  readonly circularDependencies: readonly string[][];
}

/**
 * Dependency graph output
 */
export interface DependencyGraph {
  /** Graph nodes */
  readonly nodes: readonly DependencyNode[];
  /** Graph edges */
  readonly edges: readonly DependencyEdge[];
  /** External dependencies */
  readonly externalDependencies: readonly ExternalDependency[];
  /** Graph statistics */
  readonly statistics: DependencyGraphStats;
}

/**
 * Codebase analysis session
 */
export interface CodebaseAnalysisSession {
  /** Session identifier */
  readonly sessionId: string;
  /** Project identifier */
  readonly projectId: string;
  /** Session status */
  readonly status: AnalysisSessionStatus;
  /** Root path being analyzed */
  readonly rootPath: string;
  /** Architecture overview result */
  readonly architectureOverview: ArchitectureOverview | null;
  /** Dependency graph result */
  readonly dependencyGraph: DependencyGraph | null;
  /** Session start time */
  readonly startedAt: string;
  /** Session last update time */
  readonly updatedAt: string;
  /** Warnings during analysis */
  readonly warnings: readonly string[];
  /** Errors during analysis */
  readonly errors: readonly string[];
}

/**
 * Codebase Analyzer Agent configuration
 */
export interface CodebaseAnalyzerConfig {
  /** Base path for scratchpad (defaults to .ad-sdlc/scratchpad) */
  readonly scratchpadBasePath?: string;
  /** Source directory patterns to scan */
  readonly sourcePatterns?: readonly string[];
  /** Test directory patterns to scan */
  readonly testPatterns?: readonly string[];
  /** Directories to exclude from analysis */
  readonly excludeDirs?: readonly string[];
  /** File extensions to analyze */
  readonly includeExtensions?: readonly string[];
  /** Maximum files to analyze (0 = unlimited) */
  readonly maxFiles?: number;
  /** Maximum file size to process (in bytes) */
  readonly maxFileSize?: number;
  /** Whether to analyze dependencies */
  readonly analyzeDependencies?: boolean;
  /** Whether to detect patterns */
  readonly detectPatterns?: boolean;
  /** Whether to calculate metrics */
  readonly calculateMetrics?: boolean;
  /** Sample ratio for convention detection (0.0 - 1.0) */
  readonly conventionSampleRatio?: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_CODEBASE_ANALYZER_CONFIG: Required<CodebaseAnalyzerConfig> =
  {
    scratchpadBasePath: '.ad-sdlc/scratchpad',
    sourcePatterns: ['src/**/*', 'lib/**/*', 'app/**/*'],
    testPatterns: [
      'test/**/*',
      'tests/**/*',
      '__tests__/**/*',
      '**/*.test.*',
      '**/*.spec.*',
    ],
    excludeDirs: [
      'node_modules',
      '.git',
      'dist',
      'build',
      'coverage',
      '__pycache__',
      '.venv',
      'venv',
      'target',
      'vendor',
    ],
    includeExtensions: [
      '.ts',
      '.tsx',
      '.js',
      '.jsx',
      '.py',
      '.java',
      '.kt',
      '.go',
      '.rs',
      '.cpp',
      '.c',
      '.h',
      '.cs',
      '.rb',
      '.php',
      '.swift',
    ],
    maxFiles: 10000,
    maxFileSize: 5 * 1024 * 1024, // 5MB
    analyzeDependencies: true,
    detectPatterns: true,
    calculateMetrics: true,
    conventionSampleRatio: 0.1, // Sample 10% of files for convention detection
  } as const;

/**
 * Codebase analysis result
 */
export interface CodebaseAnalysisResult {
  /** Whether analysis was successful */
  readonly success: boolean;
  /** Project ID */
  readonly projectId: string;
  /** Path to architecture_overview.yaml */
  readonly architectureOutputPath: string;
  /** Path to dependency_graph.json */
  readonly dependencyOutputPath: string;
  /** Architecture overview */
  readonly architectureOverview: ArchitectureOverview;
  /** Dependency graph */
  readonly dependencyGraph: DependencyGraph;
  /** Analysis statistics */
  readonly stats: CodebaseAnalysisStats;
  /** Warnings during analysis */
  readonly warnings: readonly string[];
}

/**
 * Statistics about the codebase analysis process
 */
export interface CodebaseAnalysisStats {
  /** Number of files scanned */
  readonly filesScanned: number;
  /** Number of files analyzed */
  readonly filesAnalyzed: number;
  /** Number of files skipped */
  readonly filesSkipped: number;
  /** Number of dependencies found */
  readonly dependenciesFound: number;
  /** Number of patterns detected */
  readonly patternsDetected: number;
  /** Total processing time in milliseconds */
  readonly processingTimeMs: number;
}

/**
 * File information during scanning
 */
export interface FileInfo {
  /** File path */
  readonly path: string;
  /** File extension */
  readonly extension: string;
  /** File size in bytes */
  readonly size: number;
  /** Programming language */
  readonly language: ProgrammingLanguage;
  /** Whether it's a test file */
  readonly isTest: boolean;
  /** Line count */
  readonly lineCount: number;
}

/**
 * Import statement information
 */
export interface ImportInfo {
  /** Source file path */
  readonly sourceFile: string;
  /** Import statement line number */
  readonly line: number;
  /** Raw import string */
  readonly rawImport: string;
  /** Resolved module path */
  readonly resolvedPath: string | null;
  /** Whether import is external */
  readonly isExternal: boolean;
  /** Imported symbols (if extractable) */
  readonly symbols: readonly string[];
}
