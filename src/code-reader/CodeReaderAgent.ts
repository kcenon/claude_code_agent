/**
 * Code Reader Agent
 *
 * Analyzes source code structure, modules, and implementations
 * using TypeScript AST parsing for the Analysis Pipeline.
 */

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import {
  Project,
  SourceFile,
  ClassDeclaration,
  FunctionDeclaration,
  InterfaceDeclaration,
  TypeAliasDeclaration,
  EnumDeclaration,
  MethodDeclaration,
  MethodSignature,
  PropertyDeclaration,
  PropertySignature,
  ParameterDeclaration,
  Scope,
} from 'ts-morph';

import type {
  ClassInfo,
  CodeInventory,
  CodeInventorySummary,
  CodeReaderConfig,
  CodeReadingResult,
  CodeReadingSession,
  CodeStatistics,
  DependencyAnalysis,
  EnumInfo,
  EnumMemberInfo,
  ExportInfo,
  ExportType,
  ExternalDependency,
  FunctionInfo,
  ImportInfo,
  InterfaceInfo,
  InternalDependency,
  MethodInfo,
  ModuleStatistics,
  ParameterInfo,
  ParsedModule,
  PropertyInfo,
  TypeAliasInfo,
  Visibility,
  CircularDependency,
} from './types.js';
import { DEFAULT_CODE_READER_CONFIG } from './types.js';
import {
  NoActiveSessionError,
  OutputWriteError,
  SourceDirectoryNotFoundError,
  TooManyParseErrorsError,
} from './errors.js';

// YAML import with dynamic loading for compatibility
let yaml: { dump: (obj: unknown) => string } | null = null;

async function loadYaml(): Promise<void> {
  if (yaml === null) {
    const jsYaml = await import('js-yaml');
    yaml = { dump: jsYaml.dump };
  }
}

/**
 * Code Reader Agent class
 *
 * Responsible for:
 * - Parsing TypeScript/JavaScript source files
 * - Extracting classes, functions, interfaces, and types
 * - Building dependency graphs
 * - Generating code_inventory.yaml output
 */
export class CodeReaderAgent {
  private readonly config: Required<CodeReaderConfig>;
  private session: CodeReadingSession | null = null;
  private project: Project | null = null;

  constructor(config: CodeReaderConfig = {}) {
    this.config = { ...DEFAULT_CODE_READER_CONFIG, ...config };
  }

  /**
   * Start a new code reading session
   * @param projectId
   */
  public async startSession(projectId: string): Promise<CodeReadingSession> {
    await loadYaml();

    this.session = {
      sessionId: randomUUID(),
      projectId,
      status: 'analyzing',
      modules: [],
      inventory: null,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      filesProcessed: 0,
      filesWithErrors: [],
      warnings: [],
      errors: [],
    };

    return this.session;
  }

