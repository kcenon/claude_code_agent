/**
 * ModeDetectorAgentAdapter tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import { isAgent } from '../../src/agents/types.js';
import {
  ModeDetectorAgentAdapter,
  MODE_DETECTOR_AGENT_ID,
} from '../../src/mode-detector/ModeDetectorAgentAdapter.js';
import { ModeDetector } from '../../src/mode-detector/ModeDetector.js';

describe('ModeDetectorAgentAdapter', () => {
  let adapter: ModeDetectorAgentAdapter;
  let tempDir: string;

  beforeEach(async () => {
    adapter = new ModeDetectorAgentAdapter();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mode-detector-adapter-test-'));

    // Create minimal project structure for detection
    await fs.mkdir(path.join(tempDir, '.ad-sdlc', 'scratchpad'), { recursive: true });
  });

  afterEach(async () => {
    await adapter.dispose();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('IAgent interface compliance', () => {
    it('should have correct agentId', () => {
      expect(adapter.agentId).toBe(MODE_DETECTOR_AGENT_ID);
      expect(adapter.agentId).toBe('mode-detector');
    });

    it('should have correct name', () => {
      expect(adapter.name).toBe('Mode Detector Agent');
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
      const instance = new ModeDetectorAgentAdapter();
      expect(instance).toBeInstanceOf(ModeDetectorAgentAdapter);
    });

    it('should accept custom configuration', () => {
      const instance = new ModeDetectorAgentAdapter({
        docsBasePath: 'custom-docs',
      });
      expect(instance).toBeInstanceOf(ModeDetectorAgentAdapter);
    });
  });

  describe('initialize()', () => {
    it('should create inner ModeDetector instance', async () => {
      await adapter.initialize();
      expect(adapter.getInner()).toBeInstanceOf(ModeDetector);
    });
  });

  describe('dispose()', () => {
    it('should release inner instance', async () => {
      await adapter.initialize();
      expect(adapter.getInner()).toBeInstanceOf(ModeDetector);

      await adapter.dispose();
      expect(() => adapter.getInner()).toThrow('Agent not initialized');
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

    it('should return ModeDetector after initialization', async () => {
      await adapter.initialize();
      expect(adapter.getInner()).toBeInstanceOf(ModeDetector);
    });
  });

  describe('detect()', () => {
    it('should throw when not initialized', async () => {
      await expect(adapter.detect('proj-1', tempDir)).rejects.toThrow('Agent not initialized');
    });

    it('should detect greenfield mode for empty project', async () => {
      await adapter.initialize();

      const result = await adapter.detect('proj-1', tempDir);

      expect(result).toBeDefined();
      expect(result.selectedMode).toBe('greenfield');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidenceLevel).toBeDefined();
      expect(result.evidence).toBeDefined();
      expect(result.scores).toBeDefined();
    });

    it('should detect enhancement mode when docs exist', async () => {
      await adapter.initialize();

      // Create docs directory with markdown
      const prdDir = path.join(tempDir, 'docs', 'prd');
      await fs.mkdir(prdDir, { recursive: true });
      await fs.writeFile(path.join(prdDir, 'project.md'), '# PRD\nSome content');

      const result = await adapter.detect('proj-2', tempDir);

      expect(result.selectedMode).toBe('enhancement');
    });

    it('should support user override mode', async () => {
      await adapter.initialize();

      const result = await adapter.detect('proj-3', tempDir, '', 'enhancement');

      expect(result.selectedMode).toBe('enhancement');
      expect(result.confidence).toBe(1.0);
    });

    it('should pass user input for keyword analysis', async () => {
      await adapter.initialize();

      const result = await adapter.detect(
        'proj-4',
        tempDir,
        'create a new project from scratch'
      );

      expect(result).toBeDefined();
      expect(result.evidence.keywords).toBeDefined();
    });
  });

  describe('lifecycle sequence', () => {
    it('should support full lifecycle: initialize -> detect -> dispose', async () => {
      await adapter.initialize();

      const result = await adapter.detect('proj-lifecycle', tempDir);
      expect(result.selectedMode).toBeDefined();

      await adapter.dispose();
      expect(() => adapter.getInner()).toThrow('Agent not initialized');
    });
  });

  describe('exported constant', () => {
    it('should export correct agent ID', () => {
      expect(MODE_DETECTOR_AGENT_ID).toBe('mode-detector');
    });
  });
});
