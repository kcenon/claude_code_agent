/**
 * MetricsCollector - Collects and aggregates performance metrics
 *
 * Features:
 * - Agent performance metrics
 * - Token usage tracking
 * - Pipeline stage durations
 * - Error rate tracking
 * - Histogram support for latency measurements
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  MetricsCollectorOptions,
  MetricValue,
  HistogramData,
  AgentMetrics,
  TokenUsageMetrics,
  StageDuration,
} from './types.js';
import { DEFAULT_PATHS } from '../config/paths.js';

/**
 * Default metrics directory
 */
const DEFAULT_METRICS_DIR = DEFAULT_PATHS.METRICS;

/**
 * Default flush interval (30 seconds)
 */
const DEFAULT_FLUSH_INTERVAL_MS = 30000;

/**
 * Default histogram buckets for duration metrics (in milliseconds)
 */
const DEFAULT_DURATION_BUCKETS = [100, 500, 1000, 5000, 10000, 30000, 60000, 120000, 300000];

/**
 * Token pricing for cost estimation (per 1000 tokens)
 */
const TOKEN_PRICING: Record<string, { input: number; output: number }> = {
  sonnet: { input: 0.003, output: 0.015 },
  opus: { input: 0.015, output: 0.075 },
  haiku: { input: 0.00025, output: 0.00125 },
};

/**
 * Metrics collector for monitoring system performance
 */
export class MetricsCollector {
  private readonly metricsDir: string;
  private readonly flushIntervalMs: number;
  private readonly prometheusFormat: boolean;
  private sessionId: string;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  // Agent metrics storage
  private agentInvocations: Map<string, { success: number; failure: number }> = new Map();
  private agentDurations: Map<string, number[]> = new Map();

  // Token usage storage
  private tokenUsage: Map<string, { input: number; output: number }> = new Map();
  private model = 'sonnet';

  // Pipeline stage storage
  private stageDurations: Map<string, StageDuration> = new Map();

  // Custom metrics storage
  private counters: Map<string, Map<string, number>> = new Map();
  private gauges: Map<string, Map<string, number>> = new Map();
  private histograms: Map<string, Map<string, { buckets: number[]; values: number[] }>> = new Map();

  constructor(options: MetricsCollectorOptions = {}) {
    this.metricsDir = options.metricsDir ?? DEFAULT_METRICS_DIR;
    this.flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.prometheusFormat = options.prometheusFormat ?? false;
    this.sessionId = '';

    this.ensureMetricsDirectory();
    this.startFlushTimer();
  }

  /**
   * Ensure the metrics directory exists
   */
  private ensureMetricsDirectory(): void {
    if (!fs.existsSync(this.metricsDir)) {
      fs.mkdirSync(this.metricsDir, { recursive: true, mode: 0o755 });
    }
  }

