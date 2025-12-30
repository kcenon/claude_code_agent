/**
 * ParallelExecutionTuner - Optimizes parallel execution parameters
 *
 * Features:
 * - Optimal worker count determination based on system resources
 * - Batch size optimization
 * - Resource contention detection and mitigation
 * - Dynamic scaling recommendations
 * - Performance benchmarking for tuning
 */

import * as os from 'node:os';

/**
 * System resource information
 */
export interface SystemResources {
  /** Number of CPU cores */
  readonly cpuCores: number;
  /** Total memory in bytes */
  readonly totalMemoryBytes: number;
  /** Free memory in bytes */
  readonly freeMemoryBytes: number;
  /** Memory usage percentage */
  readonly memoryUsagePercent: number;
  /** System load average (1, 5, 15 minutes) */
  readonly loadAverage: readonly [number, number, number];
}

/**
 * Worker pool sizing recommendation
 */
export interface WorkerPoolRecommendation {
  /** Recommended number of workers */
  readonly recommendedWorkers: number;
  /** Minimum viable workers */
  readonly minWorkers: number;
  /** Maximum safe workers */
  readonly maxWorkers: number;
  /** Reasoning for the recommendation */
  readonly reasoning: string;
  /** Confidence level (0-100) */
  readonly confidence: number;
}

/**
 * Batch configuration
 */
export interface BatchConfig {
  /** Number of items per batch */
  readonly batchSize: number;
  /** Maximum concurrent batches */
  readonly maxConcurrentBatches: number;
  /** Delay between batches in milliseconds */
  readonly batchDelayMs: number;
}

/**
 * Resource contention event
 */
export interface ContentionEvent {
  /** Type of contention */
  readonly type: 'memory' | 'cpu' | 'io' | 'api_rate_limit';
  /** Severity (0-100) */
  readonly severity: number;
  /** Timestamp of detection */
  readonly timestamp: string;
  /** Affected resource */
  readonly resource: string;
  /** Recommended action */
  readonly recommendedAction: string;
}

/**
 * Tuning history entry
 */
export interface TuningHistoryEntry {
  /** Timestamp */
  readonly timestamp: string;
  /** Worker count used */
  readonly workerCount: number;
  /** Batch size used */
  readonly batchSize: number;
  /** Throughput achieved (items/second) */
  readonly throughput: number;
  /** Average latency in milliseconds */
  readonly avgLatencyMs: number;
  /** Error rate (0-1) */
  readonly errorRate: number;
  /** Resource utilization */
  readonly resourceUtilization: {
    readonly cpu: number;
    readonly memory: number;
  };
}

/**
 * Parallel execution tuner configuration
 */
export interface ParallelExecutionTunerConfig {
  /** Base worker count (default: CPU cores - 1, min 1) */
  readonly baseWorkerCount?: number;
  /** Maximum worker count (default: CPU cores * 2) */
  readonly maxWorkerCount?: number;
  /** Memory per worker in bytes (default: 512MB) */
  readonly memoryPerWorkerBytes?: number;
  /** Target CPU utilization (default: 0.7 = 70%) */
  readonly targetCpuUtilization?: number;
  /** Target memory utilization (default: 0.8 = 80%) */
  readonly targetMemoryUtilization?: number;
  /** Enable auto-scaling (default: true) */
  readonly enableAutoScaling?: boolean;
  /** Contention detection threshold (default: 0.9 = 90%) */
  readonly contentionThreshold?: number;
  /** History size for tuning decisions (default: 100) */
  readonly historySize?: number;
  /** Polling interval for resource monitoring (default: 5000ms) */
  readonly pollingIntervalMs?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<ParallelExecutionTunerConfig> = {
  baseWorkerCount: Math.max(1, os.cpus().length - 1),
  maxWorkerCount: os.cpus().length * 2,
  memoryPerWorkerBytes: 512 * 1024 * 1024, // 512MB
  targetCpuUtilization: 0.7,
  targetMemoryUtilization: 0.8,
  enableAutoScaling: true,
  contentionThreshold: 0.9,
  historySize: 100,
  pollingIntervalMs: 5000,
};

/**
 * Parallel execution tuner for optimizing worker pools
 */
export class ParallelExecutionTuner {
  private readonly config: Required<ParallelExecutionTunerConfig>;
  private readonly tuningHistory: TuningHistoryEntry[] = [];
  private readonly contentionEvents: ContentionEvent[] = [];
  private currentWorkerCount: number;
  private currentBatchSize: number;
  private monitoringTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: ParallelExecutionTunerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.currentWorkerCount = this.config.baseWorkerCount;
    this.currentBatchSize = 3;
  }

