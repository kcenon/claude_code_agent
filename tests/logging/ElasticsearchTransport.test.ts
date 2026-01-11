import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { TransportLogEntry } from '../../src/logging/transports/types.js';

/**
 * Mock Elasticsearch client functions
 */
const mockBulk = vi.fn();
const mockPing = vi.fn();
const mockClose = vi.fn();
const mockIndicesRefresh = vi.fn();
const mockIndicesExistsIndexTemplate = vi.fn();
const mockIndicesPutIndexTemplate = vi.fn();

vi.mock('@elastic/elasticsearch', () => {
  return {
    Client: class MockClient {
      ping = mockBulk.mockName('ping');
      bulk = mockBulk.mockName('bulk');
      close = mockClose.mockName('close');
      indices = {
        refresh: mockIndicesRefresh.mockName('refresh'),
        existsIndexTemplate: mockIndicesExistsIndexTemplate.mockName('existsIndexTemplate'),
        putIndexTemplate: mockIndicesPutIndexTemplate.mockName('putIndexTemplate'),
      };

      constructor() {
        // Use shared mock functions
        this.ping = mockPing;
        this.bulk = mockBulk;
        this.close = mockClose;
        this.indices = {
          refresh: mockIndicesRefresh,
          existsIndexTemplate: mockIndicesExistsIndexTemplate,
          putIndexTemplate: mockIndicesPutIndexTemplate,
        };
      }
    },
  };
});

// Import after mock setup
import { ElasticsearchTransport } from '../../src/logging/transports/ElasticsearchTransport.js';