  /**
   * Read and analyze all source code in the project
   */
  public async analyzeCode(): Promise<CodeReadingResult> {
    const session = this.ensureSession();
    const startTime = Date.now();
    const warnings: string[] = [];

    try {
      // Update session status
      this.session = { ...session, status: 'processing', updatedAt: new Date().toISOString() };

      // Check source directory exists
      const sourceRootPath = path.resolve(this.config.sourceRoot);
      try {
        await fs.access(sourceRootPath);
      } catch {
        throw new SourceDirectoryNotFoundError(sourceRootPath);
      }

      // Initialize TypeScript project
      this.project = new Project({
        skipAddingFilesFromTsConfig: true,
        skipFileDependencyResolution: false,
        compilerOptions: {
          allowJs: true,
          declaration: false,
          noEmit: true,
        },
      });

      // Discover and add source files
      const sourceFiles = await this.discoverSourceFiles(sourceRootPath);

      // Check for too many parse errors (category 1 = Error)
      const parseErrors = this.project
        .getPreEmitDiagnostics()
        .filter((d) => (d.getCategory() as number) === 1);
      if (parseErrors.length > sourceFiles.length * 0.5) {
        throw new TooManyParseErrorsError(parseErrors.length, sourceFiles.length, 0.5);
      }

      // Group files by module (directory)
      const moduleMap = this.groupFilesByModule(sourceFiles, sourceRootPath);

      // Parse each module
      const parsedModules: ParsedModule[] = [];
      for (const [moduleName, files] of moduleMap.entries()) {
        const parsedModule = this.parseModule(moduleName, files, sourceRootPath);
        parsedModules.push(parsedModule);
      }

      // Update session with parsed modules
      this.session = {
        ...this.session,
        modules: parsedModules,
        filesProcessed: sourceFiles.length,
        updatedAt: new Date().toISOString(),
      };

      // Build dependency analysis
      const dependencies = this.analyzeDependencies(parsedModules);

      // Calculate statistics
      const summary = this.calculateSummary(parsedModules);
      const statistics = this.calculateStatistics(parsedModules);

      // Build code inventory
      const inventory: CodeInventory = {
        project: {
          name: session.projectId,
          analyzedAt: new Date().toISOString(),
          rootPath: sourceRootPath,
        },
        summary,
        modules: parsedModules,
        dependencies,
        statistics,
      };

      // Write output
      const outputPath = await this.writeCodeInventory(session.projectId, inventory);

      // Update session
      this.session = {
        ...this.session,
        status: 'completed',
        inventory,
        warnings,
        updatedAt: new Date().toISOString(),
      };

      const processingTimeMs = Date.now() - startTime;

      return {
        success: true,
        projectId: session.projectId,
        outputPath,
        inventory,
        stats: {
          filesProcessed: sourceFiles.length,
          filesWithErrors: this.session.filesWithErrors.length,
          modulesDiscovered: parsedModules.length,
          classesExtracted: summary.totalClasses,
          functionsExtracted: summary.totalFunctions,
          interfacesExtracted: summary.totalInterfaces,
          typesExtracted: summary.totalTypes,
          dependenciesMapped: dependencies.internal.length + dependencies.external.length,
          processingTimeMs,
        },
        warnings,
      };
    } catch (error) {
      const currentSession = this.session;
      if (currentSession !== null) {
        this.session = {
          ...currentSession,
          status: 'failed',
          errors: [
            ...currentSession.errors,
            error instanceof Error ? error.message : String(error),
          ],
          updatedAt: new Date().toISOString(),
        };
      }
      throw error;
    }
  }

  /**
   * Get the current session
   */
  public getSession(): CodeReadingSession | null {
    return this.session;
  }

  /**
   * Reset the agent state
   */
  public reset(): void {
    this.session = null;
    this.project = null;
  }

  // ============ Private Helper Methods ============

  private ensureSession(): CodeReadingSession {
    if (this.session === null) {
      throw new NoActiveSessionError();
    }
    return this.session;
  }

  private async discoverSourceFiles(sourceRootPath: string): Promise<SourceFile[]> {
    const sourceFiles: SourceFile[] = [];

    // Build glob patterns
    const includePatterns = this.config.includePatterns.map((p) => path.join(sourceRootPath, p));

    // Add files matching patterns
    const project = this.project;
    if (project === null) {
      return [];
    }

    for (const pattern of includePatterns) {
      project.addSourceFilesAtPaths(pattern);
    }

    // Get all added source files
    const allFiles = project.getSourceFiles();

    // Filter out excluded patterns
    for (const file of allFiles) {
      const filePath = file.getFilePath();
      const relativePath = path.relative(sourceRootPath, filePath);

      // Check if file matches any exclude pattern
      const isExcluded = this.config.excludePatterns.some((pattern) => {
        // Simple glob matching for common patterns
        if (pattern.includes('**')) {
          const regexPattern = pattern
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*')
            .replace(/\./g, '\\.');
          return new RegExp(regexPattern).test(relativePath);
        }
        return relativePath.includes(pattern.replace(/\*/g, ''));
      });

      if (!isExcluded) {
        // Check file size
        try {
          const stats = await fs.stat(filePath);
          if (stats.size <= this.config.maxFileSize) {
            sourceFiles.push(file);
          } else {
            const currentSession = this.session;
            if (currentSession !== null) {
              this.session = {
                ...currentSession,
                warnings: [
                  ...currentSession.warnings,
                  `Skipping large file: ${filePath} (${(stats.size / 1024 / 1024).toFixed(2)}MB)`,
                ],
              };
            }
          }
        } catch {
          // File might have been deleted, skip
        }
      }
    }

    return sourceFiles;
  }

