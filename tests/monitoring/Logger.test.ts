import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { Logger, getLogger, resetLogger } from '../../src/monitoring/index.js';

describe('Logger', () => {
  let logger: Logger;
  let testLogDir: string;

  beforeEach(() => {
    testLogDir = fs.mkdtempSync(path.join(os.tmpdir(), 'logger-test-'));
    resetLogger();
    logger = new Logger({ logDir: testLogDir, consoleOutput: false });
  });

  afterEach(() => {
    resetLogger();
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true });
    }
  });

  describe('log levels', () => {
    it('should log debug messages', () => {
      const debugLogger = new Logger({
        logDir: testLogDir,
        minLevel: 'DEBUG',
        consoleOutput: false,
      });

      debugLogger.debug('Debug message', { key: 'value' });

      const entries = debugLogger.getRecentEntries(1);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.level).toBe('DEBUG');
      expect(entries[0]?.message).toBe('Debug message');
    });

    it('should log info messages', () => {
      logger.info('Info message', { data: 123 });

      const entries = logger.getRecentEntries(1);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.level).toBe('INFO');
    });

    it('should log warning messages', () => {
      logger.warn('Warning message');

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.level).toBe('WARN');
    });

    it('should log error messages', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', error, { context: 'test' });

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.level).toBe('ERROR');
      expect(entries[0]?.error?.message).toBe('Test error');
    });

    it('should filter by minimum log level', () => {
      const infoLogger = new Logger({
        logDir: testLogDir,
        minLevel: 'INFO',
        consoleOutput: false,
      });

      infoLogger.debug('Should not appear');
      infoLogger.info('Should appear');

      const entries = infoLogger.getRecentEntries(10);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.level).toBe('INFO');
    });
  });

  describe('structured logging', () => {
    it('should include timestamp in logs', () => {
      logger.info('Test message');

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.timestamp).toBeDefined();
      expect(Date.parse(entries[0]?.timestamp ?? '')).not.toBeNaN();
    });

    it('should include correlation ID in logs', () => {
      logger.info('Test message');

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.correlationId).toBeDefined();
    });

    it('should include context in logs', () => {
      logger.info('Test message', { key: 'value', num: 42 });

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.context).toEqual({ key: 'value', num: 42 });
    });

    it('should format error with stack trace', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', error);

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.error?.name).toBe('Error');
      expect(entries[0]?.error?.message).toBe('Test error');
      expect(entries[0]?.error?.stack).toBeDefined();
    });
  });

  describe('agent and stage context', () => {
    it('should set and get agent context', () => {
      logger.setAgent('worker-1');
      expect(logger.getAgent()).toBe('worker-1');

      logger.info('Agent log');

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.agent).toBe('worker-1');
    });

    it('should set and get stage context', () => {
      logger.setStage('implementation');
      expect(logger.getStage()).toBe('implementation');

      logger.info('Stage log');

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.stage).toBe('implementation');
    });

    it('should clear agent and stage context', () => {
      logger.setAgent('worker-1');
      logger.setStage('implementation');

      logger.setAgent(undefined);
      logger.setStage(undefined);

      logger.info('No context');

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.agent).toBeUndefined();
      expect(entries[0]?.stage).toBeUndefined();
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

      logger.info('Test');

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
  });

  describe('child logger', () => {
    it('should create child logger with context', () => {
      const child = logger.child({ agent: 'worker-1', stage: 'implementation' });

      child.info('Child log');

      const entries = child.getRecentEntries(1);
      expect(entries[0]?.agent).toBe('worker-1');
      expect(entries[0]?.stage).toBe('implementation');
    });

    it('should inherit correlation ID from parent', () => {
      const correlationId = 'parent-correlation';
      logger.setCorrelationId(correlationId);

      const child = logger.child({ agent: 'child-agent' });

      expect(child.getCorrelationId()).toBe(correlationId);
    });
  });

  describe('log file management', () => {
    it('should return log directory', () => {
      expect(logger.getLogDir()).toBe(testLogDir);
    });

    it('should return current log file path', () => {
      const logFile = logger.getCurrentLogFile();
      expect(logFile).not.toBeNull();
      expect(logFile).toContain('app-');
      expect(logFile).toContain('.jsonl');
    });

    it('should write logs to file', () => {
      logger.info('Test message');

      const logFile = logger.getCurrentLogFile();
      expect(logFile).not.toBeNull();
      if (logFile !== null) {
        const content = fs.readFileSync(logFile, 'utf8');
        expect(content).toContain('Test message');
      }
    });
  });

  describe('getRecentEntries', () => {
    it('should return empty array when no logs', () => {
      const entries = logger.getRecentEntries(10);
      expect(entries).toEqual([]);
    });

    it('should respect limit parameter', () => {
      for (let i = 0; i < 10; i++) {
        logger.info(`Message ${i}`);
      }

      const entries = logger.getRecentEntries(5);
      expect(entries).toHaveLength(5);
    });

    it('should return entries in reverse order (most recent first)', () => {
      logger.info('First');
      logger.info('Second');
      logger.info('Third');

      const entries = logger.getRecentEntries(3);
      expect(entries[0]?.message).toBe('Third');
      expect(entries[2]?.message).toBe('First');
    });
  });

  describe('getEntriesByLevel', () => {
    it('should filter entries by level', () => {
      logger.info('Info 1');
      logger.warn('Warn 1');
      logger.info('Info 2');
      logger.error('Error 1', new Error('test'));

      const warnEntries = logger.getEntriesByLevel('WARN', 10);
      expect(warnEntries).toHaveLength(1);
      expect(warnEntries[0]?.message).toBe('Warn 1');
    });
  });

  describe('getErrors', () => {
    it('should get only error entries', () => {
      logger.info('Info');
      logger.error('Error 1', new Error('e1'));
      logger.warn('Warn');
      logger.error('Error 2', new Error('e2'));

      const errors = logger.getErrors(10);
      expect(errors).toHaveLength(2);
      expect(errors.every((e) => e.level === 'ERROR')).toBe(true);
    });
  });

  describe('singleton', () => {
    it('should return the same instance', () => {
      resetLogger();
      const instance1 = getLogger({ consoleOutput: false });
      const instance2 = getLogger();

      expect(instance1).toBe(instance2);
    });
  });

  describe('console output', () => {
    it('should log to console when enabled', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const consoleLogger = new Logger({
        logDir: testLogDir,
        consoleOutput: true,
        jsonOutput: true,
      });

      consoleLogger.info('Test message');

      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('should log errors to console.error', () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const consoleLogger = new Logger({
        logDir: testLogDir,
        consoleOutput: true,
      });

      consoleLogger.error('Error message', new Error('test'));

      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });

    it('should log warnings to console.warn', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const consoleLogger = new Logger({
        logDir: testLogDir,
        consoleOutput: true,
      });

      consoleLogger.warn('Warning message');

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('file rotation', () => {
    it('should rotate files when max files exceeded', () => {
      const rotationDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rotation-test-'));

      // Pre-create some old log files
      for (let i = 0; i < 5; i++) {
        const oldFile = path.join(rotationDir, `app-old-${i}.jsonl`);
        fs.writeFileSync(oldFile, '{"test": true}\n');
      }

      const rotatingLogger = new Logger({
        logDir: rotationDir,
        maxFiles: 2,
        consoleOutput: false,
      });

      rotatingLogger.info('New log');

      const remainingFiles = fs.readdirSync(rotationDir).filter((f) => f.endsWith('.jsonl'));
      expect(remainingFiles.length).toBeLessThanOrEqual(3);

      fs.rmSync(rotationDir, { recursive: true, force: true });
    });
  });
});
