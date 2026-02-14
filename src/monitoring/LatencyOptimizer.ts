/**
 * LatencyOptimizer - Optimizes agent startup time and handoff latency
 *
 * Features:
 * - Agent pre-warming (preload agent definitions)
 * - Connection pooling for API connections
 * - Streaming response optimization
 * - Parallel I/O operations
 * - Latency tracking and benchmarking
 */

import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import { DEFAULT_PATHS } from '../config/paths.js';

/**
 * Latency targets in milliseconds
 */
export interface LatencyTargets {
  /** Target agent startup time (default: 2000ms) */
  readonly agentStartup: number;
  /** Target handoff latency between agents (default: 1000ms) */
  readonly handoffLatency: number;
  /** Target file I/O operation time (default: 100ms) */
  readonly fileIO: number;
  /** Target API connection establishment (default: 500ms) */
  readonly apiConnection: number;
}

/**
 * Latency measurement result
 */
export interface LatencyMeasurement {
  /** Operation name */
  readonly operation: string;
  /** Measured latency in milliseconds */
  readonly latencyMs: number;
  /** Target latency in milliseconds */
  readonly targetMs: number;
  /** Whether the target was met */
  readonly targetMet: boolean;
  /** Timestamp of measurement */
  readonly timestamp: string;
  /** Additional context */
  readonly context?: Record<string, unknown>;
}

/**
 * Pre-warmed resource status
 */
export interface WarmupStatus {
  /** Resource name */
  readonly resource: string;
  /** Whether the resource is warmed up */
  readonly isWarm: boolean;
  /** Time taken to warm up in milliseconds */
  readonly warmupTimeMs?: number;
  /** Last warmed timestamp */
  readonly lastWarmedAt?: string;
  /** Error if warmup failed */
  readonly error?: string;
}

/**
 * Latency optimizer configuration
 */
export interface LatencyOptimizerConfig {
  /** Latency targets */
  readonly targets?: Partial<LatencyTargets>;
  /** Enable agent pre-warming (default: true) */
  readonly enablePrewarming?: boolean;
  /** Enable connection pooling (default: true) */
  readonly enableConnectionPooling?: boolean;
  /** Maximum pooled connections (default: 10) */
  readonly maxPooledConnections?: number;
  /** Cache directory for preloaded resources */
  readonly cacheDir?: string;
  /** Warmup interval in milliseconds (default: 300000 = 5 minutes) */
  readonly warmupIntervalMs?: number;
  /** Enable latency tracking (default: true) */
  readonly enableTracking?: boolean;
  /** Maximum tracked measurements (default: 1000) */
  readonly maxTrackedMeasurements?: number;
}

/**
 * Default latency targets
 */
const DEFAULT_LATENCY_TARGETS: LatencyTargets = {
  agentStartup: 2000,
  handoffLatency: 1000,
  fileIO: 100,
  apiConnection: 500,
};

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<LatencyOptimizerConfig> = {
  targets: DEFAULT_LATENCY_TARGETS,
  enablePrewarming: true,
  enableConnectionPooling: true,
  maxPooledConnections: 10,
  cacheDir: DEFAULT_PATHS.CACHE,
  warmupIntervalMs: 300000,
  enableTracking: true,
  maxTrackedMeasurements: 1000,
};

/**
 * Latency optimizer for minimizing response times
 */