  /**
   * Get current system resources
   */
  public getSystemResources(): SystemResources {
    const cpuCores = os.cpus().length;
    const totalMemoryBytes = os.totalmem();
    const freeMemoryBytes = os.freemem();
    const memoryUsagePercent =
      Math.round(((totalMemoryBytes - freeMemoryBytes) / totalMemoryBytes) * 10000) / 100;
    const loadAverage = os.loadavg() as [number, number, number];

    return {
      cpuCores,
      totalMemoryBytes,
      freeMemoryBytes,
      memoryUsagePercent,
      loadAverage,
    };
  }

  /**
   * Calculate optimal worker count based on current resources
   */
  public calculateOptimalWorkerCount(): WorkerPoolRecommendation {
    const resources = this.getSystemResources();

    // Calculate based on CPU
    const cpuBasedWorkers = Math.max(
      1,
      Math.floor(resources.cpuCores * this.config.targetCpuUtilization)
    );

    // Calculate based on memory
    const availableMemory = resources.freeMemoryBytes * this.config.targetMemoryUtilization;
    const memoryBasedWorkers = Math.max(
      1,
      Math.floor(availableMemory / this.config.memoryPerWorkerBytes)
    );

    // Calculate based on load
    const currentLoad = resources.loadAverage[0];
    const loadFactor = currentLoad / resources.cpuCores;
    const loadAdjustment = loadFactor > 0.8 ? 0.5 : loadFactor > 0.5 ? 0.75 : 1.0;

    // Take the minimum of all constraints
    const baseRecommendation = Math.min(cpuBasedWorkers, memoryBasedWorkers);
    const loadAdjustedRecommendation = Math.max(1, Math.floor(baseRecommendation * loadAdjustment));

    // Apply bounds
    const recommendedWorkers = Math.min(
      Math.max(1, loadAdjustedRecommendation),
      this.config.maxWorkerCount
    );

    // Calculate confidence based on resource availability
    const memoryHeadroom = resources.freeMemoryBytes / resources.totalMemoryBytes;
    const cpuHeadroom = 1 - loadFactor;
    const confidence = Math.round(Math.min(memoryHeadroom, cpuHeadroom) * 100);

    const reasoning = this.buildReasoningString(
      resources,
      cpuBasedWorkers,
      memoryBasedWorkers,
      loadAdjustment
    );

    return {
      recommendedWorkers,
      minWorkers: 1,
      maxWorkers: this.config.maxWorkerCount,
      reasoning,
      confidence,
    };
  }

  /**
   * Build reasoning string for recommendation
   */
  private buildReasoningString(
    resources: SystemResources,
    cpuBased: number,
    memoryBased: number,
    loadAdjustment: number
  ): string {
    const parts: string[] = [];

    parts.push(`CPU cores: ${String(resources.cpuCores)} (suggests ${String(cpuBased)} workers)`);
    parts.push(
      `Free memory: ${String(Math.round(resources.freeMemoryBytes / 1024 / 1024))}MB (suggests ${String(memoryBased)} workers)`
    );
    parts.push(
      `Current load: ${resources.loadAverage[0].toFixed(2)} (adjustment factor: ${String(loadAdjustment)})`
    );

    if (memoryBased < cpuBased) {
      parts.push('Memory is the limiting factor');
    } else if (loadAdjustment < 1) {
      parts.push('High system load reducing recommendation');
    }

    return parts.join('; ');
  }

  /**
   * Calculate optimal batch configuration
   */
  public calculateBatchConfig(itemCount: number): BatchConfig {
    const recommendation = this.calculateOptimalWorkerCount();

    // Batch size should balance parallelism with overhead
    const optimalBatchSize = Math.max(
      1,
      Math.min(5, Math.ceil(itemCount / recommendation.recommendedWorkers / 2))
    );

    // Concurrent batches based on worker availability
    const maxConcurrentBatches = Math.min(
      recommendation.recommendedWorkers,
      Math.ceil(itemCount / optimalBatchSize)
    );

    // Small delay to prevent API rate limiting
    const batchDelayMs = 500;

    return {
      batchSize: optimalBatchSize,
      maxConcurrentBatches,
      batchDelayMs,
    };
  }

  /**
   * Detect resource contention
   */
  public detectContention(): ContentionEvent | null {
    const resources = this.getSystemResources();

    // Check memory contention
    const memoryUsage = 1 - resources.freeMemoryBytes / resources.totalMemoryBytes;
    if (memoryUsage > this.config.contentionThreshold) {
      const event: ContentionEvent = {
        type: 'memory',
        severity: Math.round(
          ((memoryUsage - this.config.contentionThreshold) * 100) /
            (1 - this.config.contentionThreshold)
        ),
        timestamp: new Date().toISOString(),
        resource: 'system_memory',
        recommendedAction: 'Reduce worker count or batch size',
      };
      this.contentionEvents.push(event);
      return event;
    }

    // Check CPU contention
    const cpuLoad = resources.loadAverage[0] / resources.cpuCores;
    if (cpuLoad > this.config.contentionThreshold) {
      const event: ContentionEvent = {
        type: 'cpu',
        severity: Math.round(
          ((cpuLoad - this.config.contentionThreshold) * 100) /
            (1 - this.config.contentionThreshold)
        ),
        timestamp: new Date().toISOString(),
        resource: 'cpu',
        recommendedAction: 'Reduce parallelism or add delays between operations',
      };
      this.contentionEvents.push(event);
      return event;
    }

    return null;
  }