  /**
   * Start the flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer !== null) return;
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.flushIntervalMs);
  }

  /**
   * Stop the flush timer
   */
  public stopFlushTimer(): void {
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Set session ID
   * @param sessionId - Unique identifier for the current session
   */
  public setSessionId(sessionId: string): void {
    this.sessionId = sessionId;
  }

  /**
   * Get session ID
   * @returns The current session identifier
   */
  public getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Set the model for cost calculation
   * @param model - Model name (sonnet, opus, haiku) for token cost estimation
   */
  public setModel(model: string): void {
    this.model = model;
  }

  /**
   * Get labels key for map storage
   * @param labels - Optional key-value pairs to identify metric variants
   * @returns Sorted comma-separated string representation of labels
   */
  private getLabelsKey(labels?: Record<string, string>): string {
    if (labels === undefined) return '';
    return Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
  }

  /**
   * Record agent invocation start
   * @param _agent - Agent name (unused, reserved for future use)
   * @returns Timestamp in milliseconds marking the start of agent execution
   */
  public recordAgentStart(_agent: string): number {
    return Date.now();
  }

  /**
   * Record agent invocation completion
   * @param agent - Name of the agent that completed execution
   * @param startTime - Timestamp from recordAgentStart() call
   * @param success - Whether the agent execution succeeded
   */
  public recordAgentEnd(agent: string, startTime: number, success: boolean): void {
    const duration = Date.now() - startTime;

    // Update invocation counts
    const counts = this.agentInvocations.get(agent) ?? { success: 0, failure: 0 };
    if (success) {
      counts.success++;
    } else {
      counts.failure++;
    }
    this.agentInvocations.set(agent, counts);

    // Record duration
    const durations = this.agentDurations.get(agent) ?? [];
    durations.push(duration);
    this.agentDurations.set(agent, durations);

    // Update counter metrics
    this.incrementCounter('agent_invocation_total', 1, {
      agent,
      status: success ? 'success' : 'failure',
    });
    this.recordHistogram('agent_duration_seconds', duration / 1000, { agent });
  }

  /**
   * Record token usage
   * @param agent - Name of the agent consuming tokens
   * @param inputTokens - Number of input tokens consumed
   * @param outputTokens - Number of output tokens generated
   */
  public recordTokenUsage(agent: string, inputTokens: number, outputTokens: number): void {
    const usage = this.tokenUsage.get(agent) ?? { input: 0, output: 0 };
    usage.input += inputTokens;
    usage.output += outputTokens;
    this.tokenUsage.set(agent, usage);

    this.incrementCounter('token_usage_total', inputTokens, { agent, type: 'input' });
    this.incrementCounter('token_usage_total', outputTokens, { agent, type: 'output' });
  }

  /**
   * Record pipeline stage start
   * @param stage - Name of the pipeline stage being started
   */
  public recordStageStart(stage: string): void {
    this.stageDurations.set(stage, {
      stage,
      startTime: new Date().toISOString(),
      status: 'in_progress',
    });
  }

  /**
   * Record pipeline stage completion
   * @param stage - Name of the pipeline stage being completed
   * @param success - Whether the stage completed successfully
   */
  public recordStageEnd(stage: string, success: boolean): void {
    const stageData = this.stageDurations.get(stage);
    if (stageData === undefined) return;

    const endTime = new Date();
    const startTime = new Date(stageData.startTime);
    const durationMs = endTime.getTime() - startTime.getTime();

    this.stageDurations.set(stage, {
      ...stageData,
      endTime: endTime.toISOString(),
      durationMs,
      status: success ? 'completed' : 'failed',
    });

    this.recordHistogram('pipeline_stage_duration_seconds', durationMs / 1000, { stage });
    this.incrementCounter('pipeline_stage_completion_total', 1, {
      stage,
      status: success ? 'success' : 'failure',
    });
  }

  /**
   * Increment a counter metric
   * @param name - Metric name identifier
   * @param value - Amount to increment the counter by
   * @param labels - Optional labels to differentiate metric instances
   */
  public incrementCounter(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getLabelsKey(labels);
    const counterMap = this.counters.get(name) ?? new Map<string, number>();
    const current = counterMap.get(key) ?? 0;
    counterMap.set(key, current + value);
    this.counters.set(name, counterMap);
  }

  /**
   * Set a gauge metric
   * @param name - Metric name identifier
   * @param value - Current value to set the gauge to
   * @param labels - Optional labels to differentiate metric instances
   */
  public setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.getLabelsKey(labels);
    const gaugeMap = this.gauges.get(name) ?? new Map<string, number>();
    gaugeMap.set(key, value);
    this.gauges.set(name, gaugeMap);
  }

