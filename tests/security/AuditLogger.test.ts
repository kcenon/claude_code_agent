import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
});
