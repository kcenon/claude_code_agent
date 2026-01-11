import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { TransportLogEntry } from '../../src/logging/transports/types.js';

/**
 * Mock AWS CloudWatch Logs client functions
 */
const mockSend = vi.fn();
const mockDestroy = vi.fn();

vi.mock('@aws-sdk/client-cloudwatch-logs', () => {
  return {
    CloudWatchLogsClient: class MockCloudWatchLogsClient {
      send = mockSend;
      destroy = mockDestroy;

      constructor() {
        this.send = mockSend;
        this.destroy = mockDestroy;
      }
    },
    CreateLogGroupCommand: class MockCreateLogGroupCommand {
      constructor(public readonly input: unknown) {}
    },
    CreateLogStreamCommand: class MockCreateLogStreamCommand {
      constructor(public readonly input: unknown) {}
    },
    DescribeLogGroupsCommand: class MockDescribeLogGroupsCommand {
      constructor(public readonly input: unknown) {}
    },
    DescribeLogStreamsCommand: class MockDescribeLogStreamsCommand {
      constructor(public readonly input: unknown) {}
    },
    PutLogEventsCommand: class MockPutLogEventsCommand {
      constructor(public readonly input: unknown) {}
    },
    PutRetentionPolicyCommand: class MockPutRetentionPolicyCommand {
      constructor(public readonly input: unknown) {}
    },
  };
});

// Import after mock setup
import { CloudWatchTransport } from '../../src/logging/transports/CloudWatchTransport.js';

