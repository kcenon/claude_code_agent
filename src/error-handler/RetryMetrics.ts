/**
 * Retry Metrics Module
 *
 * Collects and provides metrics about retry operations including:
 * - Total attempts and success/failure rates
 * - Average delays and total retry time
 * - Backoff strategy effectiveness
 *
 * @module error-handler/RetryMetrics
 */

/**
 * Single retry operation record
 */
export interface RetryOperationRecord {
  /** Operation name/identifier */
  readonly operationName: string;
  /** Whether the operation ultimately succeeded */
  readonly success: boolean;
  /** Number of attempts made */
  readonly attempts: number;
  /** Total duration in milliseconds */
  readonly totalDurationMs: number;
  /** Backoff strategy used */
  readonly backoffStrategy: string;
  /** Timestamp when operation started */
  readonly startedAt: number;
  /** Timestamp when operation completed */
  readonly completedAt: number;
  /** Delays between each retry attempt in ms */
  readonly delays: readonly number[];
  /** Final error message if failed */
  readonly errorMessage?: string;
}

/**
 * Aggregated retry metrics
 */
export interface RetryMetricsSnapshot {
  /** Total number of operations tracked */
  readonly totalOperations: number;
  /** Number of successful operations */
  readonly successfulOperations: number;
  /** Number of failed operations */
  readonly failedOperations: number;
  /** Success rate (0-1) */
  readonly successRate: number;
  /** Total number of retry attempts across all operations */
  readonly totalAttempts: number;
  /** Average attempts per operation */
  readonly averageAttempts: number;
  /** Total time spent on retries in milliseconds */
  readonly totalRetryTimeMs: number;
  /** Average delay between retries in milliseconds */
  readonly averageDelayMs: number;
  /** Metrics grouped by operation name */
  readonly byOperation: Readonly<Record<string, OperationMetrics>>;
  /** Metrics grouped by backoff strategy */
  readonly byStrategy: Readonly<Record<string, StrategyMetrics>>;
  /** Timestamp of this snapshot */
  readonly timestamp: number;
}

/**
 * Per-operation metrics
 */
export interface OperationMetrics {
  /** Operation name */
  readonly name: string;
  /** Total executions */
  readonly totalExecutions: number;
  /** Successful executions */
  readonly successCount: number;
  /** Failed executions */
  readonly failureCount: number;
  /** Success rate (0-1) */
  readonly successRate: number;
  /** Total attempts */
  readonly totalAttempts: number;
  /** Average attempts per execution */
  readonly averageAttempts: number;
}

/**
 * Per-strategy metrics
 */
export interface StrategyMetrics {
  /** Strategy name */
  readonly strategy: string;
  /** Number of operations using this strategy */
  readonly operationCount: number;
  /** Success rate (0-1) */
  readonly successRate: number;
  /** Average delay in milliseconds */
  readonly averageDelayMs: number;
  /** Total retries */
  readonly totalRetries: number;
}

/**
 * RetryMetrics collector
 *
 * Collects and aggregates metrics from retry operations.
 * Thread-safe for concurrent access.
 */
export class RetryMetrics {
  private readonly records: RetryOperationRecord[] = [];
  private readonly maxRecords: number;

  constructor(maxRecords: number = 10000) {
    this.maxRecords = maxRecords;
  }

  /**
   * Record a completed retry operation
   *
   * @param record - Operation record to add
   */
  public record(record: RetryOperationRecord): void {
    this.records.push(record);

    // Trim old records if exceeding max
    if (this.records.length > this.maxRecords) {
      const excess = this.records.length - this.maxRecords;
      this.records.splice(0, excess);
    }
  }

  /**
   * Create a record builder for easier record creation
   *
   * @param operationName - Name of the operation
   * @param backoffStrategy - Backoff strategy used
   * @returns RecordBuilder instance
   */
  public createRecordBuilder(operationName: string, backoffStrategy: string): RecordBuilder {
    return new RecordBuilder(operationName, backoffStrategy, this);
  }

  /**
   * Get current metrics snapshot
   *
   * @returns Aggregated metrics snapshot
   */
  public getSnapshot(): RetryMetricsSnapshot {
    const totalOperations = this.records.length;

    if (totalOperations === 0) {
      return this.createEmptySnapshot();
    }

    const successfulOperations = this.records.filter((r) => r.success).length;
    const failedOperations = totalOperations - successfulOperations;
    const totalAttempts = this.records.reduce((sum, r) => sum + r.attempts, 0);
    const totalRetryTimeMs = this.records.reduce((sum, r) => sum + r.totalDurationMs, 0);
    const allDelays = this.records.flatMap((r) => r.delays);
    const averageDelayMs = allDelays.length > 0 ? allDelays.reduce((a, b) => a + b, 0) / allDelays.length : 0;

    return {
      totalOperations,
      successfulOperations,
      failedOperations,
      successRate: totalOperations > 0 ? successfulOperations / totalOperations : 0,
      totalAttempts,
      averageAttempts: totalOperations > 0 ? totalAttempts / totalOperations : 0,
      totalRetryTimeMs,
      averageDelayMs,
      byOperation: this.calculateOperationMetrics(),
      byStrategy: this.calculateStrategyMetrics(),
      timestamp: Date.now(),
    };
  }

  /**
   * Get metrics for a specific operation
   *
   * @param operationName - Operation name to get metrics for
   * @returns Operation metrics or undefined if no records
   */
  public getOperationMetrics(operationName: string): OperationMetrics | undefined {
    const metrics = this.calculateOperationMetrics();
    return metrics[operationName];
  }