  /**
   * Record a tuning history entry
   */
  public recordTuningResult(
    workerCount: number,
    batchSize: number,
    itemsProcessed: number,
    totalTimeMs: number,
    errorCount: number
  ): void {
    const resources = this.getSystemResources();

    const entry: TuningHistoryEntry = {
      timestamp: new Date().toISOString(),
      workerCount,
      batchSize,
      throughput: totalTimeMs > 0 ? (itemsProcessed / totalTimeMs) * 1000 : 0,
      avgLatencyMs: itemsProcessed > 0 ? totalTimeMs / itemsProcessed : 0,
      errorRate: itemsProcessed > 0 ? errorCount / itemsProcessed : 0,
      resourceUtilization: {
        cpu: resources.loadAverage[0] / resources.cpuCores,
        memory: resources.memoryUsagePercent / 100,
      },
    };

    this.tuningHistory.push(entry);

    // Trim history
    if (this.tuningHistory.length > this.config.historySize) {
      this.tuningHistory.shift();
    }
  }

  /**
   * Get tuning recommendations based on history
   */
  public getTuningRecommendations(): {
    readonly workerCount: number;
    readonly batchSize: number;
    readonly reasoning: string;
  } {
    if (this.tuningHistory.length < 3) {
      const baseRec = this.calculateOptimalWorkerCount();
      return {
        workerCount: baseRec.recommendedWorkers,
        batchSize: 3,
        reasoning: 'Using system resource-based defaults (insufficient history)',
      };
    }

    // Analyze recent history
    const recentHistory = this.tuningHistory.slice(-10);
    const byConfig = new Map<string, TuningHistoryEntry[]>();

    for (const entry of recentHistory) {
      const key = `${String(entry.workerCount)}-${String(entry.batchSize)}`;
      const entries = byConfig.get(key) ?? [];
      entries.push(entry);
      byConfig.set(key, entries);
    }

    // Find best performing configuration
    let bestConfig = { workers: this.currentWorkerCount, batch: this.currentBatchSize };
    let bestThroughput = 0;

    for (const [key, entries] of byConfig) {
      const avgThroughput = entries.reduce((sum, e) => sum + e.throughput, 0) / entries.length;
      const avgErrorRate = entries.reduce((sum, e) => sum + e.errorRate, 0) / entries.length;

      // Penalize high error rates
      const effectiveThroughput = avgThroughput * (1 - avgErrorRate);

      if (effectiveThroughput > bestThroughput) {
        bestThroughput = effectiveThroughput;
        const [workers, batch] = key.split('-').map(Number);
        bestConfig = {
          workers: workers ?? this.currentWorkerCount,
          batch: batch ?? this.currentBatchSize,
        };
      }
    }

    return {
      workerCount: bestConfig.workers,
      batchSize: bestConfig.batch,
      reasoning: `Based on ${String(recentHistory.length)} recent runs, config ${String(bestConfig.workers)}w/${String(bestConfig.batch)}b achieved best effective throughput`,
    };
  }

  /**
   * Apply auto-scaling based on current conditions
   */
  public autoScale(): {
    readonly previousWorkers: number;
    readonly newWorkers: number;
    readonly action: 'scale_up' | 'scale_down' | 'no_change';
    readonly reason: string;
  } {
    if (!this.config.enableAutoScaling) {
      return {
        previousWorkers: this.currentWorkerCount,
        newWorkers: this.currentWorkerCount,
        action: 'no_change',
        reason: 'Auto-scaling is disabled',
      };
    }

    const previousWorkers = this.currentWorkerCount;
    const contention = this.detectContention();
    const recommendation = this.calculateOptimalWorkerCount();

    if (contention !== null && contention.severity > 50) {
      // Scale down due to contention
      this.currentWorkerCount = Math.max(1, this.currentWorkerCount - 1);
      return {
        previousWorkers,
        newWorkers: this.currentWorkerCount,
        action: 'scale_down',
        reason: `${contention.type} contention detected (severity: ${String(contention.severity)})`,
      };
    }

    if (
      recommendation.recommendedWorkers > this.currentWorkerCount &&
      recommendation.confidence > 70
    ) {
      // Scale up if resources are available
      this.currentWorkerCount = Math.min(
        this.currentWorkerCount + 1,
        recommendation.recommendedWorkers
      );
      return {
        previousWorkers,
        newWorkers: this.currentWorkerCount,
        action: 'scale_up',
        reason: `Resources available (confidence: ${String(recommendation.confidence)}%)`,
      };
    }

    if (recommendation.recommendedWorkers < this.currentWorkerCount) {
      // Scale down if over-provisioned
      this.currentWorkerCount = recommendation.recommendedWorkers;
      return {
        previousWorkers,
        newWorkers: this.currentWorkerCount,
        action: 'scale_down',
        reason: 'Over-provisioned based on current resource availability',
      };
    }

    return {
      previousWorkers,
      newWorkers: this.currentWorkerCount,
      action: 'no_change',
      reason: 'Current configuration is optimal',
    };
  }

