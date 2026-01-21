/**
 * Codebase Analyzer Agent
 *
 * Analyzes existing code structure, architecture patterns, and dependencies
 * to understand the current implementation state for the Enhancement Pipeline.
 *
 * Implements IAgent interface for unified agent instantiation through AgentFactory.
 */

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type { IAgent } from '../agents/types.js';
import type {
  ArchitectureOverview,
  ArchitectureType,
  BuildFile,
  BuildSystemInfo,
  BuildSystemType,
  CodebaseAnalyzerConfig,
  CodebaseAnalysisResult,
  CodebaseAnalysisSession,
  CodingConventions,
  CodeMetrics,
  ConfigDirectory,
  DependencyEdge,
  DependencyGraph,
  DependencyGraphStats,
  DependencyNode,
  DetectedPattern,
  DirectoryStructure,
  ExternalDependency,
  FileInfo,
  FileStructurePattern,
  ImportInfo,
  LanguageStats,
  NamingConvention,
  ProgrammingLanguage,
  SourceDirectory,
  TestDirectory,
  TestPattern,
} from './types.js';
import { DEFAULT_CODEBASE_ANALYZER_CONFIG } from './types.js';
import {
  DirectoryScanError,
  NoActiveSessionError,
  NoSourceFilesError,
  OutputWriteError,
  ProjectNotFoundError,
} from './errors.js';

// YAML and JSON formatters
let yaml: { dump: (obj: unknown) => string } | null = null;

async function loadYaml(): Promise<void> {
  if (yaml === null) {
    const jsYaml = await import('js-yaml');
    yaml = { dump: jsYaml.dump };
  }
}

/**
 * Agent ID for CodebaseAnalyzerAgent used in AgentFactory
 */
export const CODEBASE_ANALYZER_AGENT_ID = 'codebase-analyzer-agent';

/**
 * Codebase Analyzer Agent class
 *
 * Responsible for:
 * - Analyzing project directory structure
 * - Detecting build systems and package managers
 * - Building module dependency graphs
 * - Identifying architecture and design patterns
 * - Detecting coding conventions
 * - Calculating code metrics
 *
 * Implements IAgent interface for unified agent instantiation through AgentFactory.
 */
export class CodebaseAnalyzerAgent implements IAgent {
  public readonly agentId = CODEBASE_ANALYZER_AGENT_ID;
  public readonly name = 'Codebase Analyzer Agent';

  private readonly config: Required<CodebaseAnalyzerConfig>;
  private session: CodebaseAnalysisSession | null = null;
  private initialized = false;

  constructor(config: CodebaseAnalyzerConfig = {}) {
    this.config = { ...DEFAULT_CODEBASE_ANALYZER_CONFIG, ...config };
  }

  /**
   * Initialize the agent (IAgent interface)
   * Called after construction, before first use
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }
    await loadYaml();
    this.initialized = true;
  }

  /**
   * Dispose of the agent and release resources (IAgent interface)
   * Called when the agent is no longer needed
   */
  public async dispose(): Promise<void> {
    await Promise.resolve();
    this.resetSession();
    this.initialized = false;
  }

  /**
   * Start a new analysis session
   */
  public async startSession(projectId: string, rootPath: string): Promise<CodebaseAnalysisSession> {
    await loadYaml();

    // Verify root path exists
    try {
      const stat = await fs.stat(rootPath);
      if (!stat.isDirectory()) {
        throw new ProjectNotFoundError(rootPath);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new ProjectNotFoundError(rootPath);
      }
      throw error;
    }

    this.session = {
      sessionId: randomUUID(),
      projectId,
      status: 'scanning',
      rootPath,
      architectureOverview: null,
      dependencyGraph: null,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      warnings: [],
      errors: [],
    };

    return this.session;
  }