  /**
   * Get metrics for a specific strategy
   *
   * @param strategyName - Strategy name to get metrics for
   * @returns Strategy metrics or undefined if no records
   */
  public getStrategyMetrics(strategyName: string): StrategyMetrics | undefined {
    const metrics = this.calculateStrategyMetrics();
    return metrics[strategyName];
  }

  /**
   * Get recent records
   *
   * @param limit - Maximum number of records to return
   * @returns Array of recent records (newest first)
   */
  public getRecentRecords(limit: number = 100): readonly RetryOperationRecord[] {
    const start = Math.max(0, this.records.length - limit);
    return this.records.slice(start).reverse();
  }

  /**
   * Clear all recorded metrics
   */
  public clear(): void {
    this.records.length = 0;
  }

  /**
   * Get total number of records
   */
  public get recordCount(): number {
    return this.records.length;
  }

  private createEmptySnapshot(): RetryMetricsSnapshot {
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      successRate: 0,
      totalAttempts: 0,
      averageAttempts: 0,
      totalRetryTimeMs: 0,
      averageDelayMs: 0,
      byOperation: {},
      byStrategy: {},
      timestamp: Date.now(),
    };
  }

  private calculateOperationMetrics(): Record<string, OperationMetrics> {
    const byOperation: Record<string, RetryOperationRecord[]> = {};

    for (const record of this.records) {
      const existing = byOperation[record.operationName];
      if (existing === undefined) {
        byOperation[record.operationName] = [record];
      } else {
        existing.push(record);
      }
    }

    const result: Record<string, OperationMetrics> = {};

    for (const [name, records] of Object.entries(byOperation)) {
      const totalExecutions = records.length;
      const successCount = records.filter((r) => r.success).length;
      const totalAttempts = records.reduce((sum, r) => sum + r.attempts, 0);

      result[name] = {
        name,
        totalExecutions,
        successCount,
        failureCount: totalExecutions - successCount,
        successRate: totalExecutions > 0 ? successCount / totalExecutions : 0,
        totalAttempts,
        averageAttempts: totalExecutions > 0 ? totalAttempts / totalExecutions : 0,
      };
    }

    return result;
  }

  private calculateStrategyMetrics(): Record<string, StrategyMetrics> {
    const byStrategy: Record<string, RetryOperationRecord[]> = {};

    for (const record of this.records) {
      const existing = byStrategy[record.backoffStrategy];
      if (existing === undefined) {
        byStrategy[record.backoffStrategy] = [record];
      } else {
        existing.push(record);
      }
    }

    const result: Record<string, StrategyMetrics> = {};

    for (const [strategy, records] of Object.entries(byStrategy)) {
      const operationCount = records.length;
      const successCount = records.filter((r) => r.success).length;
      const allDelays = records.flatMap((r) => r.delays);
      const totalRetries = records.reduce((sum, r) => sum + Math.max(0, r.attempts - 1), 0);

      result[strategy] = {
        strategy,
        operationCount,
        successRate: operationCount > 0 ? successCount / operationCount : 0,
        averageDelayMs: allDelays.length > 0 ? allDelays.reduce((a, b) => a + b, 0) / allDelays.length : 0,
        totalRetries,
      };
    }

    return result;
  }
}

/**
 * Builder for creating retry operation records
 */
export class RecordBuilder {
  private readonly operationName: string;
  private readonly backoffStrategy: string;
  private readonly metrics: RetryMetrics;
  private readonly startedAt: number;
  private readonly delays: number[] = [];
  private attempts: number = 0;

  constructor(operationName: string, backoffStrategy: string, metrics: RetryMetrics) {
    this.operationName = operationName;
    this.backoffStrategy = backoffStrategy;
    this.metrics = metrics;
    this.startedAt = Date.now();
  }

  /**
   * Record an attempt
   *
   * @param delayMs - Delay before this attempt (0 for first attempt)
   * @returns this for chaining
   */
  public recordAttempt(delayMs: number = 0): this {
    this.attempts++;
    if (delayMs > 0) {
      this.delays.push(delayMs);
    }
    return this;
  }

  /**
   * Complete the record as successful
   */
  public success(): void {
    const record: RetryOperationRecord = {
      operationName: this.operationName,
      success: true,
      attempts: this.attempts,
      totalDurationMs: Date.now() - this.startedAt,
      backoffStrategy: this.backoffStrategy,
      startedAt: this.startedAt,
      completedAt: Date.now(),
      delays: this.delays,
    };
    this.metrics.record(record);
  }

  /**
   * Complete the record as failed
   *
   * @param errorMessage - Error message for the failure
   */
  public failure(errorMessage: string): void {
    const record: RetryOperationRecord = {
      operationName: this.operationName,
      success: false,
      attempts: this.attempts,
      totalDurationMs: Date.now() - this.startedAt,
      backoffStrategy: this.backoffStrategy,
      startedAt: this.startedAt,
      completedAt: Date.now(),
      delays: this.delays,
      errorMessage,
    };
    this.metrics.record(record);
  }
}

/**
 * Global metrics instance for shared access
 */
let globalMetrics: RetryMetrics | undefined;

/**
 * Get or create the global metrics instance
 *
 * @returns Global RetryMetrics instance
 */
export function getGlobalRetryMetrics(): RetryMetrics {
  if (globalMetrics === undefined) {
    globalMetrics = new RetryMetrics();
  }
  return globalMetrics;
}

/**
 * Reset the global metrics instance (primarily for testing)
 */
export function resetGlobalRetryMetrics(): void {
  globalMetrics = undefined;
}
