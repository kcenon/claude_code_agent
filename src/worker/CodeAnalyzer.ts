/**
 * Code Analyzer module
 *
 * Analyzes source code to extract testable elements including
 * classes, functions, dependencies, and exports.
 *
 * @module worker/CodeAnalyzer
 */

import type {
  CodeAnalysis,
  ClassInfo,
  FunctionInfo,
  MethodInfo,
  ParameterInfo,
  PropertyInfo,
  DependencyInfo,
  ExportInfo,
} from './types.js';

/**
 * Code Analyzer
 *
 * Analyzes source code to extract structural information
 * for test generation.
 */
export class CodeAnalyzer {
  /**
   * Analyze source code to extract testable elements
   * @param content - Source code to analyze for classes, functions, dependencies, and exports
   * @returns Comprehensive code analysis including all testable elements
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
   * Extract class information from source code
   * @param content - Source code containing class declarations to parse
   * @returns Array of class information including constructors, methods, and properties
   */
  public extractClasses(content: string): readonly ClassInfo[] {
    const classes: ClassInfo[] = [];
    const lines = content.split('\n');

    // Pattern to match class declarations
    const classPattern =
      /^(?:export\s+)?class\s+(\w+)(?:\s+extends\s+\w+)?(?:\s+implements\s+[\w,\s]+)?\s*\{/;

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
   * @param content - Source code containing function declarations and arrow functions to parse
   * @returns Array of function information including parameters, return types, and complexity
   */
  public extractFunctions(content: string): readonly FunctionInfo[] {
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
   * @param content - Source code containing import declarations to parse
   * @returns Array of dependency information including module names and imported symbols
   */
  public extractDependencies(content: string): readonly DependencyInfo[] {
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

        const imports =
          defaultImport !== undefined ? [defaultImport, ...namedImports] : namedImports;

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
   * @param content - Source code containing export declarations to parse
   * @returns Array of export information including names, types, and default status
   */
  public extractExports(content: string): readonly ExportInfo[] {
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
   * @param classContent - Class body text containing constructor declaration
   * @returns Array of parameter information from the constructor signature
   */
  public extractConstructorParams(classContent: string): readonly ParameterInfo[] {
    const constructorMatch = classContent.match(/constructor\s*\(([^)]*)\)/);
    if (constructorMatch === null || constructorMatch[1] === undefined) {
      return [];
    }

    return this.parseParameters(constructorMatch[1]);
  }

  /**
   * Extract methods from class content
   * @param classContent - Class body text containing method declarations
   * @returns Array of method information including visibility, parameters, and return types
   */
  public extractMethods(classContent: string): readonly MethodInfo[] {
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
          visibilityMatch === 'public' ||
          visibilityMatch === 'private' ||
          visibilityMatch === 'protected'
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
   * @param classContent - Class body text containing property declarations
   * @returns Array of property information including names, types, and readonly status
   */
  public extractProperties(classContent: string): readonly PropertyInfo[] {
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
   * @param paramString - Raw parameter list from function/method signature
   * @returns Array of parsed parameter information with names, types, and defaults
   */
  public parseParameters(paramString: string): readonly ParameterInfo[] {
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
   * @param paramString - Parameter list string that may contain nested generics and brackets
   * @returns Array of individual parameter strings correctly split on commas
   */
  public splitParameters(paramString: string): readonly string[] {
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
   * @param lines - Array of source code lines
   * @param startLine - Zero-based line index where the code block begins
   * @returns Complete block content from opening brace to matching closing brace
   */
  public extractBlockContent(lines: readonly string[], startLine: number): string {
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
   * @param content - Code block to analyze for decision points and branches
   * @returns Estimated cyclomatic complexity score based on control flow statements
   */
  public estimateComplexity(content: string): number {
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
}