describe('ElasticsearchTransport', () => {
  let transport: ElasticsearchTransport;

  const createTestEntry = (overrides: Partial<TransportLogEntry> = {}): TransportLogEntry => ({
    timestamp: new Date('2024-01-15T10:30:00.000Z'),
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
  });

  afterEach(async () => {
    if (transport !== undefined) {
      await transport.close();
    }
  });

  describe('initialization', () => {
    it('should initialize successfully with basic config', async () => {
      transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
      });

      await transport.initialize();

      expect(transport.isReady()).toBe(true);
      expect(mockPing).toHaveBeenCalled();
    });

    it('should throw when initializing twice', async () => {
      transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
      });

      await transport.initialize();

      await expect(transport.initialize()).rejects.toThrow('already initialized');
    });

    it('should have name "elasticsearch"', () => {
      transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
      });

      expect(transport.name).toBe('elasticsearch');
    });

    it('should create index template on initialization', async () => {
      transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
        indexPrefix: 'test-logs',
      });

      await transport.initialize();

      expect(mockIndicesExistsIndexTemplate).toHaveBeenCalledWith({
        name: 'test-logs-template',
      });
      expect(mockIndicesPutIndexTemplate).toHaveBeenCalled();
    });

    it('should not create template if it already exists', async () => {
      mockIndicesExistsIndexTemplate.mockResolvedValue(true);

      transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
      });

      await transport.initialize();

      expect(mockIndicesPutIndexTemplate).not.toHaveBeenCalled();
    });
  });

  describe('authentication', () => {
    it('should configure username/password auth', async () => {
      transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
        auth: {
          username: 'elastic',
          password: 'changeme',
        },
      });

      await transport.initialize();

      expect(transport.isReady()).toBe(true);
    });

    it('should configure API key auth', async () => {
      transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
        auth: {
          apiKey: 'test-api-key',
        },
      });

      await transport.initialize();

      expect(transport.isReady()).toBe(true);
    });
  });

  describe('logging', () => {
    it('should log a single entry', async () => {
      transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
        enableBatching: false,
      });

      await transport.initialize();

      const entry = createTestEntry();
      await transport.log(entry);

      expect(mockBulk).toHaveBeenCalled();
      const bulkCall = mockBulk.mock.calls[0][0];
      expect(bulkCall.operations).toHaveLength(2); // index action + document
    });

    it('should include all optional fields in indexed document', async () => {
      transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
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

      const bulkCall = mockBulk.mock.calls[0][0];
      const document = bulkCall.operations[1];

      expect(document.correlationId).toBe('corr-123');
      expect(document.agentId).toBe('worker-1');
      expect(document.traceId).toBe('trace-abc');
      expect(document.spanId).toBe('span-xyz');
      expect(document.parentSpanId).toBe('parent-123');
      expect(document.stage).toBe('implementation');
      expect(document.projectId).toBe('proj-1');
      expect(document.sessionId).toBe('sess-1');
      expect(document.durationMs).toBe(150);
      expect(document.source).toBe('test.ts:10');
      expect(document.hostname).toBe('localhost');
      expect(document.pid).toBe(1234);
      expect(document.context).toEqual({ userId: '123' });
    });

    it('should include error information', async () => {
      transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
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

      const bulkCall = mockBulk.mock.calls[0][0];
      const document = bulkCall.operations[1];

      expect(document.error).toEqual({
        name: 'TestError',
        message: 'Test error message',
        stack: 'Error: Test error\n  at test.ts:1:1',
        code: 'TEST_ERR',
      });
    });

    it('should throw on bulk indexing failure', async () => {
      mockBulk.mockResolvedValue({
        errors: true,
        items: [{ index: { error: { reason: 'Mapping error' } } }],
      });

      transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
        enableBatching: false,
        maxRetries: 0,
      });

      await transport.initialize();

      await expect(transport.log(createTestEntry())).rejects.toThrow('Bulk indexing failed');
    });
  });

  describe('index naming', () => {
    it('should generate daily index name by default', async () => {
      transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
        indexPrefix: 'test-logs',
      });

      await transport.initialize();

      const indexName = transport.getCurrentIndexName();
      expect(indexName).toMatch(/^test-logs-\d{4}\.\d{2}\.\d{2}$/);
    });

    it('should generate monthly index name', async () => {
      transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
        indexPrefix: 'test-logs',
        indexDatePattern: 'YYYY.MM',
      });

      await transport.initialize();

      const indexName = transport.getCurrentIndexName();
      expect(indexName).toMatch(/^test-logs-\d{4}\.\d{2}$/);
    });

    it('should generate weekly index name', async () => {
      transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
        indexPrefix: 'test-logs',
        indexDatePattern: 'YYYY.WW',
      });

      await transport.initialize();

      const indexName = transport.getCurrentIndexName();
      expect(indexName).toMatch(/^test-logs-\d{4}\.\d{2}$/);
    });

    it('should use default index prefix', async () => {
      transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
      });

      await transport.initialize();

      const indexName = transport.getCurrentIndexName();
      expect(indexName).toMatch(/^ad-sdlc-logs-/);
    });
  });

  describe('log level filtering', () => {
    it('should filter logs below minimum level', async () => {
      transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
        minLevel: 'WARN',
        enableBatching: false,
      });

      await transport.initialize();

      await transport.log(createTestEntry({ level: 'DEBUG' }));
      await transport.log(createTestEntry({ level: 'INFO' }));

      expect(mockBulk).not.toHaveBeenCalled();
    });

    it('should log entries at or above minimum level', async () => {
      transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
        minLevel: 'WARN',
        enableBatching: false,
      });

      await transport.initialize();

      await transport.log(createTestEntry({ level: 'WARN' }));
      await transport.log(createTestEntry({ level: 'ERROR' }));

      expect(mockBulk).toHaveBeenCalledTimes(2);
    });
  });

  describe('batching', () => {
    it('should buffer logs when batching is enabled', async () => {
      transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
        enableBatching: true,
        bufferSize: 5,
      });

      await transport.initialize();

      // Log 4 entries (below buffer size)
      for (let i = 0; i < 4; i++) {
        await transport.log(createTestEntry());
      }

      // Should not have flushed yet
      expect(mockBulk).not.toHaveBeenCalled();

      // Log 5th entry to trigger flush
      await transport.log(createTestEntry());

      expect(mockBulk).toHaveBeenCalled();
    });

    it('should flush buffer on explicit flush call', async () => {
      transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
        enableBatching: true,
        bufferSize: 100,
      });

      await transport.initialize();

      await transport.log(createTestEntry());
      await transport.log(createTestEntry());

      await transport.flush();

      expect(mockBulk).toHaveBeenCalled();
    });
  });

  describe('health tracking', () => {
    it('should report health status', async () => {
      transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
      });

      await transport.initialize();

      const health = transport.getHealth();

      expect(health.state).toBe('ready');
      expect(health.pendingLogs).toBe(0);
      expect(health.failedAttempts).toBe(0);
    });

    it('should track total processed logs', async () => {
      transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
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
      transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
      });

      await transport.initialize();

      await expect(transport.flush()).resolves.not.toThrow();
    });

    it('should refresh index on flush', async () => {
      transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
        enableBatching: true,
      });

      await transport.initialize();

      await transport.log(createTestEntry());
      await transport.flush();

      expect(mockIndicesRefresh).toHaveBeenCalled();
    });

    it('should close without error', async () => {
      transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
      });

      await transport.initialize();

      await expect(transport.close()).resolves.not.toThrow();
      expect(mockClose).toHaveBeenCalled();
    });

    it('should throw when logging after close', async () => {
      transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
      });

      await transport.initialize();
      await transport.close();

      await expect(transport.log(createTestEntry())).rejects.toThrow('not ready');
    });
  });

  describe('client access', () => {
    it('should return null client before initialization', () => {
      transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
      });

      expect(transport.getClient()).toBeNull();
    });

    it('should return client after initialization', async () => {
      transport = new ElasticsearchTransport({
        type: 'elasticsearch',
        nodes: ['http://localhost:9200'],
      });

      await transport.initialize();

      expect(transport.getClient()).not.toBeNull();
    });
  });
});
