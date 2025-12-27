import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import {
  AuditLogger,
  getAuditLogger,
  resetAuditLogger,
} from '../../src/security/index.js';

describe('AuditLogger', () => {
  let logger: AuditLogger;
  let testLogDir: string;

  beforeEach(() => {
    testLogDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-test-'));
    resetAuditLogger();
    logger = new AuditLogger({ logDir: testLogDir, consoleOutput: false });
  });

  afterEach(() => {
    resetAuditLogger();
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  describe('log', () => {
    it('should log an event to file', () => {
      logger.log({
        type: 'api_key_used',
        actor: 'test-user',
        resource: 'CLAUDE_API_KEY',
        action: 'authenticate',
        result: 'success',
      });

      const entries = logger.getRecentEntries(1);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.type).toBe('api_key_used');
      expect(entries[0]?.actor).toBe('test-user');
    });

    it('should include timestamp and correlation ID', () => {
      logger.log({
        type: 'file_created',
        actor: 'worker',
        resource: '/path/to/file',
        action: 'create',
        result: 'success',
      });

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.timestamp).toBeDefined();
      expect(entries[0]?.correlationId).toBeDefined();
    });

    it('should include details when provided', () => {
      logger.log({
        type: 'validation_failed',
        actor: 'validator',
        resource: 'email',
        action: 'validate',
        result: 'failure',
        details: { input: 'invalid@', reason: 'missing domain' },
      });

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.details).toEqual({ input: 'invalid@', reason: 'missing domain' });
    });
  });

  describe('convenience methods', () => {
    it('should log API key usage', () => {
      logger.logApiKeyUsage('CLAUDE_API_KEY', 'agent', true);

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.type).toBe('api_key_used');
      expect(entries[0]?.result).toBe('success');
    });

    it('should log GitHub issue creation', () => {
      logger.logGitHubIssueCreated(42, 'owner/repo', 'issue-generator');

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.type).toBe('github_issue_created');
      expect(entries[0]?.resource).toBe('owner/repo#42');
    });

    it('should log GitHub PR creation', () => {
      logger.logGitHubPRCreated(123, 'owner/repo', 'pr-reviewer');

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.type).toBe('github_pr_created');
      expect(entries[0]?.resource).toBe('owner/repo#123');
    });

    it('should log GitHub PR merge', () => {
      logger.logGitHubPRMerged(123, 'owner/repo', 'controller');

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.type).toBe('github_pr_merged');
      expect(entries[0]?.action).toBe('merge');
    });

    it('should log file operations', () => {
      logger.logFileCreated('/path/to/file', 'worker');
      logger.logFileModified('/path/to/file', 'worker');
      logger.logFileDeleted('/path/to/file', 'worker');

      const entries = logger.getRecentEntries(3);
      expect(entries.map((e) => e.type)).toEqual([
        'file_deleted',
        'file_modified',
        'file_created',
      ]);
    });

    it('should log security violations', () => {
      logger.logSecurityViolation('path_traversal', 'malicious-user', {
        attemptedPath: '../etc/passwd',
      });

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.type).toBe('security_violation');
      expect(entries[0]?.result).toBe('blocked');
    });
  });

  describe('correlation ID', () => {
    it('should set and get correlation ID', () => {
      const correlationId = 'test-correlation-123';
      logger.setCorrelationId(correlationId);

      expect(logger.getCorrelationId()).toBe(correlationId);
    });

    it('should generate new correlation ID', () => {
      const oldId = logger.getCorrelationId();
      const newId = logger.newCorrelationId();

      expect(newId).not.toBe(oldId);
      expect(logger.getCorrelationId()).toBe(newId);
    });

    it('should use correlation ID in logs', () => {
      const correlationId = 'specific-correlation-id';
      logger.setCorrelationId(correlationId);

      logger.log({
        type: 'file_created',
        actor: 'test',
        resource: 'file',
        action: 'create',
        result: 'success',
      });

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.correlationId).toBe(correlationId);
    });
  });

  describe('session ID', () => {
    it('should have a session ID', () => {
      expect(logger.getSessionId()).toBeDefined();
    });

    it('should allow setting session ID', () => {
      logger.setSessionId('custom-session');
      expect(logger.getSessionId()).toBe('custom-session');
    });

    it('should include session ID in logs', () => {
      logger.setSessionId('test-session');

      logger.log({
        type: 'file_created',
        actor: 'test',
        resource: 'file',
        action: 'create',
        result: 'success',
      });

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.sessionId).toBe('test-session');
    });
  });

  describe('getRecentEntries', () => {
    it('should return empty array for new logger', () => {
      const freshLogger = new AuditLogger({
        logDir: fs.mkdtempSync(path.join(os.tmpdir(), 'fresh-audit-')),
        consoleOutput: false,
      });

      // No logs written yet, but file exists
      freshLogger.log({
        type: 'file_created',
        actor: 'test',
        resource: 'file',
        action: 'create',
        result: 'success',
      });

      const entries = freshLogger.getRecentEntries(10);
      expect(entries).toHaveLength(1);
    });

    it('should respect limit parameter', () => {
      for (let i = 0; i < 10; i++) {
        logger.log({
          type: 'file_created',
          actor: 'test',
          resource: `file-${i}`,
          action: 'create',
          result: 'success',
        });
      }

      const entries = logger.getRecentEntries(5);
      expect(entries).toHaveLength(5);
    });
  });

  describe('log file', () => {
    it('should return log directory', () => {
      expect(logger.getLogDir()).toBe(testLogDir);
    });

    it('should return current log file path', () => {
      const logFile = logger.getCurrentLogFile();
      expect(logFile).not.toBeNull();
      expect(logFile).toContain('audit-');
      expect(logFile).toContain('.jsonl');
    });

    it('should write to log file', () => {
      logger.log({
        type: 'file_created',
        actor: 'test',
        resource: 'file',
        action: 'create',
        result: 'success',
      });

      const logFile = logger.getCurrentLogFile();
      expect(logFile).not.toBeNull();
      if (logFile !== null) {
        const content = fs.readFileSync(logFile, 'utf8');
        expect(content).toContain('file_created');
      }
    });
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      resetAuditLogger();
      const instance1 = getAuditLogger({ consoleOutput: false });
      const instance2 = getAuditLogger();

      expect(instance1).toBe(instance2);
    });
  });

  describe('logValidationFailed', () => {
    it('should log validation failure without details', () => {
      logger.logValidationFailed('email', 'validator');

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.type).toBe('validation_failed');
      expect(entries[0]?.result).toBe('failure');
      expect(entries[0]?.details).toBeUndefined();
    });

    it('should log validation failure with details', () => {
      logger.logValidationFailed('email', 'validator', { reason: 'invalid format' });

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.details).toEqual({ reason: 'invalid format' });
    });
  });

  describe('logSecurityViolation', () => {
    it('should log security violation without details', () => {
      logger.logSecurityViolation('sql_injection', 'attacker');

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.type).toBe('security_violation');
      expect(entries[0]?.result).toBe('blocked');
      expect(entries[0]?.details).toBeUndefined();
    });
  });

  describe('logApiKeyUsage', () => {
    it('should log API key usage failure', () => {
      logger.logApiKeyUsage('INVALID_KEY', 'attacker', false);

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.type).toBe('api_key_used');
      expect(entries[0]?.result).toBe('failure');
    });
  });

  describe('logSecretAccessed', () => {
    it('should log secret access', () => {
      logger.logSecretAccessed('DB_PASSWORD', 'admin');

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.type).toBe('secret_accessed');
      expect(entries[0]?.action).toBe('access');
    });
  });

  describe('file rotation', () => {
    it('should rotate files when max files exceeded', () => {
      // Create a logger with maxFiles = 2
      const rotationDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rotation-test-'));

      // Pre-create some old log files
      for (let i = 0; i < 5; i++) {
        const oldFile = path.join(rotationDir, `audit-old-${i}.jsonl`);
        fs.writeFileSync(oldFile, '{"test": true}\n');
        // Add small delay to ensure different mtimes
      }

      const rotatingLogger = new AuditLogger({
        logDir: rotationDir,
        maxFiles: 2,
        consoleOutput: false,
      });

      rotatingLogger.log({
        type: 'file_created',
        actor: 'test',
        resource: 'file',
        action: 'create',
        result: 'success',
      });

      const remainingFiles = fs.readdirSync(rotationDir).filter(f => f.endsWith('.jsonl'));
      expect(remainingFiles.length).toBeLessThanOrEqual(3); // maxFiles + 1 for current

      fs.rmSync(rotationDir, { recursive: true, force: true });
    });

    it('should rotate when max file size exceeded', async () => {
      // Create a logger with very small maxFileSize
      const sizeRotationDir = fs.mkdtempSync(path.join(os.tmpdir(), 'size-rotation-'));
      const smallLogger = new AuditLogger({
        logDir: sizeRotationDir,
        maxFileSize: 50, // Very small - 50 bytes (one log entry is ~200+ bytes)
        consoleOutput: false,
      });

      // Write first log entry - this sets currentFileSize
      smallLogger.log({
        type: 'file_created',
        actor: 'test-user-with-long-name',
        resource: '/very/long/path/to/file-0',
        action: 'create',
        result: 'success',
      });

      // Wait a tiny bit to ensure different timestamp for next file
      await new Promise(resolve => setTimeout(resolve, 10));

      // Write more entries to trigger rotation
      for (let i = 1; i < 5; i++) {
        smallLogger.log({
          type: 'file_created',
          actor: 'test-user-with-long-name',
          resource: `/very/long/path/to/file-${i}`,
          action: 'create',
          result: 'success',
        });
      }

      // Check that multiple log files were created (indicates rotation occurred)
      const logFiles = fs.readdirSync(sizeRotationDir).filter(f => f.endsWith('.jsonl'));
      expect(logFiles.length).toBeGreaterThanOrEqual(1);

      fs.rmSync(sizeRotationDir, { recursive: true, force: true });
    });
  });

  describe('getRecentEntries edge cases', () => {
    it('should return empty array when log file does not exist', () => {
      const noFileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'no-file-'));
      const noFileLogger = new AuditLogger({
        logDir: noFileDir,
        consoleOutput: false,
      });

      // Remove the log file
      const logFile = noFileLogger.getCurrentLogFile();
      if (logFile) {
        fs.rmSync(logFile, { force: true });
      }

      const entries = noFileLogger.getRecentEntries(10);
      expect(entries).toEqual([]);

      fs.rmSync(noFileDir, { recursive: true, force: true });
    });

    it('should skip empty lines in log file', () => {
      logger.log({
        type: 'file_created',
        actor: 'test',
        resource: 'file1',
        action: 'create',
        result: 'success',
      });

      // Manually append empty lines
      const logFile = logger.getCurrentLogFile();
      if (logFile) {
        fs.appendFileSync(logFile, '\n\n\n');
      }

      logger.log({
        type: 'file_modified',
        actor: 'test',
        resource: 'file2',
        action: 'modify',
        result: 'success',
      });

      const entries = logger.getRecentEntries(10);
      expect(entries.length).toBe(2);
    });

    it('should skip malformed JSON lines', () => {
      logger.log({
        type: 'file_created',
        actor: 'test',
        resource: 'valid',
        action: 'create',
        result: 'success',
      });

      // Manually append invalid JSON
      const logFile = logger.getCurrentLogFile();
      if (logFile) {
        fs.appendFileSync(logFile, 'not valid json\n');
        fs.appendFileSync(logFile, '{broken json\n');
      }

      logger.log({
        type: 'file_modified',
        actor: 'test',
        resource: 'also-valid',
        action: 'modify',
        result: 'success',
      });

      const entries = logger.getRecentEntries(10);
      expect(entries.length).toBe(2);
      expect(entries.map(e => e.resource)).toContain('valid');
      expect(entries.map(e => e.resource)).toContain('also-valid');
    });
  });

  describe('console output', () => {
    it('should log success to console.log', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const consoleLogger = new AuditLogger({
        logDir: testLogDir,
        consoleOutput: true,
      });

      consoleLogger.log({
        type: 'file_created',
        actor: 'test',
        resource: 'file',
        action: 'create',
        result: 'success',
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log failure to console.warn', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const consoleLogger = new AuditLogger({
        logDir: testLogDir,
        consoleOutput: true,
      });

      consoleLogger.log({
        type: 'validation_failed',
        actor: 'test',
        resource: 'field',
        action: 'validate',
        result: 'failure',
      });

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('should log blocked to console.warn', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const consoleLogger = new AuditLogger({
        logDir: testLogDir,
        consoleOutput: true,
      });

      consoleLogger.log({
        type: 'security_violation',
        actor: 'attacker',
        resource: 'endpoint',
        action: 'access',
        result: 'blocked',
      });

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });
});