  /**
   * Record a histogram observation
   * @param name - Metric name identifier
   * @param value - Observed value to record in the histogram
   * @param labels - Optional labels to differentiate metric instances
   * @param buckets - Bucket boundaries for histogram distribution
   */
  public recordHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>,
    buckets: number[] = DEFAULT_DURATION_BUCKETS
  ): void {
    const key = this.getLabelsKey(labels);
    const histogramMap =
      this.histograms.get(name) ?? new Map<string, { buckets: number[]; values: number[] }>();
    const data = histogramMap.get(key) ?? { buckets, values: [] as number[] };
    data.values.push(value);
    histogramMap.set(key, data);
    this.histograms.set(name, histogramMap);
  }

  /**
   * Get agent metrics
   * @param agent - Name of the agent to retrieve metrics for
   * @returns Aggregated metrics for the agent, or null if no data exists
   */
  public getAgentMetrics(agent: string): AgentMetrics | null {
    const counts = this.agentInvocations.get(agent);
    const durations = this.agentDurations.get(agent);
    const tokens = this.tokenUsage.get(agent);

    if (counts === undefined) return null;

    const sortedDurations = [...(durations ?? [])].sort((a, b) => a - b);
    const p95Index = Math.floor(sortedDurations.length * 0.95);

    return {
      agent,
      invocations: counts.success + counts.failure,
      successes: counts.success,
      failures: counts.failure,
      avgDurationMs:
        sortedDurations.length > 0
          ? sortedDurations.reduce((a, b) => a + b, 0) / sortedDurations.length
          : 0,
      p95DurationMs: sortedDurations[p95Index] ?? 0,
      inputTokens: tokens?.input ?? 0,
      outputTokens: tokens?.output ?? 0,
    };
  }

  /**
   * Get all agent metrics
   * @returns Array of metrics for all agents that have been tracked
   */
  public getAllAgentMetrics(): AgentMetrics[] {
    const metrics: AgentMetrics[] = [];
    for (const agent of this.agentInvocations.keys()) {
      const m = this.getAgentMetrics(agent);
      if (m !== null) {
        metrics.push(m);
      }
    }
    return metrics;
  }

  /**
   * Get token usage metrics
   * @returns Aggregated token usage and estimated cost across all agents
   */
  public getTokenUsageMetrics(): TokenUsageMetrics {
    let totalInput = 0;
    let totalOutput = 0;
    const byAgent: Record<string, { input: number; output: number }> = {};

    for (const [agent, usage] of this.tokenUsage) {
      totalInput += usage.input;
      totalOutput += usage.output;
      byAgent[agent] = { input: usage.input, output: usage.output };
    }

    const pricing = TOKEN_PRICING[this.model] ?? TOKEN_PRICING['sonnet'];
    const estimatedCostUsd =
      (totalInput / 1000) * (pricing?.input ?? 0.003) +
      (totalOutput / 1000) * (pricing?.output ?? 0.015);

    return {
      sessionId: this.sessionId,
      totalInputTokens: totalInput,
      totalOutputTokens: totalOutput,
      byAgent,
      estimatedCostUsd: Math.round(estimatedCostUsd * 10000) / 10000,
    };
  }

  /**
   * Get pipeline stage durations
   * @returns Array of duration data for all recorded pipeline stages
   */
  public getStageDurations(): StageDuration[] {
    return Array.from(this.stageDurations.values());
  }

  /**
   * Get counter value
   * @param name - Metric name identifier
   * @param labels - Optional labels to identify specific counter instance
   * @returns Current counter value, or 0 if not found
   */
  public getCounter(name: string, labels?: Record<string, string>): number {
    const key = this.getLabelsKey(labels);
    return this.counters.get(name)?.get(key) ?? 0;
  }

  /**
   * Get gauge value
   * @param name - Metric name identifier
   * @param labels - Optional labels to identify specific gauge instance
   * @returns Current gauge value, or 0 if not found
   */
  public getGauge(name: string, labels?: Record<string, string>): number {
    const key = this.getLabelsKey(labels);
    return this.gauges.get(name)?.get(key) ?? 0;
  }

  /**
   * Get histogram data
   * @param name - Metric name identifier
   * @param labels - Optional labels to identify specific histogram instance
   * @returns Histogram data with bucket counts and statistics, or null if not found
   */
  public getHistogram(name: string, labels?: Record<string, string>): HistogramData | null {
    const key = this.getLabelsKey(labels);
    const histogramMap = this.histograms.get(name);
    if (histogramMap === undefined) return null;

    const data = histogramMap.get(key);
    if (data === undefined) return null;

    const bucketCounts: Record<string, number> = {};
    for (const bucket of data.buckets) {
      bucketCounts[String(bucket)] = data.values.filter((v) => v <= bucket).length;
    }
    bucketCounts['+Inf'] = data.values.length;

    const histogramData: HistogramData = {
      name,
      buckets: bucketCounts,
      sum: data.values.reduce((a, b) => a + b, 0),
      count: data.values.length,
    };

    if (labels !== undefined) {
      (histogramData as { labels?: Record<string, string> }).labels = labels;
    }

    return histogramData;
  }

  /**
   * Get all metric values
   * @returns Array of all counter and gauge metrics with their current values
   */
  public getAllMetrics(): MetricValue[] {
    const metrics: MetricValue[] = [];
    const timestamp = new Date().toISOString();

    // Counters
    for (const [name, valueMap] of this.counters) {
      for (const [labelsKey, value] of valueMap) {
        const labels = this.parseLabelsKey(labelsKey);
        const metric: MetricValue = { name, value, timestamp };
        if (labels !== null) {
          (metric as { labels?: Record<string, string> }).labels = labels;
        }
        metrics.push(metric);
      }
    }

    // Gauges
    for (const [name, valueMap] of this.gauges) {
      for (const [labelsKey, value] of valueMap) {
        const labels = this.parseLabelsKey(labelsKey);
        const metric: MetricValue = { name, value, timestamp };
        if (labels !== null) {
          (metric as { labels?: Record<string, string> }).labels = labels;
        }
        metrics.push(metric);
      }
    }

    return metrics;
  }

  /**
   * Parse labels key back to record
   * @param key - Serialized labels string from getLabelsKey()
   * @returns Parsed labels object, or null for empty key
   */
  private parseLabelsKey(key: string): Record<string, string> | null {
    if (key === '') return null;
    const labels: Record<string, string> = {};
    for (const pair of key.split(',')) {
      const [k, v] = pair.split('=');
      if (k !== undefined && v !== undefined) {
        labels[k] = v;
      }
    }
    return labels;
  }

  /**
   * Flush metrics to disk
   */
  public flush(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(this.metricsDir, `metrics-${timestamp}.json`);

    const data = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      agentMetrics: this.getAllAgentMetrics(),
      tokenUsage: this.getTokenUsageMetrics(),
      stageDurations: this.getStageDurations(),
      metrics: this.getAllMetrics(),
    };

    try {
      fs.writeFileSync(filename, JSON.stringify(data, null, 2), { mode: 0o644 });
    } catch {
      // Ignore write errors
    }

    // Also export Prometheus format if enabled
    if (this.prometheusFormat) {
      this.exportPrometheus();
    }
  }

  /**
   * Export metrics in Prometheus format
   * @returns Metrics formatted as Prometheus exposition format
   */
  public exportPrometheus(): string {
    const lines: string[] = [];

    // Counters
    for (const [name, valueMap] of this.counters) {
      lines.push(`# HELP ${name} Counter metric`);
      lines.push(`# TYPE ${name} counter`);
      for (const [labelsKey, value] of valueMap) {
        const labelsStr = labelsKey !== '' ? `{${labelsKey}}` : '';
        lines.push(`${name}${labelsStr} ${String(value)}`);
      }
    }

    // Gauges
    for (const [name, valueMap] of this.gauges) {
      lines.push(`# HELP ${name} Gauge metric`);
      lines.push(`# TYPE ${name} gauge`);
      for (const [labelsKey, value] of valueMap) {
        const labelsStr = labelsKey !== '' ? `{${labelsKey}}` : '';
        lines.push(`${name}${labelsStr} ${String(value)}`);
      }
    }

    // Histograms
    for (const [name, histogramMap] of this.histograms) {
      lines.push(`# HELP ${name} Histogram metric`);
      lines.push(`# TYPE ${name} histogram`);
      for (const [labelsKey, data] of histogramMap) {
        const baseLabels = labelsKey !== '' ? labelsKey + ',' : '';
        let cumulative = 0;
        for (const bucket of data.buckets) {
          cumulative += data.values.filter((v) => v <= bucket).length - cumulative;
          lines.push(`${name}_bucket{${baseLabels}le="${String(bucket)}"} ${String(cumulative)}`);
        }
        lines.push(`${name}_bucket{${baseLabels}le="+Inf"} ${String(data.values.length)}`);
        lines.push(`${name}_sum{${labelsKey}} ${String(data.values.reduce((a, b) => a + b, 0))}`);
        lines.push(`${name}_count{${labelsKey}} ${String(data.values.length)}`);
      }
    }

    const output = lines.join('\n');

    // Write to file
    const filename = path.join(this.metricsDir, 'metrics.prom');
    try {
      fs.writeFileSync(filename, output, { mode: 0o644 });
    } catch {
      // Ignore write errors
    }

    return output;
  }

  /**
   * Reset all metrics (for testing)
   */
  public reset(): void {
    this.agentInvocations.clear();
    this.agentDurations.clear();
    this.tokenUsage.clear();
    this.stageDurations.clear();
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  /**
   * Get the metrics directory
   * @returns Path to the directory where metrics are stored
   */
  public getMetricsDir(): string {
    return this.metricsDir;
  }
}

/**
 * Singleton instance for global access
 */
let globalMetricsCollector: MetricsCollector | null = null;

/**
 * Get or create the global MetricsCollector instance
 * @param options - Configuration options for the metrics collector
 * @returns The global singleton MetricsCollector instance
 */
export function getMetricsCollector(options?: MetricsCollectorOptions): MetricsCollector {
  if (globalMetricsCollector === null) {
    globalMetricsCollector = new MetricsCollector(options);
  }
  return globalMetricsCollector;
}

/**
 * Reset the global MetricsCollector instance (for testing)
 */
export function resetMetricsCollector(): void {
  if (globalMetricsCollector !== null) {
    globalMetricsCollector.stopFlushTimer();
    globalMetricsCollector = null;
  }
}
