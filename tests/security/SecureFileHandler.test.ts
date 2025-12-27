import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  SecureFileHandler,
  getSecureFileHandler,
  resetSecureFileHandler,
} from '../../src/security/index.js';

describe('SecureFileHandler', () => {
  let handler: SecureFileHandler;

  beforeEach(() => {
    resetSecureFileHandler();
    handler = new SecureFileHandler({ autoCleanup: false });
  });

  afterEach(async () => {
    await handler.cleanupAll();
    resetSecureFileHandler();
  });

  describe('createTempDir', () => {
    it('should create a temporary directory', async () => {
      const tempDir = await handler.createTempDir();

      expect(fs.existsSync(tempDir)).toBe(true);
      expect(fs.statSync(tempDir).isDirectory()).toBe(true);
    });

    it('should track the created directory', async () => {
      const tempDir = await handler.createTempDir();

      expect(handler.isTracked(tempDir)).toBe(true);
    });

    it('should create directory with restricted permissions', async () => {
      const tempDir = await handler.createTempDir();
      const stats = fs.statSync(tempDir);
      const mode = stats.mode & 0o777;

      // Owner read/write/execute only (0o700)
      expect(mode).toBe(0o700);
    });
  });

  describe('createTempDirSync', () => {
    it('should create a temporary directory synchronously', () => {
      const tempDir = handler.createTempDirSync();

      expect(fs.existsSync(tempDir)).toBe(true);
      expect(handler.isTracked(tempDir)).toBe(true);
    });
  });

  describe('createTempFile', () => {
    it('should create a temporary file with content', async () => {
      const content = 'Test content';
      const tempFile = await handler.createTempFile(content);

      expect(fs.existsSync(tempFile)).toBe(true);
      expect(fs.readFileSync(tempFile, 'utf8')).toBe(content);
    });

    it('should use custom extension', async () => {
      const tempFile = await handler.createTempFile('content', '.json');

      expect(tempFile.endsWith('.json')).toBe(true);
    });

    it('should create file with restricted permissions', async () => {
      const tempFile = await handler.createTempFile('secret');
      const stats = fs.statSync(tempFile);
      const mode = stats.mode & 0o777;

      // Owner read/write only (0o600)
      expect(mode).toBe(0o600);
    });
  });

  describe('createTempFileSync', () => {
    it('should create a temporary file synchronously', () => {
      const content = 'Sync content';
      const tempFile = handler.createTempFileSync(content);

      expect(fs.existsSync(tempFile)).toBe(true);
      expect(fs.readFileSync(tempFile, 'utf8')).toBe(content);
    });
  });

  describe('writeSecure', () => {
    it('should write content with secure permissions', async () => {
      const tempDir = await handler.createTempDir();
      const filePath = path.join(tempDir, 'secure-file.txt');

      await handler.writeSecure(filePath, 'Secure content');

      expect(fs.existsSync(filePath)).toBe(true);
      const stats = fs.statSync(filePath);
      expect(stats.mode & 0o777).toBe(0o600);
    });

    it('should create parent directories', async () => {
      const tempDir = await handler.createTempDir();
      const filePath = path.join(tempDir, 'nested', 'deep', 'file.txt');

      await handler.writeSecure(filePath, 'Content');

      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('readSecure', () => {
    it('should read file content', async () => {
      const content = 'Read this content';
      const tempFile = await handler.createTempFile(content);

      const result = await handler.readSecure(tempFile);

      expect(result).toBe(content);
    });
  });

  describe('deleteSecure', () => {
    it('should delete a file', async () => {
      const tempFile = await handler.createTempFile('To delete');
      const dirPath = path.dirname(tempFile);

      await handler.deleteSecure(tempFile);

      expect(fs.existsSync(tempFile)).toBe(false);
      // Parent directory should still exist
      expect(fs.existsSync(dirPath)).toBe(true);
    });

    it('should delete a directory', async () => {
      const tempDir = await handler.createTempDir();

      await handler.deleteSecure(tempDir);

      expect(fs.existsSync(tempDir)).toBe(false);
      expect(handler.isTracked(tempDir)).toBe(false);
    });

    it('should remove from tracked paths', async () => {
      const tempDir = await handler.createTempDir();
      expect(handler.isTracked(tempDir)).toBe(true);

      await handler.deleteSecure(tempDir);

      expect(handler.isTracked(tempDir)).toBe(false);
    });
  });

  describe('cleanupAll', () => {
    it('should delete all tracked paths', async () => {
      const dir1 = await handler.createTempDir();
      const dir2 = await handler.createTempDir();
      const file1 = await handler.createTempFile('content1');

      await handler.cleanupAll();

      expect(fs.existsSync(dir1)).toBe(false);
      expect(fs.existsSync(dir2)).toBe(false);
      expect(fs.existsSync(path.dirname(file1))).toBe(false);
      expect(handler.getTrackedCount()).toBe(0);
    });
  });

  describe('track and untrack', () => {
    it('should manually track a path', () => {
      const fakePath = '/some/fake/path';
      handler.track(fakePath);

      expect(handler.isTracked(fakePath)).toBe(true);
    });

    it('should untrack a path without deleting', async () => {
      const tempDir = await handler.createTempDir();
      handler.untrack(tempDir);

      expect(handler.isTracked(tempDir)).toBe(false);
      expect(fs.existsSync(tempDir)).toBe(true);

      // Manual cleanup
      fs.rmSync(tempDir, { recursive: true });
    });
  });

  describe('copySecure', () => {
    it('should copy file with secure permissions', async () => {
      const tempDir = await handler.createTempDir();
      const source = path.join(tempDir, 'source.txt');
      const dest = path.join(tempDir, 'dest.txt');

      fs.writeFileSync(source, 'Original content');
      await handler.copySecure(source, dest);

      expect(fs.existsSync(dest)).toBe(true);
      expect(fs.readFileSync(dest, 'utf8')).toBe('Original content');
      expect(fs.statSync(dest).mode & 0o777).toBe(0o600);
    });
  });

  describe('moveSecure', () => {
    it('should move file with secure permissions', async () => {
      const tempDir = await handler.createTempDir();
      const source = path.join(tempDir, 'source.txt');
      const dest = path.join(tempDir, 'dest.txt');

      fs.writeFileSync(source, 'Move me');
      handler.track(source);

      await handler.moveSecure(source, dest);

      expect(fs.existsSync(source)).toBe(false);
      expect(fs.existsSync(dest)).toBe(true);
      expect(handler.isTracked(source)).toBe(false);
      expect(handler.isTracked(dest)).toBe(true);
    });
  });

  describe('exists', () => {
    it('should return true for existing file', async () => {
      const tempFile = await handler.createTempFile('exists');

      expect(await handler.exists(tempFile)).toBe(true);
    });

    it('should return false for non-existing file', async () => {
      expect(await handler.exists('/non/existent/path')).toBe(false);
    });
  });

  describe('getSecureStats', () => {
    it('should return file stats with security info', async () => {
      const tempFile = await handler.createTempFile('stats test');

      const stats = await handler.getSecureStats(tempFile);

      expect(stats.size).toBeGreaterThan(0);
      expect(stats.mode).toBe(0o600);
      expect(stats.isSecure).toBe(true);
      expect(stats.warnings).toHaveLength(0);
    });
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      resetSecureFileHandler();
      const instance1 = getSecureFileHandler();
      const instance2 = getSecureFileHandler();

      expect(instance1).toBe(instance2);
    });
  });
});
