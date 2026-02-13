/**
 * Test Strategy Factory module
 *
 * Implements the Strategy pattern for test generation, supporting
 * different test types (unit, integration, e2e) with extensible strategies.
 *
 * @module worker/TestStrategyFactory
 */

import type {
  TestSuiteBlock,
  TestCase,
  TestCategory,
  ClassInfo,
  FunctionInfo,
  MethodInfo,
  DependencyInfo,
  CodeAnalysis,
  TestGeneratorConfig,
} from './types.js';
import { DEFAULT_TEST_GENERATOR_CONFIG } from './types.js';
import type { FixtureManager } from './FixtureManager.js';
import type { AssertionBuilder } from './AssertionBuilder.js';

/**
 * Test strategy interface for extensibility
 */
export interface ITestStrategy {
  /** Strategy type identifier */
  readonly type: 'unit' | 'integration' | 'e2e';
  /** Check if this strategy can generate tests for the given context */
  canGenerate(analysis: CodeAnalysis): boolean;
  /** Generate test suites */
  generateSuites(
    analysis: CodeAnalysis,
    config: Required<TestGeneratorConfig>
  ): readonly TestSuiteBlock[];
}

/**
 * Test context for strategy generation
 */
export interface TestContext {
  readonly classInfo?: ClassInfo;
  readonly functionInfo?: FunctionInfo;
  readonly dependencies: readonly DependencyInfo[];
  readonly config: Required<TestGeneratorConfig>;
}

/**
 * Test Strategy Factory
 *
 * Manages test generation strategies and orchestrates test suite creation.
 */
export class TestStrategyFactory {
  private readonly config: Required<TestGeneratorConfig>;
  private readonly fixtureManager: FixtureManager;
  private readonly assertionBuilder: AssertionBuilder;
  private readonly strategies: Map<string, ITestStrategy> = new Map();

  constructor(
    config: TestGeneratorConfig = {},
    fixtureManager: FixtureManager,
    assertionBuilder: AssertionBuilder
  ) {
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
    this.fixtureManager = fixtureManager;
    this.assertionBuilder = assertionBuilder;
  }

  /**
   * Register a test strategy
   * @param strategy
   */
  public registerStrategy(strategy: ITestStrategy): void {
    this.strategies.set(strategy.type, strategy);
  }

  /**
   * Get a registered strategy
   * @param type
   */
  public getStrategy(type: string): ITestStrategy | undefined {
    return this.strategies.get(type);
  }

  /**
   * Generate test suites for classes
   * @param analysis
   */
  public generateClassSuites(analysis: CodeAnalysis): readonly TestSuiteBlock[] {
    const suites: TestSuiteBlock[] = [];

    for (const classInfo of analysis.classes) {
      if (classInfo.isExported) {
        const suite = this.generateClassTestSuite(classInfo, analysis.dependencies);
        suites.push(suite);
      }
    }

    return suites;
  }

  /**
   * Generate test suites for functions
   * @param analysis
   */
  public generateFunctionSuites(analysis: CodeAnalysis): readonly TestSuiteBlock[] {
    const suites: TestSuiteBlock[] = [];

    for (const funcInfo of analysis.functions) {
      if (funcInfo.isExported) {
        const suite = this.generateFunctionTestSuite(funcInfo, analysis.dependencies);
        suites.push(suite);
      }
    }

    return suites;
  }

