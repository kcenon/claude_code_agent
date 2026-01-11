/**
 * Elasticsearch Transport Integration Tests
 *
 * These tests verify end-to-end scenarios for the Elasticsearch transport.
 * They use mocks to simulate Elasticsearch behavior but test complete workflows.
 *
 * For actual integration testing against a real Elasticsearch instance,
 * set the ELASTICSEARCH_TEST_URL environment variable and run:
 * npm test -- tests/logging/ElasticsearchTransport.integration.test.ts --integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { TransportLogEntry } from '../../src/logging/transports/types.js';

// Mock Elasticsearch client
const mockBulk = vi.fn();
const mockPing = vi.fn();
const mockClose = vi.fn();
const mockIndicesRefresh = vi.fn();
const mockIndicesExistsIndexTemplate = vi.fn();
const mockIndicesPutIndexTemplate = vi.fn();
const mockIndicesCreate = vi.fn();

vi.mock('@elastic/elasticsearch', () => {
  return {
    Client: class MockClient {
      ping = mockPing;
      bulk = mockBulk;
      close = mockClose;
      indices = {
        refresh: mockIndicesRefresh,
        existsIndexTemplate: mockIndicesExistsIndexTemplate,
        putIndexTemplate: mockIndicesPutIndexTemplate,
        create: mockIndicesCreate,
      };

      constructor() {
        this.ping = mockPing;
        this.bulk = mockBulk;
        this.close = mockClose;
        this.indices = {
          refresh: mockIndicesRefresh,
          existsIndexTemplate: mockIndicesExistsIndexTemplate,
          putIndexTemplate: mockIndicesPutIndexTemplate,
          create: mockIndicesCreate,
        };
      }
    },
  };
});

import { ElasticsearchTransport } from '../../src/logging/transports/ElasticsearchTransport.js';
import { Logger } from '../../src/logging/Logger.js';

describe('ElasticsearchTransport Integration', () => {
  const createTestEntry = (overrides: Partial<TransportLogEntry> = {}): TransportLogEntry => ({
    timestamp: new Date(),
    level: 'INFO',
    message: 'Test message',
    context: {},
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockPing.mockResolvedValue(true);
    mockBulk.mockResolvedValue({ errors: false, items: [] });
    mockClose.mockResolvedValue(undefined);
    mockIndicesRefresh.mockResolvedValue({});
    mockIndicesExistsIndexTemplate.mockResolvedValue(false);
    mockIndicesPutIndexTemplate.mockResolvedValue({});
    mockIndicesCreate.mockResolvedValue({});
  });

  describe('Complete Logging Workflow', () => {
    it('should handle full lifecycle: init -> log -> flush -> close', async () => {
      const transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
        indexPrefix: 'test-logs',
        enableBatching: true,
        bufferSize: 5,
      });

      // Initialize
      await transport.initialize();
      expect(transport.isReady()).toBe(true);
      expect(mockPing).toHaveBeenCalled();

      // Log multiple entries
      for (let i = 0; i < 3; i++) {
        await transport.log(createTestEntry({ message: `Log ${i}` }));
      }

      // Buffer should have entries, not yet flushed
      expect(mockBulk).not.toHaveBeenCalled();

      // Manual flush
      await transport.flush();
      expect(mockBulk).toHaveBeenCalled();

      // Verify health
      const health = transport.getHealth();
      expect(health.state).toBe('ready');
      expect(health.totalProcessed).toBe(3);

      // Close
      await transport.close();
      expect(mockClose).toHaveBeenCalled();
    });

    it('should auto-flush when buffer is full', async () => {
      const transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
        enableBatching: true,
        bufferSize: 3,
      });

      await transport.initialize();

      // Log 3 entries to trigger auto-flush
      await transport.log(createTestEntry({ message: 'Log 1' }));
      await transport.log(createTestEntry({ message: 'Log 2' }));
      await transport.log(createTestEntry({ message: 'Log 3' }));

      expect(mockBulk).toHaveBeenCalledTimes(1);

      await transport.close();
    });
  });

  describe('Error Recovery', () => {
    it('should recover from temporary Elasticsearch failures', async () => {
      let callCount = 0;
      mockBulk.mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.reject(new Error('Connection refused'));
        }
        return Promise.resolve({ errors: false, items: [] });
      });

      vi.spyOn(console, 'error').mockImplementation(() => {});

      const transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
        enableBatching: false,
        maxRetries: 3,
        retryDelayMs: 10,
      });

      await transport.initialize();

      // Should eventually succeed after retries
      await transport.log(createTestEntry());

      expect(callCount).toBe(3);
      expect(transport.getHealth().totalProcessed).toBe(1);

      await transport.close();
    });

    it('should handle partial bulk failures', async () => {
      mockBulk.mockResolvedValue({
        errors: true,
        items: [
          { index: { status: 201 } },
          { index: { status: 400, error: { reason: 'Bad document' } } },
          { index: { status: 201 } },
        ],
      });

      vi.spyOn(console, 'error').mockImplementation(() => {});

      const transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
        enableBatching: false,
        maxRetries: 0,
      });

      await transport.initialize();

      await expect(transport.log(createTestEntry())).rejects.toThrow('Bulk indexing failed');

      await transport.close();
    });
  });

  describe('Index Management', () => {
    it('should create index template on first initialization', async () => {
      mockIndicesExistsIndexTemplate.mockResolvedValue(false);

      const transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
        indexPrefix: 'custom-prefix',
      });

      await transport.initialize();

      expect(mockIndicesExistsIndexTemplate).toHaveBeenCalledWith({
        name: 'custom-prefix-template',
      });
      expect(mockIndicesPutIndexTemplate).toHaveBeenCalled();

      await transport.close();
    });

    it('should skip template creation if already exists', async () => {
      mockIndicesExistsIndexTemplate.mockResolvedValue(true);

      const transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
      });

      await transport.initialize();

      expect(mockIndicesPutIndexTemplate).not.toHaveBeenCalled();

      await transport.close();
    });

    it('should generate correct index names based on date pattern', async () => {
      const transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
        indexPrefix: 'logs',
        indexDatePattern: 'YYYY.MM.DD',
      });

      await transport.initialize();

      const indexName = transport.getCurrentIndexName();
      const today = new Date();
      const expectedPattern = `logs-${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;

      expect(indexName).toBe(expectedPattern);

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
            type: 'elasticsearch',
            nodes: ['http://localhost:9200'],
            indexPrefix: 'app-logs',
            enableBatching: false,
          },
        ],
      });

      await logger.initialize();

      expect(logger.getTransportNames()).toContain('console');
      expect(logger.getTransportNames()).toContain('elasticsearch');

      logger.info('Test message', { userId: '123' });

      // Elasticsearch should receive the log
      expect(mockBulk).toHaveBeenCalled();

      await logger.close();
    });

    it('should include correlation ID in Elasticsearch documents', async () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const logger = new Logger({
        transports: [
          {
            type: 'elasticsearch',
            nodes: ['http://localhost:9200'],
            enableBatching: false,
          },
        ],
      });

      await logger.initialize();
      logger.setCorrelationId('corr-12345');
      logger.info('Correlated message');

      const bulkCall = mockBulk.mock.calls[0][0];
      const document = bulkCall.operations[1];

      expect(document.correlationId).toBe('corr-12345');

      await logger.close();
    });
  });

  describe('High Volume Scenarios', () => {
    it('should handle rapid sequential logging', async () => {
      const transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
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
      const transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
        enableBatching: false,
        minLevel: 'INFO',
      });

      await transport.initialize();

      await transport.log(createTestEntry({ level: 'DEBUG', message: 'Debug' }));
      await transport.log(createTestEntry({ level: 'INFO', message: 'Info' }));
      await transport.log(createTestEntry({ level: 'WARN', message: 'Warn' }));
      await transport.log(createTestEntry({ level: 'ERROR', message: 'Error' }));

      // Only INFO, WARN, ERROR should be logged (DEBUG filtered)
      expect(mockBulk).toHaveBeenCalledTimes(3);

      await transport.close();
    });
  });

  describe('Structured Log Data', () => {
    it('should preserve complex context objects', async () => {
      const transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
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

      const bulkCall = mockBulk.mock.calls[0][0];
      const document = bulkCall.operations[1];

      expect(document.context).toEqual(complexContext);

      await transport.close();
    });

    it('should handle error objects correctly', async () => {
      const transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
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

      const bulkCall = mockBulk.mock.calls[0][0];
      const document = bulkCall.operations[1];

      expect(document.error).toEqual({
        name: 'ValidationError',
        message: 'Invalid input',
        stack: 'Error: Invalid input\n  at validate.ts:10:5',
        code: 'VALIDATION_FAILED',
      });

      await transport.close();
    });
  });
});
