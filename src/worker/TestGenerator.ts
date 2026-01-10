/**
 * Test Generator module
 *
 * Generates comprehensive unit tests for source code following
 * best practices including AAA pattern, proper mocking, and
 * coverage targeting.
 *
 * This module acts as a coordinator (facade) that orchestrates
 * the following specialized modules:
 * - CodeAnalyzer: Analyzes source code structure
 * - TestStrategyFactory: Generates test suites using strategies
 * - AssertionBuilder: Handles assertions and naming
 * - FixtureManager: Manages mocks and fixtures
 * - FrameworkAdapters: Formats output for different frameworks
 *
 * @module worker/TestGenerator
 */

import { extname } from 'node:path';
import type {
  TestGeneratorConfig,
  TestGenerationResult,
  TestSuite,
  TestSuiteBlock,
  TestCategory,
  CodeAnalysis,
  CodePatterns,
  FileContext,
} from './types.js';
import { DEFAULT_TEST_GENERATOR_CONFIG } from './types.js';
import { CodeAnalyzer } from './CodeAnalyzer.js';
import { TestStrategyFactory } from './TestStrategyFactory.js';
import { AssertionBuilder } from './AssertionBuilder.js';
import { FixtureManager } from './FixtureManager.js';
import { FrameworkAdapterFactory, VitestAdapter } from './FrameworkAdapters.js';

/**
 * Test Generator
 *
 * Analyzes source code and generates comprehensive test suites
 * with proper structure, mocking, and coverage targeting.
 *
 * This class serves as a facade that coordinates multiple
 * specialized modules for test generation.
 */
export class TestGenerator {
  private readonly config: Required<TestGeneratorConfig>;
  private readonly codeAnalyzer: CodeAnalyzer;
  private readonly assertionBuilder: AssertionBuilder;
  private readonly fixtureManager: FixtureManager;
  private readonly strategyFactory: TestStrategyFactory;
  private readonly adapterFactory: FrameworkAdapterFactory;

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

    // Initialize sub-modules
    this.codeAnalyzer = new CodeAnalyzer();
    this.assertionBuilder = new AssertionBuilder(config);
    this.fixtureManager = new FixtureManager(config);
    this.strategyFactory = new TestStrategyFactory(
      config,
      this.fixtureManager,
      this.assertionBuilder
    );
    this.adapterFactory = new FrameworkAdapterFactory(config);
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
    const adapter = this.adapterFactory.getAdapter('vitest') as VitestAdapter;
    const testFile = adapter.getTestFilePath(sourceFile);
    const detectedFramework = patterns.testFramework ?? 'vitest';
    const framework: 'jest' | 'vitest' | 'mocha' =
      detectedFramework === 'other' ? 'vitest' : detectedFramework;

    const suites: TestSuiteBlock[] = [];
    let totalTests = 0;

    // Generate tests for classes using strategy factory
    const classSuites = this.strategyFactory.generateClassSuites(analysis);
    for (const suite of classSuites) {
      suites.push(suite);
      totalTests += this.strategyFactory.countTests(suite);
    }

    // Generate tests for standalone functions using strategy factory
    const functionSuites = this.strategyFactory.generateFunctionSuites(analysis);
    for (const suite of functionSuites) {
      suites.push(suite);
      totalTests += this.strategyFactory.countTests(suite);
    }

    const estimatedCoverage = this.assertionBuilder.estimateCoverage(analysis, totalTests);

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
          this.strategyFactory.countTestsByCategory(suiteBlock, coverageByCategory);
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
   *
   * Delegates to CodeAnalyzer module.
   */
  public analyzeCode(content: string): CodeAnalysis {
    return this.codeAnalyzer.analyzeCode(content);
  }

  /**
   * Generate test file content
   *
   * Delegates to FrameworkAdapters module.
   */
  public generateTestFileContent(suite: TestSuite, patterns: CodePatterns): string {
    const adapter = this.adapterFactory.getAdapter(suite.framework);
    return adapter.formatTestSuite(suite, patterns);
  }

  /**
   * Get the configuration
   */
  public getConfig(): Required<TestGeneratorConfig> {
    return { ...this.config };
  }

  /**
   * Get the code analyzer instance
   */
  public getCodeAnalyzer(): CodeAnalyzer {
    return this.codeAnalyzer;
  }

  /**
   * Get the assertion builder instance
   */
  public getAssertionBuilder(): AssertionBuilder {
    return this.assertionBuilder;
  }

  /**
   * Get the fixture manager instance
   */
  public getFixtureManager(): FixtureManager {
    return this.fixtureManager;
  }

  /**
   * Get the strategy factory instance
   */
  public getStrategyFactory(): TestStrategyFactory {
    return this.strategyFactory;
  }

  /**
   * Get the adapter factory instance
   */
  public getAdapterFactory(): FrameworkAdapterFactory {
    return this.adapterFactory;
  }
}
