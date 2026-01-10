/**
 * Framework Adapters module
 *
 * Provides adapters for different test frameworks (Jest, Vitest, Mocha)
 * to generate framework-specific test file content.
 *
 * @module worker/FrameworkAdapters
 */

import { join, dirname, basename, extname } from 'node:path';
import type {
  TestSuite,
  TestSuiteBlock,
  TestCase,
  CodePatterns,
  TestGeneratorConfig,
} from './types.js';
import { DEFAULT_TEST_GENERATOR_CONFIG } from './types.js';

/**
 * Framework Adapter Interface
 *
 * Defines the contract for test framework adapters.
 */
export interface IFrameworkAdapter {
  /** Framework identifier */
  readonly framework: 'jest' | 'vitest' | 'mocha';
  /** Format a complete test suite into file content */
  formatTestSuite(suite: TestSuite, patterns: CodePatterns): string;
  /** Format a test suite block (describe block) */
  formatSuiteBlock(
    suite: TestSuiteBlock,
    indent: string,
    quote: string,
    semi: string,
    depth: number
  ): string;
  /** Format a single test case */
  formatTestCase(
    testCase: TestCase,
    indent: string,
    quote: string,
    semi: string,
    depth: number
  ): string;
  /** Generate import statements */
  generateImports(suite: TestSuite, quote: string, semi: string): string;
}

/**
 * Base Framework Adapter
 *
 * Provides common functionality for all framework adapters.
 */
abstract class BaseFrameworkAdapter implements IFrameworkAdapter {
  abstract readonly framework: 'jest' | 'vitest' | 'mocha';

