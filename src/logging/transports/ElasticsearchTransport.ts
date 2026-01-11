/**
 * ElasticsearchTransport - Elasticsearch log transport implementation
 *
 * Implements ILogTransport for Elasticsearch-based centralized logging
 * with support for index templates, daily index rotation, buffered shipping,
 * and connection retry logic.
 *
 * @module logging/transports
 */

import { Client, type ClientOptions } from '@elastic/elasticsearch';
import { BaseTransport } from './BaseTransport.js';
import type { TransportLogEntry, ElasticsearchTransportConfig } from './types.js';

/**
 * Default index prefix for log indices
 */
const DEFAULT_INDEX_PREFIX = 'ad-sdlc-logs';

/**
 * Default index date pattern for daily rotation
 */
const DEFAULT_INDEX_DATE_PATTERN = 'YYYY.MM.DD';

/**
 * Default request timeout in milliseconds
 */
const DEFAULT_REQUEST_TIMEOUT = 30000;

/**
 * Default number of shards for index
 */
const DEFAULT_NUMBER_OF_SHARDS = 1;

/**
 * Default number of replicas for index
 */
const DEFAULT_NUMBER_OF_REPLICAS = 1;

/**
 * Elasticsearch log transport implementation
 *
 * Supports:
 * - Index template creation for consistent mappings
 * - Daily index rotation for log management
 * - Buffered log shipping for performance
 * - Automatic retry on connection failures
 * - TLS/SSL for secure connections
 *
 * @example
 * ```typescript
 * const transport = new ElasticsearchTransport({
 *   type: 'elasticsearch',
 *   nodes: ['https://localhost:9200'],
 *   auth: { username: 'elastic', password: 'changeme' },
 *   indexPrefix: 'app-logs',
 *   indexDatePattern: 'YYYY.MM.DD',
 * });
 *
 * await transport.initialize();
 * await transport.log({
 *   timestamp: new Date(),
 *   level: 'INFO',
 *   message: 'Application started',
 *   context: {},
 * });
 * ```
 */
export class ElasticsearchTransport extends BaseTransport {
  /**
   * Elasticsearch client instance
   */
  private client: Client | null = null;

  /**
   * Elasticsearch node URLs
   */
  private readonly nodes: string[];

  /**
   * Authentication configuration
   */
  private readonly auth:
    | {
        readonly username?: string;
        readonly password?: string;
        readonly apiKey?: string;
      }
    | undefined;

  /**
   * Index name prefix
   */
  private readonly indexPrefix: string;

  /**
   * Index date pattern for daily/weekly rotation
   */
  private readonly indexDatePattern: string;

  /**
   * TLS/SSL enabled flag
   */
  private readonly tls: boolean;

  /**
   * CA certificate path
   */
  private readonly caCertPath: string | undefined;

  /**
   * Request timeout in milliseconds
   */
  private readonly requestTimeout: number;

  /**
   * Number of shards for index
   */
  private readonly numberOfShards: number;

  /**
   * Number of replicas for index
   */
  private readonly numberOfReplicas: number;

  /**
   * Create a new ElasticsearchTransport instance
   *
   * @param config - Elasticsearch transport configuration
   */
  constructor(config: ElasticsearchTransportConfig) {
    super('elasticsearch', config);

    this.nodes = config.nodes;
    this.auth = config.auth;
    this.indexPrefix = config.indexPrefix ?? DEFAULT_INDEX_PREFIX;
    this.indexDatePattern = config.indexDatePattern ?? DEFAULT_INDEX_DATE_PATTERN;
    this.tls = config.tls ?? false;
    this.caCertPath = config.caCertPath;
    this.requestTimeout = config.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT;
    this.numberOfShards = config.numberOfShards ?? DEFAULT_NUMBER_OF_SHARDS;
    this.numberOfReplicas = config.numberOfReplicas ?? DEFAULT_NUMBER_OF_REPLICAS;
  }

