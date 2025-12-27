/**
 * Test Generator module
 *
 * Generates comprehensive unit tests for source code following
 * best practices including AAA pattern, proper mocking, and
 * coverage targeting.
 *
 * @module worker/TestGenerator
 */

import { join, dirname, basename, extname } from 'node:path';
import type {
  TestGeneratorConfig,
  TestGenerationResult,
  TestSuite,
  TestSuiteBlock,
  TestCase,
  TestCategory,
  MockDependency,
  CodeAnalysis,
  ClassInfo,
  FunctionInfo,
  MethodInfo,
  ParameterInfo,
  DependencyInfo,
  ExportInfo,
  PropertyInfo,
  CodePatterns,
  FileContext,
} from './types.js';
import { DEFAULT_TEST_GENERATOR_CONFIG } from './types.js';

/**
 * Test Generator
 *
 * Analyzes source code and generates comprehensive test suites
 * with proper structure, mocking, and coverage targeting.
 */
export class TestGenerator {
  private readonly config: Required<TestGeneratorConfig>;

  constructor(config: TestGeneratorConfig = {}) {
    this.config = {
      coverageTarget: config.coverageTarget ?? DEFAULT_TEST_GENERATOR_CONFIG.coverageTarget,
      namingConvention: config.namingConvention ?? DEFAULT_TEST_GENERATOR_CONFIG.namingConvention,
      includeEdgeCases: config.includeEdgeCases ?? DEFAULT_TEST_GENERATOR_CONFIG.includeEdgeCases,
      includeErrorHandling:
        config.includeErrorHandling ?? DEFAULT_TEST_GENERATOR_CONFIG.includeErrorHandling,
      includeIntegration:
        config.includeIntegration ?? DEFAULT_TEST_GENERATOR_CONFIG.includeIntegration,
      mockStrategy: config.mockStrategy ?? DEFAULT_TEST_GENERATOR_CONFIG.mockStrategy,
      testFilePattern: config.testFilePattern ?? DEFAULT_TEST_GENERATOR_CONFIG.testFilePattern,
    };
  }

  /**
   * Generate tests for a source file
   */
  public generateTests(
    sourceFile: string,
    sourceContent: string,
    patterns: CodePatterns
  ): TestSuite {
    const analysis = this.analyzeCode(sourceContent);
    const testFile = this.getTestFilePath(sourceFile);
    const detectedFramework = patterns.testFramework ?? 'vitest';
    const framework: 'jest' | 'vitest' | 'mocha' =
      detectedFramework === 'other' ? 'vitest' : detectedFramework;

    const suites: TestSuiteBlock[] = [];
    let totalTests = 0;

    // Generate tests for classes
    for (const classInfo of analysis.classes) {
      if (classInfo.isExported) {
        const suite = this.generateClassTestSuite(classInfo, analysis.dependencies);
        suites.push(suite);
        totalTests += this.countTests(suite);
      }
    }

    // Generate tests for standalone functions
    for (const funcInfo of analysis.functions) {
      if (funcInfo.isExported) {
        const suite = this.generateFunctionTestSuite(funcInfo, analysis.dependencies);
        suites.push(suite);
        totalTests += this.countTests(suite);
      }
    }

    const estimatedCoverage = this.estimateCoverage(analysis, totalTests);

    return {
      sourceFile,
      testFile,
      framework,
      suites,
      totalTests,
      estimatedCoverage,
    };
  }

