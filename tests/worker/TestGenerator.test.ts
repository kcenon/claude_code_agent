import { describe, it, expect, beforeEach } from 'vitest';
import {
  TestGenerator,
  DEFAULT_TEST_GENERATOR_CONFIG,
  DEFAULT_CODE_PATTERNS,
} from '../../src/worker/index.js';
import type {
  TestGeneratorConfig,
  CodePatterns,
  FileContext,
  TestSuite,
  CodeAnalysis,
} from '../../src/worker/index.js';

describe('TestGenerator', () => {
  let generator: TestGenerator;

  beforeEach(() => {
    generator = new TestGenerator();
  });

  describe('initialization', () => {
    it('should_initialize_with_default_config_when_no_arguments_provided', () => {
      const config = generator.getConfig();

      expect(config.coverageTarget).toBe(DEFAULT_TEST_GENERATOR_CONFIG.coverageTarget);
      expect(config.namingConvention).toBe(DEFAULT_TEST_GENERATOR_CONFIG.namingConvention);
      expect(config.includeEdgeCases).toBe(DEFAULT_TEST_GENERATOR_CONFIG.includeEdgeCases);
      expect(config.includeErrorHandling).toBe(DEFAULT_TEST_GENERATOR_CONFIG.includeErrorHandling);
      expect(config.includeIntegration).toBe(DEFAULT_TEST_GENERATOR_CONFIG.includeIntegration);
      expect(config.mockStrategy).toBe(DEFAULT_TEST_GENERATOR_CONFIG.mockStrategy);
      expect(config.testFilePattern).toBe(DEFAULT_TEST_GENERATOR_CONFIG.testFilePattern);
    });

    it('should_initialize_with_custom_config_when_arguments_provided', () => {
      const customConfig: TestGeneratorConfig = {
        coverageTarget: 90,
        namingConvention: 'it_does',
        includeEdgeCases: false,
        mockStrategy: 'minimal',
        testFilePattern: 'spec',
      };

      const customGenerator = new TestGenerator(customConfig);
      const config = customGenerator.getConfig();

      expect(config.coverageTarget).toBe(90);
      expect(config.namingConvention).toBe('it_does');
      expect(config.includeEdgeCases).toBe(false);
      expect(config.mockStrategy).toBe('minimal');
      expect(config.testFilePattern).toBe('spec');
    });

    it('should_use_defaults_for_unspecified_config_options', () => {
      const partialConfig: TestGeneratorConfig = {
        coverageTarget: 95,
      };

      const partialGenerator = new TestGenerator(partialConfig);
      const config = partialGenerator.getConfig();

      expect(config.coverageTarget).toBe(95);
      expect(config.namingConvention).toBe(DEFAULT_TEST_GENERATOR_CONFIG.namingConvention);
    });
  });

  describe('analyzeCode', () => {
    it('should_extract_class_information_when_class_exists', () => {
      const sourceCode = `
export class MyService {
  private readonly name: string;

  constructor(name: string) {
    this.name = name;
  }

  public getName(): string {
    return this.name;
  }

  public async fetchData(id: number): Promise<string> {
    return \`data-\${id}\`;
  }
}
`;

      const analysis = generator.analyzeCode(sourceCode);

      expect(analysis.classes).toHaveLength(1);
      expect(analysis.classes[0].name).toBe('MyService');
      expect(analysis.classes[0].isExported).toBe(true);
      expect(analysis.classes[0].methods.length).toBeGreaterThan(0);
    });

    it('should_extract_function_information_when_standalone_function_exists', () => {
      const sourceCode = `
export function calculateSum(a: number, b: number): number {
  return a + b;
}

export async function fetchUser(id: string): Promise<User> {
  return await api.getUser(id);
}
`;

      const analysis = generator.analyzeCode(sourceCode);

      expect(analysis.functions).toHaveLength(2);
      expect(analysis.functions[0].name).toBe('calculateSum');
      expect(analysis.functions[0].isAsync).toBe(false);
      expect(analysis.functions[1].name).toBe('fetchUser');
      expect(analysis.functions[1].isAsync).toBe(true);
    });

    it('should_extract_dependencies_from_import_statements', () => {
      const sourceCode = `
import { readFile, writeFile } from 'node:fs/promises';
import type { Config } from './types.js';
import axios from 'axios';
`;

      const analysis = generator.analyzeCode(sourceCode);

      expect(analysis.dependencies.length).toBeGreaterThanOrEqual(2);

      const fsImport = analysis.dependencies.find((d) => d.module === 'node:fs/promises');
      expect(fsImport).toBeDefined();
      expect(fsImport?.imports).toContain('readFile');
      expect(fsImport?.imports).toContain('writeFile');
      expect(fsImport?.isExternal).toBe(true);
    });

    it('should_extract_export_information', () => {
      const sourceCode = `
export class ServiceA {}
export function helperFunc() {}
export const CONFIG = {};
export type MyType = string;
export interface MyInterface {}
`;

      const analysis = generator.analyzeCode(sourceCode);

      expect(analysis.exports).toHaveLength(5);

      const classExport = analysis.exports.find((e) => e.name === 'ServiceA');
      expect(classExport?.type).toBe('class');

      const funcExport = analysis.exports.find((e) => e.name === 'helperFunc');
      expect(funcExport?.type).toBe('function');

      const constExport = analysis.exports.find((e) => e.name === 'CONFIG');
      expect(constExport?.type).toBe('const');
    });

    it('should_handle_empty_source_code', () => {
      const analysis = generator.analyzeCode('');

      expect(analysis.classes).toHaveLength(0);
      expect(analysis.functions).toHaveLength(0);
      expect(analysis.dependencies).toHaveLength(0);
      expect(analysis.exports).toHaveLength(0);
    });

    it('should_detect_optional_parameters', () => {
      const sourceCode = `
export function greet(name: string, greeting?: string): string {
  return \`\${greeting || 'Hello'}, \${name}\`;
}
`;

      const analysis = generator.analyzeCode(sourceCode);
      const func = analysis.functions.find((f) => f.name === 'greet');

      expect(func).toBeDefined();
      expect(func?.params).toHaveLength(2);
      expect(func?.params[1]?.isOptional).toBe(true);
    });

    it('should_detect_default_parameters', () => {
      const sourceCode = `
export function configure(options: Options = {}): Config {
  return { ...defaults, ...options };
}
`;

      const analysis = generator.analyzeCode(sourceCode);
      const func = analysis.functions.find((f) => f.name === 'configure');

      expect(func).toBeDefined();
      expect(func?.params).toHaveLength(1);
      expect(func?.params[0]?.isOptional).toBe(true);
    });
  });

  describe('generateTests', () => {
    const defaultPatterns: CodePatterns = {
      ...DEFAULT_CODE_PATTERNS,
      testFramework: 'vitest',
    };

    it('should_generate_test_suite_for_exported_class', () => {
      const sourceCode = `
export class Calculator {
  public add(a: number, b: number): number {
    return a + b;
  }
}
`;

      const suite = generator.generateTests('src/Calculator.ts', sourceCode, defaultPatterns);

      expect(suite.sourceFile).toBe('src/Calculator.ts');
      expect(suite.testFile).toContain('Calculator.test.ts');
      expect(suite.framework).toBe('vitest');
      expect(suite.suites).toHaveLength(1);
      expect(suite.suites[0].name).toBe('Calculator');
    });

    it('should_generate_test_suite_for_exported_function', () => {
      const sourceCode = `
export function multiply(a: number, b: number): number {
  return a * b;
}
`;

      const suite = generator.generateTests('src/utils.ts', sourceCode, defaultPatterns);

      expect(suite.suites).toHaveLength(1);
      expect(suite.suites[0].name).toBe('multiply');
    });

    it('should_not_generate_tests_for_non_exported_classes', () => {
      const sourceCode = `
class InternalClass {
  public doSomething(): void {}
}
`;

      const suite = generator.generateTests('src/internal.ts', sourceCode, defaultPatterns);

      expect(suite.suites).toHaveLength(0);
    });

    it('should_include_happy_path_tests', () => {
      const sourceCode = `
export class Service {
  public async process(data: string): Promise<Result> {
    return { success: true };
  }
}
`;

      const suite = generator.generateTests('src/Service.ts', sourceCode, defaultPatterns);
      const processTests = suite.suites[0].nestedSuites.find((s) => s.name === 'process');

      expect(processTests).toBeDefined();
      const happyPathTest = processTests?.testCases.find((t) => t.category === 'happy_path');
      expect(happyPathTest).toBeDefined();
    });

    it('should_include_edge_case_tests_when_enabled', () => {
      const edgeCaseGenerator = new TestGenerator({ includeEdgeCases: true });
      const sourceCode = `
export class Validator {
  public validate(input: string): boolean {
    return input.length > 0;
  }
}
`;

      const suite = edgeCaseGenerator.generateTests('src/Validator.ts', sourceCode, defaultPatterns);
      const validateTests = suite.suites[0].nestedSuites.find((s) => s.name === 'validate');

      expect(validateTests).toBeDefined();
      const edgeCaseTest = validateTests?.testCases.find((t) => t.category === 'edge_case');
      expect(edgeCaseTest).toBeDefined();
    });

    it('should_exclude_edge_case_tests_when_disabled', () => {
      const noEdgeCaseGenerator = new TestGenerator({ includeEdgeCases: false });
      const sourceCode = `
export class Validator {
  public validate(input: string): boolean {
    return input.length > 0;
  }
}
`;

      const suite = noEdgeCaseGenerator.generateTests('src/Validator.ts', sourceCode, defaultPatterns);
      const validateTests = suite.suites[0].nestedSuites.find((s) => s.name === 'validate');

      const edgeCaseTest = validateTests?.testCases.find((t) => t.category === 'edge_case');
      expect(edgeCaseTest).toBeUndefined();
    });

    it('should_include_error_handling_tests_when_enabled', () => {
      const sourceCode = `
export class Parser {
  public parse(json: string): object {
    return JSON.parse(json);
  }
}
`;

      const suite = generator.generateTests('src/Parser.ts', sourceCode, defaultPatterns);
      const parseTests = suite.suites[0].nestedSuites.find((s) => s.name === 'parse');

      const errorTest = parseTests?.testCases.find((t) => t.category === 'error_handling');
      expect(errorTest).toBeDefined();
    });

    it('should_use_spec_pattern_when_configured', () => {
      const specGenerator = new TestGenerator({ testFilePattern: 'spec' });
      const sourceCode = `export class MyClass {}`;

      const suite = specGenerator.generateTests('src/MyClass.ts', sourceCode, defaultPatterns);

      expect(suite.testFile).toContain('.spec.ts');
    });

    it('should_handle_jest_framework', () => {
      const jestPatterns: CodePatterns = {
        ...DEFAULT_CODE_PATTERNS,
        testFramework: 'jest',
      };
      const sourceCode = `export class JestService {}`;

      const suite = generator.generateTests('src/JestService.ts', sourceCode, jestPatterns);

      expect(suite.framework).toBe('jest');
    });

    it('should_calculate_total_tests', () => {
      const sourceCode = `
export class Service {
  public methodA(): void {}
  public methodB(): void {}
}
`;

      const suite = generator.generateTests('src/Service.ts', sourceCode, defaultPatterns);

      expect(suite.totalTests).toBeGreaterThan(0);
    });
  });

  describe('generateTestsForFiles', () => {
    const defaultPatterns: CodePatterns = {
      ...DEFAULT_CODE_PATTERNS,
      testFramework: 'vitest',
    };

    it('should_generate_tests_for_multiple_files', () => {
      const files: FileContext[] = [
        {
          path: 'src/ServiceA.ts',
          content: 'export class ServiceA { public run(): void {} }',
          reason: 'Main service',
        },
        {
          path: 'src/ServiceB.ts',
          content: 'export class ServiceB { public execute(): void {} }',
          reason: 'Secondary service',
        },
      ];

      const result = generator.generateTestsForFiles(files, defaultPatterns);

      expect(result.testSuites).toHaveLength(2);
      // Total tests is calculated from nested suites within class suites
      expect(result.testSuites[0].suites).toHaveLength(1);
      expect(result.testSuites[1].suites).toHaveLength(1);
    });

    it('should_skip_test_files', () => {
      const files: FileContext[] = [
        {
          path: 'src/Service.ts',
          content: 'export class Service {}',
          reason: 'Service',
        },
        {
          path: 'tests/Service.test.ts',
          content: 'describe("Service", () => {});',
          reason: 'Existing test',
        },
      ];

      const result = generator.generateTestsForFiles(files, defaultPatterns);

      expect(result.testSuites).toHaveLength(1);
      expect(result.testSuites[0].sourceFile).toBe('src/Service.ts');
    });

    it('should_skip_non_typescript_files', () => {
      const files: FileContext[] = [
        {
          path: 'src/Service.ts',
          content: 'export class Service {}',
          reason: 'TypeScript service',
        },
        {
          path: 'src/config.json',
          content: '{"key": "value"}',
          reason: 'Config file',
        },
      ];

      const result = generator.generateTestsForFiles(files, defaultPatterns);

      expect(result.testSuites).toHaveLength(1);
    });

    it('should_track_coverage_by_category', () => {
      const files: FileContext[] = [
        {
          path: 'src/Service.ts',
          content: 'export class Service { public method(): void {} }',
          reason: 'Service',
        },
      ];

      const result = generator.generateTestsForFiles(files, defaultPatterns);

      expect(result.coverageByCategory).toBeDefined();
      expect(typeof result.coverageByCategory.happy_path).toBe('number');
      expect(typeof result.coverageByCategory.edge_case).toBe('number');
      expect(typeof result.coverageByCategory.error_handling).toBe('number');
    });

    it('should_report_warnings_for_failed_generation', () => {
      const files: FileContext[] = [
        {
          path: 'src/Valid.ts',
          content: 'export class Valid {}',
          reason: 'Valid file',
        },
      ];

      const result = generator.generateTestsForFiles(files, defaultPatterns);

      expect(result.warnings).toBeDefined();
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should_calculate_estimated_coverage', () => {
      const files: FileContext[] = [
        {
          path: 'src/Calculator.ts',
          content: `
export class Calculator {
  public add(a: number, b: number): number { return a + b; }
  public subtract(a: number, b: number): number { return a - b; }
}
`,
          reason: 'Calculator',
        },
      ];

      const result = generator.generateTestsForFiles(files, defaultPatterns);

      expect(result.estimatedCoverage).toBeGreaterThanOrEqual(0);
      expect(result.estimatedCoverage).toBeLessThanOrEqual(100);
    });
  });

  describe('generateTestFileContent', () => {
    const defaultPatterns: CodePatterns = {
      ...DEFAULT_CODE_PATTERNS,
      testFramework: 'vitest',
    };

    it('should_generate_valid_test_file_content', () => {
      const sourceCode = `export class MyClass { public method(): void {} }`;
      const suite = generator.generateTests('src/MyClass.ts', sourceCode, defaultPatterns);

      const content = generator.generateTestFileContent(suite, defaultPatterns);

      expect(content).toContain("import { describe, it, expect");
      expect(content).toContain("describe('MyClass'");
    });

    it('should_use_correct_quote_style', () => {
      const singleQuotePatterns: CodePatterns = {
        ...defaultPatterns,
        quoteStyle: 'single',
      };
      const doubleQuotePatterns: CodePatterns = {
        ...defaultPatterns,
        quoteStyle: 'double',
      };

      const sourceCode = `export class Test {}`;
      const suite = generator.generateTests('src/Test.ts', sourceCode, defaultPatterns);

      const singleContent = generator.generateTestFileContent(suite, singleQuotePatterns);
      const doubleContent = generator.generateTestFileContent(suite, doubleQuotePatterns);

      expect(singleContent).toContain("'vitest'");
      expect(doubleContent).toContain('"vitest"');
    });

    it('should_handle_semicolon_preference', () => {
      const withSemiPatterns: CodePatterns = {
        ...defaultPatterns,
        useSemicolons: true,
      };
      const noSemiPatterns: CodePatterns = {
        ...defaultPatterns,
        useSemicolons: false,
      };

      const sourceCode = `export class Test {}`;
      const suite = generator.generateTests('src/Test.ts', sourceCode, defaultPatterns);

      const withSemiContent = generator.generateTestFileContent(suite, withSemiPatterns);
      const noSemiContent = generator.generateTestFileContent(suite, noSemiPatterns);

      expect(withSemiContent).toMatch(/';$/m);
      expect(noSemiContent).not.toMatch(/';$/m);
    });

    it('should_generate_vitest_imports_for_vitest_framework', () => {
      const suite: TestSuite = {
        sourceFile: 'src/Test.ts',
        testFile: 'tests/Test.test.ts',
        framework: 'vitest',
        suites: [{ name: 'Test', nestedSuites: [], testCases: [] }],
        totalTests: 0,
        estimatedCoverage: 0,
      };

      const content = generator.generateTestFileContent(suite, defaultPatterns);

      expect(content).toContain("from 'vitest'");
    });

    it('should_generate_jest_imports_for_jest_framework', () => {
      const jestPatterns: CodePatterns = {
        ...defaultPatterns,
        testFramework: 'jest',
      };
      const suite: TestSuite = {
        sourceFile: 'src/Test.ts',
        testFile: 'tests/Test.test.ts',
        framework: 'jest',
        suites: [{ name: 'Test', nestedSuites: [], testCases: [] }],
        totalTests: 0,
        estimatedCoverage: 0,
      };

      const content = generator.generateTestFileContent(suite, jestPatterns);

      expect(content).toContain("from '@jest/globals'");
    });
  });

  describe('test naming conventions', () => {
    const defaultPatterns: CodePatterns = {
      ...DEFAULT_CODE_PATTERNS,
      testFramework: 'vitest',
    };

    it('should_use_should_when_convention_by_default', () => {
      const sourceCode = `export function fetchData(): void {}`;
      const suite = generator.generateTests('src/Service.ts', sourceCode, defaultPatterns);

      // For standalone functions, testCases are directly in the suite
      const fetchTests = suite.suites.find((s) => s.name === 'fetchData');
      const testNames = fetchTests?.testCases.map((t) => t.name) ?? [];

      expect(testNames.length).toBeGreaterThan(0);
      expect(testNames.some((n) => n.startsWith('should_'))).toBe(true);
    });

    it('should_use_it_does_convention_when_configured', () => {
      const itDoesGenerator = new TestGenerator({ namingConvention: 'it_does' });
      const sourceCode = `export function fetchData(): void {}`;
      const suite = itDoesGenerator.generateTests('src/Service.ts', sourceCode, defaultPatterns);

      const fetchTests = suite.suites.find((s) => s.name === 'fetchData');
      const testNames = fetchTests?.testCases.map((t) => t.name) ?? [];

      expect(testNames.length).toBeGreaterThan(0);
      expect(testNames.every((n) => !n.startsWith('should_'))).toBe(true);
    });

    it('should_use_test_case_convention_when_configured', () => {
      const testCaseGenerator = new TestGenerator({ namingConvention: 'test_case' });
      const sourceCode = `export function fetchData(): void {}`;
      const suite = testCaseGenerator.generateTests('src/Service.ts', sourceCode, defaultPatterns);

      const fetchTests = suite.suites.find((s) => s.name === 'fetchData');
      const testNames = fetchTests?.testCases.map((t) => t.name) ?? [];

      expect(testNames.length).toBeGreaterThan(0);
      expect(testNames.some((n) => n.startsWith('test_'))).toBe(true);
    });
  });

  describe('mock generation', () => {
    const defaultPatterns: CodePatterns = {
      ...DEFAULT_CODE_PATTERNS,
      testFramework: 'vitest',
    };

    it('should_generate_mocks_with_comprehensive_strategy', () => {
      const comprehensiveGenerator = new TestGenerator({ mockStrategy: 'comprehensive' });
      const sourceCode = `
import { database } from 'external-db';
export class Repository {
  public async save(data: object): Promise<void> {
    await database.insert(data);
  }
}
`;
      const suite = comprehensiveGenerator.generateTests('src/Repository.ts', sourceCode, defaultPatterns);

      const saveTests = suite.suites[0]?.nestedSuites.find((s) => s.name === 'save');
      const hasMocks = saveTests?.testCases.some((t) => t.mocks.length > 0);

      expect(hasMocks).toBe(true);
    });

    it('should_not_generate_mocks_with_minimal_strategy', () => {
      const minimalGenerator = new TestGenerator({ mockStrategy: 'minimal' });
      const sourceCode = `
import { database } from 'external-db';
export class Repository {
  public async save(data: object): Promise<void> {
    await database.insert(data);
  }
}
`;
      const suite = minimalGenerator.generateTests('src/Repository.ts', sourceCode, defaultPatterns);

      const saveTests = suite.suites[0]?.nestedSuites.find((s) => s.name === 'save');
      const allMocksEmpty = saveTests?.testCases.every((t) => t.mocks.length === 0);

      expect(allMocksEmpty).toBe(true);
    });
  });

  describe('class method analysis', () => {
    const defaultPatterns: CodePatterns = {
      ...DEFAULT_CODE_PATTERNS,
      testFramework: 'vitest',
    };

    it('should_generate_tests_for_public_methods_only', () => {
      const sourceCode = `
export class Service {
  public publicMethod(): void {}
  private privateMethod(): void {}
  protected protectedMethod(): void {}
}
`;
      const suite = generator.generateTests('src/Service.ts', sourceCode, defaultPatterns);

      const methodSuites = suite.suites[0]?.nestedSuites.map((s) => s.name) ?? [];

      expect(methodSuites).toContain('publicMethod');
      expect(methodSuites).not.toContain('privateMethod');
      expect(methodSuites).not.toContain('protectedMethod');
    });

    it('should_handle_async_methods_correctly', () => {
      const sourceCode = `
export class AsyncService {
  public async fetchData(): Promise<string> {
    return 'data';
  }
}
`;
      const suite = generator.generateTests('src/AsyncService.ts', sourceCode, defaultPatterns);

      const fetchTests = suite.suites[0]?.nestedSuites.find((s) => s.name === 'fetchData');
      const testCase = fetchTests?.testCases[0];

      expect(testCase?.act).toContain('await');
    });

    it('should_generate_initialization_tests_for_constructor', () => {
      const sourceCode = `
export class ConfigurableService {
  constructor(private readonly config: Config) {}
  public getConfig(): Config { return this.config; }
}
`;
      const suite = generator.generateTests('src/ConfigurableService.ts', sourceCode, defaultPatterns);

      const initSuite = suite.suites[0]?.nestedSuites.find((s) => s.name === 'initialization');

      expect(initSuite).toBeDefined();
      expect(initSuite?.testCases.length).toBeGreaterThan(0);
    });
  });

  describe('test file path generation', () => {
    const defaultPatterns: CodePatterns = {
      ...DEFAULT_CODE_PATTERNS,
      testFramework: 'vitest',
    };

    it('should_place_test_file_in_same_directory_with_test_suffix', () => {
      const sourceCode = `export class Test {}`;
      const suite = generator.generateTests('src/components/Button.ts', sourceCode, defaultPatterns);

      // Test file is placed in same directory structure with .test suffix
      expect(suite.testFile).toContain('components/Button.test.ts');
    });

    it('should_add_test_suffix_to_filename', () => {
      const sourceCode = `export class Test {}`;
      const suite = generator.generateTests('src/Utils.ts', sourceCode, defaultPatterns);

      expect(suite.testFile).toContain('Utils.test.ts');
    });

    it('should_preserve_file_extension', () => {
      const sourceCode = `export class Test {}`;
      const tsxSuite = generator.generateTests('src/Component.tsx', sourceCode, defaultPatterns);

      expect(tsxSuite.testFile).toContain('.tsx');
    });
  });

  describe('AAA pattern compliance', () => {
    const defaultPatterns: CodePatterns = {
      ...DEFAULT_CODE_PATTERNS,
      testFramework: 'vitest',
    };

    it('should_include_arrange_act_assert_in_test_cases', () => {
      const sourceCode = `
export class Calculator {
  public add(a: number, b: number): number {
    return a + b;
  }
}
`;
      const suite = generator.generateTests('src/Calculator.ts', sourceCode, defaultPatterns);

      const addTests = suite.suites[0]?.nestedSuites.find((s) => s.name === 'add');
      const testCase = addTests?.testCases[0];

      expect(testCase?.arrange).toBeDefined();
      expect(testCase?.act).toBeDefined();
      expect(testCase?.assert).toBeDefined();
    });
  });
});