  private groupFilesByModule(
    sourceFiles: SourceFile[],
    sourceRootPath: string
  ): Map<string, SourceFile[]> {
    const moduleMap = new Map<string, SourceFile[]>();

    for (const file of sourceFiles) {
      const filePath = file.getFilePath();
      const relativePath = path.relative(sourceRootPath, filePath);
      const parts = relativePath.split(path.sep);

      // Module name is the first directory level, or 'root' for files directly in source root
      const moduleName = parts.length > 1 ? (parts[0] ?? 'root') : 'root';

      const files = moduleMap.get(moduleName) ?? [];
      files.push(file);
      moduleMap.set(moduleName, files);
    }

    return moduleMap;
  }

  private parseModule(
    moduleName: string,
    files: SourceFile[],
    sourceRootPath: string
  ): ParsedModule {
    const classes: ClassInfo[] = [];
    const functions: FunctionInfo[] = [];
    const interfaces: InterfaceInfo[] = [];
    const types: TypeAliasInfo[] = [];
    const enums: EnumInfo[] = [];
    const exports: ExportInfo[] = [];
    const imports: ImportInfo[] = [];
    const sourceFilePaths: string[] = [];

    let totalLoc = 0;

    for (const file of files) {
      sourceFilePaths.push(path.relative(sourceRootPath, file.getFilePath()));
      totalLoc += file.getEndLineNumber();

      // Extract classes
      for (const classDecl of file.getClasses()) {
        classes.push(this.extractClassInfo(classDecl));
      }

      // Extract functions
      for (const funcDecl of file.getFunctions()) {
        functions.push(this.extractFunctionInfo(funcDecl));
      }

      // Extract interfaces
      for (const intfDecl of file.getInterfaces()) {
        interfaces.push(this.extractInterfaceInfo(intfDecl));
      }

      // Extract type aliases
      for (const typeDecl of file.getTypeAliases()) {
        types.push(this.extractTypeAliasInfo(typeDecl));
      }

      // Extract enums
      for (const enumDecl of file.getEnums()) {
        enums.push(this.extractEnumInfo(enumDecl));
      }

      // Extract exports
      for (const exportDecl of file.getExportDeclarations()) {
        const moduleSpecifier = exportDecl.getModuleSpecifierValue();
        for (const namedExport of exportDecl.getNamedExports()) {
          exports.push({
            name: namedExport.getName(),
            type: 'const' as ExportType, // Default, actual type determined elsewhere
            isDefault: false,
            isReExport: moduleSpecifier !== undefined,
            sourceModule: moduleSpecifier,
          });
        }
      }

      // Extract imports
      for (const importDecl of file.getImportDeclarations()) {
        const moduleSpecifier = importDecl.getModuleSpecifierValue();
        const isExternal = !moduleSpecifier.startsWith('.') && !moduleSpecifier.startsWith('/');

        const namedImports = importDecl.getNamedImports().map((ni) => ni.getName());
        const namespaceImport = importDecl.getNamespaceImport();
        const defaultImport = importDecl.getDefaultImport();

        imports.push({
          source: moduleSpecifier,
          items: namedImports,
          isExternal,
          isNamespaceImport: namespaceImport !== undefined,
          namespace: namespaceImport?.getText(),
          hasDefaultImport: defaultImport !== undefined,
          defaultImportName: defaultImport?.getText(),
        });
      }
    }

    const statistics: ModuleStatistics = {
      linesOfCode: totalLoc,
      classCount: classes.length,
      functionCount: functions.length,
      interfaceCount: interfaces.length,
      typeCount: types.length,
      enumCount: enums.length,
      exportCount: exports.length,
      importCount: imports.length,
    };

    return {
      name: moduleName,
      path: moduleName === 'root' ? sourceRootPath : path.join(sourceRootPath, moduleName),
      sourceFiles: sourceFilePaths,
      classes,
      functions,
      interfaces,
      types,
      enums,
      exports,
      imports,
      statistics,
    };
  }

