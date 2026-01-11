import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  Logger,
  getLogger,
  getLoggerFromEnv,
  resetLogger,
} from '../../src/logging/Logger.js';
import type { LoggerConfig } from '../../src/logging/Logger.js';

describe('Logger', () => {
  let logger: Logger;

  afterEach(async () => {
    if (logger !== undefined) {
      await logger.close();
    }
    resetLogger();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  describe('initialization', () => {
    it('should initialize with default configuration', async () => {
      logger = new Logger();
      await logger.initialize();

      expect(logger.isReady()).toBe(true);
    });

    it('should initialize with console transport', async () => {
      logger = new Logger({
        transports: [{ type: 'console', format: 'json' }],
      });
      await logger.initialize();

      expect(logger.isReady()).toBe(true);
      expect(logger.getTransportNames()).toContain('console');
    });

    it('should throw when initializing twice', async () => {
      logger = new Logger({
        transports: [{ type: 'console' }],
      });
      await logger.initialize();

      await expect(logger.initialize()).rejects.toThrow('already initialized');
    });

    it('should not add disabled transports', async () => {
      logger = new Logger({
        transports: [
          { type: 'console', enabled: false },
          { type: 'console', enabled: true },
        ],
      });
      await logger.initialize();

      expect(logger.getTransportNames()).toHaveLength(1);
    });
  });

  describe('logging methods', () => {
    beforeEach(async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'error').mockImplementation(() => {});

      logger = new Logger({
        minLevel: 'DEBUG',
        transports: [{ type: 'console', format: 'json' }],
      });
      await logger.initialize();
    });

    it('should log debug messages', () => {
      logger.debug('Debug message');

      expect(console.log).toHaveBeenCalled();
    });

    it('should log info messages', () => {
      logger.info('Info message');

      expect(console.log).toHaveBeenCalled();
    });

    it('should log warning messages', () => {
      logger.warn('Warning message');

      expect(console.warn).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      logger.error('Error message');

      expect(console.error).toHaveBeenCalled();
    });

    it('should log error with Error object', () => {
      const error = new Error('Test error');
      logger.error('Error occurred', error);

      expect(console.error).toHaveBeenCalled();
    });

    it('should include context in log entry', () => {
      const logSpy = vi.spyOn(console, 'log');
      logger.info('Message with context', { userId: '123', action: 'test' });

      const output = logSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.context).toEqual({ userId: '123', action: 'test' });
    });

    it('should respect minLevel setting', async () => {
      const infoLogger = new Logger({
        minLevel: 'INFO',
        transports: [{ type: 'console', format: 'json' }],
      });
      await infoLogger.initialize();

      const logSpy = vi.spyOn(console, 'log').mockClear();

      infoLogger.debug('This should not be logged');

      expect(logSpy).not.toHaveBeenCalled();

      await infoLogger.close();
    });
  });

  describe('context management', () => {
    beforeEach(async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      logger = new Logger({
        transports: [{ type: 'console', format: 'json' }],
      });
      await logger.initialize();
    });

    it('should set and get correlation ID', () => {
      logger.setCorrelationId('test-correlation-123');

      expect(logger.getCorrelationId()).toBe('test-correlation-123');
    });

    it('should generate new correlation ID', () => {
      const oldId = logger.getCorrelationId();
      const newId = logger.newCorrelationId();

      expect(newId).not.toBe(oldId);
      expect(logger.getCorrelationId()).toBe(newId);
    });

    it('should set and get session ID', () => {
      logger.setSessionId('session-456');

      expect(logger.getSessionId()).toBe('session-456');
    });

    it('should set and get agent context', () => {
      logger.setAgent('worker-agent');

      expect(logger.getAgent()).toBe('worker-agent');
    });

    it('should set and get stage context', () => {
      logger.setStage('implementation');

      expect(logger.getStage()).toBe('implementation');
    });

    it('should set and get project ID', () => {
      logger.setProjectId('project-789');

      expect(logger.getProjectId()).toBe('project-789');
    });

    it('should include context in log entries', () => {
      const logSpy = vi.spyOn(console, 'log');

      logger.setCorrelationId('corr-123');
      logger.setAgent('test-agent');
      logger.setStage('test-stage');
      logger.setProjectId('proj-456');

      logger.info('Test message');

      const output = logSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.correlationId).toBe('corr-123');
      expect(parsed.agentId).toBe('test-agent');
      expect(parsed.stage).toBe('test-stage');
      expect(parsed.projectId).toBe('proj-456');
    });

    it('should set and clear trace context', () => {
      logger.setTraceContext('trace-123', 'span-456', 'parent-789');

      const logSpy = vi.spyOn(console, 'log');
      logger.info('With trace');

      let output = logSpy.mock.calls[0]?.[0] as string;
      let parsed = JSON.parse(output);

      expect(parsed.traceId).toBe('trace-123');
      expect(parsed.spanId).toBe('span-456');
      expect(parsed.parentSpanId).toBe('parent-789');

      logger.clearTraceContext();
      logSpy.mockClear();
      logger.info('Without trace');

      output = logSpy.mock.calls[0]?.[0] as string;
      parsed = JSON.parse(output);

      expect(parsed.traceId).toBeUndefined();
    });
  });

  describe('sensitive data masking', () => {
    beforeEach(async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      logger = new Logger({
        transports: [{ type: 'console', format: 'json' }],
        enableMasking: true,
      });
      await logger.initialize();
    });

    it('should mask GitHub PAT tokens', () => {
      const logSpy = vi.spyOn(console, 'log');

      logger.info('Token: ghp_1234567890123456789012345678901234ab');

      const output = logSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.message).toContain('***REDACTED***');
      expect(parsed.message).not.toContain('ghp_');
    });

    it('should mask API keys in context', () => {
      const logSpy = vi.spyOn(console, 'log');

      logger.info('Config loaded', {
        apiKey: 'sk-1234567890123456789012345678901234567890123456ab',
      });

      const output = logSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.context.apiKey).toContain('***REDACTED***');
    });

    it('should mask JWT tokens', () => {
      const logSpy = vi.spyOn(console, 'log');

      logger.info('Auth: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U');

      const output = logSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.message).toContain('***REDACTED***');
      expect(parsed.message).not.toContain('eyJ');
    });

    it('should not mask when masking is disabled', async () => {
      const unmaskedLogger = new Logger({
        transports: [{ type: 'console', format: 'json' }],
        enableMasking: false,
      });
      await unmaskedLogger.initialize();

      const logSpy = vi.spyOn(console, 'log').mockClear();

      unmaskedLogger.info('Token: ghp_1234567890123456789012345678901234ab');

      const output = logSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.message).toContain('ghp_');

      await unmaskedLogger.close();
    });
  });

  describe('transport management', () => {
    it('should add transport at runtime', async () => {
      logger = new Logger({
        transports: [{ type: 'console' }],
      });
      await logger.initialize();

      expect(logger.getTransportNames()).toHaveLength(1);

      await logger.addTransport({ type: 'console' });

      expect(logger.getTransportNames()).toHaveLength(2);
    });

    it('should remove transport by name', async () => {
      logger = new Logger({
        transports: [
          { type: 'console' },
        ],
      });
      await logger.initialize();

      const removed = await logger.removeTransport('console');

      expect(removed).toBe(true);
      expect(logger.getTransportNames()).toHaveLength(0);
    });

    it('should return false when removing non-existent transport', async () => {
      logger = new Logger({
        transports: [{ type: 'console' }],
      });
      await logger.initialize();

      const removed = await logger.removeTransport('non-existent');

      expect(removed).toBe(false);
    });
  });

  describe('health monitoring', () => {
    it('should return health information', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      logger = new Logger({
        transports: [{ type: 'console' }],
      });
      await logger.initialize();

      logger.info('Test message');

      const health = logger.getHealth();

      expect(health.state).toBe('ready');
      expect(health.totalLogs).toBe(1);
      expect(health.failedLogs).toBe(0);
      expect(health.transports.size).toBe(1);
    });

    it('should track total logs and last log time', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      logger = new Logger({
        transports: [{ type: 'console' }],
      });
      await logger.initialize();

      logger.info('Message 1');
      logger.info('Message 2');
      logger.info('Message 3');

      const health = logger.getHealth();

      expect(health.totalLogs).toBe(3);
      expect(health.lastLogTime).toBeDefined();
    });
  });

  describe('child logger', () => {
    it('should create child logger with context', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      logger = new Logger({
        transports: [{ type: 'console', format: 'json' }],
      });
      await logger.initialize();

      const child = logger.child({
        agent: 'child-agent',
        stage: 'child-stage',
      });

      const logSpy = vi.spyOn(console, 'log').mockClear();
      child.info('Child message');

      const output = logSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.agentId).toBe('child-agent');
      expect(parsed.stage).toBe('child-stage');
    });

    it('should inherit parent correlation ID', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      logger = new Logger({
        transports: [{ type: 'console', format: 'json' }],
      });
      await logger.initialize();

      logger.setCorrelationId('parent-correlation');
      const child = logger.child({ agent: 'test' });

      expect(child.getCorrelationId()).toBe('parent-correlation');
    });

    it('should allow overriding correlation ID', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      logger = new Logger({
        transports: [{ type: 'console', format: 'json' }],
      });
      await logger.initialize();

      logger.setCorrelationId('parent-correlation');
      const child = logger.child({
        agent: 'test',
        correlationId: 'child-correlation',
      });

      expect(child.getCorrelationId()).toBe('child-correlation');
    });
  });

  describe('environment configuration', () => {
    it('should create logger from environment variables', async () => {
      vi.stubEnv('LOG_LEVEL', 'DEBUG');
      vi.stubEnv('LOG_TRANSPORTS', 'console');
      vi.stubEnv('LOG_CONSOLE_FORMAT', 'json');

      logger = Logger.fromEnvironment();
      await logger.initialize();

      expect(logger.isReady()).toBe(true);
      expect(logger.getTransportNames()).toContain('console');
    });

    it('should use custom prefix for environment variables', async () => {
      vi.stubEnv('APP_LOG_LEVEL', 'WARN');
      vi.stubEnv('APP_LOG_TRANSPORTS', 'console');

      logger = Logger.fromEnvironment({ envPrefix: 'APP_LOG' });
      await logger.initialize();

      expect(logger.isReady()).toBe(true);
    });

    it('should default to console transport when none specified', async () => {
      logger = Logger.fromEnvironment();
      await logger.initialize();

      expect(logger.getTransportNames()).toContain('console');
    });
  });

  describe('global logger', () => {
    it('should return same instance from getLogger', () => {
      const logger1 = getLogger({ transports: [{ type: 'console' }] });
      const logger2 = getLogger();

      expect(logger1).toBe(logger2);
    });

    it('should reset global logger', () => {
      const logger1 = getLogger({ transports: [{ type: 'console' }] });
      resetLogger();
      const logger2 = getLogger({ transports: [{ type: 'console' }] });

      expect(logger1).not.toBe(logger2);
    });

    it('should create global logger from environment', async () => {
      vi.stubEnv('LOG_TRANSPORTS', 'console');

      const envLogger = getLoggerFromEnv();
      await envLogger.initialize();

      expect(envLogger.isReady()).toBe(true);
    });
  });

  describe('flush and close', () => {
    it('should flush all transports', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      logger = new Logger({
        transports: [{ type: 'console' }],
      });
      await logger.initialize();

      logger.info('Message to flush');

      await expect(logger.flush()).resolves.not.toThrow();
    });

    it('should close all transports', async () => {
      logger = new Logger({
        transports: [{ type: 'console' }],
      });
      await logger.initialize();

      await logger.close();

      expect(logger.isReady()).toBe(false);
    });

    it('should not throw when closing twice', async () => {
      logger = new Logger({
        transports: [{ type: 'console' }],
      });
      await logger.initialize();

      await logger.close();
      await expect(logger.close()).resolves.not.toThrow();
    });
  });

  describe('runtime reconfiguration', () => {
    it('should add masking patterns at runtime', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      logger = new Logger({
        transports: [{ type: 'console', format: 'json' }],
        enableMasking: true,
      });
      await logger.initialize();

      await logger.reconfigure({
        maskingPatterns: [
          { name: 'custom', pattern: /SECRET_[A-Z]+/g },
        ],
      });

      const logSpy = vi.spyOn(console, 'log').mockClear();
      logger.info('Token: SECRET_ABCD');

      const output = logSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.message).toContain('***REDACTED***');
    });

    it('should add transports at runtime via reconfigure', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      logger = new Logger({
        transports: [{ type: 'console' }],
      });
      await logger.initialize();

      expect(logger.getTransportNames()).toHaveLength(1);

      await logger.reconfigure({
        transports: [{ type: 'console' }],
      });

      expect(logger.getTransportNames()).toHaveLength(2);
    });
  });

  describe('fallback behavior', () => {
    it('should log to console when not initialized', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger = new Logger({
        transports: [{ type: 'console' }],
      });

      // Not initialized
      logger.info('Fallback message');

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('[INFO]'),
        expect.anything()
      );
    });
  });

  describe('default context', () => {
    it('should include default context in all log entries', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      logger = new Logger({
        transports: [{ type: 'console', format: 'json' }],
        defaultContext: {
          service: 'test-service',
          version: '1.0.0',
        },
      });
      await logger.initialize();

      const logSpy = vi.spyOn(console, 'log').mockClear();
      logger.info('Test message');

      const output = logSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.context.service).toBe('test-service');
      expect(parsed.context.version).toBe('1.0.0');
    });

    it('should merge message context with default context', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      logger = new Logger({
        transports: [{ type: 'console', format: 'json' }],
        defaultContext: {
          service: 'test-service',
        },
      });
      await logger.initialize();

      const logSpy = vi.spyOn(console, 'log').mockClear();
      logger.info('Test message', { requestId: '123' });

      const output = logSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.context.service).toBe('test-service');
      expect(parsed.context.requestId).toBe('123');
    });
  });

  describe('durationMs extraction', () => {
    it('should extract durationMs from context', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      logger = new Logger({
        transports: [{ type: 'console', format: 'json' }],
      });
      await logger.initialize();

      const logSpy = vi.spyOn(console, 'log').mockClear();
      logger.info('Operation completed', { durationMs: 150, operation: 'test' });

      const output = logSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.durationMs).toBe(150);
      expect(parsed.context.operation).toBe('test');
    });
  });
});
