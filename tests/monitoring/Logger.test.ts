import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { Logger, getLogger, resetLogger } from '../../src/monitoring/index.js';
import type { MaskingPattern } from '../../src/monitoring/index.js';

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

  describe('project ID context', () => {
    it('should set and get project ID', () => {
      logger.setProjectId('proj-001');
      expect(logger.getProjectId()).toBe('proj-001');

      logger.info('Project log');

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.projectId).toBe('proj-001');
    });

    it('should clear project ID context', () => {
      logger.setProjectId('proj-001');
      logger.setProjectId(undefined);

      logger.info('No project');

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.projectId).toBeUndefined();
    });
  });

  describe('duration tracking', () => {
    it('should extract durationMs from context', () => {
      logger.info('Operation completed', { durationMs: 150, other: 'data' });

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.durationMs).toBe(150);
      expect(entries[0]?.context).toEqual({ other: 'data' });
    });

    it('should handle durationMs only in context', () => {
      logger.info('Fast operation', { durationMs: 5 });

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.durationMs).toBe(5);
      expect(entries[0]?.context).toBeUndefined();
    });

    it('should ignore non-numeric durationMs', () => {
      logger.info('Operation', { durationMs: 'invalid', other: 'data' });

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.durationMs).toBeUndefined();
      expect(entries[0]?.context).toEqual({ other: 'data' });
    });

    it('should work with all log levels', () => {
      const debugLogger = new Logger({
        logDir: testLogDir,
        minLevel: 'DEBUG',
        consoleOutput: false,
      });

      debugLogger.debug('Debug op', { durationMs: 10 });
      debugLogger.info('Info op', { durationMs: 20 });
      debugLogger.warn('Warn op', { durationMs: 30 });
      debugLogger.error('Error op', new Error('test'), { durationMs: 40 });

      const entries = debugLogger.getRecentEntries(4);
      expect(entries[0]?.durationMs).toBe(40);
      expect(entries[1]?.durationMs).toBe(30);
      expect(entries[2]?.durationMs).toBe(20);
      expect(entries[3]?.durationMs).toBe(10);
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

    it('should inherit project ID from parent', () => {
      logger.setProjectId('proj-001');

      const child = logger.child({ agent: 'child-agent' });

      expect(child.getProjectId()).toBe('proj-001');
    });

    it('should override project ID when specified', () => {
      logger.setProjectId('proj-001');

      const child = logger.child({ agent: 'child-agent', projectId: 'proj-002' });

      expect(child.getProjectId()).toBe('proj-002');
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

  describe('sensitive data masking', () => {
    it('should mask GitHub personal access tokens', () => {
      logger.info('Token is ghp_1234567890abcdefghijklmnopqrstuvwxyz');

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.message).toContain('***REDACTED***');
      expect(entries[0]?.message).not.toContain('ghp_');
    });

    it('should mask OpenAI API keys', () => {
      logger.info('API key: sk-1234567890abcdefghijklmnopqrstuvwxyz012345678901');

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.message).toContain('***REDACTED***');
      expect(entries[0]?.message).not.toContain('sk-');
    });

    it('should mask Bearer tokens', () => {
      logger.info('Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc');

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.message).toContain('***REDACTED***');
      expect(entries[0]?.message).not.toContain('Bearer');
    });

    it('should mask JWT tokens', () => {
      const jwt =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
      logger.info(`JWT: ${jwt}`);

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.message).toContain('***REDACTED***');
      expect(entries[0]?.message).not.toContain('eyJ');
    });

    it('should mask sensitive data in context', () => {
      logger.info('User logged in', { token: 'ghp_1234567890abcdefghijklmnopqrstuvwxyz' });

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.context?.token).toBe('***REDACTED***');
    });

    it('should mask sensitive data in nested context', () => {
      logger.info('Config loaded', {
        auth: {
          apiKey: 'sk-1234567890abcdefghijklmnopqrstuvwxyz012345678901',
        },
      });

      const entries = logger.getRecentEntries(1);
      const auth = entries[0]?.context?.auth as { apiKey: string };
      expect(auth.apiKey).toBe('***REDACTED***');
    });

    it('should mask sensitive data in error messages', () => {
      const error = new Error('Failed with token ghp_1234567890abcdefghijklmnopqrstuvwxyz');
      logger.error('Auth error', error);

      const entries = logger.getRecentEntries(1);
      expect(entries[0]?.error?.message).toContain('***REDACTED***');
      expect(entries[0]?.error?.message).not.toContain('ghp_');
    });

    it('should allow disabling masking', () => {
      const noMaskLogger = new Logger({
        logDir: testLogDir,
        consoleOutput: false,
        enableMasking: false,
      });

      noMaskLogger.info('Token: ghp_1234567890abcdefghijklmnopqrstuvwxyz');

      const entries = noMaskLogger.getRecentEntries(1);
      expect(entries[0]?.message).toContain('ghp_');
    });

    it('should allow adding custom masking patterns', () => {
      const customPattern: MaskingPattern = {
        name: 'custom_secret',
        pattern: /SECRET_[A-Z0-9]+/g,
        replacement: '[CUSTOM_REDACTED]',
      };

      const customLogger = new Logger({
        logDir: testLogDir,
        consoleOutput: false,
        maskingPatterns: [customPattern],
      });

      customLogger.info('My secret is SECRET_ABC123XYZ');

      const entries = customLogger.getRecentEntries(1);
      expect(entries[0]?.message).toContain('[CUSTOM_REDACTED]');
    });

    it('should toggle masking at runtime', () => {
      logger.info('Token: ghp_1234567890abcdefghijklmnopqrstuvwxyz');
      const masked = logger.getRecentEntries(1);
      expect(masked[0]?.message).toContain('***REDACTED***');

      logger.setMaskingEnabled(false);
      expect(logger.isMaskingEnabled()).toBe(false);

      logger.info('Token: ghp_1234567890abcdefghijklmnopqrstuvwxyz');
      const unmasked = logger.getRecentEntries(1);
      expect(unmasked[0]?.message).toContain('ghp_');

      // Reset for other tests
      logger.setMaskingEnabled(true);
    });

    it('should list masking pattern names', () => {
      const patterns = logger.getMaskingPatternNames();
      expect(patterns).toContain('github_pat');
      expect(patterns).toContain('openai_api_key');
      expect(patterns).toContain('jwt_token');
    });
  });

  describe('agent-specific logging', () => {
    let agentLogDir: string;

    beforeEach(() => {
      agentLogDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-log-test-'));
    });

    afterEach(() => {
      if (fs.existsSync(agentLogDir)) {
        fs.rmSync(agentLogDir, { recursive: true, force: true });
      }
    });

    it('should create agent-specific log files when enabled', () => {
      const agentLogger = new Logger({
        logDir: agentLogDir,
        consoleOutput: false,
        agentLogConfig: { enabled: true },
      });

      agentLogger.setAgent('worker-1');
      agentLogger.info('Agent task started');

      const agentLogsPath = path.join(agentLogDir, 'agent-logs');
      expect(fs.existsSync(agentLogsPath)).toBe(true);

      const files = fs.readdirSync(agentLogsPath);
      expect(files.some((f) => f.startsWith('worker-1-'))).toBe(true);
    });

    it('should write to both main and agent log files', () => {
      const agentLogger = new Logger({
        logDir: agentLogDir,
        consoleOutput: false,
        agentLogConfig: { enabled: true },
      });

      agentLogger.setAgent('collector');
      agentLogger.info('Collecting data');

      // Check main log
      const mainEntries = agentLogger.getRecentEntries(1);
      expect(mainEntries[0]?.message).toBe('Collecting data');

      // Check agent log
      const agentLogsPath = path.join(agentLogDir, 'agent-logs');
      const agentFiles = fs.readdirSync(agentLogsPath);
      const collectorFile = agentFiles.find((f) => f.startsWith('collector-'));
      expect(collectorFile).toBeDefined();

      if (collectorFile !== undefined) {
        const content = fs.readFileSync(path.join(agentLogsPath, collectorFile), 'utf8');
        expect(content).toContain('Collecting data');
      }
    });

    it('should use custom agent logs directory', () => {
      const agentLogger = new Logger({
        logDir: agentLogDir,
        consoleOutput: false,
        agentLogConfig: { enabled: true, directory: 'custom-agent-logs' },
      });

      agentLogger.setAgent('prd-writer');
      agentLogger.info('Writing PRD');

      const customAgentLogsPath = path.join(agentLogDir, 'custom-agent-logs');
      expect(fs.existsSync(customAgentLogsPath)).toBe(true);
    });

    it('should get agent logs using getAgentLogs', () => {
      const agentLogger = new Logger({
        logDir: agentLogDir,
        consoleOutput: false,
        agentLogConfig: { enabled: true },
      });

      agentLogger.setAgent('worker-1');
      agentLogger.info('Task 1');
      agentLogger.info('Task 2');
      agentLogger.setAgent('worker-2');
      agentLogger.info('Other task');

      const worker1Logs = agentLogger.getAgentLogs('worker-1');
      expect(worker1Logs).toHaveLength(2);
      expect(worker1Logs.every((e) => e.agent === 'worker-1')).toBe(true);
    });

    it('should list logged agents', () => {
      const agentLogger = new Logger({
        logDir: agentLogDir,
        consoleOutput: false,
        agentLogConfig: { enabled: true },
      });

      agentLogger.setAgent('collector');
      agentLogger.info('Log 1');
      agentLogger.setAgent('prd-writer');
      agentLogger.info('Log 2');
      agentLogger.setAgent('srs-writer');
      agentLogger.info('Log 3');

      const agents = agentLogger.getLoggedAgents();
      expect(agents).toContain('collector');
      expect(agents).toContain('prd-writer');
      expect(agents).toContain('srs-writer');
    });
  });

  describe('advanced log querying', () => {
    beforeEach(() => {
      // Create some test logs
      logger.setAgent('agent-a');
      logger.setStage('stage-1');
      logger.setProjectId('proj-001');
      logger.info('Message 1');

      logger.setAgent('agent-b');
      logger.setStage('stage-2');
      logger.warn('Warning message');

      logger.setAgent('agent-a');
      logger.error('Error occurred', new Error('test error'));
    });

    it('should query logs by agent', () => {
      const result = logger.queryLogs({ agent: 'agent-a' });
      expect(result.entries.every((e) => e.agent === 'agent-a')).toBe(true);
      expect(result.totalCount).toBeGreaterThan(0);
    });

    it('should query logs by level', () => {
      const result = logger.queryLogs({ level: 'WARN' });
      expect(result.entries.every((e) => e.level === 'WARN')).toBe(true);
    });

    it('should query logs by stage', () => {
      const result = logger.queryLogs({ stage: 'stage-1' });
      expect(result.entries.every((e) => e.stage === 'stage-1')).toBe(true);
    });

    it('should query logs by project ID', () => {
      const result = logger.queryLogs({ projectId: 'proj-001' });
      expect(result.entries.every((e) => e.projectId === 'proj-001')).toBe(true);
    });

    it('should search logs by message content', () => {
      const result = logger.searchLogs('Warning');
      expect(result.some((e) => e.message.includes('Warning'))).toBe(true);
    });

    it('should support pagination', () => {
      // Add more logs
      for (let i = 0; i < 10; i++) {
        logger.info(`Bulk message ${i}`);
      }

      const page1 = logger.queryLogs({}, 5, 0);
      const page2 = logger.queryLogs({}, 5, 5);

      expect(page1.entries).toHaveLength(5);
      expect(page1.hasMore).toBe(true);
      expect(page2.entries.length).toBeGreaterThan(0);
    });

    it('should query logs by correlation ID', () => {
      const correlationId = logger.getCorrelationId();
      const result = logger.getLogsByCorrelationId(correlationId);
      expect(result.every((e) => e.correlationId === correlationId)).toBe(true);
    });

    it('should query logs by time range', () => {
      const now = new Date();
      const past = new Date(now.getTime() - 60000); // 1 minute ago
      const future = new Date(now.getTime() + 60000); // 1 minute in future

      const result = logger.getLogsByTimeRange(past.toISOString(), future.toISOString());
      expect(result.length).toBeGreaterThan(0);
    });

    it('should combine multiple filters', () => {
      const result = logger.queryLogs({
        agent: 'agent-a',
        level: 'ERROR',
      });

      for (const entry of result.entries) {
        expect(entry.agent).toBe('agent-a');
        expect(entry.level).toBe('ERROR');
      }
    });
  });

  describe('log aggregation', () => {
    let aggregationDir: string;

    beforeEach(() => {
      aggregationDir = fs.mkdtempSync(path.join(os.tmpdir(), 'log-agg-'));
    });

    afterEach(() => {
      if (fs.existsSync(aggregationDir)) {
        fs.rmSync(aggregationDir, { recursive: true, force: true });
      }
    });

    it('should aggregate logs from a file source', () => {
      const sourceFile = path.join(aggregationDir, 'source.jsonl');
      const entry = { timestamp: new Date().toISOString(), level: 'INFO', message: 'Test', correlationId: 'test-1' };
      fs.writeFileSync(sourceFile, JSON.stringify(entry) + '\n');

      const result = logger.aggregateLogs([{ type: 'file', path: sourceFile }]);
      expect(result.length).toBe(1);
      expect(result[0]?.message).toBe('Test');
    });

    it('should aggregate logs from a directory source', () => {
      const entry1 = { timestamp: new Date().toISOString(), level: 'INFO', message: 'Entry 1', correlationId: 'test-1' };
      const entry2 = { timestamp: new Date().toISOString(), level: 'WARN', message: 'Entry 2', correlationId: 'test-2' };

      fs.writeFileSync(path.join(aggregationDir, 'log1.jsonl'), JSON.stringify(entry1) + '\n');
      fs.writeFileSync(path.join(aggregationDir, 'log2.jsonl'), JSON.stringify(entry2) + '\n');

      const result = logger.aggregateLogs([{ type: 'directory', path: aggregationDir }]);
      expect(result.length).toBe(2);
    });

    it('should deduplicate entries when requested', () => {
      const entry = { timestamp: '2024-01-01T00:00:00Z', level: 'INFO', message: 'Duplicate', correlationId: 'dup-1' };
      const file1 = path.join(aggregationDir, 'dup1.jsonl');
      const file2 = path.join(aggregationDir, 'dup2.jsonl');

      fs.writeFileSync(file1, JSON.stringify(entry) + '\n');
      fs.writeFileSync(file2, JSON.stringify(entry) + '\n');

      const result = logger.aggregateLogs(
        [{ type: 'file', path: file1 }, { type: 'file', path: file2 }],
        { deduplicate: true }
      );

      expect(result.length).toBe(1);
    });

    it('should sort entries by timestamp ascending', () => {
      const older = { timestamp: '2024-01-01T00:00:00Z', level: 'INFO', message: 'Older', correlationId: 'old' };
      const newer = { timestamp: '2024-01-02T00:00:00Z', level: 'INFO', message: 'Newer', correlationId: 'new' };

      const file = path.join(aggregationDir, 'sorted.jsonl');
      fs.writeFileSync(file, JSON.stringify(newer) + '\n' + JSON.stringify(older) + '\n');

      const result = logger.aggregateLogs([{ type: 'file', path: file }], { sortOrder: 'asc' });
      expect(result[0]?.message).toBe('Older');
      expect(result[1]?.message).toBe('Newer');
    });

    it('should sort entries by timestamp descending by default', () => {
      const older = { timestamp: '2024-01-01T00:00:00Z', level: 'INFO', message: 'Older', correlationId: 'old' };
      const newer = { timestamp: '2024-01-02T00:00:00Z', level: 'INFO', message: 'Newer', correlationId: 'new' };

      const file = path.join(aggregationDir, 'sorted.jsonl');
      fs.writeFileSync(file, JSON.stringify(older) + '\n' + JSON.stringify(newer) + '\n');

      const result = logger.aggregateLogs([{ type: 'file', path: file }]);
      expect(result[0]?.message).toBe('Newer');
      expect(result[1]?.message).toBe('Older');
    });

    it('should write aggregated output to file', () => {
      const entry = { timestamp: new Date().toISOString(), level: 'INFO', message: 'Output test', correlationId: 'out-1' };
      const sourceFile = path.join(aggregationDir, 'source.jsonl');
      const outputFile = path.join(aggregationDir, 'output.jsonl');

      fs.writeFileSync(sourceFile, JSON.stringify(entry) + '\n');
      logger.aggregateLogs([{ type: 'file', path: sourceFile }], { outputPath: outputFile });

      expect(fs.existsSync(outputFile)).toBe(true);
      const content = fs.readFileSync(outputFile, 'utf8');
      expect(content).toContain('Output test');
    });

    it('should write compressed aggregated output', () => {
      const entry = { timestamp: new Date().toISOString(), level: 'INFO', message: 'Compress test', correlationId: 'comp-1' };
      const sourceFile = path.join(aggregationDir, 'source.jsonl');
      const outputFile = path.join(aggregationDir, 'output.jsonl');

      fs.writeFileSync(sourceFile, JSON.stringify(entry) + '\n');
      logger.aggregateLogs([{ type: 'file', path: sourceFile }], { outputPath: outputFile, compress: true });

      expect(fs.existsSync(outputFile + '.gz')).toBe(true);
    });

    it('should apply filter to source', () => {
      const entry1 = { timestamp: new Date().toISOString(), level: 'INFO', message: 'Info entry', correlationId: 'info-1' };
      const entry2 = { timestamp: new Date().toISOString(), level: 'ERROR', message: 'Error entry', correlationId: 'err-1' };

      const sourceFile = path.join(aggregationDir, 'filtered.jsonl');
      fs.writeFileSync(sourceFile, JSON.stringify(entry1) + '\n' + JSON.stringify(entry2) + '\n');

      const result = logger.aggregateLogs([{ type: 'file', path: sourceFile, filter: { level: 'ERROR' } }]);
      expect(result.length).toBe(1);
      expect(result[0]?.level).toBe('ERROR');
    });

    it('should handle non-existent source gracefully', () => {
      const result = logger.aggregateLogs([{ type: 'file', path: '/nonexistent/path.jsonl' }]);
      expect(result.length).toBe(0);
    });

    it('should handle non-existent directory gracefully', () => {
      const result = logger.aggregateLogs([{ type: 'directory', path: '/nonexistent/dir' }]);
      expect(result.length).toBe(0);
    });

    it('should handle malformed JSON lines', () => {
      const sourceFile = path.join(aggregationDir, 'malformed.jsonl');
      const validEntry = { timestamp: new Date().toISOString(), level: 'INFO', message: 'Valid', correlationId: 'v-1' };
      fs.writeFileSync(sourceFile, JSON.stringify(validEntry) + '\n' + 'not valid json\n');

      const result = logger.aggregateLogs([{ type: 'file', path: sourceFile }]);
      expect(result.length).toBe(1);
    });
  });

  describe('log compression', () => {
    let compressionDir: string;

    beforeEach(() => {
      compressionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'log-comp-'));
    });

    afterEach(() => {
      if (fs.existsSync(compressionDir)) {
        fs.rmSync(compressionDir, { recursive: true, force: true });
      }
    });

    it('should compress a log file', () => {
      const logFile = path.join(compressionDir, 'test.jsonl');
      fs.writeFileSync(logFile, '{"message":"test"}\n');

      const result = logger.compressLogFile(logFile);
      expect(result).toBe(logFile + '.gz');
      expect(fs.existsSync(result as string)).toBe(true);
    });

    it('should delete original after compression when requested', () => {
      const logFile = path.join(compressionDir, 'delete-test.jsonl');
      fs.writeFileSync(logFile, '{"message":"test"}\n');

      logger.compressLogFile(logFile, { deleteOriginal: true });
      expect(fs.existsSync(logFile)).toBe(false);
      expect(fs.existsSync(logFile + '.gz')).toBe(true);
    });

    it('should return null for non-existent file', () => {
      const result = logger.compressLogFile('/nonexistent/file.jsonl');
      expect(result).toBeNull();
    });

    it('should return null when algorithm is none', () => {
      const logFile = path.join(compressionDir, 'no-compress.jsonl');
      fs.writeFileSync(logFile, '{"message":"test"}\n');

      const result = logger.compressLogFile(logFile, { algorithm: 'none' });
      expect(result).toBeNull();
    });

    it('should apply compression level', () => {
      const logFile = path.join(compressionDir, 'level-test.jsonl');
      fs.writeFileSync(logFile, '{"message":"test data for compression level testing"}\n'.repeat(100));

      const result = logger.compressLogFile(logFile, { level: 9 });
      expect(result).toBe(logFile + '.gz');
      expect(fs.existsSync(result as string)).toBe(true);
    });
  });

  describe('structured query language', () => {
    beforeEach(() => {
      // Create test logs with various attributes
      logger.setAgent('worker-1');
      logger.setStage('processing');
      logger.setProjectId('proj-001');
      logger.info('Task started');

      logger.setAgent('worker-2');
      logger.warn('Connection slow');

      logger.setAgent('worker-1');
      logger.error('Task failed', new Error('timeout'));

      logger.setAgent('collector');
      logger.setStage('collection');
      logger.info('Data collected');
    });

    it('should search logs with simple field query', () => {
      const result = logger.searchWithQuery('agent:worker-1');
      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries.every((e) => e.agent === 'worker-1')).toBe(true);
    });

    it('should search logs with level filter', () => {
      const result = logger.searchWithQuery('level:error');
      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries.every((e) => e.level === 'ERROR')).toBe(true);
    });

    it('should search logs with AND operator', () => {
      const result = logger.searchWithQuery('level:error AND agent:worker-1');
      expect(result.entries.length).toBeGreaterThan(0);
      for (const entry of result.entries) {
        expect(entry.level).toBe('ERROR');
        expect(entry.agent).toBe('worker-1');
      }
    });

    it('should search logs with OR operator', () => {
      const result = logger.searchWithQuery('level:error OR level:warn');
      expect(result.entries.length).toBeGreaterThan(0);
      for (const entry of result.entries) {
        expect(['ERROR', 'WARN']).toContain(entry.level);
      }
    });

    it('should search logs with NOT operator', () => {
      const result = logger.searchWithQuery('NOT level:info');
      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries.every((e) => e.level !== 'INFO')).toBe(true);
    });

    it('should search logs with message content', () => {
      const result = logger.searchWithQuery('message:failed');
      expect(result.entries.length).toBeGreaterThan(0);
      expect(result.entries.some((e) => e.message.toLowerCase().includes('failed'))).toBe(true);
    });

    it('should search logs with quoted message', () => {
      const result = logger.searchWithQuery('message:"Task failed"');
      expect(result.entries.length).toBeGreaterThan(0);
    });

    it('should search logs with complex expression', () => {
      const result = logger.searchWithQuery('(level:error OR level:warn) AND projectId:proj-001');
      for (const entry of result.entries) {
        expect(['ERROR', 'WARN']).toContain(entry.level);
        expect(entry.projectId).toBe('proj-001');
      }
    });

    it('should include query metadata in result', () => {
      const result = logger.searchWithQuery('level:info');
      expect(result.query).toBe('level:info');
      expect(result.expression).toBeDefined();
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should support pagination', () => {
      const result1 = logger.searchWithQuery('projectId:proj-001', 2, 0);
      const result2 = logger.searchWithQuery('projectId:proj-001', 2, 2);

      expect(result1.entries.length).toBeLessThanOrEqual(2);
      expect(result1.totalCount).toBeGreaterThan(0);
    });

    it('should return empty results for invalid query', () => {
      const result = logger.searchWithQuery('invalid:field');
      expect(result.entries).toHaveLength(0);
    });

    it('should parse query without executing', () => {
      const parseResult = logger.parseQuery('level:error AND agent:worker');
      expect(parseResult.success).toBe(true);
      expect(parseResult.expression).toBeDefined();
      expect(parseResult.expression?.type).toBe('compound');
    });

    it('should return parse error for invalid syntax', () => {
      const parseResult = logger.parseQuery('level:');
      expect(parseResult.success).toBe(false);
      expect(parseResult.error).toBeDefined();
    });
  });

  describe('compressed file reading in aggregation', () => {
    let gzDir: string;

    beforeEach(() => {
      gzDir = fs.mkdtempSync(path.join(os.tmpdir(), 'log-gz-'));
    });

    afterEach(() => {
      if (fs.existsSync(gzDir)) {
        fs.rmSync(gzDir, { recursive: true, force: true });
      }
    });

    it('should read compressed files from directory', () => {
      const entry = { timestamp: new Date().toISOString(), level: 'INFO', message: 'GZ entry', correlationId: 'gz-1' };
      const logFile = path.join(gzDir, 'log.jsonl');

      fs.writeFileSync(logFile, JSON.stringify(entry) + '\n');
      logger.compressLogFile(logFile, { deleteOriginal: true });

      const result = logger.aggregateLogs([{ type: 'directory', path: gzDir }]);
      expect(result.length).toBe(1);
      expect(result[0]?.message).toBe('GZ entry');
    });
  });
});
