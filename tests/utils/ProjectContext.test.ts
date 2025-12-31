import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  getProjectContext,
  initializeProject,
  getProjectRoot,
  tryGetProjectRoot,
  resolveProjectPath,
  isProjectInitialized,
  isPathWithinProject,
  resetProjectContext,
  ProjectContextError,
} from '../../src/utils/ProjectContext.js';

describe('ProjectContext', () => {
  let tempDir: string;

  beforeEach(() => {
    // Reset singleton state before each test
    resetProjectContext();

    // Create temp directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-context-test-'));
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
    // Reset singleton state after each test
    resetProjectContext();
  });

  describe('initializeProject', () => {
    it('should initialize with valid directory', () => {
      initializeProject(tempDir, { silent: true });

      expect(isProjectInitialized()).toBe(true);
      expect(getProjectRoot()).toBe(tempDir);
    });

    it('should throw ProjectContextError for non-existent directory', () => {
      const nonExistentPath = path.join(tempDir, 'non-existent');

      expect(() => initializeProject(nonExistentPath, { silent: true })).toThrow(
        ProjectContextError
      );
      expect(() => initializeProject(nonExistentPath, { silent: true })).toThrow(
        'does not exist'
      );
    });

    it('should throw ProjectContextError for file path instead of directory', () => {
      const filePath = path.join(tempDir, 'test-file.txt');
      fs.writeFileSync(filePath, 'test content');

      expect(() => initializeProject(filePath, { silent: true })).toThrow(
        ProjectContextError
      );
      expect(() => initializeProject(filePath, { silent: true })).toThrow(
        'not a directory'
      );
    });

    it('should resolve relative paths to absolute', () => {
      const originalCwd = process.cwd();
      try {
        process.chdir(tempDir);
        initializeProject('.', { silent: true });

        // Use realpathSync to handle macOS symlinks (/var -> /private/var)
        const resolvedTempDir = fs.realpathSync(tempDir);
        expect(getProjectRoot()).toBe(resolvedTempDir);
      } finally {
        process.chdir(originalCwd);
      }
    });

    it('should warn when .ad-sdlc directory is missing (non-silent mode)', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      initializeProject(tempDir);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('.ad-sdlc directory not found')
      );
      consoleSpy.mockRestore();
    });

    it('should not warn when silent option is true', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      initializeProject(tempDir, { silent: true });

      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should throw when requireAdSdlc is true and .ad-sdlc is missing', () => {
      expect(() => initializeProject(tempDir, { requireAdSdlc: true, silent: true })).toThrow(
        ProjectContextError
      );
      expect(() => initializeProject(tempDir, { requireAdSdlc: true, silent: true })).toThrow(
        '.ad-sdlc directory not found'
      );
    });

    it('should succeed when .ad-sdlc directory exists', () => {
      const adSdlcPath = path.join(tempDir, '.ad-sdlc');
      fs.mkdirSync(adSdlcPath);

      initializeProject(tempDir, { silent: true });

      expect(isProjectInitialized()).toBe(true);
    });
  });

  describe('getProjectRoot', () => {
    it('should return project root when initialized', () => {
      initializeProject(tempDir, { silent: true });

      expect(getProjectRoot()).toBe(tempDir);
    });

    it('should throw when not initialized', () => {
      expect(() => getProjectRoot()).toThrow(ProjectContextError);
      expect(() => getProjectRoot()).toThrow('not initialized');
    });
  });

  describe('tryGetProjectRoot', () => {
    it('should return project root when initialized', () => {
      initializeProject(tempDir, { silent: true });

      expect(tryGetProjectRoot()).toBe(tempDir);
    });

    it('should return undefined when not initialized', () => {
      expect(tryGetProjectRoot()).toBeUndefined();
    });
  });

  describe('resolveProjectPath', () => {
    it('should resolve relative paths against project root', () => {
      initializeProject(tempDir, { silent: true });

      const resolved = resolveProjectPath('src/index.ts');

      expect(resolved).toBe(path.join(tempDir, 'src/index.ts'));
    });

    it('should handle absolute paths correctly', () => {
      initializeProject(tempDir, { silent: true });
      const absolutePath = '/absolute/path';

      const resolved = resolveProjectPath(absolutePath);

      expect(resolved).toBe(absolutePath);
    });

    it('should throw when not initialized', () => {
      expect(() => resolveProjectPath('src/index.ts')).toThrow(ProjectContextError);
    });
  });

  describe('isPathWithinProject', () => {
    it('should return true for paths within project', () => {
      initializeProject(tempDir, { silent: true });

      expect(isPathWithinProject(path.join(tempDir, 'src'))).toBe(true);
      expect(isPathWithinProject(path.join(tempDir, 'src', 'index.ts'))).toBe(true);
    });

    it('should return false for paths outside project', () => {
      initializeProject(tempDir, { silent: true });

      expect(isPathWithinProject('/tmp')).toBe(false);
      expect(isPathWithinProject(path.join(tempDir, '..', 'other'))).toBe(false);
    });

    it('should throw when not initialized', () => {
      expect(() => isPathWithinProject('/some/path')).toThrow(ProjectContextError);
    });
  });

  describe('isProjectInitialized', () => {
    it('should return false before initialization', () => {
      expect(isProjectInitialized()).toBe(false);
    });

    it('should return true after initialization', () => {
      initializeProject(tempDir, { silent: true });

      expect(isProjectInitialized()).toBe(true);
    });

    it('should return false after reset', () => {
      initializeProject(tempDir, { silent: true });
      resetProjectContext();

      expect(isProjectInitialized()).toBe(false);
    });
  });

  describe('resetProjectContext', () => {
    it('should reset initialization state', () => {
      initializeProject(tempDir, { silent: true });
      expect(isProjectInitialized()).toBe(true);

      resetProjectContext();

      expect(isProjectInitialized()).toBe(false);
      expect(tryGetProjectRoot()).toBeUndefined();
    });

    it('should allow re-initialization after reset', () => {
      initializeProject(tempDir, { silent: true });
      const firstRoot = getProjectRoot();

      resetProjectContext();

      // Create another temp dir for re-initialization
      const secondTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-context-test2-'));
      try {
        initializeProject(secondTempDir, { silent: true });

        expect(getProjectRoot()).toBe(secondTempDir);
        expect(getProjectRoot()).not.toBe(firstRoot);
      } finally {
        fs.rmSync(secondTempDir, { recursive: true });
      }
    });
  });

  describe('singleton behavior', () => {
    it('should return same instance from getProjectContext', () => {
      const context1 = getProjectContext();
      const context2 = getProjectContext();

      expect(context1).toBe(context2);
    });

    it('should maintain state across getProjectContext calls', () => {
      const context1 = getProjectContext();
      context1.initialize(tempDir, { silent: true });

      const context2 = getProjectContext();
      expect(context2.isInitialized()).toBe(true);
      expect(context2.getProjectRoot()).toBe(tempDir);
    });
  });

  describe('CWD warning', () => {
    it('should warn when CWD differs from project root', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Initialize with a path different from cwd
      initializeProject(tempDir);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('differs from project root')
      );
      consoleSpy.mockRestore();
    });
  });
});