describe('CloudWatchTransport', () => {
  let transport: CloudWatchTransport;

  const createTestEntry = (overrides: Partial<TransportLogEntry> = {}): TransportLogEntry => ({
    timestamp: new Date('2024-01-15T10:30:00.000Z'),
    level: 'INFO',
    message: 'Test message',
    context: {},
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock responses
    mockSend.mockImplementation((command: { constructor: { name: string }; input?: unknown }) => {
      const commandName = command.constructor.name;

      switch (commandName) {
        case 'MockDescribeLogGroupsCommand':
          return Promise.resolve({
            logGroups: [{ logGroupName: '/test/logs' }],
          });
        case 'MockCreateLogGroupCommand':
          return Promise.resolve({});
        case 'MockPutRetentionPolicyCommand':
          return Promise.resolve({});
        case 'MockCreateLogStreamCommand':
          return Promise.resolve({});
        case 'MockDescribeLogStreamsCommand':
          return Promise.resolve({
            logStreams: [],
          });
        case 'MockPutLogEventsCommand':
          return Promise.resolve({
            nextSequenceToken: 'next-token-123',
          });
        default:
          return Promise.resolve({});
      }
    });

    mockDestroy.mockReturnValue(undefined);
  });

  afterEach(async () => {
    if (transport !== undefined) {
      await transport.close();
    }
  });

  describe('initialization', () => {
    it('should initialize successfully with basic config', async () => {
      transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
      });

      await transport.initialize();

      expect(transport.isReady()).toBe(true);
      expect(mockSend).toHaveBeenCalled();
    });

    it('should throw when initializing twice', async () => {
      transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
      });

      await transport.initialize();

      await expect(transport.initialize()).rejects.toThrow('already initialized');
    });

    it('should have name "cloudwatch"', () => {
      transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
      });

      expect(transport.name).toBe('cloudwatch');
    });

    it('should create log group if it does not exist', async () => {
      // Mock that log group doesn't exist
      mockSend.mockImplementation((command: { constructor: { name: string }; input?: unknown }) => {
        const commandName = command.constructor.name;

        switch (commandName) {
          case 'MockDescribeLogGroupsCommand':
            return Promise.resolve({
              logGroups: [],
            });
          case 'MockCreateLogGroupCommand':
            return Promise.resolve({});
          case 'MockPutRetentionPolicyCommand':
            return Promise.resolve({});
          case 'MockCreateLogStreamCommand':
            return Promise.resolve({});
          default:
            return Promise.resolve({});
        }
      });

      transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
        createLogGroup: true,
      });

      await transport.initialize();

      // Verify CreateLogGroupCommand was called
      const createGroupCalls = mockSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'MockCreateLogGroupCommand'
      );
      expect(createGroupCalls.length).toBe(1);
    });

    it('should not create log group if createLogGroup is false', async () => {
      mockSend.mockImplementation((command: { constructor: { name: string }; input?: unknown }) => {
        const commandName = command.constructor.name;

        switch (commandName) {
          case 'MockDescribeLogGroupsCommand':
            return Promise.resolve({
              logGroups: [],
            });
          case 'MockCreateLogStreamCommand':
            return Promise.resolve({});
          default:
            return Promise.resolve({});
        }
      });

      transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
        createLogGroup: false,
      });

      await transport.initialize();

      // Verify CreateLogGroupCommand was not called
      const createGroupCalls = mockSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'MockCreateLogGroupCommand'
      );
      expect(createGroupCalls.length).toBe(0);
    });

    it('should create log stream on initialization', async () => {
      transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
        logStreamPrefix: 'test-stream',
      });

      await transport.initialize();

      // Verify CreateLogStreamCommand was called
      const createStreamCalls = mockSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'MockCreateLogStreamCommand'
      );
      expect(createStreamCalls.length).toBe(1);
    });
  });

  describe('authentication', () => {
    it('should configure explicit credentials', async () => {
      transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
        credentials: {
          accessKeyId: 'test-key',
          secretAccessKey: 'test-secret',
        },
      });

      await transport.initialize();

      expect(transport.isReady()).toBe(true);
    });

    it('should configure credentials with session token', async () => {
      transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
        credentials: {
          accessKeyId: 'test-key',
          secretAccessKey: 'test-secret',
          sessionToken: 'test-session-token',
        },
      });

      await transport.initialize();

      expect(transport.isReady()).toBe(true);
    });
  });

  describe('logging', () => {
    it('should log a single entry', async () => {
      transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
        enableBatching: false,
      });

      await transport.initialize();

      const entry = createTestEntry();
      await transport.log(entry);

      // Verify PutLogEventsCommand was called
      const putLogEventsCalls = mockSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'MockPutLogEventsCommand'
      );
      expect(putLogEventsCalls.length).toBe(1);
    });

    it('should include all optional fields in log message', async () => {
      transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
        enableBatching: false,
      });

      await transport.initialize();

      const entry = createTestEntry({
        correlationId: 'corr-123',
        agentId: 'worker-1',
        traceId: 'trace-abc',
        spanId: 'span-xyz',
        parentSpanId: 'parent-123',
        stage: 'implementation',
        projectId: 'proj-1',
        sessionId: 'sess-1',
        durationMs: 150,
        source: 'test.ts:10',
        hostname: 'localhost',
        pid: 1234,
        context: { userId: '123' },
      });

      await transport.log(entry);

      // Verify PutLogEventsCommand was called
      const putLogEventsCalls = mockSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'MockPutLogEventsCommand'
      );
      expect(putLogEventsCalls.length).toBe(1);

      const logEvents = (putLogEventsCalls[0][0] as { input: { logEvents: unknown[] } }).input
        .logEvents;
      expect(logEvents).toHaveLength(1);

      const logMessage = JSON.parse((logEvents[0] as { message: string }).message);
      expect(logMessage.correlationId).toBe('corr-123');
      expect(logMessage.agentId).toBe('worker-1');
      expect(logMessage.traceId).toBe('trace-abc');
      expect(logMessage.spanId).toBe('span-xyz');
      expect(logMessage.parentSpanId).toBe('parent-123');
      expect(logMessage.stage).toBe('implementation');
      expect(logMessage.projectId).toBe('proj-1');
      expect(logMessage.sessionId).toBe('sess-1');
      expect(logMessage.durationMs).toBe(150);
      expect(logMessage.source).toBe('test.ts:10');
      expect(logMessage.hostname).toBe('localhost');
      expect(logMessage.pid).toBe(1234);
      expect(logMessage.context).toEqual({ userId: '123' });
    });

    it('should include error information', async () => {
      transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
        enableBatching: false,
      });

      await transport.initialize();

      const entry = createTestEntry({
        level: 'ERROR',
        error: {
          name: 'TestError',
          message: 'Test error message',
          stack: 'Error: Test error\n  at test.ts:1:1',
          code: 'TEST_ERR',
        },
      });

      await transport.log(entry);

      const putLogEventsCalls = mockSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'MockPutLogEventsCommand'
      );
      const logEvents = (putLogEventsCalls[0][0] as { input: { logEvents: unknown[] } }).input
        .logEvents;
      const logMessage = JSON.parse((logEvents[0] as { message: string }).message);

      expect(logMessage.error).toEqual({
        name: 'TestError',
        message: 'Test error message',
        stack: 'Error: Test error\n  at test.ts:1:1',
        code: 'TEST_ERR',
      });
    });

    it('should handle sequence token refresh', async () => {
      let callCount = 0;
      mockSend.mockImplementation((command: { constructor: { name: string }; input?: unknown }) => {
        const commandName = command.constructor.name;

        switch (commandName) {
          case 'MockDescribeLogGroupsCommand':
            return Promise.resolve({
              logGroups: [{ logGroupName: '/test/logs' }],
            });
          case 'MockCreateLogStreamCommand':
            return Promise.resolve({});
          case 'MockDescribeLogStreamsCommand':
            return Promise.resolve({
              logStreams: [
                {
                  logStreamName: 'test-stream',
                  uploadSequenceToken: 'refreshed-token',
                },
              ],
            });
          case 'MockPutLogEventsCommand':
            callCount++;
            if (callCount === 1) {
              // First call fails with InvalidSequenceTokenException
              const error = new Error('Invalid sequence token');
              (error as Error & { name: string }).name = 'InvalidSequenceTokenException';
              return Promise.reject(error);
            }
            // Second call succeeds
            return Promise.resolve({
              nextSequenceToken: 'new-token',
            });
          default:
            return Promise.resolve({});
        }
      });

      transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
        enableBatching: false,
      });

      await transport.initialize();
      await transport.log(createTestEntry());

      // Verify retry happened
      const putLogEventsCalls = mockSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'MockPutLogEventsCommand'
      );
      expect(putLogEventsCalls.length).toBe(2);
    });
  });

  describe('log level filtering', () => {
    it('should filter logs below minimum level', async () => {
      transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
        minLevel: 'WARN',
        enableBatching: false,
      });

      await transport.initialize();

      await transport.log(createTestEntry({ level: 'DEBUG' }));
      await transport.log(createTestEntry({ level: 'INFO' }));

      const putLogEventsCalls = mockSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'MockPutLogEventsCommand'
      );
      expect(putLogEventsCalls.length).toBe(0);
    });

    it('should log entries at or above minimum level', async () => {
      transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
        minLevel: 'WARN',
        enableBatching: false,
      });

      await transport.initialize();

      await transport.log(createTestEntry({ level: 'WARN' }));
      await transport.log(createTestEntry({ level: 'ERROR' }));

      const putLogEventsCalls = mockSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'MockPutLogEventsCommand'
      );
      expect(putLogEventsCalls.length).toBe(2);
    });
  });

  describe('batching', () => {
    it('should buffer logs when batching is enabled', async () => {
      transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
        enableBatching: true,
        bufferSize: 5,
      });

      await transport.initialize();

      // Log 4 entries (below buffer size)
      for (let i = 0; i < 4; i++) {
        await transport.log(createTestEntry());
      }

      // Should not have flushed yet
      const putLogEventsCallsBefore = mockSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'MockPutLogEventsCommand'
      );
      expect(putLogEventsCallsBefore.length).toBe(0);

      // Log 5th entry to trigger flush
      await transport.log(createTestEntry());

      const putLogEventsCallsAfter = mockSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'MockPutLogEventsCommand'
      );
      expect(putLogEventsCallsAfter.length).toBe(1);
    });

    it('should flush buffer on explicit flush call', async () => {
      transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
        enableBatching: true,
        bufferSize: 100,
      });

      await transport.initialize();

      await transport.log(createTestEntry());
      await transport.log(createTestEntry());

      await transport.flush();

      const putLogEventsCalls = mockSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'MockPutLogEventsCommand'
      );
      expect(putLogEventsCalls.length).toBe(1);
    });
  });

  describe('health tracking', () => {
    it('should report health status', async () => {
      transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
      });

      await transport.initialize();

      const health = transport.getHealth();

      expect(health.state).toBe('ready');
      expect(health.pendingLogs).toBe(0);
      expect(health.failedAttempts).toBe(0);
    });

    it('should track total processed logs', async () => {
      transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
        enableBatching: false,
      });

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
      transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
      });

      await transport.initialize();

      await expect(transport.flush()).resolves.not.toThrow();
    });

    it('should close without error', async () => {
      transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
      });

      await transport.initialize();

      await expect(transport.close()).resolves.not.toThrow();
      expect(mockDestroy).toHaveBeenCalled();
    });

    it('should throw when logging after close', async () => {
      transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
      });

      await transport.initialize();
      await transport.close();

      await expect(transport.log(createTestEntry())).rejects.toThrow('not ready');
    });
  });

  describe('client access', () => {
    it('should return null client before initialization', () => {
      transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
      });

      expect(transport.getClient()).toBeNull();
    });

    it('should return client after initialization', async () => {
      transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
      });

      await transport.initialize();

      expect(transport.getClient()).not.toBeNull();
    });

    it('should return log group name', () => {
      transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
      });

      expect(transport.getLogGroupName()).toBe('/test/logs');
    });

    it('should return null log stream name before initialization', () => {
      transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
      });

      expect(transport.getLogStreamName()).toBeNull();
    });

    it('should return log stream name after initialization', async () => {
      transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
        logStreamPrefix: 'test-prefix',
      });

      await transport.initialize();

      const streamName = transport.getLogStreamName();
      expect(streamName).not.toBeNull();
      expect(streamName).toMatch(/^test-prefix\//);
    });
  });

  describe('error handling', () => {
    it('should handle ResourceAlreadyExistsException for log group', async () => {
      mockSend.mockImplementation((command: { constructor: { name: string }; input?: unknown }) => {
        const commandName = command.constructor.name;

        switch (commandName) {
          case 'MockDescribeLogGroupsCommand':
            return Promise.resolve({
              logGroups: [],
            });
          case 'MockCreateLogGroupCommand': {
            const error = new Error('Log group already exists');
            (error as Error & { name: string }).name = 'ResourceAlreadyExistsException';
            return Promise.reject(error);
          }
          case 'MockCreateLogStreamCommand':
            return Promise.resolve({});
          default:
            return Promise.resolve({});
        }
      });

      transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
        createLogGroup: true,
      });

      // Should not throw
      await expect(transport.initialize()).resolves.not.toThrow();
    });

    it('should handle ResourceAlreadyExistsException for log stream', async () => {
      mockSend.mockImplementation((command: { constructor: { name: string }; input?: unknown }) => {
        const commandName = command.constructor.name;

        switch (commandName) {
          case 'MockDescribeLogGroupsCommand':
            return Promise.resolve({
              logGroups: [{ logGroupName: '/test/logs' }],
            });
          case 'MockCreateLogStreamCommand': {
            const error = new Error('Log stream already exists');
            (error as Error & { name: string }).name = 'ResourceAlreadyExistsException';
            return Promise.reject(error);
          }
          case 'MockDescribeLogStreamsCommand':
            return Promise.resolve({
              logStreams: [
                {
                  logStreamName: 'existing-stream',
                  uploadSequenceToken: 'existing-token',
                },
              ],
            });
          default:
            return Promise.resolve({});
        }
      });

      transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
      });

      // Should not throw
      await expect(transport.initialize()).resolves.not.toThrow();
    });

    it('should handle DataAlreadyAcceptedException', async () => {
      let callCount = 0;
      mockSend.mockImplementation((command: { constructor: { name: string }; input?: unknown }) => {
        const commandName = command.constructor.name;

        switch (commandName) {
          case 'MockDescribeLogGroupsCommand':
            return Promise.resolve({
              logGroups: [{ logGroupName: '/test/logs' }],
            });
          case 'MockCreateLogStreamCommand':
            return Promise.resolve({});
          case 'MockPutLogEventsCommand':
            callCount++;
            if (callCount === 1) {
              const error = new Error('Data already accepted') as Error & {
                name: string;
                expectedSequenceToken: string;
              };
              error.name = 'DataAlreadyAcceptedException';
              error.expectedSequenceToken = 'expected-token';
              return Promise.reject(error);
            }
            return Promise.resolve({
              nextSequenceToken: 'new-token',
            });
          default:
            return Promise.resolve({});
        }
      });

      transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
        enableBatching: false,
      });

      await transport.initialize();

      // Should not throw for duplicate data
      await expect(transport.log(createTestEntry())).resolves.not.toThrow();
    });
  });
});
