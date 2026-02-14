/**
 * CloudWatchTransport - AWS CloudWatch Logs transport implementation
 *
 * Implements ILogTransport for AWS CloudWatch Logs-based centralized logging
 * with support for log group and stream management, buffered shipping,
 * sequence token handling, and connection retry logic.
 *
 * @module logging/transports
 */

import {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  CreateLogStreamCommand,
  DescribeLogGroupsCommand,
  DescribeLogStreamsCommand,
  PutLogEventsCommand,
  PutRetentionPolicyCommand,
  type InputLogEvent,
} from '@aws-sdk/client-cloudwatch-logs';
import { BaseTransport } from './BaseTransport.js';
import type { TransportLogEntry, CloudWatchTransportConfig } from './types.js';
import { hostname } from 'node:os';

/**
 * Default log stream prefix
 */
const DEFAULT_LOG_STREAM_PREFIX = 'ad-sdlc';

/**
 * Default log retention in days
 */
const DEFAULT_RETENTION_DAYS = 30;

/**
 * Maximum number of log events per batch (AWS limit: 10,000)
 */
const MAX_BATCH_SIZE = 10000;

/**
 * Maximum batch size in bytes (AWS limit: 1,048,576)
 */
const MAX_BATCH_BYTES = 1048576;

/**
 * Overhead bytes per log event (26 bytes for timestamp + message overhead)
 */
const EVENT_OVERHEAD_BYTES = 26;