  /**
   * Generate tests for multiple files
   */
  public generateTestsForFiles(
    files: readonly FileContext[],
    patterns: CodePatterns
  ): TestGenerationResult {
    const testSuites: TestSuite[] = [];
    const warnings: string[] = [];
    let totalTests = 0;

    const coverageByCategory: Record<TestCategory, number> = {
      happy_path: 0,
      edge_case: 0,
      error_handling: 0,
      integration: 0,
    };

    for (const file of files) {
      // Only process TypeScript/JavaScript files
      const ext = extname(file.path);
      if (!['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
        continue;
      }

      // Skip test files
      if (file.path.includes('.test.') || file.path.includes('.spec.')) {
        continue;
      }

      try {
        const suite = this.generateTests(file.path, file.content, patterns);
        testSuites.push(suite);
        totalTests += suite.totalTests;

        // Count tests by category
        for (const suiteBlock of suite.suites) {
          this.countTestsByCategory(suiteBlock, coverageByCategory);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        warnings.push(`Failed to generate tests for ${file.path}: ${errorMessage}`);
      }
    }

    const estimatedCoverage =
      testSuites.length > 0
        ? testSuites.reduce((sum, s) => sum + s.estimatedCoverage, 0) / testSuites.length
        : 0;

    return {
      testSuites,
      totalTests,
      estimatedCoverage,
      coverageByCategory,
      warnings,
    };
  }

  /**
   * Analyze source code to extract testable elements
   */
  public analyzeCode(content: string): CodeAnalysis {
    const classes = this.extractClasses(content);
    const functions = this.extractFunctions(content);
    const dependencies = this.extractDependencies(content);
    const exports = this.extractExports(content);

    return {
      classes,
      functions,
      dependencies,
      exports,
    };
  }

  /**
   * Generate test file content
   */
  public generateTestFileContent(suite: TestSuite, patterns: CodePatterns): string {
    const lines: string[] = [];
    const indent = patterns.indentation === 'tabs' ? '\t' : ' '.repeat(patterns.indentSize);
    const quote = patterns.quoteStyle === 'single' ? "'" : '"';
    const semi = patterns.useSemicolons ? ';' : '';

    // Generate imports
    lines.push(this.generateImports(suite, quote, semi));
    lines.push('');

    // Generate test suites
    for (const suiteBlock of suite.suites) {
      lines.push(this.generateSuiteBlock(suiteBlock, indent, quote, semi, 0));
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Extract class information from source code
   */
  private extractClasses(content: string): readonly ClassInfo[] {
    const classes: ClassInfo[] = [];
    const lines = content.split('\n');

    // Pattern to match class declarations
    const classPattern = /^(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*\{/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      const match = line.match(classPattern);
      if (match !== null && match[1] !== undefined) {
        const className = match[1];
        const isExported = line.includes('export');
        const classContent = this.extractBlockContent(lines, i);

        const constructorParams = this.extractConstructorParams(classContent);
        const methods = this.extractMethods(classContent);
        const properties = this.extractProperties(classContent);

        classes.push({
          name: className,
          constructorParams,
          methods,
          properties,
          isExported,
          lineNumber: i + 1,
        });
      }
    }

    return classes;
  }

  /**
   * Extract function information from source code
   */
  private extractFunctions(content: string): readonly FunctionInfo[] {
    const functions: FunctionInfo[] = [];
    const lines = content.split('\n');

    // Pattern to match function declarations (excluding methods inside classes)
    const functionPattern =
      /^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]+>)?\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?\s*\{/;
    const arrowPattern =
      /^(?:export\s+)?(?:const|let)\s+(\w+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s+)?\([^)]*\)\s*(?::\s*[^=]+)?\s*=>/;

    let inClass = false;
    let braceCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      // Track class boundaries
      if (line.match(/^(?:export\s+)?class\s+/) !== null) {
        inClass = true;
        braceCount = 1;
        continue;
      }

      if (inClass) {
        braceCount += (line.match(/\{/g) ?? []).length;
        braceCount -= (line.match(/\}/g) ?? []).length;
        if (braceCount <= 0) {
          inClass = false;
        }
        continue;
      }

      // Match regular functions
      const funcMatch = line.match(functionPattern);
      if (funcMatch !== null && funcMatch[1] !== undefined) {
        const params = this.parseParameters(funcMatch[2] ?? '');
        const returnType = (funcMatch[3] ?? 'void').trim();
        const isAsync = line.includes('async');

        functions.push({
          name: funcMatch[1],
          params,
          returnType,
          isAsync,
          isExported: line.includes('export'),
          complexity: this.estimateComplexity(this.extractBlockContent(lines, i)),
          lineNumber: i + 1,
        });
        continue;
      }

      // Match arrow functions
      const arrowMatch = line.match(arrowPattern);
      if (arrowMatch !== null && arrowMatch[1] !== undefined) {
        const paramsMatch = line.match(/\(([^)]*)\)/);
        const params = this.parseParameters(paramsMatch?.[1] ?? '');
        const returnMatch = line.match(/\)\s*:\s*([^=]+)\s*=>/);
        const returnType = returnMatch?.[1]?.trim() ?? 'unknown';
        const isAsync = line.includes('async');

        functions.push({
          name: arrowMatch[1],
          params,
          returnType,
          isAsync,
          isExported: line.includes('export'),
          complexity: 1,
          lineNumber: i + 1,
        });
      }
    }

    return functions;
  }

