import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BaseTransport } from '../../src/logging/transports/BaseTransport.js';
import type { TransportLogEntry, BaseTransportConfig } from '../../src/logging/transports/types.js';

/**
 * Test implementation of BaseTransport
 */
class TestTransport extends BaseTransport {
  public doInitializeCalled = false;
  public doLogCalled = false;
  public doFlushCalled = false;
  public doCloseCalled = false;
  public loggedEntries: TransportLogEntry[][] = [];
  public shouldFailInit = false;
  public shouldFailLog = false;
  public initDelay = 0;
  public logDelay = 0;

  constructor(config: BaseTransportConfig = {}) {
    super('test', config);
  }

  protected async doInitialize(): Promise<void> {
    if (this.initDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.initDelay));
    }
    if (this.shouldFailInit) {
      throw new Error('Initialization failed');
    }
    this.doInitializeCalled = true;
  }

  protected async doLog(entries: TransportLogEntry[]): Promise<void> {
    if (this.logDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.logDelay));
    }
    if (this.shouldFailLog) {
      throw new Error('Log failed');
    }
    this.doLogCalled = true;
    this.loggedEntries.push([...entries]);
  }

  protected async doFlush(): Promise<void> {
    this.doFlushCalled = true;
  }

  protected async doClose(): Promise<void> {
    this.doCloseCalled = true;
  }

  // Expose protected members for testing
  public getState(): string {
    return this.state;
  }

  public getBuffer(): TransportLogEntry[] {
    return this.buffer;
  }

  public getMinLevel(): string {
    return this.minLevel;
  }

  public getBufferSize(): number {
    return this.bufferSize;
  }

  public getEnableBatching(): boolean {
    return this.enableBatching;
  }
}

