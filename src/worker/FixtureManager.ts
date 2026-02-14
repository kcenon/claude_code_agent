/**
 * Fixture Manager module
 *
 * Manages test fixtures, mock generation, and setup/teardown
 * code for test suites.
 *
 * @module worker/FixtureManager
 */

import type {
  TestGeneratorConfig,
  MockDependency,
  ClassInfo,
  FunctionInfo,
  MethodInfo,
  DependencyInfo,
} from './types.js';
import { DEFAULT_TEST_GENERATOR_CONFIG } from './types.js';

/**
 * Fixture schema for generating test data
 */
export interface FixtureSchema {
  /** Name of the fixture */
  readonly name: string;
  /** Type of the fixture data */
  readonly type: string;
  /** Properties of the fixture (for objects) */
  readonly properties?: readonly FixtureProperty[];
}

/**
 * Property within a fixture schema
 */
export interface FixtureProperty {
  /** Property name */
  readonly name: string;
  /** Property type */
  readonly type: string;
  /** Default value */
  readonly defaultValue?: string;
  /** Whether the property is optional */
  readonly optional?: boolean;
}

/**
 * Generated fixture
 */
export interface Fixture {
  /** Fixture name */
  readonly name: string;
  /** Fixture value expression */
  readonly value: string;
  /** Type annotation */
  readonly type: string;
}

/**
 * Mock configuration
 */
export interface Mock {
  /** Mock name */
  readonly name: string;
  /** Mock type */
  readonly type: 'spy' | 'stub' | 'mock' | 'fake';
  /** Module being mocked */
  readonly module?: string;
  /** Implementation expression */
  readonly implementation?: string;
}

/**
 * Test data specification
 */
export interface DataSpec {
  /** Data type */
  readonly type: string;
  /** Constraints for generation */
  readonly constraints?: Record<string, unknown>;
}

/**
 * Generated test data
 */
export interface TestData {
  /** Variable name */
  readonly name: string;
  /** Value expression */
  readonly value: string;
}

/**
 * Fixture Manager Interface
 */
export interface IFixtureManager {
  createFixture(schema: FixtureSchema): Fixture;
  createMock(dependency: DependencyInfo): Mock;
  generateTestData(spec: DataSpec): TestData;
}

/**
 * Fixture Manager
 *
 * Handles fixture creation, mock generation, and test setup code.
 */
export class FixtureManager implements IFixtureManager {
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
   * Create a fixture from a schema
   * @param schema - Fixture schema defining the structure and properties
   * @returns Generated fixture with name, value expression, and type annotation
   */
  public createFixture(schema: FixtureSchema): Fixture {
    let value: string;

    if (schema.properties && schema.properties.length > 0) {
      const props = schema.properties
        .map((p) => `  ${p.name}: ${p.defaultValue ?? this.getDefaultValue(p.type)}`)
        .join(',\n');
      value = `{\n${props}\n}`;
    } else {
      value = this.getDefaultValue(schema.type);
    }

    return {
      name: schema.name,
      value,
      type: schema.type,
    };
  }

  /**
   * Create a mock from a dependency
   * @param dependency - Dependency information including module and imported symbols
   * @returns Mock configuration with name, type, module, and implementation
   */
  public createMock(dependency: DependencyInfo): Mock {
    const name = dependency.imports[0] ?? 'unknownMock';

    return {
      name: `mock${name}`,
      type: 'mock',
      module: dependency.module,
      implementation: this.generateMockImplementation(dependency),
    };
  }

  /**
   * Generate test data from specification
   * @param spec - Test data specification with type and optional constraints
   * @returns Generated test data with variable name and value expression
   */
  public generateTestData(spec: DataSpec): TestData {
    const name = `test${spec.type.charAt(0).toUpperCase()}${spec.type.slice(1)}`;
    const value = this.getDefaultValue(spec.type);

    return {
      name,
      value,
    };
  }

  /**
   * Generate mocks for a method
   * @param _method - Method information (unused, reserved for future use)
   * @param dependencies - Array of dependency information to generate mocks for
   * @param config - Test generator configuration including mock strategy
   * @returns Array of mock dependencies for external modules
   */
  public generateMocksForMethod(
    _method: MethodInfo,
    dependencies: readonly DependencyInfo[],
    config: Required<TestGeneratorConfig>
  ): readonly MockDependency[] {
    if (config.mockStrategy === 'minimal') {
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
   * @param func - Function information to generate mocks for
   * @param dependencies - Array of dependency information to generate mocks for
   * @param config - Test generator configuration including mock strategy
   * @returns Array of mock dependencies for external modules
   */
  public generateMocksForFunction(
    func: FunctionInfo,
    dependencies: readonly DependencyInfo[],
    config: Required<TestGeneratorConfig>
  ): readonly MockDependency[] {
    return this.generateMocksForMethod(
      { ...func, visibility: 'public', lineNumber: func.lineNumber },
      dependencies,
      config
    );
  }

  /**
   * Generate class setup code
   * @param classInfo - Class information to generate setup for
   * @param dependencies - Array of dependency information to mock in setup
   * @returns Test setup code including instance declaration and beforeEach block
   */
  public generateClassSetup(classInfo: ClassInfo, dependencies: readonly DependencyInfo[]): string {
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
   * Generate beforeEach setup code
   * @param classInfo - Class information to generate instance creation for
   * @returns BeforeEach block code that instantiates the class
   */
  public generateBeforeEach(classInfo: ClassInfo): string {
    const lines: string[] = [];
    lines.push('beforeEach(() => {');
    lines.push(`  instance = new ${classInfo.name}();`);
    lines.push('});');
    return lines.join('\n');
  }

  /**
   * Generate afterEach teardown code
   * @returns AfterEach block code that clears all mocks
   */
  public generateAfterEach(): string {
    const lines: string[] = [];
    lines.push('afterEach(() => {');
    lines.push('  vi.clearAllMocks();');
    lines.push('});');
    return lines.join('\n');
  }

  /**
   * Get default value for a type
   * @param type - TypeScript type string to generate default value for
   * @returns String representation of a default value for the given type
   */
  private getDefaultValue(type: string): string {
    const lowerType = type.toLowerCase();

    if (lowerType.includes('string')) return "''";
    if (lowerType.includes('number')) return '0';
    if (lowerType.includes('boolean')) return 'false';
    if (lowerType.includes('array') || lowerType.includes('[]')) return '[]';
    if (lowerType.includes('null')) return 'null';
    if (lowerType.includes('undefined')) return 'undefined';
    if (lowerType.includes('date')) return 'new Date()';
    if (lowerType.includes('map')) return 'new Map()';
    if (lowerType.includes('set')) return 'new Set()';
    if (lowerType.includes('promise')) return 'Promise.resolve()';

    // Default to empty object
    return '{}';
  }

  /**
   * Generate mock implementation for a dependency
   * @param dependency - Dependency information to generate mock implementation for
   * @returns Object literal string with vi.fn() mocks for each imported symbol
   */
  private generateMockImplementation(dependency: DependencyInfo): string {
    const imports = dependency.imports;

    if (imports.length === 0) {
      return '{}';
    }

    const mockProps = imports.map((importName) => `  ${importName}: vi.fn()`).join(',\n');

    return `{\n${mockProps}\n}`;
  }

  /**
   * Get configuration
   * @returns Copy of the current test generator configuration
   */
  public getConfig(): Required<TestGeneratorConfig> {
    return { ...this.config };
  }
}