/**
 * CloudWatch Logs transport implementation
 *
 * Supports:
 * - Automatic log group creation with retention policy
 * - Log stream management with hostname-based naming
 * - Buffered log shipping with sequence token handling
 * - Automatic retry on connection failures
 * - AWS credentials from default credential chain or explicit configuration
 *
 * @example
 * ```typescript
 * const transport = new CloudWatchTransport({
 *   type: 'cloudwatch',
 *   region: 'us-east-1',
 *   logGroupName: '/app/logs',
 *   logStreamPrefix: 'production',
 *   createLogGroup: true,
 *   retentionInDays: 30,
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
export class CloudWatchTransport extends BaseTransport {
  /**
   * CloudWatch Logs client instance
   */
  private client: CloudWatchLogsClient | null = null;

  /**
   * AWS region
   */
  private readonly region: string;

  /**
   * Log group name
   */
  private readonly logGroupName: string;

  /**
   * Log stream prefix
   */
  private readonly logStreamPrefix: string;

  /**
   * AWS credentials configuration
   */
  private readonly credentials:
    | {
        readonly accessKeyId?: string;
        readonly secretAccessKey?: string;
        readonly sessionToken?: string;
      }
    | undefined;

  /**
   * Create log group if it doesn't exist
   */
  private readonly createLogGroup: boolean;

  /**
   * Log retention in days
   */
  private readonly retentionInDays: number;

  /**
   * Current log stream name
   */
  private logStreamName: string | null = null;

  /**
   * Sequence token for log events
   */
  private sequenceToken: string | undefined = undefined;

  /**
   * Create a new CloudWatchTransport instance
   *
   * @param config - CloudWatch transport configuration
   */
  constructor(config: CloudWatchTransportConfig) {
    super('cloudwatch', config);

    this.region = config.region;
    this.logGroupName = config.logGroupName;
    this.logStreamPrefix = config.logStreamPrefix ?? DEFAULT_LOG_STREAM_PREFIX;
    this.credentials = config.credentials;
    this.createLogGroup = config.createLogGroup ?? true;
    this.retentionInDays = config.retentionInDays ?? DEFAULT_RETENTION_DAYS;
  }

  /**
   * Initialize the CloudWatch transport
   *
   * Creates the CloudWatch Logs client, verifies/creates log group,
   * and creates a new log stream for this session.
   */
  protected async doInitialize(): Promise<void> {
    // Build client configuration
    const clientConfig: {
      region: string;
      credentials?: {
        accessKeyId: string;
        secretAccessKey: string;
        sessionToken?: string;
      };
    } = {
      region: this.region,
    };

    // Configure explicit credentials if provided
    if (this.credentials !== undefined) {
      const creds = this.credentials;
      if (creds.accessKeyId !== undefined && creds.secretAccessKey !== undefined) {
        clientConfig.credentials = {
          accessKeyId: creds.accessKeyId,
          secretAccessKey: creds.secretAccessKey,
          ...(creds.sessionToken !== undefined && { sessionToken: creds.sessionToken }),
        };
      }
    }

    this.client = new CloudWatchLogsClient(clientConfig);

    // Ensure log group exists
    await this.ensureLogGroup();

    // Create log stream for this session
    await this.createLogStream();
  }

  /**
   * Log entries to CloudWatch Logs
   *
   * Batches log events and ships them with sequence token handling.
   *
   * @param entries - Log entries to ship
   */
  protected async doLog(entries: TransportLogEntry[]): Promise<void> {
    if (this.client === null) {
      throw new Error('CloudWatch Logs client not initialized');
    }

    if (entries.length === 0) {
      return;
    }

    if (this.logStreamName === null) {
      throw new Error('Log stream not created');
    }

    // Convert entries to CloudWatch log events
    const logEvents = entries.map((entry) => this.formatEntry(entry));

    // Split into batches respecting AWS limits
    const batches = this.splitIntoBatches(logEvents);

    // Ship each batch
    for (const batch of batches) {
      await this.shipBatch(batch);
    }
  }

  /**
   * Flush CloudWatch operations
   *
   * CloudWatch Logs doesn't require explicit flush as PutLogEvents is synchronous.
   */
  protected async doFlush(): Promise<void> {
    // CloudWatch Logs PutLogEvents is synchronous, no additional flush needed
  }

  /**
   * Close the CloudWatch transport
   *
   * Destroys the CloudWatch Logs client.
   *
   * @returns Resolved promise after client cleanup is complete
   */
  protected doClose(): Promise<void> {
    if (this.client !== null) {
      this.client.destroy();
      this.client = null;
    }
    this.logStreamName = null;
    this.sequenceToken = undefined;
    return Promise.resolve();
  }

  /**
   * Ensure log group exists
   *
   * Creates the log group if it doesn't exist and sets retention policy.
   */
  private async ensureLogGroup(): Promise<void> {
    if (this.client === null) {
      return;
    }

    try {
      // Check if log group exists
      const describeResponse = await this.client.send(
        new DescribeLogGroupsCommand({
          logGroupNamePrefix: this.logGroupName,
          limit: 1,
        })
      );

      const exists =
        describeResponse.logGroups?.some((group) => group.logGroupName === this.logGroupName) ??
        false;

      if (!exists && this.createLogGroup) {
        // Create log group
        await this.client.send(
          new CreateLogGroupCommand({
            logGroupName: this.logGroupName,
          })
        );

        // Set retention policy
        await this.client.send(
          new PutRetentionPolicyCommand({
            logGroupName: this.logGroupName,
            retentionInDays: this.retentionInDays,
          })
        );
      }
    } catch (error) {
      // ResourceAlreadyExistsException is OK, log group was created concurrently
      if (this.isResourceAlreadyExistsError(error)) {
        return;
      }
      this.handleError('Failed to ensure log group', error);
      throw error;
    }
  }

  /**
   * Create a new log stream for this session
   *
   * Generates a unique stream name based on prefix, hostname, and timestamp.
   */
  private async createLogStream(): Promise<void> {
    if (this.client === null) {
      return;
    }

    // Generate unique log stream name
    const hostName = hostname();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logStreamName = `${this.logStreamPrefix}/${hostName}/${timestamp}`;

    try {
      await this.client.send(
        new CreateLogStreamCommand({
          logGroupName: this.logGroupName,
          logStreamName: this.logStreamName,
        })
      );

      // New stream doesn't have a sequence token
      this.sequenceToken = undefined;
    } catch (error) {
      // ResourceAlreadyExistsException means stream exists, get its sequence token
      if (this.isResourceAlreadyExistsError(error)) {
        await this.refreshSequenceToken();
        return;
      }
      this.handleError('Failed to create log stream', error);
      throw error;
    }
  }

  /**
   * Refresh the sequence token for the current log stream
   */
  private async refreshSequenceToken(): Promise<void> {
    if (this.client === null || this.logStreamName === null) {
      return;
    }

    try {
      const response = await this.client.send(
        new DescribeLogStreamsCommand({
          logGroupName: this.logGroupName,
          logStreamNamePrefix: this.logStreamName,
          limit: 1,
        })
      );

      const stream = response.logStreams?.find((s) => s.logStreamName === this.logStreamName);
      if (stream !== undefined) {
        this.sequenceToken = stream.uploadSequenceToken;
      }
    } catch (error) {
      this.handleError('Failed to refresh sequence token', error);
    }
  }

  /**
   * Ship a batch of log events to CloudWatch Logs
   *
   * @param batch - Log events to ship
   */
  private async shipBatch(batch: InputLogEvent[]): Promise<void> {
    if (this.client === null || this.logStreamName === null) {
      throw new Error('CloudWatch transport not initialized');
    }

    try {
      const response = await this.client.send(
        new PutLogEventsCommand({
          logGroupName: this.logGroupName,
          logStreamName: this.logStreamName,
          logEvents: batch,
          sequenceToken: this.sequenceToken,
        })
      );

      // Update sequence token for next batch
      this.sequenceToken = response.nextSequenceToken;
    } catch (error) {
      // Handle InvalidSequenceTokenException by refreshing and retrying
      if (this.isInvalidSequenceTokenError(error)) {
        await this.refreshSequenceToken();
        // Retry with updated token
        const response = await this.client.send(
          new PutLogEventsCommand({
            logGroupName: this.logGroupName,
            logStreamName: this.logStreamName,
            logEvents: batch,
            sequenceToken: this.sequenceToken,
          })
        );
        this.sequenceToken = response.nextSequenceToken;
        return;
      }

      // Handle DataAlreadyAcceptedException (duplicate batch)
      if (this.isDataAlreadyAcceptedError(error)) {
        // Extract new sequence token from error
        this.sequenceToken = this.extractSequenceTokenFromError(error);
        return;
      }

      throw error;
    }
  }

  /**
   * Split log events into batches respecting AWS limits
   *
   * @param events - Log events to split
   * @returns Array of batches
   */
  private splitIntoBatches(events: InputLogEvent[]): InputLogEvent[][] {
    const batches: InputLogEvent[][] = [];
    let currentBatch: InputLogEvent[] = [];
    let currentBatchBytes = 0;

    for (const event of events) {
      const eventBytes = this.calculateEventBytes(event);

      // Check if adding this event would exceed limits
      if (
        currentBatch.length >= MAX_BATCH_SIZE ||
        currentBatchBytes + eventBytes > MAX_BATCH_BYTES
      ) {
        if (currentBatch.length > 0) {
          batches.push(currentBatch);
        }
        currentBatch = [];
        currentBatchBytes = 0;
      }

      currentBatch.push(event);
      currentBatchBytes += eventBytes;
    }

    // Add remaining events
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  /**
   * Calculate the size of a log event in bytes
   *
   * @param event - Log event
   * @returns Size in bytes
   */
  private calculateEventBytes(event: InputLogEvent): number {
    const messageBytes = event.message !== undefined ? Buffer.byteLength(event.message, 'utf8') : 0;
    return messageBytes + EVENT_OVERHEAD_BYTES;
  }

  /**
   * Format a log entry for CloudWatch Logs
   *
   * @param entry - Log entry to format
   * @returns CloudWatch log event
   */
  private formatEntry(entry: TransportLogEntry): InputLogEvent {
    const logData: Record<string, unknown> = {
      level: entry.level,
      message: entry.message,
    };

    // Add optional fields
    if (entry.correlationId !== undefined) {
      logData['correlationId'] = entry.correlationId;
    }
    if (entry.agentId !== undefined) {
      logData['agentId'] = entry.agentId;
    }
    if (entry.traceId !== undefined) {
      logData['traceId'] = entry.traceId;
    }
    if (entry.spanId !== undefined) {
      logData['spanId'] = entry.spanId;
    }
    if (entry.parentSpanId !== undefined) {
      logData['parentSpanId'] = entry.parentSpanId;
    }
    if (entry.stage !== undefined) {
      logData['stage'] = entry.stage;
    }
    if (entry.projectId !== undefined) {
      logData['projectId'] = entry.projectId;
    }
    if (entry.sessionId !== undefined) {
      logData['sessionId'] = entry.sessionId;
    }
    if (entry.durationMs !== undefined) {
      logData['durationMs'] = entry.durationMs;
    }
    if (entry.error !== undefined) {
      logData['error'] = entry.error;
    }
    if (entry.source !== undefined) {
      logData['source'] = entry.source;
    }
    if (entry.hostname !== undefined) {
      logData['hostname'] = entry.hostname;
    }
    if (entry.pid !== undefined) {
      logData['pid'] = entry.pid;
    }
    if (Object.keys(entry.context).length > 0) {
      logData['context'] = entry.context;
    }

    return {
      timestamp: entry.timestamp.getTime(),
      message: JSON.stringify(logData),
    };
  }

  /**
   * Check if error is ResourceAlreadyExistsException
   *
   * @param error - The caught error to inspect
   * @returns True if the error indicates the resource already exists
   */
  private isResourceAlreadyExistsError(error: unknown): boolean {
    return (
      error !== null &&
      typeof error === 'object' &&
      'name' in error &&
      error.name === 'ResourceAlreadyExistsException'
    );
  }

  /**
   * Check if error is InvalidSequenceTokenException
   *
   * @param error - The caught error to inspect
   * @returns True if the error indicates a stale sequence token
   */
  private isInvalidSequenceTokenError(error: unknown): boolean {
    return (
      error !== null &&
      typeof error === 'object' &&
      'name' in error &&
      error.name === 'InvalidSequenceTokenException'
    );
  }

  /**
   * Check if error is DataAlreadyAcceptedException
   *
   * @param error - The caught error to inspect
   * @returns True if the error indicates a duplicate batch submission
   */
  private isDataAlreadyAcceptedError(error: unknown): boolean {
    return (
      error !== null &&
      typeof error === 'object' &&
      'name' in error &&
      error.name === 'DataAlreadyAcceptedException'
    );
  }

  /**
   * Extract sequence token from error message
   *
   * @param error - The caught error containing the expected sequence token
   * @returns The expected sequence token, or undefined if not extractable
   */
  private extractSequenceTokenFromError(error: unknown): string | undefined {
    if (
      error !== null &&
      typeof error === 'object' &&
      'expectedSequenceToken' in error &&
      typeof error.expectedSequenceToken === 'string'
    ) {
      return error.expectedSequenceToken;
    }
    return undefined;
  }

  /**
   * Get the CloudWatch Logs client for testing or advanced usage
   *
   * @returns The CloudWatch Logs client instance or null if not initialized
   */
  public getClient(): CloudWatchLogsClient | null {
    return this.client;
  }

  /**
   * Get the current log group name
   *
   * @returns Log group name
   */
  public getLogGroupName(): string {
    return this.logGroupName;
  }

  /**
   * Get the current log stream name
   *
   * @returns Current log stream name or null if not initialized
   */
  public getLogStreamName(): string | null {
    return this.logStreamName;
  }
}
