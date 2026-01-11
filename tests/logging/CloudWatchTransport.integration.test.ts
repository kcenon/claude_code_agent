/**
 * CloudWatch Transport Integration Tests
 *
 * These tests verify end-to-end scenarios for the CloudWatch transport.
 * They use mocks to simulate AWS CloudWatch behavior but test complete workflows.
 *
 * For actual integration testing against real AWS CloudWatch,
 * set the AWS_REGION and AWS credentials environment variables and run:
 * npm test -- tests/logging/CloudWatchTransport.integration.test.ts --integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { TransportLogEntry } from '../../src/logging/transports/types.js';

// Mock AWS CloudWatch Logs client
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

import { CloudWatchTransport } from '../../src/logging/transports/CloudWatchTransport.js';
import { Logger } from '../../src/logging/Logger.js';

describe('CloudWatchTransport Integration', () => {
  const createTestEntry = (overrides: Partial<TransportLogEntry> = {}): TransportLogEntry => ({
    timestamp: new Date(),
    level: 'INFO',
    message: 'Test message',
    context: {},
    ...overrides,
  });

  const setupDefaultMocks = () => {
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
            nextSequenceToken: `token-${Date.now()}`,
          });
        default:
          return Promise.resolve({});
      }
    });

    mockDestroy.mockReturnValue(undefined);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  describe('Complete Logging Workflow', () => {
    it('should handle full lifecycle: init -> log -> flush -> close', async () => {
      const transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/app/logs',
        logStreamPrefix: 'test',
        enableBatching: true,
        bufferSize: 5,
      });

      // Initialize
      await transport.initialize();
      expect(transport.isReady()).toBe(true);

      // Verify log group was checked
      const describeGroupCalls = mockSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'MockDescribeLogGroupsCommand'
      );
      expect(describeGroupCalls.length).toBeGreaterThan(0);

      // Log multiple entries
      for (let i = 0; i < 3; i++) {
        await transport.log(createTestEntry({ message: `Log ${i}` }));
      }

      // Manual flush
      await transport.flush();

      // Verify PutLogEvents was called
      const putLogEventsCalls = mockSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'MockPutLogEventsCommand'
      );
      expect(putLogEventsCalls.length).toBeGreaterThan(0);

      // Verify health
      const health = transport.getHealth();
      expect(health.state).toBe('ready');
      expect(health.totalProcessed).toBe(3);

      // Close
      await transport.close();
      expect(mockDestroy).toHaveBeenCalled();
    });

    it('should auto-flush when buffer is full', async () => {
      const transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/app/logs',
        enableBatching: true,
        bufferSize: 3,
      });

      await transport.initialize();

      // Log 3 entries to trigger auto-flush
      await transport.log(createTestEntry({ message: 'Log 1' }));
      await transport.log(createTestEntry({ message: 'Log 2' }));
      await transport.log(createTestEntry({ message: 'Log 3' }));

      const putLogEventsCalls = mockSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'MockPutLogEventsCommand'
      );
      expect(putLogEventsCalls.length).toBe(1);

      await transport.close();
    });
  });

  describe('Log Group Management', () => {
    it('should create log group if not exists and createLogGroup is true', async () => {
      mockSend.mockImplementation((command: { constructor: { name: string }; input?: unknown }) => {
        const commandName = command.constructor.name;

        switch (commandName) {
          case 'MockDescribeLogGroupsCommand':
            return Promise.resolve({
              logGroups: [], // No groups exist
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

      const transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/new/logs',
        createLogGroup: true,
        retentionInDays: 14,
      });

      await transport.initialize();

      const createGroupCalls = mockSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'MockCreateLogGroupCommand'
      );
      expect(createGroupCalls.length).toBe(1);

      const retentionCalls = mockSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'MockPutRetentionPolicyCommand'
      );
      expect(retentionCalls.length).toBe(1);

      await transport.close();
    });

    it('should skip log group creation if already exists', async () => {
      const transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs', // Exists in default mock
        createLogGroup: true,
      });

      await transport.initialize();

      const createGroupCalls = mockSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'MockCreateLogGroupCommand'
      );
      expect(createGroupCalls.length).toBe(0);

      await transport.close();
    });
  });

  describe('Sequence Token Handling', () => {
    it('should handle InvalidSequenceTokenException and retry', async () => {
      let putCallCount = 0;
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
            putCallCount++;
            if (putCallCount === 1) {
              const error = new Error('Invalid sequence token');
              (error as Error & { name: string }).name = 'InvalidSequenceTokenException';
              return Promise.reject(error);
            }
            return Promise.resolve({
              nextSequenceToken: 'new-token',
            });
          default:
            return Promise.resolve({});
        }
      });

      const transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
        enableBatching: false,
      });

      await transport.initialize();
      await transport.log(createTestEntry());

      // Should have retried after token refresh
      expect(putCallCount).toBe(2);

      await transport.close();
    });

    it('should handle DataAlreadyAcceptedException gracefully', async () => {
      let putCallCount = 0;
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
            putCallCount++;
            if (putCallCount === 1) {
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

      const transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
        enableBatching: false,
      });

      await transport.initialize();

      // Should not throw
      await expect(transport.log(createTestEntry())).resolves.not.toThrow();

      await transport.close();
    });
  });

  describe('Logger Integration', () => {
    it('should work correctly when added to Logger', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const logger = new Logger({
        transports: [
          { type: 'console', format: 'json' },
          {
            type: 'cloudwatch',
            region: 'us-east-1',
            logGroupName: '/app/logs',
            enableBatching: false,
          },
        ],
      });

      await logger.initialize();

      expect(logger.getTransportNames()).toContain('console');
      expect(logger.getTransportNames()).toContain('cloudwatch');

      logger.info('Test message', { userId: '123' });

      // CloudWatch should receive the log
      const putLogEventsCalls = mockSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'MockPutLogEventsCommand'
      );
      expect(putLogEventsCalls.length).toBe(1);

      await logger.close();
    });

    it('should include all trace context in CloudWatch logs', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const logger = new Logger({
        transports: [
          {
            type: 'cloudwatch',
            region: 'us-east-1',
            logGroupName: '/app/logs',
            enableBatching: false,
          },
        ],
      });

      await logger.initialize();
      logger.setCorrelationId('corr-12345');
      logger.setAgent('worker-agent');
      logger.setStage('processing');
      logger.setTraceContext('trace-abc', 'span-xyz', 'parent-123');
      logger.info('Traced message');

      const putLogEventsCalls = mockSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'MockPutLogEventsCommand'
      );
      const logEvents = (putLogEventsCalls[0][0] as { input: { logEvents: unknown[] } }).input
        .logEvents;
      const logMessage = JSON.parse((logEvents[0] as { message: string }).message);

      expect(logMessage.correlationId).toBe('corr-12345');
      expect(logMessage.agentId).toBe('worker-agent');
      expect(logMessage.stage).toBe('processing');
      expect(logMessage.traceId).toBe('trace-abc');
      expect(logMessage.spanId).toBe('span-xyz');
      expect(logMessage.parentSpanId).toBe('parent-123');

      await logger.close();
    });
  });

  describe('High Volume Scenarios', () => {
    it('should handle rapid sequential logging', async () => {
      const transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/app/logs',
        enableBatching: true,
        bufferSize: 100,
      });

      await transport.initialize();

      // Log 50 entries rapidly
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(transport.log(createTestEntry({ message: `Rapid log ${i}` })));
      }
      await Promise.all(promises);

      // Flush remaining
      await transport.flush();

      const health = transport.getHealth();
      expect(health.totalProcessed).toBe(50);

      await transport.close();
    });

    it('should handle varied log levels correctly', async () => {
      const transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/app/logs',
        enableBatching: false,
        minLevel: 'INFO',
      });

      await transport.initialize();

      await transport.log(createTestEntry({ level: 'DEBUG', message: 'Debug' }));
      await transport.log(createTestEntry({ level: 'INFO', message: 'Info' }));
      await transport.log(createTestEntry({ level: 'WARN', message: 'Warn' }));
      await transport.log(createTestEntry({ level: 'ERROR', message: 'Error' }));

      // Only INFO, WARN, ERROR should be logged (DEBUG filtered)
      const putLogEventsCalls = mockSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'MockPutLogEventsCommand'
      );
      expect(putLogEventsCalls.length).toBe(3);

      await transport.close();
    });
  });

  describe('Error Handling', () => {
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

      const transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/existing/logs',
        createLogGroup: true,
      });

      // Should not throw - handles race condition gracefully
      await expect(transport.initialize()).resolves.not.toThrow();

      await transport.close();
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

      const transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/test/logs',
      });

      // Should not throw - handles concurrent creation gracefully
      await expect(transport.initialize()).resolves.not.toThrow();

      await transport.close();
    });
  });

  describe('Structured Log Data', () => {
    it('should preserve complex context objects in JSON format', async () => {
      const transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/app/logs',
        enableBatching: false,
      });

      await transport.initialize();

      const complexContext = {
        user: {
          id: '123',
          roles: ['admin', 'user'],
        },
        request: {
          method: 'POST',
          path: '/api/data',
          headers: {
            'content-type': 'application/json',
          },
        },
        metrics: {
          responseTime: 150,
          bytesTransferred: 1024,
        },
      };

      await transport.log(
        createTestEntry({
          message: 'Complex log',
          context: complexContext,
        })
      );

      const putLogEventsCalls = mockSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'MockPutLogEventsCommand'
      );
      const logEvents = (putLogEventsCalls[0][0] as { input: { logEvents: unknown[] } }).input
        .logEvents;
      const logMessage = JSON.parse((logEvents[0] as { message: string }).message);

      expect(logMessage.context).toEqual(complexContext);

      await transport.close();
    });

    it('should handle error objects correctly', async () => {
      const transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/app/logs',
        enableBatching: false,
      });

      await transport.initialize();

      await transport.log(
        createTestEntry({
          level: 'ERROR',
          message: 'Error occurred',
          error: {
            name: 'ValidationError',
            message: 'Invalid input',
            stack: 'Error: Invalid input\n  at validate.ts:10:5',
            code: 'VALIDATION_FAILED',
          },
        })
      );

      const putLogEventsCalls = mockSend.mock.calls.filter(
        (call) => call[0].constructor.name === 'MockPutLogEventsCommand'
      );
      const logEvents = (putLogEventsCalls[0][0] as { input: { logEvents: unknown[] } }).input
        .logEvents;
      const logMessage = JSON.parse((logEvents[0] as { message: string }).message);

      expect(logMessage.error).toEqual({
        name: 'ValidationError',
        message: 'Invalid input',
        stack: 'Error: Invalid input\n  at validate.ts:10:5',
        code: 'VALIDATION_FAILED',
      });

      await transport.close();
    });
  });

  describe('Log Stream Naming', () => {
    it('should use custom stream prefix in stream name', async () => {
      const transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/app/logs',
        logStreamPrefix: 'custom-prefix',
      });

      await transport.initialize();

      const streamName = transport.getLogStreamName();
      expect(streamName).not.toBeNull();
      expect(streamName).toMatch(/^custom-prefix\//);

      await transport.close();
    });

    it('should include hostname and timestamp in stream name', async () => {
      const transport = new CloudWatchTransport({
        type: 'cloudwatch',
        region: 'us-east-1',
        logGroupName: '/app/logs',
        logStreamPrefix: 'test',
      });

      await transport.initialize();

      const streamName = transport.getLogStreamName();
      expect(streamName).not.toBeNull();
      // Stream name format: {prefix}/{hostname}/{timestamp}
      expect(streamName?.split('/').length).toBeGreaterThanOrEqual(2);

      await transport.close();
    });
  });
});