  /**
   * Extract dependencies from import statements
   */
  private extractDependencies(content: string): readonly DependencyInfo[] {
    const dependencies: DependencyInfo[] = [];
    const lines = content.split('\n');

    const importPattern = /^import\s+(?:type\s+)?(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/;
    const importAllPattern = /^import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/;

    for (const line of lines) {
      const match = line.match(importPattern);
      if (match !== null) {
        const namedImports = match[1]?.split(',').map((s) => s.trim().split(' ')[0] ?? '') ?? [];
        const defaultImport = match[2];
        const module = match[3] ?? '';

        const imports = defaultImport !== undefined ? [defaultImport, ...namedImports] : namedImports;

        dependencies.push({
          module,
          imports: imports.filter((i) => i !== ''),
          isTypeOnly: line.includes('import type'),
          isExternal: !module.startsWith('.') && !module.startsWith('/'),
        });
        continue;
      }

      const allMatch = line.match(importAllPattern);
      if (allMatch !== null && allMatch[1] !== undefined && allMatch[2] !== undefined) {
        dependencies.push({
          module: allMatch[2],
          imports: [allMatch[1]],
          isTypeOnly: false,
          isExternal: !allMatch[2].startsWith('.') && !allMatch[2].startsWith('/'),
        });
      }
    }

    return dependencies;
  }

  /**
   * Extract export statements
   */
  private extractExports(content: string): readonly ExportInfo[] {
    const exports: ExportInfo[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      // Export class
      if (line.match(/^export\s+(?:default\s+)?class\s+(\w+)/) !== null) {
        const match = line.match(/class\s+(\w+)/);
        if (match !== null && match[1] !== undefined) {
          exports.push({
            name: match[1],
            type: 'class',
            isDefault: line.includes('default'),
          });
        }
        continue;
      }

      // Export function
      if (line.match(/^export\s+(?:default\s+)?(?:async\s+)?function\s+(\w+)/) !== null) {
        const match = line.match(/function\s+(\w+)/);
        if (match !== null && match[1] !== undefined) {
          exports.push({
            name: match[1],
            type: 'function',
            isDefault: line.includes('default'),
          });
        }
        continue;
      }

      // Export const
      if (line.match(/^export\s+(?:default\s+)?const\s+(\w+)/) !== null) {
        const match = line.match(/const\s+(\w+)/);
        if (match !== null && match[1] !== undefined) {
          exports.push({
            name: match[1],
            type: 'const',
            isDefault: line.includes('default'),
          });
        }
        continue;
      }

      // Export type
      if (line.match(/^export\s+type\s+(\w+)/) !== null) {
        const match = line.match(/type\s+(\w+)/);
        if (match !== null && match[1] !== undefined) {
          exports.push({
            name: match[1],
            type: 'type',
            isDefault: false,
          });
        }
        continue;
      }

      // Export interface
      if (line.match(/^export\s+interface\s+(\w+)/) !== null) {
        const match = line.match(/interface\s+(\w+)/);
        if (match !== null && match[1] !== undefined) {
          exports.push({
            name: match[1],
            type: 'interface',
            isDefault: false,
          });
        }
      }
    }

    return exports;
  }

  /**
   * Extract constructor parameters from class content
   */
  private extractConstructorParams(classContent: string): readonly ParameterInfo[] {
    const constructorMatch = classContent.match(/constructor\s*\(([^)]*)\)/);
    if (constructorMatch === null || constructorMatch[1] === undefined) {
      return [];
    }

    return this.parseParameters(constructorMatch[1]);
  }

