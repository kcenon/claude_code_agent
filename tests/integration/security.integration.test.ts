/**
 * Security module integration tests
 *
 * Tests the interaction between security components
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  SecretManager,
  InputValidator,
  AuditLogger,
  SecureFileHandler,
  RateLimiter,
  resetSecretManager,
  resetAuditLogger,
  resetSecureFileHandler,
} from '../../src/security/index.js';

describe('Security Module Integration', () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a temporary directory for tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'security-integration-'));
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    // Reset singletons
    resetSecretManager();
    resetAuditLogger();
    resetSecureFileHandler();
  });

  describe('SecretManager with AuditLogger', () => {
    it('should log secret access events', () => {
      const secretManager = new SecretManager({
        throwOnMissing: false,
        requiredSecrets: [],
      });
      secretManager.load();
      secretManager.set('TEST_API_KEY', 'secret-value-12345');

      const auditLogger = new AuditLogger({
        logDir: path.join(tempDir, 'audit'),
        consoleOutput: false,
      });

      // Access secret and log it
      const value = secretManager.get('TEST_API_KEY');
      auditLogger.logSecretAccessed('TEST_API_KEY', 'test-user');

      expect(value).toBe('secret-value-12345');

      // Verify audit log was created
      const entries = auditLogger.getRecentEntries();
      expect(entries.length).toBeGreaterThan(0);
      expect(entries[0]?.type).toBe('secret_accessed');
    });

    it('should mask secrets in log messages', () => {
      const secretManager = new SecretManager({
        throwOnMissing: false,
        requiredSecrets: [],
      });
      secretManager.load();
      secretManager.set('API_KEY', 'super-secret-value');

      const message = 'API call with key: super-secret-value failed';
      const masked = secretManager.mask(message);

      expect(masked).not.toContain('super-secret-value');
      expect(masked).toContain('[API_KEY_REDACTED]');
    });
  });

  describe('InputValidator with SecureFileHandler', () => {
    it('should validate paths before secure file operations', async () => {
      const validator = new InputValidator({
        basePath: tempDir,
      });

      const fileHandler = new SecureFileHandler({
        autoCleanup: false,
      });

      // Valid path within base
      const validPath = validator.validateFilePath('subdir/file.txt');
      expect(validPath.startsWith(tempDir)).toBe(true);

      // Create file securely
      await fileHandler.writeSecure(validPath, 'secure content');

      // Verify file exists with correct permissions
      const stats = await fileHandler.getSecureStats(validPath);
      expect(stats.isSecure).toBe(true);

      // Read file securely
      const content = await fileHandler.readSecure(validPath);
      expect(content).toBe('secure content');
    });

    it('should reject path traversal attempts', () => {
      const validator = new InputValidator({
        basePath: tempDir,
      });

      expect(() => validator.validateFilePath('../../../etc/passwd')).toThrow();
      expect(() => validator.validateFilePath('/absolute/path')).toThrow();
    });
  });

  describe('RateLimiter integration', () => {
    it('should work with multiple operations', async () => {
      const limiter = new RateLimiter({
        maxRequests: 3,
        windowMs: 1000,
      });

      const key = 'test-user';

      // First 3 requests should pass
      for (let i = 0; i < 3; i++) {
        expect(limiter.check(key).allowed).toBe(true);
      }

      // 4th request should fail
      expect(limiter.check(key).allowed).toBe(false);

      // Different key should work
      expect(limiter.check('other-user').allowed).toBe(true);

      // Clean up
      limiter.stop();
    });
  });

  describe('Full security workflow', () => {
    it('should handle a complete secure operation', async () => {
      // Initialize components
      const secretManager = new SecretManager({
        throwOnMissing: false,
        requiredSecrets: [],
      });
      secretManager.load();
      secretManager.set('ENCRYPTION_KEY', 'test-encryption-key');

      const validator = new InputValidator({
        basePath: tempDir,
      });

      const fileHandler = new SecureFileHandler({
        autoCleanup: false,
      });

      const auditLogger = new AuditLogger({
        logDir: path.join(tempDir, 'audit'),
        consoleOutput: false,
      });

      const rateLimiter = new RateLimiter({
        maxRequests: 10,
        windowMs: 60000,
      });

      const userId = 'integration-test-user';

      // Check rate limit
      expect(rateLimiter.check(userId).allowed).toBe(true);

      // Validate input path
      const filePath = validator.validateFilePath('secure-data.txt');

      // Write secure content
      const secretKey = secretManager.get('ENCRYPTION_KEY');
      const content = `Encrypted with: ${secretKey}`;
      await fileHandler.writeSecure(filePath, content);

      // Log the operation
      auditLogger.logFileCreated(filePath, userId);

      // Verify
      const entries = auditLogger.getRecentEntries();
      const fileEntry = entries.find((e) => e.type === 'file_created');
      expect(fileEntry).toBeDefined();
      expect(fileEntry?.actor).toBe(userId);

      // Clean up
      rateLimiter.stop();
    });
  });
});