  /**
   * Initialize the Elasticsearch transport
   *
   * Creates the Elasticsearch client, verifies connection,
   * and sets up index template for consistent mappings.
   */
  protected async doInitialize(): Promise<void> {
    // Build client options with proper typing
    const clientOptions: ClientOptions = {
      nodes: this.nodes,
      requestTimeout: this.requestTimeout,
      maxRetries: this.maxRetries,
    };

    // Configure authentication
    if (this.auth !== undefined) {
      const authConfig = this.auth;
      if (authConfig.apiKey !== undefined) {
        clientOptions.auth = { apiKey: authConfig.apiKey };
      } else if (authConfig.username !== undefined && authConfig.password !== undefined) {
        clientOptions.auth = {
          username: authConfig.username,
          password: authConfig.password,
        };
      }
    }

    // Configure TLS
    if (this.tls) {
      const tlsConfig: { rejectUnauthorized: boolean; ca?: Buffer } = {
        rejectUnauthorized: this.caCertPath !== undefined,
      };
      if (this.caCertPath !== undefined) {
        const fs = await import('node:fs');
        tlsConfig.ca = fs.readFileSync(this.caCertPath);
      }
      clientOptions.tls = tlsConfig;
    }

    this.client = new Client(clientOptions);

    // Verify connection
    await this.client.ping();

    // Create index template
    await this.ensureIndexTemplate();
  }

  /**
   * Log entries to Elasticsearch
   *
   * Uses bulk API for efficient shipping of multiple log entries.
   *
   * @param entries - Log entries to ship
   */
  protected async doLog(entries: TransportLogEntry[]): Promise<void> {
    if (this.client === null) {
      throw new Error('Elasticsearch client not initialized');
    }

    if (entries.length === 0) {
      return;
    }

    const indexName = this.getIndexName();
    const operations: Array<Record<string, unknown>> = [];

    for (const entry of entries) {
      operations.push({ index: { _index: indexName } });
      operations.push(this.formatEntry(entry));
    }

    const response = await this.client.bulk({
      operations: operations as unknown[],
      refresh: false,
    });

    if (response.errors) {
      const failedItems = response.items.filter((item) => item.index?.error !== undefined);
      const errorMessages = failedItems
        .map((item) => item.index?.error?.reason ?? 'Unknown error')
        .slice(0, 3);
      throw new Error(`Bulk indexing failed for ${String(failedItems.length)} items: ${errorMessages.join(', ')}`);
    }
  }

  /**
   * Flush Elasticsearch operations
   *
   * Requests a refresh on the current index to make documents searchable.
   */
  protected async doFlush(): Promise<void> {
    if (this.client === null) {
      return;
    }

    try {
      const indexName = this.getIndexName();
      await this.client.indices.refresh({ index: indexName });
    } catch {
      // Ignore refresh errors (index may not exist yet)
    }
  }

  /**
   * Close the Elasticsearch transport
   *
   * Closes the Elasticsearch client connection.
   */
  protected async doClose(): Promise<void> {
    if (this.client !== null) {
      await this.client.close();
      this.client = null;
    }
  }