  /**
   * Extract methods from class content
   */
  private extractMethods(classContent: string): readonly MethodInfo[] {
    const methods: MethodInfo[] = [];
    const lines = classContent.split('\n');

    const methodPattern =
      /^\s*(public|private|protected)?\s*(async)?\s*(\w+)\s*(?:<[^>]+>)?\s*\(([^)]*)\)(?:\s*:\s*([^{]+))?\s*\{/;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      const match = line.match(methodPattern);
      if (match !== null && match[3] !== undefined && match[3] !== 'constructor') {
        const visibilityMatch = match[1];
        const visibility: 'public' | 'private' | 'protected' =
          visibilityMatch === 'public' || visibilityMatch === 'private' || visibilityMatch === 'protected'
            ? visibilityMatch
            : 'public';
        const isAsync = match[2] === 'async';
        const name = match[3];
        const params = this.parseParameters(match[4] ?? '');
        const returnType = (match[5] ?? 'void').trim();

        methods.push({
          name,
          params,
          returnType,
          isAsync,
          visibility,
          complexity: 1,
          lineNumber: i + 1,
        });
      }
    }

    return methods;
  }

  /**
   * Extract properties from class content
   */
  private extractProperties(classContent: string): readonly PropertyInfo[] {
    const properties: PropertyInfo[] = [];
    const lines = classContent.split('\n');

    const propertyPattern =
      /^\s*(?:public|private|protected)?\s*(readonly)?\s*(\w+)\s*(?:\?)?:\s*([^;=]+)/;

    for (const line of lines) {
      // Skip method declarations
      if (line.includes('(') && line.includes(')')) continue;

      const match = line.match(propertyPattern);
      if (match !== null && match[2] !== undefined && match[3] !== undefined) {
        properties.push({
          name: match[2],
          type: match[3].trim(),
          isReadonly: match[1] === 'readonly',
        });
      }
    }

    return properties;
  }

  /**
   * Parse parameter string into ParameterInfo array
   */
  private parseParameters(paramString: string): readonly ParameterInfo[] {
    if (paramString.trim() === '') return [];

    const params: ParameterInfo[] = [];
    const paramParts = this.splitParameters(paramString);

    for (const part of paramParts) {
      const trimmed = part.trim();
      if (trimmed === '') continue;

      // Handle destructuring (skip for now)
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) continue;

      const isOptional = trimmed.includes('?');
      const hasDefault = trimmed.includes('=');
      const defaultMatch = trimmed.match(/=\s*(.+)$/);
      const defaultValue = defaultMatch?.[1]?.trim();

      // Remove default value for type parsing
      const withoutDefault = trimmed.split('=')[0]?.trim() ?? '';
      const withoutOptional = withoutDefault.replace('?', '');

      const colonIndex = withoutOptional.indexOf(':');
      let name: string;
      let type: string;

      if (colonIndex !== -1) {
        name = withoutOptional.substring(0, colonIndex).trim();
        type = withoutOptional.substring(colonIndex + 1).trim();
      } else {
        name = withoutOptional.trim();
        type = 'unknown';
      }

      // Clean up name (remove visibility modifiers)
      name = name.replace(/^(public|private|protected|readonly)\s+/, '');

      if (name !== '') {
        const param: ParameterInfo = {
          name,
          type,
          isOptional: isOptional || hasDefault,
        };
        if (defaultValue !== undefined) {
          (param as { defaultValue: string }).defaultValue = defaultValue;
        }
        params.push(param);
      }
    }

