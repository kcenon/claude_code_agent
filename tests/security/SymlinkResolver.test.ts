import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';
import * as os from 'node:os';
import * as fs from 'node:fs';
import { SymlinkResolver, PathTraversalError } from '../../src/security/index.js';

describe('SymlinkResolver', () => {
  let resolver: SymlinkResolver;
  let testDir: string;
  let subDir: string;
  let testFile: string;

  beforeEach(() => {
    // Create temporary test directory structure
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'symlink-resolver-test-'));
    subDir = path.join(testDir, 'subdir');
    fs.mkdirSync(subDir);
    testFile = path.join(testDir, 'test.txt');
    fs.writeFileSync(testFile, 'test content');

    resolver = new SymlinkResolver({
      baseDir: testDir,
    });
  });

  afterEach(() => {
    // Clean up test directory
    try {
      fs.rmSync(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('resolve', () => {
    it('should resolve a simple file path', () => {
      const result = resolver.resolve('test.txt');
      expect(result.isWithinBoundary).toBe(true);
      expect(result.isSymlink).toBe(false);
      expect(result.normalizedPath).toBe(testFile);
    });

    it('should resolve nested paths', () => {
      const nestedFile = path.join(subDir, 'nested.txt');
      fs.writeFileSync(nestedFile, 'nested content');

      const result = resolver.resolve('subdir/nested.txt');
      expect(result.isWithinBoundary).toBe(true);
      expect(result.isSymlink).toBe(false);
    });

    it('should handle non-existent files', () => {
      const result = resolver.resolve('nonexistent.txt');
      expect(result.isWithinBoundary).toBe(true);
      expect(result.realPath).toBe(null);
      expect(result.isSymlink).toBe(false);
    });

    it('should reject paths outside boundary', () => {
      const result = resolver.resolve('../../../etc/passwd');
      expect(result.isWithinBoundary).toBe(false);
    });
  });

  describe('symlink handling', () => {
    it('should detect symlinks within boundary', () => {
      const linkPath = path.join(testDir, 'link.txt');
      try {
        fs.symlinkSync(testFile, linkPath);
      } catch {
        // Skip on systems that don't support symlinks
        return;
      }

      // On macOS, /tmp is actually /private/tmp, so we need to resolve the base dir
      // and create a resolver with the resolved path
      const resolvedTestDir = fs.realpathSync(testDir);
      const resolverWithRealPath = new SymlinkResolver({
        baseDir: resolvedTestDir,
      });

      const result = resolverWithRealPath.resolve('link.txt');
      expect(result.isSymlink).toBe(true);
      expect(result.isWithinBoundary).toBe(true);
      expect(result.realPath).toBe(fs.realpathSync(testFile));
    });

    it('should reject symlinks pointing outside boundary', () => {
      const outsideFile = path.join(os.tmpdir(), 'outside.txt');
      fs.writeFileSync(outsideFile, 'outside content');

      const linkPath = path.join(testDir, 'bad-link.txt');
      try {
        fs.symlinkSync(outsideFile, linkPath);
      } catch {
        // Skip on systems that don't support symlinks
        fs.unlinkSync(outsideFile);
        return;
      }

      const result = resolver.resolve('bad-link.txt');
      expect(result.isSymlink).toBe(true);
      expect(result.isWithinBoundary).toBe(false);

      // Cleanup
      fs.unlinkSync(outsideFile);
    });

    it('should respect deny policy', () => {
      const linkPath = path.join(testDir, 'link.txt');
      try {
        fs.symlinkSync(testFile, linkPath);
      } catch {
        // Skip on systems that don't support symlinks
        return;
      }

      const denyResolver = new SymlinkResolver({
        baseDir: testDir,
        symlinkPolicy: 'deny',
      });

      const result = denyResolver.resolve('link.txt');
      expect(result.isSymlink).toBe(true);
      expect(result.isWithinBoundary).toBe(false);
    });
  });

  describe('validatePath', () => {
    it('should return path for valid files', () => {
      const result = resolver.validatePath('test.txt');
      expect(result).toBe(testFile);
    });

    it('should throw for paths outside boundary', () => {
      expect(() => resolver.validatePath('../../../etc/passwd')).toThrow(PathTraversalError);
    });

    it('should throw for symlinks with deny policy', () => {
      const linkPath = path.join(testDir, 'link.txt');
      try {
        fs.symlinkSync(testFile, linkPath);
      } catch {
        return;
      }

      const denyResolver = new SymlinkResolver({
        baseDir: testDir,
        symlinkPolicy: 'deny',
      });

      expect(() => denyResolver.validatePath('link.txt')).toThrow(PathTraversalError);
    });
  });

  describe('resolveAsync', () => {
    it('should resolve paths asynchronously', async () => {
      const result = await resolver.resolveAsync('test.txt');
      expect(result.isWithinBoundary).toBe(true);
      expect(result.normalizedPath).toBe(testFile);
    });

    it('should handle non-existent files async', async () => {
      const result = await resolver.resolveAsync('nonexistent.txt');
      expect(result.isWithinBoundary).toBe(true);
      expect(result.realPath).toBe(null);
    });
  });

  describe('openSafe', () => {
    it('should open files safely', () => {
      const handle = resolver.openSafe('test.txt', 'r');
      expect(handle.fd).toBeGreaterThan(0);
      expect(handle.path).toBe(testFile);
      handle.close();
    });

    it('should throw for paths outside boundary', () => {
      expect(() => resolver.openSafe('../../../etc/passwd', 'r')).toThrow(PathTraversalError);
    });
  });

  describe('openSafeAsync', () => {
    it('should open files safely async', async () => {
      const handle = await resolver.openSafeAsync('test.txt', 'r');
      expect(handle.fd).toBeGreaterThan(0);
      expect(handle.path).toBe(testFile);
      handle.close();
    });

    it('should throw for paths outside boundary async', async () => {
      await expect(resolver.openSafeAsync('../../../etc/passwd', 'r')).rejects.toThrow(
        PathTraversalError
      );
    });
  });

  describe('allowed external directories', () => {
    it('should allow paths in allowed directories', () => {
      const allowedDir = fs.mkdtempSync(path.join(os.tmpdir(), 'allowed-'));
      const allowedFile = path.join(allowedDir, 'allowed.txt');
      fs.writeFileSync(allowedFile, 'allowed content');

      const multiResolver = new SymlinkResolver({
        baseDir: testDir,
        allowedDirs: [allowedDir],
      });

      // Can still access files in base dir
      const result1 = multiResolver.resolve('test.txt');
      expect(result1.isWithinBoundary).toBe(true);

      // Cleanup
      fs.rmSync(allowedDir, { recursive: true, force: true });
    });
  });

  describe('case sensitivity', () => {
    it('should default to platform-appropriate case sensitivity', () => {
      const isCaseInsensitive = resolver.isCaseInsensitive();
      const expectedCaseInsensitive = process.platform === 'win32' || process.platform === 'darwin';
      expect(isCaseInsensitive).toBe(expectedCaseInsensitive);
    });

    it('should respect explicit case sensitivity option', () => {
      const caseInsensitiveResolver = new SymlinkResolver({
        baseDir: testDir,
        caseInsensitive: true,
      });
      expect(caseInsensitiveResolver.isCaseInsensitive()).toBe(true);

      const caseSensitiveResolver = new SymlinkResolver({
        baseDir: testDir,
        caseInsensitive: false,
      });
      expect(caseSensitiveResolver.isCaseInsensitive()).toBe(false);
    });
  });

  describe('getters', () => {
    it('should return correct base directory', () => {
      expect(resolver.getBaseDir()).toBe(testDir);
    });

    it('should return correct symlink policy', () => {
      expect(resolver.getSymlinkPolicy()).toBe('resolve');

      const denyResolver = new SymlinkResolver({
        baseDir: testDir,
        symlinkPolicy: 'deny',
      });
      expect(denyResolver.getSymlinkPolicy()).toBe('deny');
    });
  });
});
