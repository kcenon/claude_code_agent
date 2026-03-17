/**
 * Tests for ConfigWatcher atomic reload with rollback
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FileValidationResult } from '../../src/config/types.js';

// Use vi.hoisted to create mock functions available in vi.mock factories
const {
  mockWarn,
  mockError,
  mockSnapshotConfigCache,
  mockRestoreConfigCache,
  mockValidateConfigFile,
} = vi.hoisted(() => ({
  mockWarn: vi.fn(),
  mockError: vi.fn(),
  mockSnapshotConfigCache: vi.fn(),
  mockRestoreConfigCache: vi.fn(),
  mockValidateConfigFile: vi.fn(),
}));

// Use a hoisted cache store for the loader mock
const { cacheStore } = vi.hoisted(() => ({
  cacheStore: new Map<string, unknown>(),
}));

// Mock loader module with explicit functions
vi.mock('../../src/config/loader.js', () => ({
  validateConfigFile: mockValidateConfigFile,
  getConfigDir: vi.fn().mockReturnValue('/mock/config'),
  getAllConfigFilePaths: vi.fn().mockReturnValue({
    workflow: '/mock/config/workflow.yaml',
    agents: '/mock/config/agents.yaml',
  }),
  snapshotConfigCache: mockSnapshotConfigCache,
  restoreConfigCache: mockRestoreConfigCache,
  clearConfigCache: vi.fn(),
  invalidateConfigCache: vi.fn(),
  getConfigCacheStats: vi.fn().mockReturnValue({ size: 0, entries: [] }),
}));

// Mock node:fs to prevent actual file watching
vi.mock('node:fs', () => ({
  watch: vi.fn().mockReturnValue({
    on: vi.fn(),
    close: vi.fn(),
  }),
  existsSync: vi.fn().mockReturnValue(true),
}));

// Mock utils
vi.mock('../../src/utils/index.js', () => ({
  tryGetProjectRoot: vi.fn().mockReturnValue('/mock/project'),
}));

// Mock logging using hoisted mock functions
vi.mock('../../src/logging/index.js', () => ({
  getLogger: vi.fn().mockReturnValue({
    child: vi.fn().mockReturnValue({
      warn: mockWarn,
      error: mockError,
      info: vi.fn(),
      debug: vi.fn(),
    }),
  }),
}));

// Import after mocks are set up
import { ConfigWatcher } from '../../src/config/watcher.js';

/**
 * Helper: trigger a file change event on the first watched file
 * and flush the debounce timer + microtasks
 */
async function triggerFileChange(): Promise<void> {
  const { watch: fsWatch } = await import('node:fs');
  const watchCall = vi.mocked(fsWatch).mock.calls[0];
  const listener = watchCall?.[1] as (eventType: string) => void;
  listener('change');

  // Use runAllTimersAsync to flush both the debounce setTimeout and
  // any microtasks from the async handler
  await vi.runAllTimersAsync();
}