  private extractClassInfo(classDecl: ClassDeclaration): ClassInfo {
    const methods: MethodInfo[] = [];
    const properties: PropertyInfo[] = [];

    // Extract methods
    for (const method of classDecl.getMethods()) {
      if (!this.config.extractPrivate && this.getVisibility(method) === 'private') {
        continue;
      }
      methods.push(this.extractMethodInfo(method));
    }

    // Extract properties
    for (const prop of classDecl.getProperties()) {
      if (!this.config.extractPrivate && this.getPropertyVisibility(prop) === 'private') {
        continue;
      }
      properties.push(this.extractPropertyInfo(prop));
    }

    const extendsClause = classDecl.getExtends();
    const implementsClauses = classDecl.getImplements();

    const className = classDecl.getName();
    return {
      name: className !== undefined ? className : 'Anonymous',
      exported: classDecl.isExported(),
      abstract: classDecl.isAbstract(),
      extends: extendsClause?.getText() ?? null,
      implements: implementsClauses.map((i) => i.getText()),
      methods,
      properties,
      isDefaultExport: classDecl.isDefaultExport(),
      description: this.getJsDocDescription(classDecl),
      lineNumber: classDecl.getStartLineNumber(),
    };
  }

  private extractMethodInfo(method: MethodDeclaration): MethodInfo {
    return {
      name: method.getName(),
      visibility: this.getVisibility(method),
      static: method.isStatic(),
      async: method.isAsync(),
      abstract: method.isAbstract(),
      parameters: method.getParameters().map((p) => this.extractParameterInfo(p)),
      returnType: method.getReturnType().getText(),
      description: this.getJsDocDescription(method),
      lineNumber: method.getStartLineNumber(),
    };
  }

  private extractPropertyInfo(prop: PropertyDeclaration | PropertySignature): PropertyInfo {
    const isClassProperty = prop instanceof PropertyDeclaration;
    const classProp = isClassProperty ? prop : null;

    return {
      name: prop.getName(),
      type: prop.getType().getText(),
      visibility: classProp !== null ? this.getPropertyVisibility(classProp) : undefined,
      static: classProp !== null ? classProp.isStatic() : undefined,
      readonly: prop.isReadonly(),
      optional: prop.hasQuestionToken(),
      description: this.getJsDocDescription(prop),
    };
  }

  private extractParameterInfo(param: ParameterDeclaration): ParameterInfo {
    return {
      name: param.getName(),
      type: param.getType().getText(),
      optional: param.isOptional(),
      defaultValue: param.getInitializer()?.getText(),
      isRest: param.isRestParameter(),
    };
  }

  private extractFunctionInfo(funcDecl: FunctionDeclaration): FunctionInfo {
    const funcName = funcDecl.getName();
    const returnType = funcDecl.getReturnType().getText();
    return {
      name: funcName !== undefined ? funcName : 'anonymous',
      exported: funcDecl.isExported(),
      async: funcDecl.isAsync(),
      generator: funcDecl.isGenerator(),
      parameters: funcDecl.getParameters().map((p) => this.extractParameterInfo(p)),
      returnType: returnType.length > 0 ? returnType : 'void',
      isDefaultExport: funcDecl.isDefaultExport(),
      description: this.getJsDocDescription(funcDecl),
      lineNumber: funcDecl.getStartLineNumber(),
    };
  }

  private extractInterfaceInfo(intfDecl: InterfaceDeclaration): InterfaceInfo {
    const properties: PropertyInfo[] = [];
    const methods: MethodInfo[] = [];

    // Extract properties
    for (const prop of intfDecl.getProperties()) {
      properties.push({
        name: prop.getName(),
        type: prop.getType().getText(),
        readonly: prop.isReadonly(),
        optional: prop.hasQuestionToken(),
        description: this.getJsDocDescription(prop),
      });
    }

    // Extract methods
    for (const method of intfDecl.getMethods()) {
      methods.push({
        name: method.getName(),
        visibility: 'public',
        static: false,
        async: false,
        abstract: false,
        parameters: method.getParameters().map((p) => this.extractParameterInfo(p)),
        returnType: method.getReturnType().getText() || 'void',
        description: this.getJsDocDescription(method),
        lineNumber: method.getStartLineNumber(),
      });
    }

    const extendsClauses = intfDecl.getExtends();

    return {
      name: intfDecl.getName(),
      exported: intfDecl.isExported(),
      extends: extendsClauses.map((e) => e.getText()),
      properties,
      methods,
      isDefaultExport: intfDecl.isDefaultExport(),
      description: this.getJsDocDescription(intfDecl),
      lineNumber: intfDecl.getStartLineNumber(),
    };
  }

