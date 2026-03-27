/**
 * Config loader unit tests
 *
 * Tests critical paths in config/loader.ts including:
 * - Environment detection and resolution
 * - Environment-specific file path construction
 * - Deep merge configuration logic
 * - Config file type detection
 * - Config file existence checks
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import {
  getCurrentEnvironment,
  getEnvConfigFilePath,
  deepMergeConfig,
  getConfigFileType,
  configFilesExist,
  getConfigDir,
  clearConfigCache,
} from '../../src/config/loader.js';

describe('Config Loader', () => {
  describe('getCurrentEnvironment', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      delete process.env['AD_SDLC_ENV'];
      delete process.env['NODE_ENV'];
      // Restore only the keys we care about
      if (originalEnv['AD_SDLC_ENV'] !== undefined) {
        process.env['AD_SDLC_ENV'] = originalEnv['AD_SDLC_ENV'];
      }
      if (originalEnv['NODE_ENV'] !== undefined) {
        process.env['NODE_ENV'] = originalEnv['NODE_ENV'];
      }
    });

    it('should return AD_SDLC_ENV when set', () => {
      process.env['AD_SDLC_ENV'] = 'staging';
      expect(getCurrentEnvironment()).toBe('staging');
    });

    it('should fall back to NODE_ENV when AD_SDLC_ENV is not set', () => {
      delete process.env['AD_SDLC_ENV'];
      process.env['NODE_ENV'] = 'production';
      expect(getCurrentEnvironment()).toBe('production');
    });

    it('should prefer AD_SDLC_ENV over NODE_ENV', () => {
      process.env['AD_SDLC_ENV'] = 'development';
      process.env['NODE_ENV'] = 'production';
      expect(getCurrentEnvironment()).toBe('development');
    });

    it('should return undefined when no env vars are set', () => {
      delete process.env['AD_SDLC_ENV'];
      delete process.env['NODE_ENV'];
      expect(getCurrentEnvironment()).toBeUndefined();
    });
  });

  describe('getEnvConfigFilePath', () => {
    it('should construct environment-specific path', () => {
      const input = path.resolve('/config/workflow.yaml');
      const expected = path.resolve('/config/workflow.development.yaml');
      const result = getEnvConfigFilePath(input, 'development');
      expect(result).toBe(expected);
    });

    it('should handle nested directory paths', () => {
      const input = path.resolve('/a/b/c/agents.yaml');
      const expected = path.resolve('/a/b/c/agents.staging.yaml');
      const result = getEnvConfigFilePath(input, 'staging');
      expect(result).toBe(expected);
    });

    it('should handle production environment', () => {
      const input = path.resolve('/config/workflow.yaml');
      const expected = path.resolve('/config/workflow.production.yaml');
      const result = getEnvConfigFilePath(input, 'production');
      expect(result).toBe(expected);
    });
  });

  describe('deepMergeConfig', () => {
    it('should merge flat objects', () => {
      const base = { a: 1, b: 2 };
      const override = { b: 3, c: 4 };
      expect(deepMergeConfig(base, override)).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should deep merge nested objects', () => {
      const base = { nested: { a: 1, b: 2 }, top: 'value' };
      const override = { nested: { b: 3, c: 4 } };
      expect(deepMergeConfig(base, override)).toEqual({
        nested: { a: 1, b: 3, c: 4 },
        top: 'value',
      });
    });

    it('should replace arrays instead of merging', () => {
      const base = { items: [1, 2, 3] };
      const override = { items: [4, 5] };
      expect(deepMergeConfig(base, override)).toEqual({ items: [4, 5] });
    });

    it('should skip undefined values in override', () => {
      const base = { a: 1, b: 2 };
      const override = { a: undefined, b: 3 };
      expect(deepMergeConfig(base, override)).toEqual({ a: 1, b: 3 });
    });

    it('should return override when base is not a plain object', () => {
      expect(deepMergeConfig(null as unknown as object, { a: 1 })).toEqual({ a: 1 });
      expect(deepMergeConfig([1, 2] as unknown as object, { a: 1 })).toEqual({ a: 1 });
    });

    it('should return override when override is not a plain object', () => {
      const base = { a: 1 };
      expect(deepMergeConfig(base, 'string' as unknown as Partial<typeof base>)).toBe('string');
    });

    it('should handle deeply nested structures', () => {
      const base = { l1: { l2: { l3: { value: 'old' } } } };
      const override = { l1: { l2: { l3: { value: 'new' } } } };
      expect(deepMergeConfig(base, override)).toEqual({
        l1: { l2: { l3: { value: 'new' } } },
      });
    });
  });

  describe('getConfigFileType', () => {
    it('should detect workflow config type', () => {
      expect(getConfigFileType('/path/to/workflow.yaml')).toBe('workflow');
    });

    it('should detect agents config type', () => {
      expect(getConfigFileType('/path/to/agents.yaml')).toBe('agents');
    });

    it('should return null for unknown file types', () => {
      expect(getConfigFileType('/path/to/unknown.yaml')).toBeNull();
      expect(getConfigFileType('/path/to/config.json')).toBeNull();
    });

    it('should match based on filename suffix', () => {
      expect(getConfigFileType('workflow.yaml')).toBe('workflow');
      expect(getConfigFileType('agents.yaml')).toBe('agents');
    });
  });

  describe('configFilesExist', () => {
    it('should return false for non-existent directory', () => {
      const result = configFilesExist('/nonexistent/path/that/does/not/exist');
      expect(result.workflow).toBe(false);
      expect(result.agents).toBe(false);
    });
  });

  describe('getConfigDir', () => {
    it('should resolve path with provided baseDir', () => {
      const projectPath = path.resolve('/my/project');
      const result = getConfigDir(projectPath);
      expect(result).toContain('my');
      expect(result).toContain('project');
      expect(result).toContain('.ad-sdlc');
    });
  });

  describe('clearConfigCache', () => {
    it('should not throw when clearing empty cache', () => {
      expect(() => clearConfigCache()).not.toThrow();
    });
  });
});