describe('ConfigWatcher Atomic Reload', () => {
  let watcher: ConfigWatcher;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    cacheStore.clear();

    // Re-apply mock implementations after clearAllMocks
    mockSnapshotConfigCache.mockImplementation((filePath: string) => {
      const data = cacheStore.get(filePath);
      if (data === undefined) return undefined;
      return structuredClone(data);
    });

    mockRestoreConfigCache.mockImplementation((filePath: string, data: unknown) => {
      cacheStore.set(filePath, data);
    });

    watcher = new ConfigWatcher('/mock/project');
  });

  afterEach(() => {
    watcher.close();
    vi.useRealTimers();
  });

  describe('snapshot and rollback on validation failure', () => {
    it('should snapshot config before validation', async () => {
      cacheStore.set('/mock/config/workflow.yaml', { version: '1.0.0', name: 'test' });

      const validResult: FileValidationResult = {
        filePath: '/mock/config/workflow.yaml',
        valid: true,
        errors: [],
        schemaVersion: '1.0.0',
      };
      mockValidateConfigFile.mockResolvedValue(validResult);

      const callback = vi.fn();
      watcher.watch(callback, { debounceMs: 0 });

      await triggerFileChange();

      expect(mockSnapshotConfigCache).toHaveBeenCalledWith('/mock/config/workflow.yaml');
    });

    it('should rollback to snapshot when validation fails', async () => {
      const previousConfig = { version: '1.0.0', name: 'valid-config' };
      cacheStore.set('/mock/config/workflow.yaml', previousConfig);

      const invalidResult: FileValidationResult = {
        filePath: '/mock/config/workflow.yaml',
        valid: false,
        errors: [{ path: 'name', message: 'Invalid name' }],
        schemaVersion: '1.0.0',
      };
      mockValidateConfigFile.mockResolvedValue(invalidResult);

      const callback = vi.fn();
      watcher.watch(callback, { debounceMs: 0 });

      await triggerFileChange();

      expect(mockRestoreConfigCache).toHaveBeenCalledWith(
        '/mock/config/workflow.yaml',
        previousConfig
      );
    });

    it('should log WARN on rollback', async () => {
      cacheStore.set('/mock/config/workflow.yaml', { version: '1.0.0' });

      const invalidResult: FileValidationResult = {
        filePath: '/mock/config/workflow.yaml',
        valid: false,
        errors: [{ path: 'version', message: 'Bad version' }],
        schemaVersion: '1.0.0',
      };
      mockValidateConfigFile.mockResolvedValue(invalidResult);

      const callback = vi.fn();
      watcher.watch(callback, { debounceMs: 0 });

      await triggerFileChange();

      expect(mockWarn).toHaveBeenCalledWith(
        'Configuration validation failed, rolled back to previous valid config',
        expect.objectContaining({
          filePath: '/mock/config/workflow.yaml',
          errors: invalidResult.errors,
        })
      );
    });

    it('should still invoke callback with invalid result after rollback', async () => {
      cacheStore.set('/mock/config/workflow.yaml', { version: '1.0.0' });

      const invalidResult: FileValidationResult = {
        filePath: '/mock/config/workflow.yaml',
        valid: false,
        errors: [{ path: 'name', message: 'Missing name' }],
        schemaVersion: '1.0.0',
      };
      mockValidateConfigFile.mockResolvedValue(invalidResult);

      const callback = vi.fn();
      watcher.watch(callback, { debounceMs: 0 });

      await triggerFileChange();

      expect(callback).toHaveBeenCalledWith('/mock/config/workflow.yaml', invalidResult);
    });

    it('should update snapshot on successful validation', async () => {
      cacheStore.set('/mock/config/workflow.yaml', { version: '1.0.0', name: 'old' });

      const validResult: FileValidationResult = {
        filePath: '/mock/config/workflow.yaml',
        valid: true,
        errors: [],
        schemaVersion: '1.0.0',
      };
      mockValidateConfigFile.mockResolvedValue(validResult);

      const callback = vi.fn();
      watcher.watch(callback, { debounceMs: 0 });

      await triggerFileChange();

      // snapshotConfigCache is called: once before validation, once after success
      expect(mockSnapshotConfigCache).toHaveBeenCalledTimes(2);
    });

    it('should not rollback when there is no previous snapshot', async () => {
      // No data in cache store => snapshot returns undefined

      const invalidResult: FileValidationResult = {
        filePath: '/mock/config/workflow.yaml',
        valid: false,
        errors: [{ path: 'name', message: 'Invalid' }],
        schemaVersion: '1.0.0',
      };
      mockValidateConfigFile.mockResolvedValue(invalidResult);

      const callback = vi.fn();
      watcher.watch(callback, { debounceMs: 0 });

      await triggerFileChange();

      expect(callback).toHaveBeenCalled();
      expect(mockRestoreConfigCache).not.toHaveBeenCalled();
      expect(mockWarn).not.toHaveBeenCalled();
    });

    it('should not snapshot or restore when validateOnChange is false', async () => {
      cacheStore.set('/mock/config/workflow.yaml', { version: '1.0.0' });

      const callback = vi.fn();
      watcher.watch(callback, { debounceMs: 0, validateOnChange: false });

      await triggerFileChange();

      expect(mockSnapshotConfigCache).not.toHaveBeenCalled();
      expect(mockRestoreConfigCache).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(
        '/mock/config/workflow.yaml',
        expect.objectContaining({ valid: true })
      );
    });
  });

  describe('rollback on unexpected errors', () => {
    it('should rollback on unexpected error during reload', async () => {
      const previousConfig = { version: '1.0.0', name: 'safe' };
      cacheStore.set('/mock/config/workflow.yaml', previousConfig);

      mockValidateConfigFile.mockRejectedValue(new Error('Unexpected parse error'));

      const onError = vi.fn();
      const callback = vi.fn();
      watcher.watch(callback, { debounceMs: 0, onError });

      await triggerFileChange();

      expect(mockRestoreConfigCache).toHaveBeenCalledWith(
        '/mock/config/workflow.yaml',
        previousConfig
      );

      expect(mockWarn).toHaveBeenCalledWith(
        'Configuration reload error, rolled back to previous valid config',
        expect.objectContaining({
          filePath: '/mock/config/workflow.yaml',
          error: 'Unexpected parse error',
        })
      );

      expect(onError).toHaveBeenCalled();
    });

    it('should not rollback on error when no snapshot exists', async () => {
      // No data in cache store

      mockValidateConfigFile.mockRejectedValue(new Error('Parse error'));

      const onError = vi.fn();
      watcher.watch(vi.fn(), { debounceMs: 0, onError });

      await triggerFileChange();

      expect(mockRestoreConfigCache).not.toHaveBeenCalled();
      expect(mockWarn).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalled();
    });
  });

  describe('close', () => {
    it('should clear config snapshots on close', () => {
      watcher.close();
      expect(watcher.isActive()).toBe(false);
    });
  });
});
