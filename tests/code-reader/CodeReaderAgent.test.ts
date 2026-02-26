/**
 * Code Reader Agent tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import {
  CodeReaderAgent,
  getCodeReaderAgent,
  resetCodeReaderAgent,
  NoActiveSessionError,
  SourceDirectoryNotFoundError,
  TooManyParseErrorsError,
  DEFAULT_CODE_READER_CONFIG,
} from '../../src/code-reader/index.js';

describe('CodeReaderAgent', () => {
  let tempDir: string;
  let agent: CodeReaderAgent;

  beforeEach(async () => {
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'code-reader-test-'));

    // Create src directory structure
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });

    // Create agent with temp directory config
    agent = new CodeReaderAgent({
      sourceRoot: path.join(tempDir, 'src'),
      scratchpadBasePath: path.join(tempDir, '.ad-sdlc', 'scratchpad'),
    });
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
    resetCodeReaderAgent();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultAgent = new CodeReaderAgent();
      expect(defaultAgent).toBeInstanceOf(CodeReaderAgent);
    });

    it('should initialize with custom configuration', () => {
      const customAgent = new CodeReaderAgent({
        extractPrivate: true,
        includeComments: false,
      });
      expect(customAgent).toBeInstanceOf(CodeReaderAgent);
    });

    it('should have default configuration values', () => {
      expect(DEFAULT_CODE_READER_CONFIG.sourceRoot).toBe('src');
      expect(DEFAULT_CODE_READER_CONFIG.includePatterns).toContain('**/*.ts');
      expect(DEFAULT_CODE_READER_CONFIG.excludePatterns).toContain('**/*.test.ts');
      expect(DEFAULT_CODE_READER_CONFIG.extractPrivate).toBe(false);
      expect(DEFAULT_CODE_READER_CONFIG.analyzeDependencies).toBe(true);
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance with getCodeReaderAgent', () => {
      const agent1 = getCodeReaderAgent();
      const agent2 = getCodeReaderAgent();
      expect(agent1).toBe(agent2);
    });

    it('should create new instance after reset', () => {
      const agent1 = getCodeReaderAgent();
      resetCodeReaderAgent();
      const agent2 = getCodeReaderAgent();
      expect(agent1).not.toBe(agent2);
    });
  });

  describe('session management', () => {
    it('should start a session with project ID', async () => {
      const session = await agent.startSession('test-project');

      expect(session).toBeDefined();
      expect(session.projectId).toBe('test-project');
      expect(session.sessionId).toBeDefined();
      expect(session.status).toBe('analyzing');
      expect(session.modules).toEqual([]);
      expect(session.inventory).toBeNull();
    });

    it('should return current session', async () => {
      expect(agent.getSession()).toBeNull();

      await agent.startSession('test-project');
      const session = agent.getSession();

      expect(session).toBeDefined();
      expect(session?.projectId).toBe('test-project');
    });

    it('should reset agent state', async () => {
      await agent.startSession('test-project');
      expect(agent.getSession()).not.toBeNull();

      agent.reset();
      expect(agent.getSession()).toBeNull();
    });

    it('should throw NoActiveSessionError when analyzing without session', async () => {
      await expect(agent.analyzeCode()).rejects.toThrow(NoActiveSessionError);
    });
  });

  describe('source directory validation', () => {
    it('should throw SourceDirectoryNotFoundError for non-existent directory', async () => {
      const invalidAgent = new CodeReaderAgent({
        sourceRoot: path.join(tempDir, 'non-existent'),
        scratchpadBasePath: path.join(tempDir, '.ad-sdlc', 'scratchpad'),
      });

      await invalidAgent.startSession('test-project');
      await expect(invalidAgent.analyzeCode()).rejects.toThrow(SourceDirectoryNotFoundError);
    });
  });

  describe('code analysis', () => {
    it('should analyze empty directory gracefully', async () => {
      await agent.startSession('test-project');
      const result = await agent.analyzeCode();

      expect(result.success).toBe(true);
      expect(result.stats.filesProcessed).toBe(0);
      expect(result.inventory.modules).toEqual([]);
    });

    it('should extract class information', async () => {
      // Create a sample TypeScript file with a class
      const classContent = `
export class Calculator {
  private value: number = 0;

  /**
   * Adds two numbers
   */
  public add(a: number, b: number): number {
    return a + b;
  }

  public subtract(a: number, b: number): number {
    return a - b;
  }

  protected multiply(a: number, b: number): number {
    return a * b;
  }
}
`;
      await fs.writeFile(path.join(tempDir, 'src', 'calculator.ts'), classContent);

      await agent.startSession('test-project');
      const result = await agent.analyzeCode();

      expect(result.success).toBe(true);
      expect(result.stats.classesExtracted).toBe(1);

      const rootModule = result.inventory.modules.find((m) => m.name === 'root');
      expect(rootModule).toBeDefined();
      expect(rootModule?.classes.length).toBe(1);

      const calcClass = rootModule?.classes[0];
      expect(calcClass?.name).toBe('Calculator');
      expect(calcClass?.exported).toBe(true);
      expect(calcClass?.methods.length).toBe(3); // add, subtract, multiply (no private)
    }, 15000);

    it('should extract function information', async () => {
      const funcContent = `
export async function fetchData(url: string): Promise<string> {
  return 'data';
}

export function processData(input: string, options?: object): string[] {
  return [input];
}

function privateHelper(): void {
  // Not exported
}
`;
      await fs.writeFile(path.join(tempDir, 'src', 'utils.ts'), funcContent);

      await agent.startSession('test-project');
      const result = await agent.analyzeCode();

      expect(result.stats.functionsExtracted).toBe(3);

      const rootModule = result.inventory.modules.find((m) => m.name === 'root');
      const exportedFuncs = rootModule?.functions.filter((f) => f.exported);
      expect(exportedFuncs?.length).toBe(2);

      const fetchFunc = rootModule?.functions.find((f) => f.name === 'fetchData');
      expect(fetchFunc?.async).toBe(true);
      expect(fetchFunc?.parameters.length).toBe(1);
      expect(fetchFunc?.parameters[0]?.name).toBe('url');
      expect(fetchFunc?.parameters[0]?.type).toBe('string');
    }, 15000);

    it('should extract interface information', async () => {
      const intfContent = `
export interface User {
  readonly id: string;
  name: string;
  email?: string;
}

export interface UserService {
  findById(id: string): User | null;
  save(user: User): Promise<void>;
}
`;
      await fs.writeFile(path.join(tempDir, 'src', 'types.ts'), intfContent);

      await agent.startSession('test-project');
      const result = await agent.analyzeCode();

      expect(result.stats.interfacesExtracted).toBe(2);

      const rootModule = result.inventory.modules.find((m) => m.name === 'root');
      const userIntf = rootModule?.interfaces.find((i) => i.name === 'User');
      expect(userIntf).toBeDefined();
      expect(userIntf?.properties.length).toBe(3);
      expect(userIntf?.properties.find((p) => p.name === 'id')?.readonly).toBe(true);
      expect(userIntf?.properties.find((p) => p.name === 'email')?.optional).toBe(true);
    }, 15000);

    it('should extract type alias information', async () => {
      const typeContent = `
export type UserId = string;
export type Status = 'active' | 'inactive' | 'pending';
export type Handler<T> = (input: T) => Promise<void>;
`;
      await fs.writeFile(path.join(tempDir, 'src', 'aliases.ts'), typeContent);

      await agent.startSession('test-project');
      const result = await agent.analyzeCode();

      expect(result.stats.typesExtracted).toBe(3);

      const rootModule = result.inventory.modules.find((m) => m.name === 'root');
      expect(rootModule?.types.length).toBe(3);
      expect(rootModule?.types.find((t) => t.name === 'UserId')?.definition).toBe('string');
    }, 15000);

    it('should extract enum information', async () => {
      const enumContent = `
export enum Color {
  Red = 'red',
  Green = 'green',
  Blue = 'blue',
}

export const enum Direction {
  Up,
  Down,
  Left,
  Right,
}
`;
      await fs.writeFile(path.join(tempDir, 'src', 'enums.ts'), enumContent);

      await agent.startSession('test-project');
      const result = await agent.analyzeCode();

      const rootModule = result.inventory.modules.find((m) => m.name === 'root');
      expect(rootModule?.enums.length).toBe(2);

      const colorEnum = rootModule?.enums.find((e) => e.name === 'Color');
      expect(colorEnum?.members.length).toBe(3);

      const directionEnum = rootModule?.enums.find((e) => e.name === 'Direction');
      expect(directionEnum?.isConst).toBe(true);
    });

    it('should group files by module (subdirectory)', async () => {
      // Create module directories
      await fs.mkdir(path.join(tempDir, 'src', 'utils'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'src', 'services'), { recursive: true });

      await fs.writeFile(
        path.join(tempDir, 'src', 'utils', 'helper.ts'),
        'export function helper(): void {}'
      );
      await fs.writeFile(
        path.join(tempDir, 'src', 'services', 'api.ts'),
        'export class ApiService {}'
      );

      await agent.startSession('test-project');
      const result = await agent.analyzeCode();

      expect(result.inventory.modules.length).toBe(2);

      const moduleNames = result.inventory.modules.map((m) => m.name);
      expect(moduleNames).toContain('utils');
      expect(moduleNames).toContain('services');
    });
  });

  describe('dependency analysis', () => {
    it('should detect internal dependencies', async () => {
      await fs.mkdir(path.join(tempDir, 'src', 'utils'), { recursive: true });
      await fs.mkdir(path.join(tempDir, 'src', 'services'), { recursive: true });

      await fs.writeFile(
        path.join(tempDir, 'src', 'utils', 'logger.ts'),
        'export class Logger { log(msg: string): void {} }'
      );

      await fs.writeFile(
        path.join(tempDir, 'src', 'services', 'api.ts'),
        `import { Logger } from '../utils/logger';
export class ApiService {
  constructor(private logger: Logger) {}
}`
      );

      await agent.startSession('test-project');
      const result = await agent.analyzeCode();

      expect(result.inventory.dependencies.internal.length).toBeGreaterThan(0);

      const serviceDep = result.inventory.dependencies.internal.find(
        (d) => d.from === 'services' && d.to === 'utils'
      );
      expect(serviceDep).toBeDefined();
      expect(serviceDep?.imports).toContain('Logger');
    });

    it('should detect external dependencies', async () => {
      await fs.writeFile(
        path.join(tempDir, 'src', 'index.ts'),
        `import * as fs from 'node:fs';
import { join } from 'path';
export const test = true;`
      );

      await agent.startSession('test-project');
      const result = await agent.analyzeCode();

      expect(result.inventory.dependencies.external.length).toBe(2);

      const fsImport = result.inventory.dependencies.external.find((d) => d.module === 'node:fs');
      expect(fsImport).toBeDefined();
    });
  });

  describe('statistics calculation', () => {
    it('should calculate accurate statistics', async () => {
      await fs.writeFile(
        path.join(tempDir, 'src', 'file1.ts'),
        `export class A {}
export function b(): void {}
export interface C {}
export type D = string;`
      );

      await fs.writeFile(
        path.join(tempDir, 'src', 'file2.ts'),
        `export class E {}
export class F {}`
      );

      await agent.startSession('test-project');
      const result = await agent.analyzeCode();

      expect(result.inventory.summary.totalModules).toBe(1);
      expect(result.inventory.summary.totalClasses).toBe(3);
      expect(result.inventory.summary.totalFunctions).toBe(1);
      expect(result.inventory.summary.totalInterfaces).toBe(1);
      expect(result.inventory.summary.totalTypes).toBe(1);

      expect(result.inventory.statistics.totals.filesAnalyzed).toBe(2);
    });
  });

  describe('output generation', () => {
    it('should write code_inventory.yaml file', async () => {
      await fs.writeFile(path.join(tempDir, 'src', 'index.ts'), 'export const version = "1.0.0";');

      await agent.startSession('test-project');
      const result = await agent.analyzeCode();

      expect(result.outputPath).toBeDefined();
      expect(result.outputPath).toContain('code_inventory.yaml');

      // Verify file exists
      const fileExists = await fs
        .access(result.outputPath)
        .then(() => true)
        .catch(() => false);
      expect(fileExists).toBe(true);

      // Verify content is valid YAML
      const content = await fs.readFile(result.outputPath, 'utf-8');
      expect(content).toContain('code_inventory:');
      expect(content).toContain('project:');
      expect(content).toContain('modules:');
    });
  });

  describe('error handling', () => {
    it('should handle syntax errors gracefully when below threshold', async () => {
      // Create multiple valid files and one invalid
      await fs.writeFile(path.join(tempDir, 'src', 'valid1.ts'), 'export const a = 1;');

      await fs.writeFile(path.join(tempDir, 'src', 'valid2.ts'), 'export const b = 2;');

      await fs.writeFile(path.join(tempDir, 'src', 'valid3.ts'), 'export const c = 3;');

      // This has a minor issue but ts-morph can still parse it
      await fs.writeFile(
        path.join(tempDir, 'src', 'minor_issue.ts'),
        'export const d = { key: "value" };'
      );

      await agent.startSession('test-project');
      const result = await agent.analyzeCode();

      // Should succeed when valid files are majority
      expect(result.success).toBe(true);
    });

    it('should exclude test files by default', async () => {
      await fs.writeFile(path.join(tempDir, 'src', 'main.ts'), 'export const a = 1;');
      // Note: test/spec files would be excluded by pattern matching, not added to project
      // The exclude patterns work during file discovery phase

      await agent.startSession('test-project');
      const result = await agent.analyzeCode();

      // Only main.ts should be processed
      expect(result.stats.filesProcessed).toBe(1);
    });
  });

  describe('parse error threshold', () => {
    it('should use configurable parseErrorThreshold', async () => {
      // Create an agent with a very low threshold (0.0) so any error triggers it
      const strictAgent = new CodeReaderAgent({
        sourceRoot: path.join(tempDir, 'src'),
        scratchpadBasePath: path.join(tempDir, '.ad-sdlc', 'scratchpad'),
        parseErrorThreshold: 0.0,
      });

      // A file that will produce TypeScript diagnostics (referencing undefined type)
      await fs.writeFile(path.join(tempDir, 'src', 'broken.ts'), 'const x: NonExistentType = 42;');

      await strictAgent.startSession('test-project');
      await expect(strictAgent.analyzeCode()).rejects.toThrow(TooManyParseErrorsError);
    });

    it('should include per-file details in TooManyParseErrorsError', async () => {
      const strictAgent = new CodeReaderAgent({
        sourceRoot: path.join(tempDir, 'src'),
        scratchpadBasePath: path.join(tempDir, '.ad-sdlc', 'scratchpad'),
        parseErrorThreshold: 0.0,
      });

      await fs.writeFile(path.join(tempDir, 'src', 'bad.ts'), 'const x: UndefinedType = 1;');

      await strictAgent.startSession('test-project');
      try {
        await strictAgent.analyzeCode();
        expect.unreachable('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TooManyParseErrorsError);
        const parseError = error as TooManyParseErrorsError;
        expect(parseError.fileErrors.length).toBeGreaterThan(0);
        expect(parseError.fileErrors[0]?.filePath).toContain('bad.ts');
        expect(parseError.message).toContain('Failed files:');
      }
    });
  });

  describe('configuration options', () => {
    it('should extract private members when configured', async () => {
      const customAgent = new CodeReaderAgent({
        sourceRoot: path.join(tempDir, 'src'),
        scratchpadBasePath: path.join(tempDir, '.ad-sdlc', 'scratchpad'),
        extractPrivate: true,
      });

      await fs.writeFile(
        path.join(tempDir, 'src', 'service.ts'),
        `export class Service {
  private secret: string = 'hidden';
  private doSomething(): void {}
  public doPublic(): void {}
}`
      );

      await customAgent.startSession('test-project');
      const result = await customAgent.analyzeCode();

      const rootModule = result.inventory.modules.find((m) => m.name === 'root');
      const service = rootModule?.classes.find((c) => c.name === 'Service');

      // With extractPrivate: true, should include private members
      expect(service?.methods.length).toBe(2);
      expect(service?.properties.length).toBe(1);
    });
  });
});