  /**
   * Analyze the codebase and generate outputs
   */
  public async analyze(): Promise<CodebaseAnalysisResult> {
    const session = this.ensureSession();
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // Update session status
      this.session = {
        ...session,
        status: 'analyzing',
        updatedAt: new Date().toISOString(),
      };

      // Step 1: Scan all files
      const allFiles = await this.scanDirectory(session.rootPath);
      if (allFiles.length === 0) {
        throw new NoSourceFilesError(session.rootPath, this.config.sourcePatterns);
      }

      // Step 2: Categorize files
      const fileInfos = await this.categorizeFiles(allFiles, session.rootPath);

      // Step 3: Detect build system
      const buildSystem = await this.detectBuildSystem(session.rootPath);

      // Step 4: Analyze directory structure
      const structure = this.analyzeStructure(fileInfos, session.rootPath);

      // Step 5: Extract dependencies
      let dependencyGraph: DependencyGraph | null = null;
      if (this.config.analyzeDependencies) {
        dependencyGraph = await this.buildDependencyGraph(
          fileInfos,
          session.rootPath,
          buildSystem.type
        );
      }

      // Step 6: Detect patterns
      let patterns: DetectedPattern[] = [];
      let architectureType: ArchitectureType = 'unknown';
      let confidence = 0;

      if (this.config.detectPatterns) {
        const patternResult = this.detectArchitecturePatterns(structure, fileInfos);
        patterns = patternResult.patterns;
        architectureType = patternResult.type;
        confidence = patternResult.confidence;
      }

      // Step 7: Detect conventions
      const conventions = await this.detectConventions(fileInfos, session.rootPath);

      // Step 8: Calculate metrics
      let metrics: CodeMetrics;
      if (this.config.calculateMetrics) {
        metrics = this.calculateMetrics(fileInfos);
      } else {
        metrics = this.createEmptyMetrics();
      }

      // Build architecture overview
      const architectureOverview: ArchitectureOverview = {
        type: architectureType,
        confidence,
        patterns,
        structure,
        conventions,
        metrics,
        buildSystem,
      };

      // Use empty dependency graph if not analyzed
      if (dependencyGraph === null) {
        dependencyGraph = this.createEmptyDependencyGraph();
      }

      // Write outputs
      const architectureOutputPath = await this.writeArchitectureOverview(
        session.projectId,
        architectureOverview
      );
      const dependencyOutputPath = await this.writeDependencyGraph(
        session.projectId,
        dependencyGraph
      );

      // Update session
      this.session = {
        ...this.session,
        status: 'completed',
        architectureOverview,
        dependencyGraph,
        warnings,
        updatedAt: new Date().toISOString(),
      };

      const processingTimeMs = Date.now() - startTime;

      return {
        success: true,
        projectId: session.projectId,
        architectureOutputPath,
        dependencyOutputPath,
        architectureOverview,
        dependencyGraph,
        stats: {
          filesScanned: allFiles.length,
          filesAnalyzed: fileInfos.length,
          filesSkipped: allFiles.length - fileInfos.length,
          dependenciesFound: dependencyGraph.edges.length,
          patternsDetected: patterns.length,
          processingTimeMs,
        },
        warnings,
      };
    } catch (error) {
      // session is guaranteed to exist here since ensureSession() was called at the start
      const currentSession = this.session ?? session;
      this.session = {
        ...currentSession,
        status: 'failed',
        errors: [...currentSession.errors, error instanceof Error ? error.message : String(error)],
        updatedAt: new Date().toISOString(),
      };
      throw error;
    }
  }

  /**
   * Get current session
   */
  public getSession(): CodebaseAnalysisSession | null {
    return this.session;
  }

  /**
   * Reset the session
   */
  public resetSession(): void {
    this.session = null;
  }

  // ============================================================
  // Private helper methods
  // ============================================================

  private ensureSession(): CodebaseAnalysisSession {
    if (this.session === null) {
      throw new NoActiveSessionError();
    }
    return this.session;
  }

  /**
   * Recursively scan directory for files
   */
  private async scanDirectory(dirPath: string): Promise<string[]> {
    const files: string[] = [];

    const scanRecursive = async (currentPath: string): Promise<void> => {
      try {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);

          // Skip excluded directories
          if (entry.isDirectory()) {
            if (this.config.excludeDirs.includes(entry.name)) {
              continue;
            }
            await scanRecursive(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (
              this.config.includeExtensions.length === 0 ||
              this.config.includeExtensions.includes(ext)
            ) {
              files.push(fullPath);
            }

            // Check file limit
            if (this.config.maxFiles > 0 && files.length >= this.config.maxFiles) {
              return;
            }
          }
        }
      } catch (error) {
        const err = error as NodeJS.ErrnoException;
        if (err.code !== 'EACCES' && err.code !== 'ENOENT') {
          throw new DirectoryScanError(currentPath, err.message || 'Unknown error');
        }
        // Skip permission denied and not found errors
      }
    };

    await scanRecursive(dirPath);
    return files;
  }

  /**
   * Categorize files and extract basic info
   */
  private async categorizeFiles(filePaths: string[], rootPath: string): Promise<FileInfo[]> {
    const fileInfos: FileInfo[] = [];

    for (const filePath of filePaths) {
      try {
        const stat = await fs.stat(filePath);

        // Skip files exceeding size limit
        if (stat.size > this.config.maxFileSize) {
          continue;
        }

        const relativePath = path.relative(rootPath, filePath);
        const extension = path.extname(filePath);
        const language = this.detectLanguage(extension);
        const isTest = this.isTestFile(relativePath);

        // Count lines
        let lineCount = 0;
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          lineCount = content.split('\n').length;
        } catch {
          // Skip unreadable files
          continue;
        }

        fileInfos.push({
          path: relativePath,
          extension,
          size: stat.size,
          language,
          isTest,
          lineCount,
        });
      } catch {
        // Skip files that can't be accessed
        continue;
      }
    }

    return fileInfos;
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(extension: string): ProgrammingLanguage {
    const languageMap: Record<string, ProgrammingLanguage> = {
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.mjs': 'javascript',
      '.cjs': 'javascript',
      '.py': 'python',
      '.java': 'java',
      '.kt': 'kotlin',
      '.kts': 'kotlin',
      '.go': 'go',
      '.rs': 'rust',
      '.cpp': 'cpp',
      '.cc': 'cpp',
      '.cxx': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.hpp': 'cpp',
      '.cs': 'csharp',
      '.rb': 'ruby',
      '.php': 'php',
      '.swift': 'swift',
    };

    return languageMap[extension.toLowerCase()] ?? 'other';
  }

  /**
   * Check if file is a test file
   */
  private isTestFile(relativePath: string): boolean {
    const testPatterns = [
      /[._]test\./i,
      /[._]spec\./i,
      /^test[s]?\//i,
      /__tests__\//i,
      /test[s]?\/.*\.(ts|js|py|java|kt|go)$/i,
    ];

    return testPatterns.some((pattern) => pattern.test(relativePath));
  }

  /**
   * Detect build system
   */
  private async detectBuildSystem(rootPath: string): Promise<BuildSystemInfo> {
    const buildFileChecks: Array<{
      file: string;
      type: BuildSystemType;
      scripts?: (content: string) => string[];
      version?: (content: string) => string | undefined;
    }> = [
      {
        file: 'package.json',
        type: 'npm',
        scripts: (content): string[] => {
          try {
            const pkg = JSON.parse(content) as {
              scripts?: Record<string, string>;
            };
            return Object.keys(pkg.scripts ?? {});
          } catch {
            return [];
          }
        },
        version: (content): string | undefined => {
          try {
            const pkg = JSON.parse(content) as { version?: string };
            return pkg.version;
          } catch {
            return undefined;
          }
        },
      },
      { file: 'build.gradle', type: 'gradle' },
      { file: 'build.gradle.kts', type: 'gradle' },
      { file: 'pom.xml', type: 'maven' },
      { file: 'CMakeLists.txt', type: 'cmake' },
      { file: 'Makefile', type: 'make' },
      { file: 'Cargo.toml', type: 'cargo' },
      { file: 'go.mod', type: 'go' },
      { file: 'requirements.txt', type: 'pip' },
      { file: 'pyproject.toml', type: 'poetry' },
      { file: 'setup.py', type: 'pip' },
    ];

    for (const check of buildFileChecks) {
      const filePath = path.join(rootPath, check.file);
      try {
        const content = await fs.readFile(filePath, 'utf-8');

        // Check for lock files
        let hasLockFile = false;
        const lockFiles: Record<BuildSystemType, string[]> = {
          npm: ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'],
          yarn: ['yarn.lock'],
          pnpm: ['pnpm-lock.yaml'],
          gradle: ['gradle.lockfile'],
          maven: [],
          cmake: [],
          make: [],
          cargo: ['Cargo.lock'],
          go: ['go.sum'],
          pip: ['requirements.txt'],
          poetry: ['poetry.lock'],
          other: [],
          unknown: [],
        };

        for (const lockFile of lockFiles[check.type]) {
          try {
            await fs.access(path.join(rootPath, lockFile));
            hasLockFile = true;
            break;
          } catch {
            // Lock file doesn't exist
          }
        }

        // Detect specific package manager for npm projects
        let actualType = check.type;
        if (check.type === 'npm') {
          try {
            await fs.access(path.join(rootPath, 'yarn.lock'));
            actualType = 'yarn';
          } catch {
            try {
              await fs.access(path.join(rootPath, 'pnpm-lock.yaml'));
              actualType = 'pnpm';
            } catch {
              // Keep npm
            }
          }
        }

        return {
          type: actualType,
          version: check.version?.(content),
          scripts: check.scripts?.(content) ?? [],
          hasLockFile,
        };
      } catch {
        // File doesn't exist, continue checking
      }
    }

    return {
      type: 'unknown',
      version: undefined,
      scripts: [],
      hasLockFile: false,
    };
  }

  /**
   * Analyze directory structure
   */
  private analyzeStructure(files: FileInfo[], _rootPath: string): DirectoryStructure {
    const sourceDirs = new Map<
      string,
      { purpose: string; count: number; language: ProgrammingLanguage | undefined }
    >();
    const testDirs = new Map<string, { framework: string | undefined; count: number }>();
    const configDirs = new Map<string, string>();
    const buildFiles: BuildFile[] = [];

    // Common source directory patterns
    const sourceDirPatterns: Array<{ pattern: RegExp; purpose: string }> = [
      { pattern: /^src\/?/i, purpose: 'main source code' },
      { pattern: /^lib\/?/i, purpose: 'library code' },
      { pattern: /^app\/?/i, purpose: 'application code' },
      { pattern: /^packages\/?/i, purpose: 'monorepo packages' },
      { pattern: /^modules\/?/i, purpose: 'modules' },
      { pattern: /^components\/?/i, purpose: 'UI components' },
    ];

    // Config patterns
    const configPatterns: Array<{ pattern: RegExp; type: string }> = [
      { pattern: /^config\/?/i, type: 'configuration' },
      { pattern: /^\.config\/?/i, type: 'configuration' },
      { pattern: /^scripts\/?/i, type: 'scripts' },
    ];

    // Build file patterns
    const buildFilePatterns: Array<{
      pattern: RegExp;
      type: BuildSystemType;
    }> = [
      { pattern: /^package\.json$/i, type: 'npm' },
      { pattern: /^tsconfig\.json$/i, type: 'npm' },
      { pattern: /^build\.gradle(\.kts)?$/i, type: 'gradle' },
      { pattern: /^pom\.xml$/i, type: 'maven' },
      { pattern: /^CMakeLists\.txt$/i, type: 'cmake' },
      { pattern: /^Makefile$/i, type: 'make' },
      { pattern: /^Cargo\.toml$/i, type: 'cargo' },
      { pattern: /^go\.mod$/i, type: 'go' },
    ];

    for (const file of files) {
      const dir = path.dirname(file.path);
      const fileName = path.basename(file.path);

      // Check for build files
      for (const { pattern, type } of buildFilePatterns) {
        if (pattern.test(fileName) && dir === '.') {
          buildFiles.push({ path: file.path, type });
        }
      }

      // Categorize by directory
      if (file.isTest) {
        const testDir = dir.split(path.sep)[0] ?? dir;
        const existing = testDirs.get(testDir) ?? { count: 0 };
        testDirs.set(testDir, {
          ...existing,
          count: existing.count + 1,
          framework: this.detectTestFramework(file.path),
        });
      } else {
        // Check source patterns
        for (const { pattern, purpose } of sourceDirPatterns) {
          if (pattern.test(file.path)) {
            const sourceDir = file.path.match(pattern)?.[0]?.replace(/\/$/, '') ?? dir;
            const existing = sourceDirs.get(sourceDir) ?? {
              purpose,
              count: 0,
            };
            sourceDirs.set(sourceDir, {
              ...existing,
              count: existing.count + 1,
              language: file.language,
            });
            break;
          }
        }

        // Check config patterns
        for (const { pattern, type } of configPatterns) {
          if (pattern.test(file.path)) {
            const configDir = file.path.match(pattern)?.[0]?.replace(/\/$/, '') ?? dir;
            configDirs.set(configDir, type);
            break;
          }
        }
      }
    }

    // Convert maps to arrays
    const sourceDirectories: SourceDirectory[] = [];
    for (const [dirPath, info] of sourceDirs) {
      sourceDirectories.push({
        path: dirPath,
        purpose: info.purpose,
        fileCount: info.count,
        primaryLanguage: info.language,
      });
    }

    const testDirectories: TestDirectory[] = [];
    for (const [dirPath, info] of testDirs) {
      testDirectories.push({
        path: dirPath,
        framework: info.framework,
        testFileCount: info.count,
      });
    }

    const configDirectories: ConfigDirectory[] = [];
    for (const [dirPath, type] of configDirs) {
      configDirectories.push({ path: dirPath, type });
    }

    return {
      sourceDirs: sourceDirectories,
      testDirs: testDirectories,
      configDirs: configDirectories,
      buildFiles,
    };
  }

  /**
   * Detect test framework from file path
   */
  private detectTestFramework(filePath: string): string | undefined {
    const fileName = path.basename(filePath);

    if (/\.test\.(ts|tsx|js|jsx)$/i.test(fileName)) {
      return 'jest';
    }
    if (/\.spec\.(ts|tsx|js|jsx)$/i.test(fileName)) {
      return 'jest';
    }
    if (/test_.*\.py$/i.test(fileName) || /.*_test\.py$/i.test(fileName)) {
      return 'pytest';
    }
    if (/Test\.java$/i.test(fileName)) {
      return 'junit';
    }
    if (/Test\.kt$/i.test(fileName)) {
      return 'junit';
    }
    if (/_test\.go$/i.test(fileName)) {
      return 'go test';
    }

    return undefined;
  }

  /**
   * Build dependency graph
   */
  private async buildDependencyGraph(
    files: FileInfo[],
    rootPath: string,
    buildSystem: BuildSystemType
  ): Promise<DependencyGraph> {
    const nodes: Map<string, DependencyNode> = new Map();
    const edges: DependencyEdge[] = [];
    const externalDeps: Map<string, ExternalDependency> = new Map();

    // Parse import statements from each file
    for (const file of files) {
      if (file.isTest) continue;

      const nodeId = this.getModuleId(file.path);
      nodes.set(nodeId, {
        id: nodeId,
        type: 'internal',
        path: file.path,
        language: file.language,
        exports: [],
      });

      // Parse imports
      try {
        const fullPath = path.join(rootPath, file.path);
        const content = await fs.readFile(fullPath, 'utf-8');
        const imports = this.parseImports(content, file.language, file.path);

        for (const imp of imports) {
          if (imp.isExternal) {
            // Track external dependency
            const existing = externalDeps.get(imp.rawImport);
            if (existing) {
              externalDeps.set(imp.rawImport, {
                ...existing,
                usedBy: [...existing.usedBy, nodeId],
              });
            } else {
              externalDeps.set(imp.rawImport, {
                name: imp.rawImport.split('/')[0] ?? imp.rawImport,
                version: '*',
                type: 'production',
                usedBy: [nodeId],
              });
            }
          } else if (imp.resolvedPath !== null) {
            // Internal dependency
            const targetId = this.getModuleId(imp.resolvedPath);

            // Add edge
            const existingEdge = edges.find((e) => e.from === nodeId && e.to === targetId);
            if (existingEdge) {
              // Increment weight
              const idx = edges.indexOf(existingEdge);
              edges[idx] = { ...existingEdge, weight: existingEdge.weight + 1 };
            } else {
              edges.push({
                from: nodeId,
                to: targetId,
                type: 'import',
                weight: 1,
              });
            }
          }
        }
      } catch {
        // Skip files that can't be parsed
      }
    }

    // Load external dependencies from package.json if available
    if (buildSystem === 'npm' || buildSystem === 'yarn' || buildSystem === 'pnpm') {
      try {
        const pkgPath = path.join(rootPath, 'package.json');
        const pkgContent = await fs.readFile(pkgPath, 'utf-8');
        const pkg = JSON.parse(pkgContent) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };

        for (const [name, version] of Object.entries(pkg.dependencies ?? {})) {
          const existing = externalDeps.get(name);
          if (existing) {
            externalDeps.set(name, { ...existing, version });
          } else {
            externalDeps.set(name, {
              name,
              version,
              type: 'production',
              usedBy: [],
            });
          }
        }

        for (const [name, version] of Object.entries(pkg.devDependencies ?? {})) {
          const existing = externalDeps.get(name);
          if (existing) {
            externalDeps.set(name, {
              ...existing,
              version,
              type: 'development',
            });
          } else {
            externalDeps.set(name, {
              name,
              version,
              type: 'development',
              usedBy: [],
            });
          }
        }
      } catch {
        // Skip if package.json can't be read
      }
    }

    // Calculate statistics
    const nodeArray = Array.from(nodes.values());
    const externalArray = Array.from(externalDeps.values());

    // Find most depended-on modules
    const dependencyCounts = new Map<string, number>();
    for (const edge of edges) {
      dependencyCounts.set(edge.to, (dependencyCounts.get(edge.to) ?? 0) + 1);
    }
    const sortedByDeps = Array.from(dependencyCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);

    // Detect circular dependencies
    const circularDeps = this.detectCircularDependencies(edges);

    const statistics: DependencyGraphStats = {
      totalNodes: nodeArray.length,
      totalEdges: edges.length,
      externalPackages: externalArray.length,
      avgDependenciesPerModule: nodeArray.length > 0 ? edges.length / nodeArray.length : 0,
      mostDependedOn: sortedByDeps,
      circularDependencies: circularDeps,
    };

    return {
      nodes: nodeArray,
      edges,
      externalDependencies: externalArray,
      statistics,
    };
  }

  /**
   * Get module ID from file path
   */
  private getModuleId(filePath: string): string {
    // Remove extension and normalize
    const withoutExt = filePath.replace(/\.[^.]+$/, '');
    return withoutExt.replace(/\\/g, '/');
  }

  /**
   * Parse import statements from file content
   */
  private parseImports(
    content: string,
    language: ProgrammingLanguage,
    sourcePath: string
  ): ImportInfo[] {
    const imports: ImportInfo[] = [];
    const lines = content.split('\n');

    // Language-specific import patterns
    const importPatterns: Record<ProgrammingLanguage, RegExp[]> = {
      typescript: [
        /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
        /import\s+['"]([^'"]+)['"]/g,
        /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      ],
      javascript: [
        /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
        /import\s+['"]([^'"]+)['"]/g,
        /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
      ],
      python: [/^from\s+(\S+)\s+import/gm, /^import\s+(\S+)/gm],
      java: [/^import\s+(\S+);/gm],
      kotlin: [/^import\s+(\S+)/gm],
      go: [/import\s+["']([^"']+)["']/g, /import\s+\(\s*["']([^"']+)["']/g],
      rust: [/use\s+(\S+)/g],
      cpp: [/#include\s*[<"]([^>"]+)[>"]/g],
      c: [/#include\s*[<"]([^>"]+)[>"]/g],
      csharp: [/using\s+(\S+);/g],
      ruby: [/require\s+['"]([^'"]+)['"]/g, /require_relative\s+['"]([^'"]+)['"]/g],
      php: [/use\s+(\S+);/g, /require\s+['"]([^'"]+)['"]/g, /include\s+['"]([^'"]+)['"]/g],
      swift: [/import\s+(\S+)/g],
      other: [],
    };

    const patterns = importPatterns[language];

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum] ?? '';

      for (const pattern of patterns) {
        // Reset pattern state
        pattern.lastIndex = 0;
        let match;

        while ((match = pattern.exec(line)) !== null) {
          const rawImport = match[1] ?? '';

          // Determine if external
          const isExternal = this.isExternalImport(rawImport, language);

          // Resolve path for internal imports
          let resolvedPath: string | null = null;
          if (!isExternal) {
            resolvedPath = this.resolveImportPath(rawImport, sourcePath, language);
          }

          imports.push({
            sourceFile: sourcePath,
            line: lineNum + 1,
            rawImport,
            resolvedPath,
            isExternal,
            symbols: [],
          });
        }
      }
    }

    return imports;
  }

  /**
   * Check if import is external (from node_modules, pip packages, etc.)
   */
  private isExternalImport(importPath: string, language: ProgrammingLanguage): boolean {
    if (language === 'typescript' || language === 'javascript') {
      // Relative imports start with . or /
      return !importPath.startsWith('.') && !importPath.startsWith('/');
    }

    if (language === 'python') {
      // Standard library and pip packages don't start with .
      return !importPath.startsWith('.');
    }

    if (language === 'go') {
      // Standard library doesn't have dots
      return !importPath.startsWith('.');
    }

    // For other languages, assume non-relative paths are external
    return !importPath.startsWith('.');
  }

  /**
   * Resolve import path to actual file path
   */
  private resolveImportPath(
    importPath: string,
    sourcePath: string,
    language: ProgrammingLanguage
  ): string | null {
    if (language === 'typescript' || language === 'javascript') {
      const sourceDir = path.dirname(sourcePath);
      let resolved = path.join(sourceDir, importPath);

      // Normalize path
      resolved = path.normalize(resolved).replace(/\\/g, '/');

      // Remove leading ./
      if (resolved.startsWith('./')) {
        resolved = resolved.slice(2);
      }

      return resolved;
    }

    if (language === 'python') {
      // Convert Python relative imports
      const sourceDir = path.dirname(sourcePath);
      const parts = importPath.split('.');
      const relativePath = parts.join('/');
      return path.join(sourceDir, relativePath).replace(/\\/g, '/');
    }

    return null;
  }

  /**
   * Detect circular dependencies in the graph
   */
  private detectCircularDependencies(edges: DependencyEdge[]): string[][] {
    const cycles: string[][] = [];
    const adjacency = new Map<string, string[]>();

    // Build adjacency list
    for (const edge of edges) {
      const existing = adjacency.get(edge.from) ?? [];
      adjacency.set(edge.from, [...existing, edge.to]);
    }

    // DFS to find cycles
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (node: string, path: string[]): void => {
      visited.add(node);
      recursionStack.add(node);

      const neighbors = adjacency.get(node) ?? [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          dfs(neighbor, [...path, neighbor]);
        } else if (recursionStack.has(neighbor)) {
          // Found a cycle
          const cycleStart = path.indexOf(neighbor);
          if (cycleStart !== -1) {
            cycles.push([...path.slice(cycleStart), neighbor]);
          }
        }
      }

      recursionStack.delete(node);
    };

    for (const node of adjacency.keys()) {
      if (!visited.has(node)) {
        dfs(node, [node]);
      }
    }

    return cycles;
  }

  /**
   * Detect architecture patterns
   */
  private detectArchitecturePatterns(
    structure: DirectoryStructure,
    files: FileInfo[]
  ): { type: ArchitectureType; confidence: number; patterns: DetectedPattern[] } {
    const patterns: DetectedPattern[] = [];
    let type: ArchitectureType = 'unknown';
    let confidence = 0;

    // Check for layered architecture patterns
    const layeredPatterns = ['controllers', 'services', 'repositories', 'models'];
    const hasLayered = layeredPatterns.filter((pattern) =>
      structure.sourceDirs.some((d) => d.path.toLowerCase().includes(pattern))
    );

    if (hasLayered.length >= 3) {
      type = 'layered';
      confidence = hasLayered.length / layeredPatterns.length;

      patterns.push({
        name: 'Layered Architecture',
        type: 'architectural',
        locations: hasLayered.map((p) => ({
          path: structure.sourceDirs.find((d) => d.path.toLowerCase().includes(p))?.path ?? p,
          description: `${p} layer`,
        })),
        confidence,
      });
    }

    // Check for MVC pattern
    const mvcPatterns = ['controllers', 'views', 'models'];
    const hasMVC = mvcPatterns.filter((pattern) =>
      structure.sourceDirs.some((d) => d.path.toLowerCase().includes(pattern))
    );

    if (hasMVC.length >= 2) {
      patterns.push({
        name: 'MVC',
        type: 'architectural',
        locations: hasMVC.map((p) => ({
          path: structure.sourceDirs.find((d) => d.path.toLowerCase().includes(p))?.path ?? p,
          description: `${p.charAt(0).toUpperCase()}${p.slice(1)}`,
        })),
        confidence: hasMVC.length / mvcPatterns.length,
      });
    }

    // Check for monorepo/microservices pattern
    const hasPackages = structure.sourceDirs.some(
      (d) => d.path.includes('packages') || d.path.includes('services')
    );

    if (hasPackages) {
      // Count number of packages/services
      const packageCount = structure.sourceDirs.filter(
        (d) => d.path.includes('packages/') || d.path.includes('services/')
      ).length;

      if (packageCount >= 3) {
        type = 'microservices';
        confidence = Math.min(packageCount / 5, 1);

        patterns.push({
          name: 'Microservices/Monorepo',
          type: 'architectural',
          locations: [
            {
              path: 'packages/ or services/',
              description: `${String(packageCount)} packages/services detected`,
            },
          ],
          confidence,
        });
      }
    }

    // Check for modular pattern
    const hasModules = structure.sourceDirs.some((d) => d.path.includes('modules'));

    if (hasModules && type === 'unknown') {
      type = 'modular';
      confidence = 0.7;

      patterns.push({
        name: 'Modular',
        type: 'architectural',
        locations: [
          {
            path: 'modules/',
            description: 'Modular structure detected',
          },
        ],
        confidence,
      });
    }

    // Default to monolith if single source directory
    if (type === 'unknown' && structure.sourceDirs.length <= 2) {
      type = 'monolith';
      confidence = 0.6;
    }

    // Detect design patterns
    // Repository pattern
    const hasRepositories = files.some(
      (f) => f.path.toLowerCase().includes('repository') || f.path.toLowerCase().includes('repo')
    );

    if (hasRepositories) {
      patterns.push({
        name: 'Repository',
        type: 'design',
        locations: files
          .filter(
            (f) =>
              f.path.toLowerCase().includes('repository') || f.path.toLowerCase().includes('repo')
          )
          .slice(0, 3)
          .map((f) => ({
            path: f.path,
            description: 'Repository implementation',
          })),
        confidence: 0.8,
      });
    }

    // Factory pattern
    const hasFactories = files.some((f) => f.path.toLowerCase().includes('factory'));

    if (hasFactories) {
      patterns.push({
        name: 'Factory',
        type: 'design',
        locations: files
          .filter((f) => f.path.toLowerCase().includes('factory'))
          .slice(0, 3)
          .map((f) => ({
            path: f.path,
            description: 'Factory implementation',
          })),
        confidence: 0.8,
      });
    }

    return { type, confidence, patterns };
  }

  /**
   * Detect coding conventions
   */
  private async detectConventions(
    files: FileInfo[],
    analysisRootPath: string
  ): Promise<CodingConventions> {
    // Sample files for convention detection
    const sampleSize = Math.max(1, Math.floor(files.length * this.config.conventionSampleRatio));
    const sampledFiles = files.filter((f) => !f.isTest).slice(0, sampleSize);

    // Analyze naming conventions using string-keyed objects for flexibility
    const namingStats: {
      variables: Record<string, number>;
      files: Record<string, number>;
      functions: Record<string, number>;
    } = {
      variables: {
        camelCase: 0,
        snake_case: 0,
        PascalCase: 0,
        'kebab-case': 0,
        SCREAMING_SNAKE_CASE: 0,
        mixed: 0,
      },
      files: {
        camelCase: 0,
        'kebab-case': 0,
        snake_case: 0,
        PascalCase: 0,
        SCREAMING_SNAKE_CASE: 0,
        mixed: 0,
      },
      functions: {
        camelCase: 0,
        snake_case: 0,
        PascalCase: 0,
        'kebab-case': 0,
        SCREAMING_SNAKE_CASE: 0,
        mixed: 0,
      },
    };

    // Analyze file naming
    for (const file of files) {
      const fileName = path.basename(file.path, path.extname(file.path));
      const style = this.detectNamingStyle(fileName);
      namingStats.files[style] = (namingStats.files[style] ?? 0) + 1;
    }

    // Analyze code content for variable and function naming
    for (const file of sampledFiles) {
      try {
        const fullPath = path.join(analysisRootPath, file.path);
        const content = await fs.readFile(fullPath, 'utf-8');

        // Extract identifiers (simplified)
        const varPattern = /(?:const|let|var|val)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
        const funcPattern = /(?:function|def|fn|func)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;

        let match;
        while ((match = varPattern.exec(content)) !== null) {
          const name = match[1] ?? '';
          const style = this.detectNamingStyle(name);
          namingStats.variables[style] = (namingStats.variables[style] ?? 0) + 1;
        }

        while ((match = funcPattern.exec(content)) !== null) {
          const name = match[1] ?? '';
          const style = this.detectNamingStyle(name);
          namingStats.functions[style] = (namingStats.functions[style] ?? 0) + 1;
        }
      } catch {
        // Skip unreadable files
      }
    }

    // Determine predominant conventions
    const findPredominant = (stats: Record<string, number>): NamingConvention => {
      const entries = Object.entries(stats);
      const total = entries.reduce((sum, [, count]) => sum + count, 0);
      if (total === 0) return 'mixed';

      const sorted = entries.sort((a, b) => b[1] - a[1]);
      const [topStyle, topCount] = sorted[0] ?? ['mixed', 0];

      // If top style is > 60% of total, use it; otherwise mixed
      if (topCount / total > 0.6) {
        return topStyle as NamingConvention;
      }
      return 'mixed';
    };

    // Detect test patterns
    const testPattern = this.detectTestPattern(files);

    // Detect file structure pattern
    const fileStructure = this.detectFileStructurePattern(files);

    return {
      naming: {
        variables: findPredominant(namingStats.variables),
        files: findPredominant(namingStats.files),
        classes: 'PascalCase', // Generally universal
        functions: findPredominant(namingStats.functions),
        constants: 'SCREAMING_SNAKE_CASE', // Generally universal
      },
      fileStructure,
      testPattern,
    };
  }

  /**
   * Detect naming style of an identifier
   */
  private detectNamingStyle(name: string): NamingConvention {
    if (/^[a-z][a-zA-Z0-9]*$/.test(name) && !name.includes('_')) {
      return 'camelCase';
    }
    if (/^[a-z][a-z0-9_]*$/.test(name)) {
      return 'snake_case';
    }
    if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) {
      return 'PascalCase';
    }
    if (/^[a-z][a-z0-9-]*$/.test(name)) {
      return 'kebab-case';
    }
    if (/^[A-Z][A-Z0-9_]*$/.test(name)) {
      return 'SCREAMING_SNAKE_CASE';
    }
    return 'mixed';
  }

  /**
   * Detect test pattern
   */
  private detectTestPattern(files: FileInfo[]): TestPattern {
    const testFiles = files.filter((f) => f.isTest);

    // Detect naming pattern
    let naming = '*.test.*';
    const specCount = testFiles.filter((f) => f.path.includes('.spec.')).length;
    const testCount = testFiles.filter((f) => f.path.includes('.test.')).length;

    if (specCount > testCount) {
      naming = '*.spec.*';
    }

    // Detect location pattern
    let location = 'tests/';
    if (testFiles.some((f) => f.path.includes('__tests__'))) {
      location = '__tests__/';
    } else if (
      testFiles.some((f) => {
        const dir = path.dirname(f.path);
        return !dir.includes('test') && f.path.includes('.test.');
      })
    ) {
      location = 'colocated';
    }

    // Detect framework
    let framework: string | undefined;
    for (const file of testFiles) {
      const detected = this.detectTestFramework(file.path);
      if (detected !== undefined) {
        framework = detected;
        break;
      }
    }

    return { naming, location, framework };
  }

  /**
   * Detect file structure pattern
   */
  private detectFileStructurePattern(files: FileInfo[]): FileStructurePattern {
    const patterns: string[] = [];
    const examples: string[] = [];

    // Check for feature-based structure
    const featureDirs = new Set<string>();
    for (const file of files) {
      const parts = file.path.split(path.sep);
      if (parts.length >= 3 && parts[0] === 'src') {
        featureDirs.add(parts[1] ?? '');
      }
    }

    if (featureDirs.size >= 3) {
      patterns.push('feature-based');
      examples.push(
        ...Array.from(featureDirs)
          .slice(0, 3)
          .map((d) => `src/${d}/`)
      );
    }

    // Check for type-based structure
    const typeDirs = ['controllers', 'services', 'models', 'utils', 'types'];
    const foundTypeDirs = typeDirs.filter((t) =>
      files.some((f) => f.path.includes(`/${t}/`) || f.path.startsWith(`${t}/`))
    );

    if (foundTypeDirs.length >= 2) {
      patterns.push('type-based');
      examples.push(...foundTypeDirs.map((d) => `${d}/`));
    }

    return {
      pattern: patterns.join(' + ') || 'flat',
      examples: examples.slice(0, 5),
    };
  }

  /**
   * Calculate code metrics
   */
  private calculateMetrics(files: FileInfo[]): CodeMetrics {
    const languageCounts = new Map<ProgrammingLanguage, { files: number; lines: number }>();

    let totalLines = 0;
    let sourceFiles = 0;
    let testFiles = 0;

    for (const file of files) {
      totalLines += file.lineCount;

      if (file.isTest) {
        testFiles++;
      } else {
        sourceFiles++;
      }

      const existing = languageCounts.get(file.language) ?? {
        files: 0,
        lines: 0,
      };
      languageCounts.set(file.language, {
        files: existing.files + 1,
        lines: existing.lines + file.lineCount,
      });
    }

    // Build language stats
    const languages: LanguageStats[] = [];
    for (const [lang, counts] of languageCounts) {
      languages.push({
        name: lang,
        files: counts.files,
        lines: counts.lines,
        percentage: totalLines > 0 ? (counts.lines / totalLines) * 100 : 0,
      });
    }

    // Sort by percentage
    languages.sort((a, b) => b.percentage - a.percentage);

    return {
      totalFiles: files.length,
      totalLines,
      totalSourceFiles: sourceFiles,
      totalTestFiles: testFiles,
      languages,
    };
  }

  /**
   * Create empty metrics
   */
  private createEmptyMetrics(): CodeMetrics {
    return {
      totalFiles: 0,
      totalLines: 0,
      totalSourceFiles: 0,
      totalTestFiles: 0,
      languages: [],
    };
  }

  /**
   * Create empty dependency graph
   */
  private createEmptyDependencyGraph(): DependencyGraph {
    return {
      nodes: [],
      edges: [],
      externalDependencies: [],
      statistics: {
        totalNodes: 0,
        totalEdges: 0,
        externalPackages: 0,
        avgDependenciesPerModule: 0,
        mostDependedOn: [],
        circularDependencies: [],
      },
    };
  }

  /**
   * Write architecture overview to YAML file
   */
  private async writeArchitectureOverview(
    projectId: string,
    overview: ArchitectureOverview
  ): Promise<string> {
    const outputDir = path.join(this.config.scratchpadBasePath, 'analysis', projectId);
    const outputPath = path.join(outputDir, 'architecture_overview.yaml');

    try {
      await fs.mkdir(outputDir, { recursive: true });

      // Convert to YAML-friendly format
      const yamlContent = {
        architecture: {
          type: overview.type,
          confidence: overview.confidence,
          patterns: overview.patterns.map((p) => ({
            name: p.name,
            type: p.type,
            confidence: p.confidence,
            locations: p.locations.map((l) => ({
              path: l.path,
              description: l.description,
            })),
          })),
          structure: {
            source_dirs: overview.structure.sourceDirs.map((d) => ({
              path: d.path,
              purpose: d.purpose,
              file_count: d.fileCount,
              primary_language: d.primaryLanguage,
            })),
            test_dirs: overview.structure.testDirs.map((d) => ({
              path: d.path,
              framework: d.framework,
              test_file_count: d.testFileCount,
            })),
            config_dirs: overview.structure.configDirs.map((d) => ({
              path: d.path,
              type: d.type,
            })),
            build_files: overview.structure.buildFiles.map((f) => ({
              path: f.path,
              type: f.type,
            })),
          },
          conventions: {
            naming: {
              variables: overview.conventions.naming.variables,
              files: overview.conventions.naming.files,
              classes: overview.conventions.naming.classes,
              functions: overview.conventions.naming.functions,
              constants: overview.conventions.naming.constants,
            },
            file_structure: {
              pattern: overview.conventions.fileStructure.pattern,
              examples: overview.conventions.fileStructure.examples,
            },
            test_pattern: {
              naming: overview.conventions.testPattern.naming,
              location: overview.conventions.testPattern.location,
              framework: overview.conventions.testPattern.framework,
            },
          },
          metrics: {
            total_files: overview.metrics.totalFiles,
            total_lines: overview.metrics.totalLines,
            total_source_files: overview.metrics.totalSourceFiles,
            total_test_files: overview.metrics.totalTestFiles,
            languages: overview.metrics.languages.map((l) => ({
              name: l.name,
              files: l.files,
              lines: l.lines,
              percentage: Math.round(l.percentage * 100) / 100,
            })),
          },
          build_system: {
            type: overview.buildSystem.type,
            version: overview.buildSystem.version,
            scripts: overview.buildSystem.scripts,
            has_lock_file: overview.buildSystem.hasLockFile,
          },
        },
      };

      if (yaml === null) {
        await loadYaml();
      }

      // yaml is guaranteed to be non-null after loadYaml() call
      const yamlModule = yaml;
      if (yamlModule === null) {
        throw new Error('Failed to load YAML module');
      }

      await fs.writeFile(outputPath, yamlModule.dump(yamlContent), 'utf-8');
      return outputPath;
    } catch (error) {
      throw new OutputWriteError(
        outputPath,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Write dependency graph to JSON file
   */
  private async writeDependencyGraph(projectId: string, graph: DependencyGraph): Promise<string> {
    const outputDir = path.join(this.config.scratchpadBasePath, 'analysis', projectId);
    const outputPath = path.join(outputDir, 'dependency_graph.json');

    try {
      await fs.mkdir(outputDir, { recursive: true });

      const jsonContent = JSON.stringify(graph, null, 2);
      await fs.writeFile(outputPath, jsonContent, 'utf-8');

      return outputPath;
    } catch (error) {
      throw new OutputWriteError(
        outputPath,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }
}

// ============================================================
// Singleton instance management
// ============================================================

let codebaseAnalyzerInstance: CodebaseAnalyzerAgent | null = null;

/**
 * Get the singleton instance of CodebaseAnalyzerAgent
 */
export function getCodebaseAnalyzerAgent(config?: CodebaseAnalyzerConfig): CodebaseAnalyzerAgent {
  if (codebaseAnalyzerInstance === null) {
    codebaseAnalyzerInstance = new CodebaseAnalyzerAgent(config);
  }
  return codebaseAnalyzerInstance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetCodebaseAnalyzerAgent(): void {
  codebaseAnalyzerInstance = null;
}