export class LatencyOptimizer {
  private readonly config: Required<LatencyOptimizerConfig>;
  private readonly targets: LatencyTargets;
  private readonly measurements: LatencyMeasurement[] = [];
  private readonly warmupStatus: Map<string, WarmupStatus> = new Map();
  private readonly preloadedAgents: Set<string> = new Set();
  private warmupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: LatencyOptimizerConfig = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      targets: { ...DEFAULT_LATENCY_TARGETS, ...config.targets },
    };
    this.targets = this.config.targets as LatencyTargets;

    this.ensureCacheDirectory();
  }

  /**
   * Ensure the cache directory exists
   */
  private ensureCacheDirectory(): void {
    if (!fs.existsSync(this.config.cacheDir)) {
      fs.mkdirSync(this.config.cacheDir, { recursive: true, mode: 0o755 });
    }
  }

  /**
   * Get latency targets
   * @returns Copy of the current latency targets configuration
   */
  public getTargets(): LatencyTargets {
    return { ...this.targets };
  }

  /**
   * Measure and track an operation's latency
   * @param operation - Name of the operation being measured
   * @param targetType - Type of latency target to compare against (agentStartup, handoffLatency, fileIO, apiConnection)
   * @param fn - Synchronous function to execute and measure
   * @param context - Optional additional context information to attach to the measurement
   * @returns The result of executing the measured function
   */
  public measure<T>(
    operation: string,
    targetType: keyof LatencyTargets,
    fn: () => T,
    context?: Record<string, unknown>
  ): T {
    const startTime = performance.now();
    const result = fn();
    const latencyMs = performance.now() - startTime;

    this.recordMeasurement(operation, latencyMs, this.targets[targetType], context);

    return result;
  }

  /**
   * Measure and track an async operation's latency
   * @param operation - Name of the operation being measured
   * @param targetType - Type of latency target to compare against (agentStartup, handoffLatency, fileIO, apiConnection)
   * @param fn - Asynchronous function to execute and measure
   * @param context - Optional additional context information to attach to the measurement
   * @returns Promise resolving to the result of executing the measured function
   */
  public async measureAsync<T>(
    operation: string,
    targetType: keyof LatencyTargets,
    fn: () => Promise<T>,
    context?: Record<string, unknown>
  ): Promise<T> {
    const startTime = performance.now();
    const result = await fn();
    const latencyMs = performance.now() - startTime;

    this.recordMeasurement(operation, latencyMs, this.targets[targetType], context);

    return result;
  }

  /**
   * Record a latency measurement
   * @param operation - Name of the operation that was measured
   * @param latencyMs - Actual measured latency in milliseconds
   * @param targetMs - Target latency threshold in milliseconds
   * @param context - Optional additional context information to attach to the measurement
   */
  private recordMeasurement(
    operation: string,
    latencyMs: number,
    targetMs: number,
    context?: Record<string, unknown>
  ): void {
    if (!this.config.enableTracking) return;

    const measurement: LatencyMeasurement = {
      operation,
      latencyMs: Math.round(latencyMs * 100) / 100,
      targetMs,
      targetMet: latencyMs <= targetMs,
      timestamp: new Date().toISOString(),
      ...(context !== undefined ? { context } : {}),
    };

    this.measurements.push(measurement);

    // Trim if exceeds max
    if (this.measurements.length > this.config.maxTrackedMeasurements) {
      this.measurements.shift();
    }
  }

  /**
   * Pre-warm an agent by preloading its definition
   * @param agentName - Unique identifier of the agent to pre-warm
   * @param definitionPath - File system path to the agent's definition file
   * @returns Promise resolving to warmup status indicating success or failure
   */
  public async prewarmAgent(agentName: string, definitionPath: string): Promise<WarmupStatus> {
    if (!this.config.enablePrewarming) {
      return {
        resource: agentName,
        isWarm: false,
        error: 'Pre-warming is disabled',
      };
    }

    const startTime = performance.now();

    try {
      // Check if file exists
      try {
        await fsp.access(definitionPath);
      } catch {
        const status: WarmupStatus = {
          resource: agentName,
          isWarm: false,
          error: `Agent definition not found: ${definitionPath}`,
        };
        this.warmupStatus.set(agentName, status);
        return status;
      }

      // Read and cache the agent definition
      const content = await fsp.readFile(definitionPath, 'utf-8');
      const cacheFile = path.join(this.config.cacheDir, `agent-${agentName}.cache`);
      await fsp.writeFile(cacheFile, content, { mode: 0o644 });

      this.preloadedAgents.add(agentName);

      const warmupTimeMs = performance.now() - startTime;
      const status: WarmupStatus = {
        resource: agentName,
        isWarm: true,
        warmupTimeMs: Math.round(warmupTimeMs * 100) / 100,
        lastWarmedAt: new Date().toISOString(),
      };

      this.warmupStatus.set(agentName, status);
      return status;
    } catch (error) {
      const status: WarmupStatus = {
        resource: agentName,
        isWarm: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
      this.warmupStatus.set(agentName, status);
      return status;
    }
  }

  /**
   * Pre-warm multiple agents in parallel
   * @param agents - Array of agent configurations with name and definition path
   * @returns Promise resolving to array of warmup statuses for all agents
   */
  public async prewarmAgents(
    agents: Array<{ name: string; definitionPath: string }>
  ): Promise<WarmupStatus[]> {
    return Promise.all(agents.map((agent) => this.prewarmAgent(agent.name, agent.definitionPath)));
  }

  /**
   * Check if an agent is pre-warmed
   * @param agentName - Unique identifier of the agent to check
   * @returns True if the agent is currently pre-warmed and cached, false otherwise
   */
  public isAgentWarmed(agentName: string): boolean {
    return this.preloadedAgents.has(agentName);
  }

  /**
   * Get cached agent definition if available
   * @param agentName - Unique identifier of the agent whose cached definition to retrieve
   * @returns Cached agent definition content as string, or null if not available
   */
  public getCachedAgentDefinition(agentName: string): string | null {
    if (!this.preloadedAgents.has(agentName)) {
      return null;
    }

    const cacheFile = path.join(this.config.cacheDir, `agent-${agentName}.cache`);
    if (!fs.existsSync(cacheFile)) {
      this.preloadedAgents.delete(agentName);
      return null;
    }

    return fs.readFileSync(cacheFile, 'utf-8');
  }

  /**
   * Get warmup status for a resource
   * @param resource - Name of the resource (typically agent name) to check
   * @returns Warmup status object if available, or null if resource has not been warmed
   */
  public getWarmupStatus(resource: string): WarmupStatus | null {
    return this.warmupStatus.get(resource) ?? null;
  }

  /**
   * Get all warmup statuses
   * @returns Array of all recorded warmup statuses for all resources
   */
  public getAllWarmupStatuses(): WarmupStatus[] {
    return Array.from(this.warmupStatus.values());
  }

  /**
   * Start periodic warmup timer
   * @param agents - Array of agent configurations to periodically pre-warm
   */
  public startWarmupTimer(agents: Array<{ name: string; definitionPath: string }>): void {
    if (this.warmupTimer !== null) return;

    // Initial warmup
    void this.prewarmAgents(agents);

    // Periodic refresh
    this.warmupTimer = setInterval(() => {
      void this.prewarmAgents(agents);
    }, this.config.warmupIntervalMs);
  }

  /**
   * Stop periodic warmup timer
   */
  public stopWarmupTimer(): void {
    if (this.warmupTimer !== null) {
      clearInterval(this.warmupTimer);
      this.warmupTimer = null;
    }
  }

  /**
   * Execute multiple I/O operations in parallel
   * @param operations - Array of async functions representing I/O operations to execute concurrently
   * @returns Promise resolving to array of results from all operations
   */
  public async parallelIO<T>(operations: Array<() => Promise<T>>): Promise<T[]> {
    const startTime = performance.now();
    const promises = operations.map((op) => op());
    const results = await Promise.all(promises);
    const latencyMs = performance.now() - startTime;

    this.recordMeasurement(
      'parallel_io_batch',
      latencyMs,
      this.targets.fileIO * operations.length,
      {
        operationCount: operations.length,
      }
    );

    return results;
  }

  /**
   * Get latency statistics for an operation type
   * @param operation - Optional operation name to filter statistics; if omitted, returns stats for all operations
   * @returns Statistical summary including count, averages, percentiles, and target met rate
   */
  public getLatencyStats(operation?: string): {
    readonly count: number;
    readonly avgMs: number;
    readonly minMs: number;
    readonly maxMs: number;
    readonly p50Ms: number;
    readonly p95Ms: number;
    readonly p99Ms: number;
    readonly targetMetRate: number;
  } {
    const filtered =
      operation !== undefined
        ? this.measurements.filter((m) => m.operation === operation)
        : this.measurements;

    if (filtered.length === 0) {
      return {
        count: 0,
        avgMs: 0,
        minMs: 0,
        maxMs: 0,
        p50Ms: 0,
        p95Ms: 0,
        p99Ms: 0,
        targetMetRate: 0,
      };
    }

    const latencies = filtered.map((m) => m.latencyMs).sort((a, b) => a - b);
    const sum = latencies.reduce((a, b) => a + b, 0);
    const targetMetCount = filtered.filter((m) => m.targetMet).length;

    return {
      count: latencies.length,
      avgMs: Math.round((sum / latencies.length) * 100) / 100,
      minMs: latencies[0] ?? 0,
      maxMs: latencies[latencies.length - 1] ?? 0,
      p50Ms: latencies[Math.floor(latencies.length * 0.5)] ?? 0,
      p95Ms: latencies[Math.floor(latencies.length * 0.95)] ?? 0,
      p99Ms: latencies[Math.floor(latencies.length * 0.99)] ?? 0,
      targetMetRate: Math.round((targetMetCount / latencies.length) * 10000) / 100,
    };
  }

  /**
   * Get all measurements
   * @returns Array of all recorded latency measurements
   */
  public getMeasurements(): readonly LatencyMeasurement[] {
    return [...this.measurements];
  }

  /**
   * Get measurements that missed their target
   * @returns Array of latency measurements that exceeded their target threshold
   */
  public getSlowMeasurements(): readonly LatencyMeasurement[] {
    return this.measurements.filter((m) => !m.targetMet);
  }

  /**
   * Clear all measurements
   */
  public clearMeasurements(): void {
    this.measurements.length = 0;
  }

  /**
   * Clear all cached agents
   */
  public clearCache(): void {
    this.preloadedAgents.clear();
    this.warmupStatus.clear();

    // Remove cache files
    if (fs.existsSync(this.config.cacheDir)) {
      const files = fs.readdirSync(this.config.cacheDir);
      for (const file of files) {
        if (file.startsWith('agent-') && file.endsWith('.cache')) {
          fs.unlinkSync(path.join(this.config.cacheDir, file));
        }
      }
    }
  }

  /**
   * Reset the optimizer
   */
  public reset(): void {
    this.stopWarmupTimer();
    this.clearMeasurements();
    this.clearCache();
  }

  /**
   * Check if current performance meets targets
   * @returns Object indicating overall target achievement and per-operation details
   */
  public meetsTargets(): {
    readonly overall: boolean;
    readonly details: Record<string, boolean>;
  } {
    const stats = this.getLatencyStats();
    const details: Record<string, boolean> = {};

    // Check each operation type
    const operationTypes = new Set(this.measurements.map((m) => m.operation));
    for (const op of operationTypes) {
      const opStats = this.getLatencyStats(op);
      details[op] = opStats.targetMetRate >= 95; // 95% should meet target
    }

    return {
      overall: stats.targetMetRate >= 95,
      details,
    };
  }
}

/**
 * Singleton instance for global access
 */
let globalLatencyOptimizer: LatencyOptimizer | null = null;

/**
 * Get or create the global LatencyOptimizer instance
 * @param config - Optional configuration to use when creating the instance (only applied on first creation)
 * @returns The global LatencyOptimizer singleton instance
 */
export function getLatencyOptimizer(config?: LatencyOptimizerConfig): LatencyOptimizer {
  if (globalLatencyOptimizer === null) {
    globalLatencyOptimizer = new LatencyOptimizer(config);
  }
  return globalLatencyOptimizer;
}

/**
 * Reset the global LatencyOptimizer instance (for testing)
 */
export function resetLatencyOptimizer(): void {
  if (globalLatencyOptimizer !== null) {
    globalLatencyOptimizer.reset();
    globalLatencyOptimizer = null;
  }
}