    return params;
  }

  /**
   * Split parameters handling nested generics
   */
  private splitParameters(paramString: string): readonly string[] {
    const result: string[] = [];
    let current = '';
    let depth = 0;

    for (const char of paramString) {
      if (char === '<' || char === '(' || char === '{' || char === '[') {
        depth++;
        current += char;
      } else if (char === '>' || char === ')' || char === '}' || char === ']') {
        depth--;
        current += char;
      } else if (char === ',' && depth === 0) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim() !== '') {
      result.push(current);
    }

    return result;
  }

  /**
   * Extract block content starting from a line
   */
  private extractBlockContent(lines: readonly string[], startLine: number): string {
    let braceCount = 0;
    let started = false;
    const blockLines: string[] = [];

    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      if (line === undefined) continue;

      for (const char of line) {
        if (char === '{') {
          braceCount++;
          started = true;
        } else if (char === '}') {
          braceCount--;
        }
      }

      blockLines.push(line);

      if (started && braceCount === 0) {
        break;
      }
    }

    return blockLines.join('\n');
  }

  /**
   * Estimate cyclomatic complexity of code block
   */
  private estimateComplexity(content: string): number {
    let complexity = 1;

    // Count decision points
    const patterns = [
      /\bif\s*\(/g,
      /\belse\s+if\s*\(/g,
      /\bfor\s*\(/g,
      /\bwhile\s*\(/g,
      /\bswitch\s*\(/g,
      /\bcase\s+/g,
      /\bcatch\s*\(/g,
      /\?\s*[^:]+:/g, // ternary
      /&&/g,
      /\|\|/g,
    ];

    for (const pattern of patterns) {
      complexity += (content.match(pattern) ?? []).length;
    }

    return complexity;
  }

  /**
   * Generate test suite for a class
   */
  private generateClassTestSuite(
    classInfo: ClassInfo,
    dependencies: readonly DependencyInfo[]
  ): TestSuiteBlock {
    const nestedSuites: TestSuiteBlock[] = [];

    // Generate initialization tests
    if (classInfo.constructorParams.length > 0) {
      nestedSuites.push(this.generateInitializationSuite(classInfo));
    }

    // Generate tests for each public method
    for (const method of classInfo.methods) {
      if (method.visibility === 'public') {
        nestedSuites.push(this.generateMethodTestSuite(classInfo.name, method, dependencies));
      }
    }

    // Generate setup
    const setup = this.generateClassSetup(classInfo, dependencies);

    const result: TestSuiteBlock = {
      name: classInfo.name,
      nestedSuites,
      testCases: [],
      setup,
    };

    return result;
  }

  /**
   * Generate initialization test suite
   */
  private generateInitializationSuite(classInfo: ClassInfo): TestSuiteBlock {
    const testCases: TestCase[] = [];

    // Happy path: default initialization
    testCases.push({
      name: this.formatTestName('initialize_with_defaults', 'no_arguments_provided'),
      category: 'happy_path',
      priority: 'high',
      description: `${classInfo.name} should initialize with default values when no arguments provided`,
      arrange: 'Create instance with no arguments',
      act: `new ${classInfo.name}()`,
      assert: 'Verify default values are set correctly',
      mocks: [],
      coversBranches: ['default_initialization'],
    });

    // Happy path: custom configuration
    if (classInfo.constructorParams.length > 0) {
      testCases.push({
        name: this.formatTestName('initialize_with_custom_config', 'valid_arguments_provided'),
        category: 'happy_path',
        priority: 'high',
        description: `${classInfo.name} should initialize with custom values when arguments provided`,
        arrange: 'Create instance with custom arguments',
        act: `new ${classInfo.name}(customConfig)`,
        assert: 'Verify custom values are set correctly',
        mocks: [],
        coversBranches: ['custom_initialization'],
      });
    }

    // Edge case: optional parameters
    const optionalParams = classInfo.constructorParams.filter((p) => p.isOptional);
    if (optionalParams.length > 0 && this.config.includeEdgeCases) {
      testCases.push({
        name: this.formatTestName('handle_optional_params', 'partial_arguments_provided'),
        category: 'edge_case',
        priority: 'medium',
        description: `${classInfo.name} should handle partial configuration correctly`,
        arrange: 'Create instance with only some optional arguments',
        act: `new ${classInfo.name}(partialConfig)`,
        assert: 'Verify optional values use defaults',
        mocks: [],
        coversBranches: ['partial_initialization'],
      });
    }

    return {
      name: 'initialization',
      nestedSuites: [],
      testCases,
    };
  }

  /**
   * Generate test suite for a method
   */
  private generateMethodTestSuite(
    className: string,
    method: MethodInfo,
    dependencies: readonly DependencyInfo[]
  ): TestSuiteBlock {
    const testCases: TestCase[] = [];
    const mocks = this.generateMocksForMethod(method, dependencies);

    // Happy path test
    testCases.push({
      name: this.formatTestName(`return_${this.inferReturnDescription(method)}`, 'valid_input'),
      category: 'happy_path',
      priority: 'critical',
      description: `${method.name} should complete successfully with valid input`,
      arrange: `Set up ${className} instance and valid input data`,
      act: method.isAsync ? `await instance.${method.name}(validInput)` : `instance.${method.name}(validInput)`,
      assert: 'Verify expected result is returned',
      mocks,
      coversBranches: ['happy_path'],
    });

    // Edge cases
    if (this.config.includeEdgeCases) {
      // Empty/null input
      if (method.params.length > 0) {
        testCases.push({
          name: this.formatTestName('handle_empty_input', 'empty_data_provided'),
          category: 'edge_case',
          priority: 'medium',
          description: `${method.name} should handle empty input gracefully`,
          arrange: 'Set up instance with empty input',
          act: method.isAsync ? `await instance.${method.name}({})` : `instance.${method.name}({})`,
          assert: 'Verify appropriate handling of empty input',
          mocks,
          coversBranches: ['empty_input'],
        });
      }

      // Boundary values
      testCases.push({
        name: this.formatTestName('handle_boundary_values', 'boundary_input_provided'),
        category: 'edge_case',
        priority: 'medium',
        description: `${method.name} should handle boundary values correctly`,
        arrange: 'Set up instance with boundary value input',
        act: method.isAsync ? `await instance.${method.name}(boundaryInput)` : `instance.${method.name}(boundaryInput)`,
        assert: 'Verify boundary handling',
        mocks,
        coversBranches: ['boundary_handling'],
      });
    }

    // Error handling
    if (this.config.includeErrorHandling) {
      testCases.push({
        name: this.formatTestName('throw_error', 'invalid_input_provided'),
        category: 'error_handling',
        priority: 'high',
        description: `${method.name} should throw error for invalid input`,
        arrange: 'Set up instance with invalid input',
        act: method.isAsync
          ? `await expect(instance.${method.name}(invalidInput)).rejects.toThrow()`
          : `expect(() => instance.${method.name}(invalidInput)).toThrow()`,
        assert: 'Verify appropriate error is thrown',
        mocks,
        coversBranches: ['error_path'],
      });
    }

    return {
      name: method.name,
      nestedSuites: [],
      testCases,
    };
  }

  /**
   * Generate test suite for a function
   */
  private generateFunctionTestSuite(
    func: FunctionInfo,
    dependencies: readonly DependencyInfo[]
  ): TestSuiteBlock {
    const testCases: TestCase[] = [];
    const mocks = this.generateMocksForFunction(func, dependencies);

    // Happy path
    testCases.push({
      name: this.formatTestName(`return_${this.inferFunctionReturnDescription(func)}`, 'valid_input'),
      category: 'happy_path',
      priority: 'critical',
      description: `${func.name} should complete successfully with valid input`,
      arrange: 'Set up valid input data',
      act: func.isAsync ? `await ${func.name}(validInput)` : `${func.name}(validInput)`,
      assert: 'Verify expected result',
      mocks,
      coversBranches: ['happy_path'],
    });

    // Edge cases
    if (this.config.includeEdgeCases && func.params.length > 0) {
      testCases.push({
        name: this.formatTestName('handle_empty_input', 'empty_data_provided'),
        category: 'edge_case',
        priority: 'medium',
        description: `${func.name} should handle empty input`,
        arrange: 'Set up empty input',
        act: func.isAsync ? `await ${func.name}()` : `${func.name}()`,
        assert: 'Verify appropriate handling',
        mocks,
        coversBranches: ['empty_input'],
      });
    }

    // Error handling
    if (this.config.includeErrorHandling) {
      testCases.push({
        name: this.formatTestName('throw_error', 'invalid_input'),
        category: 'error_handling',
        priority: 'high',
        description: `${func.name} should throw error for invalid input`,
        arrange: 'Set up invalid input',
        act: func.isAsync
          ? `await expect(${func.name}(invalid)).rejects.toThrow()`
          : `expect(() => ${func.name}(invalid)).toThrow()`,
        assert: 'Verify error thrown',
        mocks,
        coversBranches: ['error_path'],
      });
    }

    return {
      name: func.name,
      nestedSuites: [],
      testCases,
    };
  }

  /**
   * Generate mocks for a method
   */
  private generateMocksForMethod(
    _method: MethodInfo,
    dependencies: readonly DependencyInfo[]
  ): readonly MockDependency[] {
    if (this.config.mockStrategy === 'minimal') {
      return [];
    }

    const mocks: MockDependency[] = [];

    // Add mocks for external dependencies
    for (const dep of dependencies) {
      if (dep.isExternal && !dep.isTypeOnly) {
        for (const importName of dep.imports) {
          mocks.push({
            name: importName,
            type: 'module',
            strategy: 'mock',
            behavior: `Mock implementation for ${importName}`,
          });
        }
      }
    }

    return mocks;
  }

  /**
   * Generate mocks for a function
   */
  private generateMocksForFunction(
    func: FunctionInfo,
    dependencies: readonly DependencyInfo[]
  ): readonly MockDependency[] {
    return this.generateMocksForMethod(
      { ...func, visibility: 'public', lineNumber: func.lineNumber },
      dependencies
    );
  }

  /**
   * Generate class setup code
   */
  private generateClassSetup(
    classInfo: ClassInfo,
    dependencies: readonly DependencyInfo[]
  ): string {
    const lines: string[] = [];
    lines.push(`let instance: ${classInfo.name};`);

    // Add mock declarations for dependencies
    for (const dep of dependencies) {
      if (dep.isExternal && !dep.isTypeOnly) {
        for (const importName of dep.imports) {
          lines.push(`let mock${importName}: jest.Mocked<typeof ${importName}>;`);
        }
      }
    }

    lines.push('');
    lines.push('beforeEach(() => {');

    // Initialize mocks
    for (const dep of dependencies) {
      if (dep.isExternal && !dep.isTypeOnly) {
        for (const importName of dep.imports) {
          lines.push(`  mock${importName} = createMock<typeof ${importName}>();`);
        }
      }
    }

    // Create instance
    lines.push(`  instance = new ${classInfo.name}();`);
    lines.push('});');

    return lines.join('\n');
  }

  /**
   * Format test name according to naming convention
   */
  private formatTestName(expected: string, condition: string): string {
    switch (this.config.namingConvention) {
      case 'should_when':
        return `should_${expected}_when_${condition}`;
      case 'it_does':
        return `${expected} with ${condition}`;
      case 'test_case':
        return `test_${expected}_${condition}`;
      default:
        return `should_${expected}_when_${condition}`;
    }
  }

  /**
   * Infer return description from method
   */
  private inferReturnDescription(method: MethodInfo): string {
    if (method.returnType.includes('void')) return 'complete_successfully';
    if (method.returnType.includes('boolean')) return 'expected_boolean';
    if (method.returnType.includes('string')) return 'expected_string';
    if (method.returnType.includes('number')) return 'expected_number';
    if (method.returnType.includes('[]')) return 'expected_array';
    return 'expected_result';
  }

  /**
   * Infer return description from function
   */
  private inferFunctionReturnDescription(func: FunctionInfo): string {
    if (func.returnType.includes('void')) return 'complete_successfully';
    if (func.returnType.includes('boolean')) return 'expected_boolean';
    if (func.returnType.includes('string')) return 'expected_string';
    if (func.returnType.includes('number')) return 'expected_number';
    if (func.returnType.includes('[]')) return 'expected_array';
    return 'expected_result';
  }

  /**
   * Get test file path for a source file
   */
  private getTestFilePath(sourceFile: string): string {
    const dir = dirname(sourceFile);
    const name = basename(sourceFile, extname(sourceFile));
    const ext = extname(sourceFile);
    const pattern = this.config.testFilePattern;

    // Check if source is in src directory
    const testDir = dir.replace(/\/src(\/|$)/, '/tests$1');

    return join(testDir, `${name}.${pattern}${ext}`);
  }

  /**
   * Count total tests in a suite block
   */
  private countTests(suite: TestSuiteBlock): number {
    let count = suite.testCases.length;
    for (const nested of suite.nestedSuites) {
      count += this.countTests(nested);
    }
    return count;
  }

  /**
   * Count tests by category
   */
  private countTestsByCategory(suite: TestSuiteBlock, counts: Record<TestCategory, number>): void {
    for (const testCase of suite.testCases) {
      counts[testCase.category]++;
    }
    for (const nested of suite.nestedSuites) {
      this.countTestsByCategory(nested, counts);
    }
  }

  /**
   * Estimate coverage percentage
   */
  private estimateCoverage(analysis: CodeAnalysis, testCount: number): number {
    // Rough estimation: each test covers approximately 10% of a method/function
    const totalUnits =
      analysis.classes.reduce((sum, c) => sum + c.methods.length, 0) + analysis.functions.length;

    if (totalUnits === 0) return 0;

    const coveragePerTest = 100 / totalUnits / 3; // Assuming 3 tests per unit for 100%
    const estimatedCoverage = Math.min(coveragePerTest * testCount, 100);

    return Math.round(estimatedCoverage);
  }

  /**
   * Generate import statements for test file
   */
  private generateImports(suite: TestSuite, quote: string, semi: string): string {
    const lines: string[] = [];
    const framework = suite.framework;

    // Framework imports
    if (framework === 'vitest') {
      lines.push(`import { describe, it, expect, beforeEach, afterEach, vi } from ${quote}vitest${quote}${semi}`);
    } else if (framework === 'jest') {
      lines.push(`import { describe, it, expect, beforeEach, afterEach } from ${quote}@jest/globals${quote}${semi}`);
    }

    // Source imports
    const testDir = dirname(suite.testFile);
    const relativePath = this.getRelativePath(testDir, suite.sourceFile);

    const exportNames = suite.suites.map((s) => s.name).join(', ');
    lines.push(`import { ${exportNames} } from ${quote}${relativePath}${quote}${semi}`);

    return lines.join('\n');
  }

  /**
   * Get relative path between directories
   */
  private getRelativePath(from: string, to: string): string {
    // Simplified relative path calculation
    const fromParts = from.split('/').filter((p) => p !== '');
    const toParts = to.split('/').filter((p) => p !== '');

    let commonLength = 0;
    for (let i = 0; i < Math.min(fromParts.length, toParts.length); i++) {
      if (fromParts[i] === toParts[i]) {
        commonLength++;
      } else {
        break;
      }
    }

    const upCount = fromParts.length - commonLength;
    const upPath = '../'.repeat(upCount);
    const downPath = toParts.slice(commonLength).join('/');

    // Remove extension
    const withoutExt = downPath.replace(/\.[^.]+$/, '');

    return upPath + withoutExt || './' + withoutExt;
  }

  /**
   * Generate suite block code
   */
  private generateSuiteBlock(
    suite: TestSuiteBlock,
    indent: string,
    quote: string,
    semi: string,
    depth: number
  ): string {
    const lines: string[] = [];
    const prefix = indent.repeat(depth);

    lines.push(`${prefix}describe(${quote}${suite.name}${quote}, () => {`);

    // Setup
    if (suite.setup !== undefined) {
      const setupLines = suite.setup.split('\n');
      for (const line of setupLines) {
        lines.push(`${prefix}${indent}${line}`);
      }
      lines.push('');
    }

    // Nested suites
    for (const nested of suite.nestedSuites) {
      lines.push(this.generateSuiteBlock(nested, indent, quote, semi, depth + 1));
      lines.push('');
    }

    // Test cases
    for (const testCase of suite.testCases) {
      lines.push(this.generateTestCase(testCase, indent, quote, semi, depth + 1));
    }

    // Teardown
    if (suite.teardown !== undefined) {
      lines.push('');
      const teardownLines = suite.teardown.split('\n');
      for (const line of teardownLines) {
        lines.push(`${prefix}${indent}${line}`);
      }
    }

    lines.push(`${prefix}})${semi}`);

    return lines.join('\n');
  }

  /**
   * Generate test case code
   */
  private generateTestCase(
    testCase: TestCase,
    indent: string,
    quote: string,
    semi: string,
    depth: number
  ): string {
    const lines: string[] = [];
    const prefix = indent.repeat(depth);

    lines.push(`${prefix}it(${quote}${testCase.name}${quote}, async () => {`);
    lines.push(`${prefix}${indent}// Arrange`);
    lines.push(`${prefix}${indent}// ${testCase.arrange}`);
    lines.push('');
    lines.push(`${prefix}${indent}// Act`);
    lines.push(`${prefix}${indent}// ${testCase.act}`);
    lines.push('');
    lines.push(`${prefix}${indent}// Assert`);
    lines.push(`${prefix}${indent}// ${testCase.assert}`);
    lines.push(`${prefix}})${semi}`);

    return lines.join('\n');
  }

  /**
   * Get the configuration
   */
  public getConfig(): Required<TestGeneratorConfig> {
    return { ...this.config };
  }
}