  protected readonly config: Required<TestGeneratorConfig>;

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
   * Format a complete test suite into file content
   */
  public formatTestSuite(suite: TestSuite, patterns: CodePatterns): string {
    const lines: string[] = [];
    const indent = patterns.indentation === 'tabs' ? '\t' : ' '.repeat(patterns.indentSize);
    const quote = patterns.quoteStyle === 'single' ? "'" : '"';
    const semi = patterns.useSemicolons ? ';' : '';

    // Generate imports
    lines.push(this.generateImports(suite, quote, semi));
    lines.push('');

    // Generate test suites
    for (const suiteBlock of suite.suites) {
      lines.push(this.formatSuiteBlock(suiteBlock, indent, quote, semi, 0));
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Format a test suite block (describe block)
   */
  public formatSuiteBlock(
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
      lines.push(this.formatSuiteBlock(nested, indent, quote, semi, depth + 1));
      lines.push('');
    }

    // Test cases
    for (const testCase of suite.testCases) {
      lines.push(this.formatTestCase(testCase, indent, quote, semi, depth + 1));
    }

    // Teardown
    if (suite.teardown !== undefined) {
      lines.push('');
      const teardownLines = suite.teardown.split('\n');
      for (const line of teardownLines) {
        lines.push(`${prefix}${indent}${line}`);
      }
    }

    lines.push(`${prefix}}${semi}`);

    return lines.join('\n');
  }

  /**
   * Format a single test case
   */
  public formatTestCase(
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
    lines.push(`${prefix}}${semi}`);

    return lines.join('\n');
  }

  /**
   * Generate import statements
   */
  public abstract generateImports(suite: TestSuite, quote: string, semi: string): string;

  /**
   * Get relative path between directories
   */
  protected getRelativePath(from: string, to: string): string {
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
   * Get test file path for a source file
   */
  public getTestFilePath(sourceFile: string): string {
    const dir = dirname(sourceFile);
    const name = basename(sourceFile, extname(sourceFile));
    const ext = extname(sourceFile);
    const pattern = this.config.testFilePattern;

    // Check if source is in src directory
    const testDir = dir.replace(/\/src(\/|$)/, '/tests$1');

    return join(testDir, `${name}.${pattern}${ext}`);
  }
}

/**
 * Vitest Framework Adapter
 */
export class VitestAdapter extends BaseFrameworkAdapter {
  readonly framework = 'vitest' as const;

  /**
   * Generate Vitest-specific imports
   */
  public generateImports(suite: TestSuite, quote: string, semi: string): string {
    const lines: string[] = [];

    // Vitest framework imports
    lines.push(
      `import { describe, it, expect, beforeEach, afterEach, vi } from ${quote}vitest${quote}${semi}`
    );

    // Source imports
    const testDir = dirname(suite.testFile);
    const relativePath = this.getRelativePath(testDir, suite.sourceFile);

    const exportNames = suite.suites.map((s) => s.name).join(', ');
    lines.push(`import { ${exportNames} } from ${quote}${relativePath}${quote}${semi}`);

    return lines.join('\n');
  }
}

/**
 * Jest Framework Adapter
 */
export class JestAdapter extends BaseFrameworkAdapter {
  readonly framework = 'jest' as const;

  /**
   * Generate Jest-specific imports
   */
  public generateImports(suite: TestSuite, quote: string, semi: string): string {
    const lines: string[] = [];

    // Jest framework imports
    lines.push(
      `import { describe, it, expect, beforeEach, afterEach } from ${quote}@jest/globals${quote}${semi}`
    );

    // Source imports
    const testDir = dirname(suite.testFile);
    const relativePath = this.getRelativePath(testDir, suite.sourceFile);

    const exportNames = suite.suites.map((s) => s.name).join(', ');
    lines.push(`import { ${exportNames} } from ${quote}${relativePath}${quote}${semi}`);

    return lines.join('\n');
  }
}

/**
 * Mocha Framework Adapter
 */
export class MochaAdapter extends BaseFrameworkAdapter {
  readonly framework = 'mocha' as const;

  /**
   * Generate Mocha-specific imports
   */
  public generateImports(suite: TestSuite, quote: string, semi: string): string {
    const lines: string[] = [];

    // Mocha + Chai imports
    lines.push(`import { describe, it, beforeEach, afterEach } from ${quote}mocha${quote}${semi}`);
    lines.push(`import { expect } from ${quote}chai${quote}${semi}`);
    lines.push(`import sinon from ${quote}sinon${quote}${semi}`);

    // Source imports
    const testDir = dirname(suite.testFile);
    const relativePath = this.getRelativePath(testDir, suite.sourceFile);

    const exportNames = suite.suites.map((s) => s.name).join(', ');
    lines.push(`import { ${exportNames} } from ${quote}${relativePath}${quote}${semi}`);

    return lines.join('\n');
  }

  /**
   * Override test case formatting for Mocha style
   */
  public formatTestCase(
    testCase: TestCase,
    indent: string,
    quote: string,
    semi: string,
    depth: number
  ): string {
    const lines: string[] = [];
    const prefix = indent.repeat(depth);

    // Mocha uses 'it' but with done callback for async
    lines.push(`${prefix}it(${quote}${testCase.name}${quote}, async function() {`);
    lines.push(`${prefix}${indent}// Arrange`);
    lines.push(`${prefix}${indent}// ${testCase.arrange}`);
    lines.push('');
    lines.push(`${prefix}${indent}// Act`);
    lines.push(`${prefix}${indent}// ${testCase.act}`);
    lines.push('');
    lines.push(`${prefix}${indent}// Assert`);
    lines.push(`${prefix}${indent}// ${testCase.assert}`);
    lines.push(`${prefix}}${semi}`);

    return lines.join('\n');
  }
}

/**
 * Framework Adapter Factory
 *
 * Creates the appropriate adapter for a given test framework.
 */
export class FrameworkAdapterFactory {
  private readonly adapters: Map<string, IFrameworkAdapter> = new Map();

  constructor(config: TestGeneratorConfig = {}) {
    // Register default adapters
    this.adapters.set('vitest', new VitestAdapter(config));
    this.adapters.set('jest', new JestAdapter(config));
    this.adapters.set('mocha', new MochaAdapter(config));
  }

  /**
   * Get adapter for a framework
   */
  public getAdapter(framework: 'jest' | 'vitest' | 'mocha'): IFrameworkAdapter {
    const adapter = this.adapters.get(framework);
    if (adapter === undefined) {
      // Default to Vitest - always registered in constructor
      const vitestAdapter = this.adapters.get('vitest');
      if (vitestAdapter === undefined) {
        throw new Error('Vitest adapter not found. This should never happen.');
      }
      return vitestAdapter;
    }
    return adapter;
  }

  /**
   * Register a custom adapter
   */
  public registerAdapter(adapter: IFrameworkAdapter): void {
    this.adapters.set(adapter.framework, adapter);
  }

  /**
   * Get all registered adapters
   */
  public getAdapters(): readonly IFrameworkAdapter[] {
    return Array.from(this.adapters.values());
  }
}