  /**
   * Get current worker count
   */
  public getCurrentWorkerCount(): number {
    return this.currentWorkerCount;
  }

  /**
   * Set current worker count
   */
  public setCurrentWorkerCount(count: number): void {
    this.currentWorkerCount = Math.max(1, Math.min(count, this.config.maxWorkerCount));
  }

  /**
   * Get current batch size
   */
  public getCurrentBatchSize(): number {
    return this.currentBatchSize;
  }

  /**
   * Set current batch size
   */
  public setCurrentBatchSize(size: number): void {
    this.currentBatchSize = Math.max(1, size);
  }

  /**
   * Get tuning history
   */
  public getTuningHistory(): readonly TuningHistoryEntry[] {
    return [...this.tuningHistory];
  }

  /**
   * Get contention events
   */
  public getContentionEvents(): readonly ContentionEvent[] {
    return [...this.contentionEvents];
  }

  /**
   * Get recent contention events
   */
  public getRecentContentionEvents(durationMs: number = 60000): readonly ContentionEvent[] {
    const cutoff = Date.now() - durationMs;
    return this.contentionEvents.filter((e) => new Date(e.timestamp).getTime() > cutoff);
  }

  /**
   * Start resource monitoring
   */
  public startMonitoring(callback?: (event: ContentionEvent) => void): void {
    if (this.monitoringTimer !== null) return;

    this.monitoringTimer = setInterval(() => {
      const contention = this.detectContention();
      if (contention !== null && callback !== undefined) {
        callback(contention);
      }
    }, this.config.pollingIntervalMs);
  }

  /**
   * Stop resource monitoring
   */
  public stopMonitoring(): void {
    if (this.monitoringTimer !== null) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = null;
    }
  }

  /**
   * Clear history and events
   */
  public clearHistory(): void {
    this.tuningHistory.length = 0;
    this.contentionEvents.length = 0;
  }

  /**
   * Reset to defaults
   */
  public reset(): void {
    this.stopMonitoring();
    this.clearHistory();
    this.currentWorkerCount = this.config.baseWorkerCount;
    this.currentBatchSize = 3;
  }

  /**
   * Get performance summary
   */
  public getPerformanceSummary(): {
    readonly avgThroughput: number;
    readonly avgLatencyMs: number;
    readonly avgErrorRate: number;
    readonly contentionCount: number;
    readonly recentContentions: number;
  } {
    const history = this.tuningHistory;

    if (history.length === 0) {
      return {
        avgThroughput: 0,
        avgLatencyMs: 0,
        avgErrorRate: 0,
        contentionCount: this.contentionEvents.length,
        recentContentions: this.getRecentContentionEvents().length,
      };
    }

    return {
      avgThroughput: history.reduce((sum, e) => sum + e.throughput, 0) / history.length,
      avgLatencyMs: history.reduce((sum, e) => sum + e.avgLatencyMs, 0) / history.length,
      avgErrorRate: history.reduce((sum, e) => sum + e.errorRate, 0) / history.length,
      contentionCount: this.contentionEvents.length,
      recentContentions: this.getRecentContentionEvents().length,
    };
  }
}

/**
 * Singleton instance for global access
 */
let globalParallelExecutionTuner: ParallelExecutionTuner | null = null;

/**
 * Get or create the global ParallelExecutionTuner instance
 */
export function getParallelExecutionTuner(
  config?: ParallelExecutionTunerConfig
): ParallelExecutionTuner {
  if (globalParallelExecutionTuner === null) {
    globalParallelExecutionTuner = new ParallelExecutionTuner(config);
  }
  return globalParallelExecutionTuner;
}

/**
 * Reset the global ParallelExecutionTuner instance (for testing)
 */
export function resetParallelExecutionTuner(): void {
  if (globalParallelExecutionTuner !== null) {
    globalParallelExecutionTuner.reset();
    globalParallelExecutionTuner = null;
  }
}
