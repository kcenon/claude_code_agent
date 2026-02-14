/**
 * Assertion Builder module
 *
 * Handles assertion generation, test naming conventions,
 * and return type inference for test cases.
 *
 * @module worker/AssertionBuilder
 */

import type { TestGeneratorConfig, MethodInfo, FunctionInfo, CodeAnalysis } from './types.js';
import { DEFAULT_TEST_GENERATOR_CONFIG } from './types.js';

/**
 * Assertion specification
 */
export interface Assertion {
  /** Actual value expression */
  readonly actual: string;
  /** Expected value expression */
  readonly expected: string;
  /** Matcher to use (e.g., 'toBe', 'toEqual') */
  readonly matcher: string;
  /** Whether this is a negated assertion */
  readonly negated?: boolean;
}

/**
 * Expected value with type information
 */
export interface ExpectedValue {
  /** The expected value expression */
  readonly value: string;
  /** The type of the expected value */
  readonly type: string;
  /** Whether the value is literal or computed */
  readonly isLiteral: boolean;
}

/**
 * Inference context for determining expected values
 */
export interface InferenceContext {
  /** Return type string */
  readonly returnType: string;
  /** Method or function name */
  readonly name: string;
  /** Whether the method/function is async */
  readonly isAsync: boolean;
}

/**
 * Assertion Builder Interface
 */
export interface IAssertionBuilder {
  build(expected: ExpectedValue, actual: string): Assertion;
  inferExpected(context: InferenceContext): ExpectedValue;
  formatAssertion(assertion: Assertion, framework: 'jest' | 'vitest' | 'mocha'): string;
}

/**
 * Assertion Builder
 *
 * Handles assertion building, test name formatting, and
 * return type inference for generated tests.
 */
export class AssertionBuilder implements IAssertionBuilder {
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
   * Build an assertion from expected value and actual expression
   * @param expected - Expected value with type information and literal flag
   * @param actual - Expression string representing the actual value to test
   * @returns Assertion object with matcher, actual, and expected values
   */
  public build(expected: ExpectedValue, actual: string): Assertion {
    const matcher = this.selectMatcher(expected.type);

    return {
      actual,
      expected: expected.value,
      matcher,
      negated: false,
    };
  }

  /**
   * Infer expected value from context
   * @param context - Context containing return type, name, and async status
   * @returns Inferred expected value based on the return type
   */
  public inferExpected(context: InferenceContext): ExpectedValue {
    const { returnType } = context;

    // Infer based on return type
    if (returnType.includes('boolean')) {
      return { value: 'true', type: 'boolean', isLiteral: true };
    }
    if (returnType.includes('number')) {
      return { value: 'expectedNumber', type: 'number', isLiteral: false };
    }
    if (returnType.includes('string')) {
      return { value: "'expectedString'", type: 'string', isLiteral: true };
    }
    if (returnType.includes('[]') || returnType.includes('Array')) {
      return { value: 'expectedArray', type: 'array', isLiteral: false };
    }
    if (returnType.includes('void') || returnType === 'void') {
      return { value: 'undefined', type: 'void', isLiteral: true };
    }
    if (returnType.includes('Promise')) {
      // Extract inner type from Promise
      const innerMatch = returnType.match(/Promise<([^>]+)>/);
      if (innerMatch !== null && innerMatch[1] !== undefined && innerMatch[1] !== '') {
        return this.inferExpected({ ...context, returnType: innerMatch[1] });
      }
    }

    // Default to object
    return { value: 'expectedResult', type: 'object', isLiteral: false };
  }

  /**
   * Format assertion for a specific framework
   * @param assertion - Assertion object with actual, expected, matcher, and negation flag
   * @param framework - Target test framework (jest, vitest, or mocha)
   * @returns Formatted assertion string using framework-specific syntax
   */
  public formatAssertion(assertion: Assertion, framework: 'jest' | 'vitest' | 'mocha'): string {
    const { actual, expected, matcher, negated } = assertion;

    switch (framework) {
      case 'jest':
      case 'vitest':
        if (negated === true) {
          return `expect(${actual}).not.${matcher}(${expected});`;
        }
        return `expect(${actual}).${matcher}(${expected});`;

      case 'mocha':
        // Mocha uses chai syntax
        if (negated === true) {
          return `expect(${actual}).to.not.${this.chaiMatcher(matcher)}(${expected});`;
        }
        return `expect(${actual}).to.${this.chaiMatcher(matcher)}(${expected});`;

      default:
        return `expect(${actual}).${matcher}(${expected});`;
    }
  }

