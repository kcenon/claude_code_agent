import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConsoleTransport } from '../../src/logging/transports/ConsoleTransport.js';
import type { TransportLogEntry } from '../../src/logging/transports/types.js';

describe('ConsoleTransport', () => {
  let transport: ConsoleTransport;

  const createTestEntry = (overrides: Partial<TransportLogEntry> = {}): TransportLogEntry => ({
    timestamp: new Date('2024-01-15T10:30:00.000Z'),
    level: 'INFO',
    message: 'Test message',
    context: {},
    ...overrides,
  });

  afterEach(async () => {
    if (transport !== undefined) {
      await transport.close();
    }
    vi.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      transport = new ConsoleTransport({ type: 'console' });
      await transport.initialize();

      expect(transport.isReady()).toBe(true);
    });

    it('should throw when initializing twice', async () => {
      transport = new ConsoleTransport({ type: 'console' });
      await transport.initialize();

      await expect(transport.initialize()).rejects.toThrow('already initialized');
    });

    it('should have name "console"', async () => {
      transport = new ConsoleTransport({ type: 'console' });
      expect(transport.name).toBe('console');
    });
  });

  describe('JSON format logging', () => {
    it('should log in JSON format', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      transport = new ConsoleTransport({ type: 'console', format: 'json' });
      await transport.initialize();

      const entry = createTestEntry();
      await transport.log(entry);

      expect(logSpy).toHaveBeenCalled();
      const output = logSpy.mock.calls[0]?.[0] as string;
      expect(() => JSON.parse(output)).not.toThrow();

      const parsed = JSON.parse(output);
      expect(parsed.level).toBe('INFO');
      expect(parsed.message).toBe('Test message');
    });

    it('should include optional fields in JSON output', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      transport = new ConsoleTransport({ type: 'console', format: 'json' });
      await transport.initialize();

      const entry = createTestEntry({
        correlationId: 'corr-123',
        agentId: 'worker-1',
        stage: 'implementation',
        durationMs: 150,
      });
      await transport.log(entry);

      const output = logSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.correlationId).toBe('corr-123');
      expect(parsed.agentId).toBe('worker-1');
      expect(parsed.stage).toBe('implementation');
      expect(parsed.durationMs).toBe(150);
    });

    it('should include context in JSON output', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      transport = new ConsoleTransport({ type: 'console', format: 'json' });
      await transport.initialize();

      const entry = createTestEntry({
        context: { userId: '123', action: 'login' },
      });
      await transport.log(entry);

      const output = logSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.context).toEqual({ userId: '123', action: 'login' });
    });
  });

  describe('pretty format logging', () => {
    it('should log in pretty format', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      transport = new ConsoleTransport({
        type: 'console',
        format: 'pretty',
        colors: false,
      });
      await transport.initialize();

      const entry = createTestEntry();
      await transport.log(entry);

      expect(logSpy).toHaveBeenCalled();
      const output = logSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('INFO');
      expect(output).toContain('Test message');
    });

    it('should include timestamp in pretty format when enabled', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      transport = new ConsoleTransport({
        type: 'console',
        format: 'pretty',
        colors: false,
        includeTimestamp: true,
      });
      await transport.initialize();

      const entry = createTestEntry();
      await transport.log(entry);

      const output = logSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('10:30:00');
    });

    it('should exclude timestamp in pretty format when disabled', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      transport = new ConsoleTransport({
        type: 'console',
        format: 'pretty',
        colors: false,
        includeTimestamp: false,
      });
      await transport.initialize();

      const entry = createTestEntry();
      await transport.log(entry);

      const output = logSpy.mock.calls[0]?.[0] as string;
      expect(output).not.toContain('10:30:00');
    });

    it('should include agent ID in pretty format', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      transport = new ConsoleTransport({
        type: 'console',
        format: 'pretty',
        colors: false,
      });
      await transport.initialize();

      const entry = createTestEntry({ agentId: 'worker-1' });
      await transport.log(entry);

      const output = logSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('[worker-1]');
    });

    it('should include stage in pretty format', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      transport = new ConsoleTransport({
        type: 'console',
        format: 'pretty',
        colors: false,
      });
      await transport.initialize();

      const entry = createTestEntry({ stage: 'implementation' });
      await transport.log(entry);

      const output = logSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('(implementation)');
    });

    it('should include duration in pretty format', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      transport = new ConsoleTransport({
        type: 'console',
        format: 'pretty',
        colors: false,
      });
      await transport.initialize();

      const entry = createTestEntry({ durationMs: 250 });
      await transport.log(entry);

      const output = logSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('250ms');
    });
  });

  describe('log level routing', () => {
    it('should log INFO to console.log', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      transport = new ConsoleTransport({ type: 'console' });
      await transport.initialize();

      await transport.log(createTestEntry({ level: 'INFO' }));

      expect(logSpy).toHaveBeenCalled();
    });

    it('should log DEBUG to console.log', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      transport = new ConsoleTransport({ type: 'console', minLevel: 'DEBUG' });
      await transport.initialize();

      await transport.log(createTestEntry({ level: 'DEBUG' }));

      expect(logSpy).toHaveBeenCalled();
    });

    it('should log WARN to console.warn', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      transport = new ConsoleTransport({ type: 'console' });
      await transport.initialize();

      await transport.log(createTestEntry({ level: 'WARN' }));

      expect(warnSpy).toHaveBeenCalled();
    });

    it('should log ERROR to console.error', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      transport = new ConsoleTransport({ type: 'console' });
      await transport.initialize();

      await transport.log(createTestEntry({ level: 'ERROR' }));

      expect(errorSpy).toHaveBeenCalled();
    });
  });

  describe('error logging', () => {
    it('should include error stack in pretty format', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      transport = new ConsoleTransport({
        type: 'console',
        format: 'pretty',
        colors: false,
      });
      await transport.initialize();

      const entry = createTestEntry({
        level: 'ERROR',
        error: {
          name: 'TestError',
          message: 'Test error message',
          stack: 'Error: Test error\n  at test.ts:1:1',
        },
      });
      await transport.log(entry);

      expect(errorSpy).toHaveBeenCalled();
      const output = errorSpy.mock.calls[0]?.[0] as string;
      expect(output).toContain('at test.ts:1:1');
    });

    it('should include error in JSON format', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      transport = new ConsoleTransport({ type: 'console', format: 'json' });
      await transport.initialize();

      const entry = createTestEntry({
        level: 'ERROR',
        error: {
          name: 'TestError',
          message: 'Test error message',
          stack: 'Error: Test error\n  at test.ts:1:1',
        },
      });
      await transport.log(entry);

      const output = errorSpy.mock.calls[0]?.[0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.error.name).toBe('TestError');
      expect(parsed.error.message).toBe('Test error message');
    });
  });

  describe('log level filtering', () => {
    it('should filter logs below minimum level', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      transport = new ConsoleTransport({ type: 'console', minLevel: 'WARN' });
      await transport.initialize();

      await transport.log(createTestEntry({ level: 'DEBUG' }));
      await transport.log(createTestEntry({ level: 'INFO' }));

      expect(logSpy).not.toHaveBeenCalled();
    });

    it('should log entries at or above minimum level', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      transport = new ConsoleTransport({ type: 'console', minLevel: 'WARN' });
      await transport.initialize();

      await transport.log(createTestEntry({ level: 'WARN' }));
      await transport.log(createTestEntry({ level: 'ERROR' }));

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('health tracking', () => {
    it('should report health status', async () => {
      transport = new ConsoleTransport({ type: 'console' });
      await transport.initialize();

      const health = transport.getHealth();

      expect(health.state).toBe('ready');
      expect(health.pendingLogs).toBe(0);
      expect(health.failedAttempts).toBe(0);
    });

    it('should track total processed logs', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      transport = new ConsoleTransport({ type: 'console' });
      await transport.initialize();

      await transport.log(createTestEntry());
      await transport.log(createTestEntry());
      await transport.log(createTestEntry());

      const health = transport.getHealth();
      expect(health.totalProcessed).toBe(3);
    });
  });

  describe('flush and close', () => {
    it('should flush without error', async () => {
      transport = new ConsoleTransport({ type: 'console' });
      await transport.initialize();

      await expect(transport.flush()).resolves.not.toThrow();
    });

    it('should close without error', async () => {
      transport = new ConsoleTransport({ type: 'console' });
      await transport.initialize();

      await expect(transport.close()).resolves.not.toThrow();
    });

    it('should throw when logging after close', async () => {
      transport = new ConsoleTransport({ type: 'console' });
      await transport.initialize();
      await transport.close();

      await expect(transport.log(createTestEntry())).rejects.toThrow('not ready');
    });
  });
});