  private extractTypeAliasInfo(typeDecl: TypeAliasDeclaration): TypeAliasInfo {
    return {
      name: typeDecl.getName(),
      exported: typeDecl.isExported(),
      definition: typeDecl.getType().getText(),
      isDefaultExport: typeDecl.isDefaultExport(),
      description: this.getJsDocDescription(typeDecl),
      lineNumber: typeDecl.getStartLineNumber(),
    };
  }

  private extractEnumInfo(enumDecl: EnumDeclaration): EnumInfo {
    const members: EnumMemberInfo[] = enumDecl.getMembers().map((m) => ({
      name: m.getName(),
      value: m.getValue(),
    }));

    return {
      name: enumDecl.getName(),
      exported: enumDecl.isExported(),
      isConst: enumDecl.isConstEnum(),
      members,
      isDefaultExport: enumDecl.isDefaultExport(),
      description: this.getJsDocDescription(enumDecl),
      lineNumber: enumDecl.getStartLineNumber(),
    };
  }

  private getVisibility(method: MethodDeclaration): Visibility {
    const scope = method.getScope();
    if (scope === Scope.Private) return 'private';
    if (scope === Scope.Protected) return 'protected';
    return 'public';
  }

  private getPropertyVisibility(prop: PropertyDeclaration): Visibility {
    const scope = prop.getScope();
    if (scope === Scope.Private) return 'private';
    if (scope === Scope.Protected) return 'protected';
    return 'public';
  }

  private getJsDocDescription(
    node:
      | ClassDeclaration
      | MethodDeclaration
      | MethodSignature
      | PropertyDeclaration
      | PropertySignature
      | FunctionDeclaration
      | InterfaceDeclaration
      | TypeAliasDeclaration
      | EnumDeclaration
  ): string | undefined {
    if (!this.config.includeComments) return undefined;

    try {
      // Check if node has getJsDocs method
      if (!('getJsDocs' in node) || typeof node.getJsDocs !== 'function') {
        return undefined;
      }

      const jsDocs = node.getJsDocs();
      if (jsDocs.length === 0) return undefined;

      const firstDoc = jsDocs[0];
      if (!firstDoc) return undefined;

      const description = firstDoc.getDescription();
      return description.trim() || undefined;
    } catch {
      // If JSDoc parsing fails, return undefined
      return undefined;
    }
  }

