/**
 * ProjectInitializerAgentAdapter tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import { isAgent } from '../../src/agents/types.js';
import {
  ProjectInitializerAgentAdapter,
  PROJECT_INITIALIZER_AGENT_ID,
} from '../../src/project-initializer/ProjectInitializerAgentAdapter.js';
import { ProjectInitializer } from '../../src/project-initializer/ProjectInitializer.js';
import type { InitOptions } from '../../src/project-initializer/types.js';

describe('ProjectInitializerAgentAdapter', () => {
  let adapter: ProjectInitializerAgentAdapter;
  let tempDir: string;

  const makeOptions = (targetDir: string): InitOptions => ({
    projectName: 'test-project',
    techStack: 'typescript',
    template: 'minimal',
    targetDir,
    skipValidation: true,
  });

  beforeEach(async () => {
    adapter = new ProjectInitializerAgentAdapter();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pi-adapter-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('IAgent interface compliance', () => {
    it('should have correct agentId', () => {
      expect(adapter.agentId).toBe(PROJECT_INITIALIZER_AGENT_ID);
      expect(adapter.agentId).toBe('project-initializer');
    });

    it('should have correct name', () => {
      expect(adapter.name).toBe('Project Initializer Agent');
    });

    it('should pass isAgent type guard', () => {
      expect(isAgent(adapter)).toBe(true);
    });

    it('should implement initialize() and dispose()', async () => {
      await expect(adapter.initialize()).resolves.toBeUndefined();
      await expect(adapter.dispose()).resolves.toBeUndefined();
    });
  });

  describe('constructor', () => {
    it('should accept no arguments', () => {
      const instance = new ProjectInitializerAgentAdapter();
      expect(instance).toBeInstanceOf(ProjectInitializerAgentAdapter);
    });

    it('should accept default options', () => {
      const instance = new ProjectInitializerAgentAdapter(makeOptions(tempDir));
      expect(instance).toBeInstanceOf(ProjectInitializerAgentAdapter);
    });
  });

  describe('initialize()', () => {
    it('should create inner instance when default options provided', async () => {
      const adapterWithOptions = new ProjectInitializerAgentAdapter(makeOptions(tempDir));
      await adapterWithOptions.initialize();

      expect(adapterWithOptions.getInner()).toBeInstanceOf(ProjectInitializer);
    });

    it('should not create inner instance when no default options', async () => {
      await adapter.initialize();

      expect(() => adapter.getInner()).toThrow('Agent not initialized');
    });
  });

  describe('dispose()', () => {
    it('should release inner instance', async () => {
      const adapterWithOptions = new ProjectInitializerAgentAdapter(makeOptions(tempDir));
      await adapterWithOptions.initialize();
      expect(adapterWithOptions.getInner()).toBeInstanceOf(ProjectInitializer);

      await adapterWithOptions.dispose();
      expect(() => adapterWithOptions.getInner()).toThrow('Agent not initialized');
    });

    it('should be safe to call multiple times', async () => {
      await adapter.dispose();
      await adapter.dispose();
    });
  });

  describe('getInner()', () => {
    it('should throw when not initialized', () => {
      expect(() => adapter.getInner()).toThrow('Agent not initialized');
    });

    it('should return ProjectInitializer after initialize with options', async () => {
      const adapterWithOptions = new ProjectInitializerAgentAdapter(makeOptions(tempDir));
      await adapterWithOptions.initialize();

      expect(adapterWithOptions.getInner()).toBeInstanceOf(ProjectInitializer);
    });
  });

  describe('execute()', () => {
    it('should throw when no options provided and no default options', async () => {
      await adapter.initialize();

      await expect(adapter.execute()).rejects.toThrow(
        'Agent not initialized: provide options via constructor or execute()'
      );
    });

    it('should create instance and execute with provided options', async () => {
      await adapter.initialize();

      const result = await adapter.execute(makeOptions(tempDir));
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      expect(typeof result.projectPath).toBe('string');
    });

    it('should allow execute with options even without prior initialize', async () => {
      const result = await adapter.execute(makeOptions(tempDir));
      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
    });

    it('should return successful result for valid temp directory', async () => {
      const result = await adapter.execute(makeOptions(tempDir));
      expect(result.success).toBe(true);
      expect(result.createdFiles.length).toBeGreaterThan(0);
    });
  });

  describe('lifecycle sequence', () => {
    it('should support full lifecycle: initialize -> use -> dispose', async () => {
      const adapterWithOptions = new ProjectInitializerAgentAdapter(makeOptions(tempDir));

      await adapterWithOptions.initialize();
      expect(adapterWithOptions.getInner()).toBeInstanceOf(ProjectInitializer);

      await adapterWithOptions.dispose();
      expect(() => adapterWithOptions.getInner()).toThrow('Agent not initialized');
    });
  });

  describe('exported constant', () => {
    it('should export correct agent ID', () => {
      expect(PROJECT_INITIALIZER_AGENT_ID).toBe('project-initializer');
    });
  });
});