  /**
   * Generate test suite for a class
   * @param classInfo
   * @param dependencies
   */
  public generateClassTestSuite(
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
    const setup = this.fixtureManager.generateClassSetup(classInfo, dependencies);

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
   * @param classInfo
   */
  public generateInitializationSuite(classInfo: ClassInfo): TestSuiteBlock {
    const testCases: TestCase[] = [];

    // Happy path: default initialization
    testCases.push({
      name: this.assertionBuilder.formatTestName(
        'initialize_with_defaults',
        'no_arguments_provided',
        this.config
      ),
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
        name: this.assertionBuilder.formatTestName(
          'initialize_with_custom_config',
          'valid_arguments_provided',
          this.config
        ),
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
        name: this.assertionBuilder.formatTestName(
          'handle_optional_params',
          'partial_arguments_provided',
          this.config
        ),
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
   * @param className
   * @param method
   * @param dependencies
   */
  public generateMethodTestSuite(
    className: string,
    method: MethodInfo,
    dependencies: readonly DependencyInfo[]
  ): TestSuiteBlock {
    const testCases: TestCase[] = [];
    const mocks = this.fixtureManager.generateMocksForMethod(method, dependencies, this.config);

    // Happy path test
    testCases.push({
      name: this.assertionBuilder.formatTestName(
        `return_${this.assertionBuilder.inferReturnDescription(method)}`,
        'valid_input',
        this.config
      ),
      category: 'happy_path',
      priority: 'critical',
      description: `${method.name} should complete successfully with valid input`,
      arrange: `Set up ${className} instance and valid input data`,
      act: method.isAsync
        ? `await instance.${method.name}(validInput)`
        : `instance.${method.name}(validInput)`,
      assert: 'Verify expected result is returned',
      mocks,
      coversBranches: ['happy_path'],
    });

    // Edge cases
    if (this.config.includeEdgeCases) {
      // Empty/null input
      if (method.params.length > 0) {
        testCases.push({
          name: this.assertionBuilder.formatTestName(
            'handle_empty_input',
            'empty_data_provided',
            this.config
          ),
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
        name: this.assertionBuilder.formatTestName(
          'handle_boundary_values',
          'boundary_input_provided',
          this.config
        ),
        category: 'edge_case',
        priority: 'medium',
        description: `${method.name} should handle boundary values correctly`,
        arrange: 'Set up instance with boundary value input',
        act: method.isAsync
          ? `await instance.${method.name}(boundaryInput)`
          : `instance.${method.name}(boundaryInput)`,
        assert: 'Verify boundary handling',
        mocks,
        coversBranches: ['boundary_handling'],
      });
    }

    // Error handling
    if (this.config.includeErrorHandling) {
      testCases.push({
        name: this.assertionBuilder.formatTestName(
          'throw_error',
          'invalid_input_provided',
          this.config
        ),
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
   * @param func
   * @param dependencies
   */
  public generateFunctionTestSuite(
    func: FunctionInfo,
    dependencies: readonly DependencyInfo[]
  ): TestSuiteBlock {
    const testCases: TestCase[] = [];
    const mocks = this.fixtureManager.generateMocksForFunction(func, dependencies, this.config);

    // Happy path
    testCases.push({
      name: this.assertionBuilder.formatTestName(
        `return_${this.assertionBuilder.inferFunctionReturnDescription(func)}`,
        'valid_input',
        this.config
      ),
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
        name: this.assertionBuilder.formatTestName(
          'handle_empty_input',
          'empty_data_provided',
          this.config
        ),
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
        name: this.assertionBuilder.formatTestName('throw_error', 'invalid_input', this.config),
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
   * Count total tests in a suite block
   * @param suite
   */
  public countTests(suite: TestSuiteBlock): number {
    let count = suite.testCases.length;
    for (const nested of suite.nestedSuites) {
      count += this.countTests(nested);
    }
    return count;
  }

  /**
   * Count tests by category
   * @param suite
   * @param counts
   */
  public countTestsByCategory(suite: TestSuiteBlock, counts: Record<TestCategory, number>): void {
    for (const testCase of suite.testCases) {
      counts[testCase.category]++;
    }
    for (const nested of suite.nestedSuites) {
      this.countTestsByCategory(nested, counts);
    }
  }

  /**
   * Get configuration
   */
  public getConfig(): Required<TestGeneratorConfig> {
    return { ...this.config };
  }
}

/**
 * Built-in Unit Test Strategy
 */
export class UnitTestStrategy implements ITestStrategy {
  readonly type = 'unit' as const;

  canGenerate(analysis: CodeAnalysis): boolean {
    return analysis.classes.length > 0 || analysis.functions.length > 0;
  }

  generateSuites(
    _analysis: CodeAnalysis,
    _config: Required<TestGeneratorConfig>
  ): readonly TestSuiteBlock[] {
    // Unit test generation is handled by TestStrategyFactory directly
    // This strategy serves as a marker for unit test capability
    return [];
  }
}

/**
 * Built-in Integration Test Strategy
 */
export class IntegrationTestStrategy implements ITestStrategy {
  readonly type = 'integration' as const;

  canGenerate(analysis: CodeAnalysis): boolean {
    // Integration tests are applicable when there are external dependencies
    return analysis.dependencies.some((d) => d.isExternal && !d.isTypeOnly);
  }

  generateSuites(
    _analysis: CodeAnalysis,
    _config: Required<TestGeneratorConfig>
  ): readonly TestSuiteBlock[] {
    // Integration test generation can be extended here
    return [];
  }
}

/**
 * Built-in E2E Test Strategy
 */
export class E2ETestStrategy implements ITestStrategy {
  readonly type = 'e2e' as const;

  canGenerate(_analysis: CodeAnalysis): boolean {
    // E2E tests are applicable for entry points and API modules
    return false;
  }

  generateSuites(
    _analysis: CodeAnalysis,
    _config: Required<TestGeneratorConfig>
  ): readonly TestSuiteBlock[] {
    // E2E test generation can be extended here
    return [];
  }
}