  private analyzeDependencies(modules: ParsedModule[]): DependencyAnalysis {
    const internal: InternalDependency[] = [];
    const externalMap = new Map<string, { count: number; files: string[] }>();
    const circular: CircularDependency[] = [];

    // Build module name set for quick lookup
    const moduleNames = new Set(modules.map((m) => m.name));

    // Analyze each module's imports
    for (const module of modules) {
      const internalDeps = new Map<string, string[]>();

      for (const imp of module.imports) {
        if (imp.isExternal) {
          // External dependency
          const existing = externalMap.get(imp.source) ?? { count: 0, files: [] };
          existing.count++;
          existing.files.push(module.name);
          externalMap.set(imp.source, existing);
        } else {
          // Internal dependency - resolve module name
          const targetModule = this.resolveModuleName(imp.source, module.name, moduleNames);
          if (targetModule !== null && targetModule !== module.name) {
            const existing = internalDeps.get(targetModule) ?? [];
            existing.push(...imp.items);
            if (
              imp.hasDefaultImport &&
              imp.defaultImportName !== undefined &&
              imp.defaultImportName.length > 0
            ) {
              existing.push(imp.defaultImportName);
            }
            internalDeps.set(targetModule, existing);
          }
        }
      }

      // Add internal dependencies
      for (const [target, imports] of internalDeps) {
        internal.push({
          from: module.name,
          to: target,
          imports,
        });
      }
    }

    // Convert external map to array
    const external: ExternalDependency[] = Array.from(externalMap.entries()).map(
      ([module, data]) => ({
        module,
        importCount: data.count,
        importedBy: data.files,
      })
    );

    // Detect circular dependencies
    const graph = new Map<string, Set<string>>();
    for (const dep of internal) {
      const deps = graph.get(dep.from) ?? new Set();
      deps.add(dep.to);
      graph.set(dep.from, deps);
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const detectCycle = (node: string, path: string[]): void => {
      visited.add(node);
      recursionStack.add(node);

      const neighbors = graph.get(node) ?? new Set();
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          detectCycle(neighbor, [...path, neighbor]);
        } else if (recursionStack.has(neighbor)) {
          // Found cycle
          const cycleStart = path.indexOf(neighbor);
          const cycle = cycleStart >= 0 ? path.slice(cycleStart) : [...path, neighbor];
          circular.push({
            modules: cycle,
            severity: cycle.length > 3 ? 'error' : 'warning',
          });
        }
      }

      recursionStack.delete(node);
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        detectCycle(node, [node]);
      }
    }

    return { internal, external, circular };
  }

  private resolveModuleName(
    importPath: string,
    currentModule: string,
    moduleNames: Set<string>
  ): string | null {
    // Handle relative imports
    if (importPath.startsWith('.')) {
      const parts = importPath.split('/');
      // Go up directories
      let upCount = 0;
      for (const part of parts) {
        if (part === '..') upCount++;
        else if (part !== '.') break;
      }

      // If going up from root or one level, try to find target module
      const targetParts = parts.filter((p) => p !== '.' && p !== '..');
      if (targetParts.length > 0) {
        const targetModule = targetParts[0];
        if (
          targetModule !== undefined &&
          targetModule.length > 0 &&
          moduleNames.has(targetModule)
        ) {
          return targetModule;
        }
      }

      // If staying in same module
      if (upCount === 0 || (upCount === 1 && currentModule !== 'root')) {
        return currentModule;
      }
    }

    return null;
  }

  private calculateSummary(modules: ParsedModule[]): CodeInventorySummary {
    let totalClasses = 0;
    let totalFunctions = 0;
    let totalInterfaces = 0;
    let totalTypes = 0;
    let totalEnums = 0;
    let totalLines = 0;

    for (const module of modules) {
      totalClasses += module.statistics.classCount;
      totalFunctions += module.statistics.functionCount;
      totalInterfaces += module.statistics.interfaceCount;
      totalTypes += module.statistics.typeCount;
      totalEnums += module.statistics.enumCount;
      totalLines += module.statistics.linesOfCode;
    }

    return {
      totalModules: modules.length,
      totalClasses,
      totalFunctions,
      totalInterfaces,
      totalTypes,
      totalEnums,
      totalLines,
    };
  }

  private calculateStatistics(modules: ParsedModule[]): CodeStatistics {
    const byModule = modules.map((m) => ({
      name: m.name,
      loc: m.statistics.linesOfCode,
      classes: m.statistics.classCount,
      functions: m.statistics.functionCount,
      interfaces: m.statistics.interfaceCount,
      types: m.statistics.typeCount,
    }));

    const summary = this.calculateSummary(modules);
    const filesAnalyzed = modules.reduce((acc, m) => acc + m.sourceFiles.length, 0);

    return {
      byModule,
      totals: {
        filesAnalyzed,
        totalLoc: summary.totalLines,
        avgLocPerFile: filesAnalyzed > 0 ? Math.round(summary.totalLines / filesAnalyzed) : 0,
        totalClasses: summary.totalClasses,
        totalFunctions: summary.totalFunctions,
        totalInterfaces: summary.totalInterfaces,
        totalTypes: summary.totalTypes,
        totalEnums: summary.totalEnums,
      },
    };
  }

  private async writeCodeInventory(projectId: string, inventory: CodeInventory): Promise<string> {
    const outputDir = path.join(this.config.scratchpadBasePath, 'analysis', projectId);
    const outputPath = path.join(outputDir, 'code_inventory.yaml');

    try {
      await fs.mkdir(outputDir, { recursive: true });

      // Ensure yaml is loaded
      if (yaml === null) {
        await loadYaml();
      }
      const yamlModule = yaml;
      if (yamlModule === null) {
        throw new Error('YAML module failed to load');
      }

      // Convert to YAML-friendly format (snake_case)
      const yamlContent = yamlModule.dump({
        code_inventory: {
          project: inventory.project,
          summary: {
            total_modules: inventory.summary.totalModules,
            total_classes: inventory.summary.totalClasses,
            total_functions: inventory.summary.totalFunctions,
            total_interfaces: inventory.summary.totalInterfaces,
            total_types: inventory.summary.totalTypes,
            total_enums: inventory.summary.totalEnums,
            total_lines: inventory.summary.totalLines,
          },
          modules: inventory.modules.map((m) => ({
            name: m.name,
            path: m.path,
            source_files: m.sourceFiles,
            classes: m.classes.map((c) => ({
              name: c.name,
              exported: c.exported,
              abstract: c.abstract,
              extends: c.extends,
              implements: c.implements,
              methods: c.methods.map((method) => ({
                name: method.name,
                visibility: method.visibility,
                static: method.static,
                async: method.async,
                parameters: method.parameters.map((p) => ({
                  name: p.name,
                  type: p.type,
                  optional: p.optional,
                })),
                return_type: method.returnType,
              })),
              properties: c.properties.map((p) => ({
                name: p.name,
                type: p.type,
                visibility: p.visibility,
                readonly: p.readonly,
              })),
              line_number: c.lineNumber,
            })),
            functions: m.functions.map((f) => ({
              name: f.name,
              exported: f.exported,
              async: f.async,
              parameters: f.parameters.map((p) => ({
                name: p.name,
                type: p.type,
                optional: p.optional,
              })),
              return_type: f.returnType,
              line_number: f.lineNumber,
            })),
            interfaces: m.interfaces.map((i) => ({
              name: i.name,
              exported: i.exported,
              extends: i.extends,
              properties: i.properties.map((p) => ({
                name: p.name,
                type: p.type,
                readonly: p.readonly,
                optional: p.optional,
              })),
              line_number: i.lineNumber,
            })),
            types: m.types.map((t) => ({
              name: t.name,
              exported: t.exported,
              definition: t.definition,
              line_number: t.lineNumber,
            })),
            enums: m.enums.map((e) => ({
              name: e.name,
              exported: e.exported,
              is_const: e.isConst,
              members: e.members,
              line_number: e.lineNumber,
            })),
            statistics: {
              lines_of_code: m.statistics.linesOfCode,
              class_count: m.statistics.classCount,
              function_count: m.statistics.functionCount,
              interface_count: m.statistics.interfaceCount,
              type_count: m.statistics.typeCount,
            },
          })),
          dependencies: {
            internal: inventory.dependencies.internal.map((d) => ({
              from: d.from,
              to: d.to,
              imports: d.imports,
            })),
            external: inventory.dependencies.external.map((d) => ({
              module: d.module,
              import_count: d.importCount,
              imported_by: d.importedBy,
            })),
            circular: inventory.dependencies.circular.map((c) => ({
              modules: c.modules,
              severity: c.severity,
            })),
          },
          statistics: {
            by_module: inventory.statistics.byModule.map((s) => ({
              name: s.name,
              loc: s.loc,
              classes: s.classes,
              functions: s.functions,
            })),
            totals: {
              files_analyzed: inventory.statistics.totals.filesAnalyzed,
              total_loc: inventory.statistics.totals.totalLoc,
              avg_loc_per_file: inventory.statistics.totals.avgLocPerFile,
              total_classes: inventory.statistics.totals.totalClasses,
              total_functions: inventory.statistics.totals.totalFunctions,
              total_interfaces: inventory.statistics.totals.totalInterfaces,
              total_types: inventory.statistics.totals.totalTypes,
            },
          },
        },
      });

      await fs.writeFile(outputPath, yamlContent, 'utf-8');
      return outputPath;
    } catch (error) {
      throw new OutputWriteError(
        outputPath,
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}

// ============ Singleton Pattern ============

let globalCodeReaderAgent: CodeReaderAgent | null = null;

/**
 * Get the global Code Reader Agent instance
 * @param config
 */
export function getCodeReaderAgent(config?: CodeReaderConfig): CodeReaderAgent {
  if (globalCodeReaderAgent === null) {
    globalCodeReaderAgent = new CodeReaderAgent(config);
  }
  return globalCodeReaderAgent;
}

/**
 * Reset the global Code Reader Agent instance
 */
export function resetCodeReaderAgent(): void {
  if (globalCodeReaderAgent !== null) {
    globalCodeReaderAgent.reset();
    globalCodeReaderAgent = null;
  }
}