  /**
   * Ensure index template exists
   *
   * Creates an index template for consistent field mappings across
   * all log indices created by this transport.
   */
  private async ensureIndexTemplate(): Promise<void> {
    if (this.client === null) {
      return;
    }

    const templateName = `${this.indexPrefix}-template`;

    try {
      const exists = await this.client.indices.existsIndexTemplate({ name: templateName });

      if (!exists) {
        await this.client.indices.putIndexTemplate({
          name: templateName,
          index_patterns: [`${this.indexPrefix}-*`],
          template: {
            settings: {
              number_of_shards: this.numberOfShards,
              number_of_replicas: this.numberOfReplicas,
            },
            mappings: {
              properties: {
                timestamp: { type: 'date' },
                level: { type: 'keyword' },
                message: { type: 'text' },
                correlationId: { type: 'keyword' },
                agentId: { type: 'keyword' },
                traceId: { type: 'keyword' },
                spanId: { type: 'keyword' },
                parentSpanId: { type: 'keyword' },
                stage: { type: 'keyword' },
                projectId: { type: 'keyword' },
                sessionId: { type: 'keyword' },
                durationMs: { type: 'long' },
                error: {
                  type: 'object',
                  properties: {
                    name: { type: 'keyword' },
                    message: { type: 'text' },
                    stack: { type: 'text' },
                    code: { type: 'keyword' },
                  },
                },
                source: { type: 'keyword' },
                hostname: { type: 'keyword' },
                pid: { type: 'integer' },
                context: { type: 'object', enabled: true },
              },
            },
          },
          priority: 100,
        });
      }
    } catch (error) {
      // Log template creation error but don't fail initialization
      this.handleError('Failed to create index template', error);
    }
  }

  /**
   * Get the current index name based on date pattern
   *
   * @returns Current index name with date suffix
   */
  private getIndexName(): string {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');

    let dateSuffix: string;
    if (this.indexDatePattern === 'YYYY.MM.DD') {
      dateSuffix = `${year}.${month}.${day}`;
    } else if (this.indexDatePattern === 'YYYY.MM') {
      dateSuffix = `${year}.${month}`;
    } else if (this.indexDatePattern === 'YYYY.WW') {
      const weekNumber = this.getWeekNumber(now);
      dateSuffix = `${year}.${String(weekNumber).padStart(2, '0')}`;
    } else {
      dateSuffix = `${year}.${month}.${day}`;
    }

    return `${this.indexPrefix}-${dateSuffix}`;
  }

  /**
   * Get ISO week number for a date
   *
   * @param date - Date to get week number for
   * @returns Week number (1-53)
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  /**
   * Format a log entry for Elasticsearch
   *
   * @param entry - Log entry to format
   * @returns Formatted document for indexing
   */
  private formatEntry(entry: TransportLogEntry): Record<string, unknown> {
    const doc: Record<string, unknown> = {
      timestamp: entry.timestamp.toISOString(),
      level: entry.level,
      message: entry.message,
    };

    // Add optional fields
    if (entry.correlationId !== undefined) {
      doc['correlationId'] = entry.correlationId;
    }
    if (entry.agentId !== undefined) {
      doc['agentId'] = entry.agentId;
    }
    if (entry.traceId !== undefined) {
      doc['traceId'] = entry.traceId;
    }
    if (entry.spanId !== undefined) {
      doc['spanId'] = entry.spanId;
    }
    if (entry.parentSpanId !== undefined) {
      doc['parentSpanId'] = entry.parentSpanId;
    }
    if (entry.stage !== undefined) {
      doc['stage'] = entry.stage;
    }
    if (entry.projectId !== undefined) {
      doc['projectId'] = entry.projectId;
    }
    if (entry.sessionId !== undefined) {
      doc['sessionId'] = entry.sessionId;
    }
    if (entry.durationMs !== undefined) {
      doc['durationMs'] = entry.durationMs;
    }
    if (entry.error !== undefined) {
      doc['error'] = entry.error;
    }
    if (entry.source !== undefined) {
      doc['source'] = entry.source;
    }
    if (entry.hostname !== undefined) {
      doc['hostname'] = entry.hostname;
    }
    if (entry.pid !== undefined) {
      doc['pid'] = entry.pid;
    }
    if (Object.keys(entry.context).length > 0) {
      doc['context'] = entry.context;
    }

    return doc;
  }

  /**
   * Get the Elasticsearch client for testing or advanced usage
   *
   * @returns The Elasticsearch client instance or null if not initialized
   */
  public getClient(): Client | null {
    return this.client;
  }

  /**
   * Get the current index name for testing or monitoring
   *
   * @returns Current index name
   */
  public getCurrentIndexName(): string {
    return this.getIndexName();
  }
}