describe('BaseTransport', () => {
  let transport: TestTransport;

  const createTestEntry = (overrides: Partial<TransportLogEntry> = {}): TransportLogEntry => ({
    timestamp: new Date('2024-01-15T10:30:00.000Z'),
    level: 'INFO',
    message: 'Test message',
    context: {},
    ...overrides,
  });

  afterEach(async () => {
    if (transport !== undefined) {
      try {
        await transport.close();
      } catch {
        // Ignore errors during cleanup
      }
    }
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should use default configuration values', () => {
      transport = new TestTransport();

      expect(transport.name).toBe('test');
      expect(transport.getMinLevel()).toBe('DEBUG');
      expect(transport.getBufferSize()).toBe(100);
      expect(transport.getEnableBatching()).toBe(true);
    });

    it('should accept custom configuration', () => {
      transport = new TestTransport({
        minLevel: 'WARN',
        bufferSize: 50,
        enableBatching: false,
      });

      expect(transport.getMinLevel()).toBe('WARN');
      expect(transport.getBufferSize()).toBe(50);
      expect(transport.getEnableBatching()).toBe(false);
    });
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      transport = new TestTransport();
      await transport.initialize();

      expect(transport.doInitializeCalled).toBe(true);
      expect(transport.isReady()).toBe(true);
      expect(transport.getState()).toBe('ready');
    });

    it('should throw when initializing twice', async () => {
      transport = new TestTransport();
      await transport.initialize();

      await expect(transport.initialize()).rejects.toThrow('already initialized');
    });

    it('should set error state on initialization failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      transport = new TestTransport();
      transport.shouldFailInit = true;

      await expect(transport.initialize()).rejects.toThrow('Initialization failed');
      expect(transport.getState()).toBe('error');
      expect(transport.isReady()).toBe(false);
    });
  });

  describe('logging with batching enabled', () => {
    beforeEach(async () => {
      transport = new TestTransport({
        bufferSize: 3,
        flushIntervalMs: 0, // Disable timer for testing
        enableBatching: true,
      });
      await transport.initialize();
    });

    it('should buffer logs until buffer is full', async () => {
      await transport.log(createTestEntry({ message: 'Entry 1' }));
      await transport.log(createTestEntry({ message: 'Entry 2' }));

      expect(transport.getBuffer().length).toBe(2);
      expect(transport.loggedEntries.length).toBe(0);
    });

    it('should flush when buffer reaches limit', async () => {
      await transport.log(createTestEntry({ message: 'Entry 1' }));
      await transport.log(createTestEntry({ message: 'Entry 2' }));
      await transport.log(createTestEntry({ message: 'Entry 3' }));

      expect(transport.getBuffer().length).toBe(0);
      expect(transport.loggedEntries.length).toBe(1);
      expect(transport.loggedEntries[0]).toHaveLength(3);
    });

    it('should flush pending logs on manual flush', async () => {
      await transport.log(createTestEntry({ message: 'Entry 1' }));
      await transport.log(createTestEntry({ message: 'Entry 2' }));

      await transport.flush();

      expect(transport.getBuffer().length).toBe(0);
      expect(transport.loggedEntries.length).toBe(1);
      expect(transport.loggedEntries[0]).toHaveLength(2);
    });

    it('should not flush when buffer is empty', async () => {
      await transport.flush();

      expect(transport.doFlushCalled).toBe(false);
      expect(transport.loggedEntries.length).toBe(0);
    });
  });

  describe('logging with batching disabled', () => {
    beforeEach(async () => {
      transport = new TestTransport({
        enableBatching: false,
      });
      await transport.initialize();
    });

    it('should ship immediately without buffering', async () => {
      await transport.log(createTestEntry({ message: 'Entry 1' }));

      expect(transport.getBuffer().length).toBe(0);
      expect(transport.loggedEntries.length).toBe(1);
      expect(transport.loggedEntries[0]).toHaveLength(1);
    });

    it('should ship each entry individually', async () => {
      await transport.log(createTestEntry({ message: 'Entry 1' }));
      await transport.log(createTestEntry({ message: 'Entry 2' }));

      expect(transport.loggedEntries.length).toBe(2);
    });
  });

  describe('log level filtering', () => {
    it('should filter logs below minimum level', async () => {
      transport = new TestTransport({
        minLevel: 'WARN',
        enableBatching: false,
      });
      await transport.initialize();

      await transport.log(createTestEntry({ level: 'DEBUG' }));
      await transport.log(createTestEntry({ level: 'INFO' }));

      expect(transport.loggedEntries.length).toBe(0);
    });

    it('should accept logs at or above minimum level', async () => {
      transport = new TestTransport({
        minLevel: 'WARN',
        enableBatching: false,
      });
      await transport.initialize();

      await transport.log(createTestEntry({ level: 'WARN' }));
      await transport.log(createTestEntry({ level: 'ERROR' }));

      expect(transport.loggedEntries.length).toBe(2);
    });
  });

  describe('error handling and retries', () => {
    it('should retry on failure', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      let callCount = 0;
      transport = new TestTransport({
        enableBatching: false,
        maxRetries: 2,
        retryDelayMs: 10,
      });
      await transport.initialize();

      // Fail first two calls, succeed on third
      const originalDoLog = transport['doLog'].bind(transport);
      transport['doLog'] = async (entries: TransportLogEntry[]) => {
        callCount++;
        if (callCount < 3) {
          throw new Error('Temporary failure');
        }
        return originalDoLog(entries);
      };

      await transport.log(createTestEntry());

      expect(callCount).toBe(3);
    });

    it('should throw after max retries exceeded', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      transport = new TestTransport({
        enableBatching: false,
        maxRetries: 1,
        retryDelayMs: 10,
      });
      await transport.initialize();
      transport.shouldFailLog = true;

      await expect(transport.log(createTestEntry())).rejects.toThrow('Log failed');
    });

    it('should track failed attempts in health', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      transport = new TestTransport({
        enableBatching: false,
        maxRetries: 2,
        retryDelayMs: 10,
      });
      await transport.initialize();
      transport.shouldFailLog = true;

      try {
        await transport.log(createTestEntry());
      } catch {
        // Expected
      }

      const health = transport.getHealth();
      expect(health.failedAttempts).toBe(3); // Initial + 2 retries
    });
  });

  describe('health tracking', () => {
    it('should report initial health state', async () => {
      transport = new TestTransport();
      await transport.initialize();

      const health = transport.getHealth();

      expect(health.state).toBe('ready');
      expect(health.pendingLogs).toBe(0);
      expect(health.failedAttempts).toBe(0);
      expect(health.totalProcessed).toBe(0);
    });

    it('should track total processed logs', async () => {
      transport = new TestTransport({ enableBatching: false });
      await transport.initialize();

      await transport.log(createTestEntry());
      await transport.log(createTestEntry());
      await transport.log(createTestEntry());

      const health = transport.getHealth();
      expect(health.totalProcessed).toBe(3);
    });

    it('should track pending logs', async () => {
      transport = new TestTransport({
        enableBatching: true,
        bufferSize: 10,
        flushIntervalMs: 0,
      });
      await transport.initialize();

      await transport.log(createTestEntry());
      await transport.log(createTestEntry());

      const health = transport.getHealth();
      expect(health.pendingLogs).toBe(2);
    });

    it('should track last log time', async () => {
      transport = new TestTransport({ enableBatching: false });
      await transport.initialize();

      const beforeLog = new Date();
      await transport.log(createTestEntry());
      const afterLog = new Date();

      const health = transport.getHealth();
      expect(health.lastLogTime).toBeDefined();
      expect(health.lastLogTime!.getTime()).toBeGreaterThanOrEqual(beforeLog.getTime());
      expect(health.lastLogTime!.getTime()).toBeLessThanOrEqual(afterLog.getTime());
    });

    it('should track last error', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      transport = new TestTransport({
        enableBatching: false,
        maxRetries: 0,
      });
      await transport.initialize();
      transport.shouldFailLog = true;

      try {
        await transport.log(createTestEntry());
      } catch {
        // Expected
      }

      const health = transport.getHealth();
      expect(health.lastError).toBe('Log failed');
      expect(health.lastErrorTime).toBeDefined();
    });
  });

  describe('close', () => {
    it('should flush pending logs before closing', async () => {
      transport = new TestTransport({
        enableBatching: true,
        bufferSize: 10,
        flushIntervalMs: 0,
      });
      await transport.initialize();

      await transport.log(createTestEntry({ message: 'Pending' }));

      await transport.close();

      expect(transport.loggedEntries.length).toBe(1);
      expect(transport.doCloseCalled).toBe(true);
      expect(transport.getState()).toBe('closed');
    });

    it('should be idempotent', async () => {
      transport = new TestTransport();
      await transport.initialize();

      await transport.close();
      await transport.close();

      expect(transport.getState()).toBe('closed');
    });

    it('should reject logging after close', async () => {
      transport = new TestTransport();
      await transport.initialize();
      await transport.close();

      await expect(transport.log(createTestEntry())).rejects.toThrow('not ready');
    });

    it('should suppress flush errors during close', async () => {
      transport = new TestTransport({
        enableBatching: false,
        maxRetries: 0,
      });
      await transport.initialize();

      // Add a log that will fail during close flush
      transport.shouldFailLog = true;

      // Close should not throw despite flush failure
      await expect(transport.close()).resolves.not.toThrow();
      expect(transport.doCloseCalled).toBe(true);
    });
  });

  describe('state transitions', () => {
    it('should transition through states correctly', async () => {
      transport = new TestTransport();

      expect(transport.getState()).toBe('uninitialized');

      const initPromise = transport.initialize();
      // State becomes 'initializing' during initialization
      await initPromise;

      expect(transport.getState()).toBe('ready');

      await transport.close();

      expect(transport.getState()).toBe('closed');
    });
  });

  describe('isReady', () => {
    it('should return false before initialization', () => {
      transport = new TestTransport();
      expect(transport.isReady()).toBe(false);
    });

    it('should return true after initialization', async () => {
      transport = new TestTransport();
      await transport.initialize();
      expect(transport.isReady()).toBe(true);
    });

    it('should return false after close', async () => {
      transport = new TestTransport();
      await transport.initialize();
      await transport.close();
      expect(transport.isReady()).toBe(false);
    });

    it('should return false on error state', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});

      transport = new TestTransport();
      transport.shouldFailInit = true;

      try {
        await transport.initialize();
      } catch {
        // Expected
      }

      expect(transport.isReady()).toBe(false);
    });
  });
});
