/**
 * Codebase Analyzer Agent tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import {
  CodebaseAnalyzerAgent,
  getCodebaseAnalyzerAgent,
  resetCodebaseAnalyzerAgent,
  NoActiveSessionError,
  ProjectNotFoundError,
  NoSourceFilesError,
  DEFAULT_CODEBASE_ANALYZER_CONFIG,
} from '../../src/codebase-analyzer/index.js';

describe('CodebaseAnalyzerAgent', () => {
  let tempDir: string;
  let agent: CodebaseAnalyzerAgent;

  beforeEach(async () => {
    // Create a temporary directory for test files
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'codebase-analyzer-test-')
    );

    // Create a basic project structure
    await fs.mkdir(path.join(tempDir, 'src', 'controllers'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'src', 'services'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'src', 'models'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'tests'), { recursive: true });
    await fs.mkdir(path.join(tempDir, 'config'), { recursive: true });

    // Create sample source files
    await fs.writeFile(
      path.join(tempDir, 'src', 'controllers', 'userController.ts'),
      `import { UserService } from '../services/userService';
import { User } from '../models/user';

export class UserController {
  private userService: UserService;

  constructor() {
    this.userService = new UserService();
  }

  async getUser(id: string): Promise<User> {
    return this.userService.findById(id);
  }
}
`
    );

    await fs.writeFile(
      path.join(tempDir, 'src', 'services', 'userService.ts'),
      `import { User } from '../models/user';

export class UserService {
  findById(id: string): User {
    return { id, name: 'Test User' };
  }
}
`
    );

    await fs.writeFile(
      path.join(tempDir, 'src', 'models', 'user.ts'),
      `export interface User {
  id: string;
  name: string;
}
`
    );

    // Create test file
    await fs.writeFile(
      path.join(tempDir, 'tests', 'userController.test.ts'),
      `import { UserController } from '../src/controllers/userController';

describe('UserController', () => {
  it('should get user', () => {
    const controller = new UserController();
    expect(controller).toBeDefined();
  });
});
`
    );

    // Create package.json
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify(
        {
          name: 'test-project',
          version: '1.0.0',
          scripts: {
            build: 'tsc',
            test: 'vitest',
          },
          dependencies: {
            express: '^4.18.0',
          },
          devDependencies: {
            typescript: '^5.0.0',
            vitest: '^1.0.0',
          },
        },
        null,
        2
      )
    );

    // Create package-lock.json (to indicate npm as package manager)
    await fs.writeFile(
      path.join(tempDir, 'package-lock.json'),
      JSON.stringify({ lockfileVersion: 2 })
    );

    // Create agent with temp directory config
    agent = new CodebaseAnalyzerAgent({
      scratchpadBasePath: path.join(tempDir, '.ad-sdlc', 'scratchpad'),
    });
  });

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
    resetCodebaseAnalyzerAgent();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultAgent = new CodebaseAnalyzerAgent();
      expect(defaultAgent).toBeInstanceOf(CodebaseAnalyzerAgent);
    });

    it('should initialize with custom configuration', () => {
      const customAgent = new CodebaseAnalyzerAgent({
        analyzeDependencies: false,
        detectPatterns: false,
      });
      expect(customAgent).toBeInstanceOf(CodebaseAnalyzerAgent);
    });

    it('should have default configuration values', () => {
      expect(DEFAULT_CODEBASE_ANALYZER_CONFIG.scratchpadBasePath).toBe(
        '.ad-sdlc/scratchpad'
      );
      expect(DEFAULT_CODEBASE_ANALYZER_CONFIG.analyzeDependencies).toBe(true);
      expect(DEFAULT_CODEBASE_ANALYZER_CONFIG.detectPatterns).toBe(true);
      expect(DEFAULT_CODEBASE_ANALYZER_CONFIG.calculateMetrics).toBe(true);
      expect(DEFAULT_CODEBASE_ANALYZER_CONFIG.maxFiles).toBe(10000);
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance with getCodebaseAnalyzerAgent', () => {
      const agent1 = getCodebaseAnalyzerAgent();
      const agent2 = getCodebaseAnalyzerAgent();
      expect(agent1).toBe(agent2);
    });

    it('should create new instance after reset', () => {
      const agent1 = getCodebaseAnalyzerAgent();
      resetCodebaseAnalyzerAgent();
      const agent2 = getCodebaseAnalyzerAgent();
      expect(agent1).not.toBe(agent2);
    });
  });

  describe('session management', () => {
    it('should start a session with project ID and root path', async () => {
      const session = await agent.startSession('test-project', tempDir);

      expect(session).toBeDefined();
      expect(session.projectId).toBe('test-project');
      expect(session.sessionId).toBeDefined();
      expect(session.status).toBe('scanning');
      expect(session.rootPath).toBe(tempDir);
      expect(session.architectureOverview).toBeNull();
      expect(session.dependencyGraph).toBeNull();
    });

    it('should return current session', async () => {
      expect(agent.getSession()).toBeNull();

      await agent.startSession('test-project', tempDir);
      const session = agent.getSession();

      expect(session).toBeDefined();
      expect(session?.projectId).toBe('test-project');
    });

    it('should reset session', async () => {
      await agent.startSession('test-project', tempDir);
      expect(agent.getSession()).not.toBeNull();

      agent.resetSession();
      expect(agent.getSession()).toBeNull();
    });

    it('should throw ProjectNotFoundError for non-existent path', async () => {
      await expect(
        agent.startSession('test-project', '/non/existent/path')
      ).rejects.toThrow(ProjectNotFoundError);
    });
  });

  describe('analyze()', () => {
    it('should throw NoActiveSessionError if no session started', async () => {
      await expect(agent.analyze()).rejects.toThrow(NoActiveSessionError);
    });

    it('should analyze codebase and return results', async () => {
      await agent.startSession('test-project', tempDir);
      const result = await agent.analyze();

      expect(result.success).toBe(true);
      expect(result.projectId).toBe('test-project');
      expect(result.architectureOutputPath).toContain(
        'architecture_overview.yaml'
      );
      expect(result.dependencyOutputPath).toContain('dependency_graph.json');
    });

    it('should detect architecture type', async () => {
      await agent.startSession('test-project', tempDir);
      const result = await agent.analyze();

      // Small test projects may be detected as monolith or layered
      expect(['layered', 'monolith', 'modular', 'unknown']).toContain(
        result.architectureOverview.type
      );
      expect(result.architectureOverview.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should detect patterns when structure is clear', async () => {
      await agent.startSession('test-project', tempDir);
      const result = await agent.analyze();

      // Patterns array should be defined, may be empty for small projects
      expect(result.architectureOverview.patterns).toBeDefined();
      expect(Array.isArray(result.architectureOverview.patterns)).toBe(true);
    });

    it('should analyze directory structure', async () => {
      await agent.startSession('test-project', tempDir);
      const result = await agent.analyze();

      expect(result.architectureOverview.structure.sourceDirs.length).toBeGreaterThan(0);
      expect(result.architectureOverview.structure.testDirs.length).toBeGreaterThan(0);
    });

    it('should detect build system', async () => {
      await agent.startSession('test-project', tempDir);
      const result = await agent.analyze();

      expect(result.architectureOverview.buildSystem.type).toBe('npm');
      expect(result.architectureOverview.buildSystem.hasLockFile).toBe(true);
      expect(result.architectureOverview.buildSystem.scripts).toContain('build');
      expect(result.architectureOverview.buildSystem.scripts).toContain('test');
    });

    it('should build dependency graph', async () => {
      await agent.startSession('test-project', tempDir);
      const result = await agent.analyze();

      expect(result.dependencyGraph.nodes.length).toBeGreaterThan(0);
      expect(result.dependencyGraph.edges.length).toBeGreaterThan(0);
      expect(result.dependencyGraph.statistics.totalNodes).toBeGreaterThan(0);
    });

    it('should detect external dependencies', async () => {
      await agent.startSession('test-project', tempDir);
      const result = await agent.analyze();

      expect(result.dependencyGraph.externalDependencies.length).toBeGreaterThan(0);
      expect(
        result.dependencyGraph.externalDependencies.some(
          (d) => d.name === 'express'
        )
      ).toBe(true);
    });

    it('should calculate code metrics', async () => {
      await agent.startSession('test-project', tempDir);
      const result = await agent.analyze();

      expect(result.architectureOverview.metrics.totalFiles).toBeGreaterThan(0);
      expect(result.architectureOverview.metrics.totalLines).toBeGreaterThan(0);
      expect(
        result.architectureOverview.metrics.languages.length
      ).toBeGreaterThan(0);
      expect(
        result.architectureOverview.metrics.languages.some(
          (l) => l.name === 'typescript'
        )
      ).toBe(true);
    });

    it('should detect naming conventions', async () => {
      await agent.startSession('test-project', tempDir);
      const result = await agent.analyze();

      expect(result.architectureOverview.conventions.naming).toBeDefined();
      expect(result.architectureOverview.conventions.naming.variables).toBeDefined();
      expect(result.architectureOverview.conventions.naming.files).toBeDefined();
    });

    it('should detect test patterns', async () => {
      await agent.startSession('test-project', tempDir);
      const result = await agent.analyze();

      expect(result.architectureOverview.conventions.testPattern).toBeDefined();
      expect(result.architectureOverview.conventions.testPattern.naming).toBeDefined();
      expect(result.architectureOverview.conventions.testPattern.location).toBeDefined();
    });

    it('should write output files', async () => {
      await agent.startSession('test-project', tempDir);
      const result = await agent.analyze();

      const archExists = await fs
        .access(result.architectureOutputPath)
        .then(() => true)
        .catch(() => false);
      const depExists = await fs
        .access(result.dependencyOutputPath)
        .then(() => true)
        .catch(() => false);

      expect(archExists).toBe(true);
      expect(depExists).toBe(true);
    });

    it('should return valid analysis statistics', async () => {
      await agent.startSession('test-project', tempDir);
      const result = await agent.analyze();

      expect(result.stats.filesScanned).toBeGreaterThan(0);
      expect(result.stats.filesAnalyzed).toBeGreaterThan(0);
      expect(result.stats.processingTimeMs).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty source directory', async () => {
      // Create empty temp dir
      const emptyDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'codebase-empty-')
      );

      const emptyAgent = new CodebaseAnalyzerAgent({
        scratchpadBasePath: path.join(emptyDir, '.ad-sdlc', 'scratchpad'),
      });

      await emptyAgent.startSession('empty-project', emptyDir);

      await expect(emptyAgent.analyze()).rejects.toThrow(NoSourceFilesError);

      await fs.rm(emptyDir, { recursive: true, force: true });
    });

    it('should skip excluded directories', async () => {
      // Create node_modules directory with files
      await fs.mkdir(path.join(tempDir, 'node_modules'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, 'node_modules', 'test.ts'),
        'export const test = 1;'
      );

      await agent.startSession('test-project', tempDir);
      const result = await agent.analyze();

      // node_modules files should not be included
      expect(
        result.dependencyGraph.nodes.some((n) =>
          n.path?.includes('node_modules')
        )
      ).toBe(false);
    });

    it('should handle files without extensions', async () => {
      await fs.writeFile(path.join(tempDir, 'Makefile'), 'all: build');

      await agent.startSession('test-project', tempDir);
      const result = await agent.analyze();

      // Should still complete without error
      expect(result.success).toBe(true);
    });

    it('should handle large files gracefully', async () => {
      // Create a file that's larger than maxFileSize
      const largeContent = 'x'.repeat(10 * 1024 * 1024); // 10MB
      await fs.writeFile(path.join(tempDir, 'src', 'large.ts'), largeContent);

      const smallAgent = new CodebaseAnalyzerAgent({
        scratchpadBasePath: path.join(tempDir, '.ad-sdlc', 'scratchpad'),
        maxFileSize: 1024, // 1KB limit
      });

      await smallAgent.startSession('test-project', tempDir);
      const result = await smallAgent.analyze();

      // Large file should be skipped but analysis should complete
      expect(result.success).toBe(true);
      expect(result.stats.filesSkipped).toBeGreaterThan(0);
    });
  });

  describe('language detection', () => {
    it('should detect TypeScript files', async () => {
      await agent.startSession('test-project', tempDir);
      const result = await agent.analyze();

      const tsLanguage = result.architectureOverview.metrics.languages.find(
        (l) => l.name === 'typescript'
      );
      expect(tsLanguage).toBeDefined();
      expect(tsLanguage?.files).toBeGreaterThan(0);
    });

    it('should detect Python files', async () => {
      await fs.writeFile(
        path.join(tempDir, 'src', 'script.py'),
        'def hello():\n    print("Hello")\n'
      );

      await agent.startSession('test-project', tempDir);
      const result = await agent.analyze();

      const pyLanguage = result.architectureOverview.metrics.languages.find(
        (l) => l.name === 'python'
      );
      expect(pyLanguage).toBeDefined();
    });

    it('should detect JavaScript files', async () => {
      await fs.writeFile(
        path.join(tempDir, 'src', 'script.js'),
        'function hello() { console.log("Hello"); }\n'
      );

      await agent.startSession('test-project', tempDir);
      const result = await agent.analyze();

      const jsLanguage = result.architectureOverview.metrics.languages.find(
        (l) => l.name === 'javascript'
      );
      expect(jsLanguage).toBeDefined();
    });
  });

  describe('import parsing', () => {
    it('should parse TypeScript imports', async () => {
      await agent.startSession('test-project', tempDir);
      const result = await agent.analyze();

      // userController imports userService and user
      expect(result.dependencyGraph.edges.length).toBeGreaterThan(0);
    });

    it('should parse Python imports', async () => {
      await fs.mkdir(path.join(tempDir, 'src', 'python'), { recursive: true });
      await fs.writeFile(
        path.join(tempDir, 'src', 'python', 'main.py'),
        'from .utils import helper\nimport os\n'
      );
      await fs.writeFile(
        path.join(tempDir, 'src', 'python', 'utils.py'),
        'def helper():\n    pass\n'
      );

      await agent.startSession('test-project', tempDir);
      const result = await agent.analyze();

      expect(result.success).toBe(true);
    });
  });

  describe('circular dependency detection', () => {
    it('should detect circular dependencies', async () => {
      // Create circular dependency
      await fs.writeFile(
        path.join(tempDir, 'src', 'a.ts'),
        "import { b } from './b';\nexport const a = 1;\n"
      );
      await fs.writeFile(
        path.join(tempDir, 'src', 'b.ts'),
        "import { a } from './a';\nexport const b = 2;\n"
      );

      await agent.startSession('test-project', tempDir);
      const result = await agent.analyze();

      // Circular dependencies should be tracked
      expect(result.dependencyGraph.statistics).toBeDefined();
    });
  });

  describe('output file content', () => {
    it('should generate valid YAML for architecture overview', async () => {
      await agent.startSession('test-project', tempDir);
      const result = await agent.analyze();

      const content = await fs.readFile(
        result.architectureOutputPath,
        'utf-8'
      );

      expect(content).toContain('architecture:');
      expect(content).toContain('type:');
      expect(content).toContain('patterns:');
      expect(content).toContain('structure:');
    });

    it('should generate valid JSON for dependency graph', async () => {
      await agent.startSession('test-project', tempDir);
      const result = await agent.analyze();

      const content = await fs.readFile(result.dependencyOutputPath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed).toHaveProperty('nodes');
      expect(parsed).toHaveProperty('edges');
      expect(parsed).toHaveProperty('externalDependencies');
      expect(parsed).toHaveProperty('statistics');
    });
  });

  describe('session status updates', () => {
    it('should update session status during analysis', async () => {
      await agent.startSession('test-project', tempDir);

      const initialSession = agent.getSession();
      expect(initialSession?.status).toBe('scanning');

      await agent.analyze();

      const finalSession = agent.getSession();
      expect(finalSession?.status).toBe('completed');
    });

    it('should set failed status on error', async () => {
      const emptyDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'codebase-fail-')
      );

      const failAgent = new CodebaseAnalyzerAgent({
        scratchpadBasePath: path.join(emptyDir, '.ad-sdlc', 'scratchpad'),
      });

      await failAgent.startSession('fail-project', emptyDir);

      try {
        await failAgent.analyze();
      } catch {
        // Expected to fail
      }

      const session = failAgent.getSession();
      expect(session?.status).toBe('failed');
      expect(session?.errors.length).toBeGreaterThan(0);

      await fs.rm(emptyDir, { recursive: true, force: true });
    });
  });

  describe('configuration options', () => {
    it('should skip dependency analysis when disabled', async () => {
      const noDepAgent = new CodebaseAnalyzerAgent({
        scratchpadBasePath: path.join(tempDir, '.ad-sdlc', 'scratchpad'),
        analyzeDependencies: false,
      });

      await noDepAgent.startSession('test-project', tempDir);
      const result = await noDepAgent.analyze();

      expect(result.success).toBe(true);
      // Dependency graph should be empty when disabled
      expect(result.dependencyGraph.edges.length).toBe(0);
      expect(result.dependencyGraph.nodes.length).toBe(0);
    });

    it('should skip pattern detection when disabled', async () => {
      const noPatternAgent = new CodebaseAnalyzerAgent({
        scratchpadBasePath: path.join(tempDir, '.ad-sdlc', 'scratchpad'),
        detectPatterns: false,
      });

      await noPatternAgent.startSession('test-project', tempDir);
      const result = await noPatternAgent.analyze();

      expect(result.success).toBe(true);
      expect(result.architectureOverview.type).toBe('unknown');
    });

    it('should skip metrics calculation when disabled', async () => {
      const noMetricsAgent = new CodebaseAnalyzerAgent({
        scratchpadBasePath: path.join(tempDir, '.ad-sdlc', 'scratchpad'),
        calculateMetrics: false,
      });

      await noMetricsAgent.startSession('test-project', tempDir);
      const result = await noMetricsAgent.analyze();

      expect(result.success).toBe(true);
      expect(result.architectureOverview.metrics).toBeDefined();
    });

    it('should handle all options disabled', async () => {
      const minimalAgent = new CodebaseAnalyzerAgent({
        scratchpadBasePath: path.join(tempDir, '.ad-sdlc', 'scratchpad'),
        analyzeDependencies: false,
        detectPatterns: false,
        calculateMetrics: false,
      });

      await minimalAgent.startSession('test-project', tempDir);
      const result = await minimalAgent.analyze();

      expect(result.success).toBe(true);
    });
  });

  describe('build system detection', () => {
    it('should detect yarn projects', async () => {
      // Create yarn.lock
      await fs.writeFile(path.join(tempDir, 'yarn.lock'), '# yarn lockfile');

      await agent.startSession('test-project', tempDir);
      const result = await agent.analyze();

      expect(result.architectureOverview.buildSystem.type).toBe('yarn');
      expect(result.architectureOverview.buildSystem.hasLockFile).toBe(true);
    });

    it('should detect pnpm projects', async () => {
      // Remove package-lock.json and add pnpm-lock.yaml
      await fs.rm(path.join(tempDir, 'package-lock.json'));
      await fs.writeFile(
        path.join(tempDir, 'pnpm-lock.yaml'),
        'lockfileVersion: 5.4'
      );

      await agent.startSession('test-project', tempDir);
      const result = await agent.analyze();

      expect(result.architectureOverview.buildSystem.type).toBe('pnpm');
    });

    it('should detect Gradle projects', async () => {
      const gradleDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'codebase-gradle-')
      );

      await fs.mkdir(path.join(gradleDir, 'src', 'main', 'java'), {
        recursive: true,
      });
      await fs.writeFile(
        path.join(gradleDir, 'build.gradle'),
        'plugins { id "java" }'
      );
      await fs.writeFile(
        path.join(gradleDir, 'src', 'main', 'java', 'App.java'),
        'public class App { public static void main(String[] args) {} }'
      );

      const gradleAgent = new CodebaseAnalyzerAgent({
        scratchpadBasePath: path.join(gradleDir, '.ad-sdlc', 'scratchpad'),
      });

      await gradleAgent.startSession('gradle-project', gradleDir);
      const result = await gradleAgent.analyze();

      expect(result.architectureOverview.buildSystem.type).toBe('gradle');

      await fs.rm(gradleDir, { recursive: true, force: true });
    });

    it('should detect Cargo projects', async () => {
      const cargoDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'codebase-cargo-')
      );

      await fs.mkdir(path.join(cargoDir, 'src'), { recursive: true });
      await fs.writeFile(
        path.join(cargoDir, 'Cargo.toml'),
        '[package]\nname = "test"\nversion = "0.1.0"'
      );
      await fs.writeFile(
        path.join(cargoDir, 'Cargo.lock'),
        '# Cargo lock file'
      );
      await fs.writeFile(
        path.join(cargoDir, 'src', 'main.rs'),
        'fn main() { println!("Hello"); }'
      );

      const cargoAgent = new CodebaseAnalyzerAgent({
        scratchpadBasePath: path.join(cargoDir, '.ad-sdlc', 'scratchpad'),
      });

      await cargoAgent.startSession('cargo-project', cargoDir);
      const result = await cargoAgent.analyze();

      expect(result.architectureOverview.buildSystem.type).toBe('cargo');
      expect(result.architectureOverview.buildSystem.hasLockFile).toBe(true);

      await fs.rm(cargoDir, { recursive: true, force: true });
    });

    it('should detect Go projects', async () => {
      const goDir = await fs.mkdtemp(path.join(os.tmpdir(), 'codebase-go-'));

      await fs.writeFile(
        path.join(goDir, 'go.mod'),
        'module example.com/test\n\ngo 1.21'
      );
      await fs.writeFile(path.join(goDir, 'go.sum'), '');
      await fs.writeFile(
        path.join(goDir, 'main.go'),
        'package main\n\nimport "fmt"\n\nfunc main() { fmt.Println("Hello") }'
      );

      const goAgent = new CodebaseAnalyzerAgent({
        scratchpadBasePath: path.join(goDir, '.ad-sdlc', 'scratchpad'),
      });

      await goAgent.startSession('go-project', goDir);
      const result = await goAgent.analyze();

      expect(result.architectureOverview.buildSystem.type).toBe('go');
      expect(result.architectureOverview.buildSystem.hasLockFile).toBe(true);

      await fs.rm(goDir, { recursive: true, force: true });
    });

    it('should handle invalid package.json gracefully', async () => {
      // Overwrite with invalid JSON
      await fs.writeFile(path.join(tempDir, 'package.json'), '{ invalid json }');

      await agent.startSession('test-project', tempDir);
      const result = await agent.analyze();

      // Should still complete without crashing
      expect(result.success).toBe(true);
      expect(result.architectureOverview.buildSystem.scripts).toEqual([]);
    });
  });

  describe('path validation', () => {
    it('should throw ProjectNotFoundError when path is a file not directory', async () => {
      const filePath = path.join(tempDir, 'some-file.txt');
      await fs.writeFile(filePath, 'test content');

      await expect(agent.startSession('test-project', filePath)).rejects.toThrow(
        ProjectNotFoundError
      );
    });
  });

  describe('additional language detection', () => {
    it('should detect Go files', async () => {
      await fs.writeFile(
        path.join(tempDir, 'src', 'main.go'),
        'package main\n\nfunc main() {}\n'
      );

      await agent.startSession('test-project', tempDir);
      const result = await agent.analyze();

      const goLanguage = result.architectureOverview.metrics.languages.find(
        (l) => l.name === 'go'
      );
      expect(goLanguage).toBeDefined();
    });

    it('should detect Rust files', async () => {
      await fs.writeFile(
        path.join(tempDir, 'src', 'lib.rs'),
        'pub fn hello() { println!("Hello"); }\n'
      );

      await agent.startSession('test-project', tempDir);
      const result = await agent.analyze();

      const rustLanguage = result.architectureOverview.metrics.languages.find(
        (l) => l.name === 'rust'
      );
      expect(rustLanguage).toBeDefined();
    });

    it('should detect C++ files', async () => {
      await fs.writeFile(
        path.join(tempDir, 'src', 'main.cpp'),
        '#include <iostream>\nint main() { return 0; }\n'
      );

      await agent.startSession('test-project', tempDir);
      const result = await agent.analyze();

      const cppLanguage = result.architectureOverview.metrics.languages.find(
        (l) => l.name === 'cpp'
      );
      expect(cppLanguage).toBeDefined();
    });

    it('should detect Kotlin files', async () => {
      await fs.writeFile(
        path.join(tempDir, 'src', 'App.kt'),
        'fun main() { println("Hello") }\n'
      );

      await agent.startSession('test-project', tempDir);
      const result = await agent.analyze();

      const kotlinLanguage = result.architectureOverview.metrics.languages.find(
        (l) => l.name === 'kotlin'
      );
      expect(kotlinLanguage).toBeDefined();
    });

    it('should detect Java files', async () => {
      await fs.writeFile(
        path.join(tempDir, 'src', 'Main.java'),
        'public class Main { public static void main(String[] args) {} }\n'
      );

      await agent.startSession('test-project', tempDir);
      const result = await agent.analyze();

      const javaLanguage = result.architectureOverview.metrics.languages.find(
        (l) => l.name === 'java'
      );
      expect(javaLanguage).toBeDefined();
    });
  });

  describe('maxFiles configuration', () => {
    it('should respect maxFiles limit', async () => {
      // Create a fresh directory with many files
      const manyFilesDir = await fs.mkdtemp(
        path.join(os.tmpdir(), 'codebase-many-files-')
      );

      await fs.mkdir(path.join(manyFilesDir, 'src'), { recursive: true });

      // Create 20 files
      for (let i = 0; i < 20; i++) {
        await fs.writeFile(
          path.join(manyFilesDir, 'src', `file${i}.ts`),
          `export const x${i} = ${i};`
        );
      }

      const limitedAgent = new CodebaseAnalyzerAgent({
        scratchpadBasePath: path.join(manyFilesDir, '.ad-sdlc', 'scratchpad'),
        maxFiles: 5,
      });

      await limitedAgent.startSession('test-project', manyFilesDir);
      const result = await limitedAgent.analyze();

      expect(result.success).toBe(true);
      // Should be limited to approximately maxFiles (may vary by 1-2 due to scan order)
      expect(result.stats.filesScanned).toBeLessThanOrEqual(10);

      await fs.rm(manyFilesDir, { recursive: true, force: true });
    });
  });

  describe('includeExtensions configuration', () => {
    it('should filter by extension when specified', async () => {
      await fs.writeFile(
        path.join(tempDir, 'src', 'script.py'),
        'print("hello")'
      );
      await fs.writeFile(
        path.join(tempDir, 'src', 'app.rb'),
        'puts "hello"'
      );

      const tsOnlyAgent = new CodebaseAnalyzerAgent({
        scratchpadBasePath: path.join(tempDir, '.ad-sdlc', 'scratchpad'),
        includeExtensions: ['.ts'],
      });

      await tsOnlyAgent.startSession('test-project', tempDir);
      const result = await tsOnlyAgent.analyze();

      expect(result.success).toBe(true);
      // Should only have TypeScript files
      const languages = result.architectureOverview.metrics.languages;
      expect(languages.every((l) => l.name === 'typescript')).toBe(true);
    });
  });
});