  /**
   * Format test name according to naming convention
   * @param expected - Expected outcome or behavior description
   * @param condition - Condition or scenario being tested
   * @param config - Test generator configuration with naming convention preference
   * @returns Formatted test name string following the configured convention
   */
  public formatTestName(
    expected: string,
    condition: string,
    config: Required<TestGeneratorConfig>
  ): string {
    switch (config.namingConvention) {
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
   * @param method - Method information including return type
   * @returns Human-readable description of the expected return value
   */
  public inferReturnDescription(method: MethodInfo): string {
    if (method.returnType.includes('void')) return 'complete_successfully';
    if (method.returnType.includes('boolean')) return 'expected_boolean';
    if (method.returnType.includes('string')) return 'expected_string';
    if (method.returnType.includes('number')) return 'expected_number';
    if (method.returnType.includes('[]')) return 'expected_array';
    return 'expected_result';
  }

  /**
   * Infer return description from function
   * @param func - Function information including return type
   * @returns Human-readable description of the expected return value
   */
  public inferFunctionReturnDescription(func: FunctionInfo): string {
    if (func.returnType.includes('void')) return 'complete_successfully';
    if (func.returnType.includes('boolean')) return 'expected_boolean';
    if (func.returnType.includes('string')) return 'expected_string';
    if (func.returnType.includes('number')) return 'expected_number';
    if (func.returnType.includes('[]')) return 'expected_array';
    return 'expected_result';
  }

  /**
   * Estimate coverage percentage
   * @param analysis - Code analysis containing classes, methods, and functions
   * @param testCount - Number of tests that have been generated
   * @returns Estimated coverage percentage (0-100)
   */
  public estimateCoverage(analysis: CodeAnalysis, testCount: number): number {
    // Rough estimation: each test covers approximately 10% of a method/function
    const totalUnits =
      analysis.classes.reduce((sum, c) => sum + c.methods.length, 0) + analysis.functions.length;

    if (totalUnits === 0) return 0;

    const coveragePerTest = 100 / totalUnits / 3; // Assuming 3 tests per unit for 100%
    const estimatedCoverage = Math.min(coveragePerTest * testCount, 100);

    return Math.round(estimatedCoverage);
  }

  /**
   * Select appropriate matcher based on type
   * @param type - TypeScript type string to select matcher for
   * @returns Jest/Vitest matcher name appropriate for the type
   */
  private selectMatcher(type: string): string {
    switch (type) {
      case 'boolean':
        return 'toBe';
      case 'number':
        return 'toBe';
      case 'string':
        return 'toBe';
      case 'array':
        return 'toEqual';
      case 'object':
        return 'toEqual';
      case 'void':
        return 'toBeUndefined';
      default:
        return 'toEqual';
    }
  }

  /**
   * Convert Jest/Vitest matcher to Chai matcher
   * @param matcher - Jest/Vitest matcher name to convert
   * @returns Equivalent Chai matcher syntax
   */
  private chaiMatcher(matcher: string): string {
    const matcherMap: Record<string, string> = {
      toBe: 'equal',
      toEqual: 'deep.equal',
      toBeUndefined: 'be.undefined',
      toBeNull: 'be.null',
      toBeTruthy: 'be.ok',
      toBeFalsy: 'not.be.ok',
      toContain: 'include',
      toHaveLength: 'have.length',
      toThrow: 'throw',
    };

    return matcherMap[matcher] ?? matcher;
  }

  /**
   * Get configuration
   * @returns Copy of the current test generator configuration
   */
  public getConfig(): Required<TestGeneratorConfig> {
    return { ...this.config };
  }
}
