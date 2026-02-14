/**
 * ResponseTimeBenchmarks - Performance benchmark definitions and validation
 *
 * Features:
 * - Defines performance targets for all pipeline stages
 * - Provides benchmark validation utilities
 * - Tracks benchmark compliance over time
 * - Generates performance reports
 */

/**
 * Feature complexity levels
 */
export type FeatureComplexity = 'simple' | 'medium' | 'complex';

/**
 * Pipeline stage names
 */
export type PipelineStage =
  | 'collection'
  | 'prd_generation'
  | 'srs_generation'
  | 'sds_generation'
  | 'issue_generation'
  | 'implementation'
  | 'pr_review';

/**
 * Benchmark target definition
 */
export interface BenchmarkTarget {
  /** Stage or operation name */
  readonly name: string;
  /** Target time in milliseconds */
  readonly targetMs: number;
  /** Warning threshold in milliseconds */
  readonly warningMs: number;
  /** Critical threshold in milliseconds */
  readonly criticalMs: number;
  /** Description of the benchmark */
  readonly description: string;
}

/**
 * Benchmark result
 */
export interface BenchmarkResult {
  /** Benchmark name */
  readonly name: string;
  /** Actual time in milliseconds */
  readonly actualMs: number;
  /** Target time in milliseconds */
  readonly targetMs: number;
  /** Status */
  readonly status: 'pass' | 'warning' | 'fail';
  /** Whether the target was met */
  readonly targetMet: boolean;
  /** Deviation from target as percentage */
  readonly deviationPercent: number;
  /** Timestamp */
  readonly timestamp: string;
}

/**
 * Pipeline benchmark configuration by complexity
 */
export interface PipelineBenchmarks {
  /** Document generation total time */
  readonly documentGeneration: number;
  /** Issue generation time */
  readonly issueGeneration: number;
  /** Total pipeline time */
  readonly total: number;
}

/**
 * Stage-level benchmark targets
 */
export interface StageBenchmarks {
  readonly collection: number;
  readonly prd: number;
  readonly srs: number;
  readonly sds: number;
  readonly issues: number;
  readonly implementation: number;
  readonly prReview: number;
}

/**
 * Latency benchmark targets
 */
export interface LatencyBenchmarks {
  readonly agentStartup: number;
  readonly handoffLatency: number;
  readonly fileIO: number;
  readonly apiConnection: number;
}

/**
 * All benchmark definitions
 */
export interface AllBenchmarks {
  /** Pipeline benchmarks by complexity */
  readonly pipeline: Record<FeatureComplexity, PipelineBenchmarks>;
  /** Stage-level benchmarks */
  readonly stages: StageBenchmarks;
  /** Latency benchmarks */
  readonly latency: LatencyBenchmarks;
  /** E2E targets (in minutes) */
  readonly e2e: {
    readonly simpleFeatureMinutes: number;
    readonly complexFeatureMinutes: number;
  };
}

/**
 * Default benchmark definitions (in milliseconds unless noted)
 */
export const DEFAULT_BENCHMARKS: AllBenchmarks = {
  pipeline: {
    simple: {
      documentGeneration: 20000, // 20 seconds
      issueGeneration: 10000, // 10 seconds
      total: 30000, // 30 seconds
    },
    medium: {
      documentGeneration: 30000, // 30 seconds
      issueGeneration: 15000, // 15 seconds
      total: 45000, // 45 seconds
    },
    complex: {
      documentGeneration: 60000, // 60 seconds
      issueGeneration: 30000, // 30 seconds
      total: 90000, // 90 seconds
    },
  },
  stages: {
    collection: 10000, // 10 seconds
    prd: 15000, // 15 seconds
    srs: 15000, // 15 seconds
    sds: 15000, // 15 seconds
    issues: 30000, // 30 seconds
    implementation: 300000, // 5 minutes per issue
    prReview: 120000, // 2 minutes
  },
  latency: {
    agentStartup: 2000, // 2 seconds
    handoffLatency: 1000, // 1 second
    fileIO: 100, // 100ms
    apiConnection: 500, // 500ms
  },
  e2e: {
    simpleFeatureMinutes: 15,
    complexFeatureMinutes: 30,
  },
};

/**
 * Benchmark validation result
 */
export interface ValidationResult {
  /** Overall pass/fail */
  readonly passed: boolean;
  /** Individual benchmark results */
  readonly results: readonly BenchmarkResult[];
  /** Summary statistics */
  readonly summary: {
    readonly total: number;
    readonly passed: number;
    readonly warnings: number;
    readonly failed: number;
    readonly passRate: number;
  };
}

/**
 * Benchmark history entry
 */
export interface BenchmarkHistoryEntry {
  /** Session ID */
  readonly sessionId: string;
  /** Timestamp */
  readonly timestamp: string;
  /** Complexity of the feature */
  readonly complexity: FeatureComplexity;
  /** Stage timings */
  readonly stageTimes: Record<string, number>;
  /** Total time */
  readonly totalTimeMs: number;
  /** Whether all benchmarks passed */
  readonly allPassed: boolean;
}

/**
 * Response time benchmarks manager
 */
export class ResponseTimeBenchmarks {
  private readonly benchmarks: AllBenchmarks;
  private readonly history: BenchmarkHistoryEntry[] = [];
  private readonly maxHistorySize: number;

  constructor(customBenchmarks: Partial<AllBenchmarks> = {}, maxHistorySize: number = 100) {
    this.benchmarks = this.mergeBenchmarks(DEFAULT_BENCHMARKS, customBenchmarks);
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * Deep merge benchmark configurations
   * @param defaults - Default benchmark values to use as base
   * @param custom - Custom benchmark values to override defaults
   * @returns Merged benchmark configuration
   */
  private mergeBenchmarks(defaults: AllBenchmarks, custom: Partial<AllBenchmarks>): AllBenchmarks {
    return {
      pipeline: {
        simple: { ...defaults.pipeline.simple, ...custom.pipeline?.simple },
        medium: { ...defaults.pipeline.medium, ...custom.pipeline?.medium },
        complex: { ...defaults.pipeline.complex, ...custom.pipeline?.complex },
      },
      stages: { ...defaults.stages, ...custom.stages },
      latency: { ...defaults.latency, ...custom.latency },
      e2e: { ...defaults.e2e, ...custom.e2e },
    };
  }

  /**
   * Get all benchmark definitions
   * @returns Complete benchmark configuration including pipeline, stages, latency, and E2E
   */
  public getBenchmarks(): AllBenchmarks {
    return this.benchmarks;
  }

  /**
   * Get pipeline benchmarks for a complexity level
   * @param complexity - Feature complexity level (simple, medium, complex)
   * @returns Pipeline benchmark targets for the specified complexity
   */
  public getPipelineBenchmarks(complexity: FeatureComplexity): PipelineBenchmarks {
    return this.benchmarks.pipeline[complexity];
  }

  /**
   * Get stage benchmarks
   * @returns Benchmark targets for individual pipeline stages
   */
  public getStageBenchmarks(): StageBenchmarks {
    return this.benchmarks.stages;
  }

  /**
   * Get latency benchmarks
   * @returns Benchmark targets for system latency metrics
   */
  public getLatencyBenchmarks(): LatencyBenchmarks {
    return this.benchmarks.latency;
  }

  /**
   * Create a benchmark target
   * @param name - Unique identifier for the benchmark
   * @param targetMs - Target time in milliseconds
   * @param description - Human-readable description of what is being benchmarked
   * @returns Complete benchmark target with warning and critical thresholds
   */
  public createTarget(name: string, targetMs: number, description: string): BenchmarkTarget {
    return {
      name,
      targetMs,
      warningMs: targetMs * 1.2, // 20% over is warning
      criticalMs: targetMs * 1.5, // 50% over is critical
      description,
    };
  }

  /**
   * Validate a timing against a benchmark
   * @param name - Unique identifier for the benchmark being validated
   * @param actualMs - Actual measured time in milliseconds
   * @param target - Benchmark target to validate against
   * @returns Validation result with status and deviation percentage
   */
  public validateTiming(name: string, actualMs: number, target: BenchmarkTarget): BenchmarkResult {
    let status: 'pass' | 'warning' | 'fail';
    if (actualMs <= target.targetMs) {
      status = 'pass';
    } else if (actualMs <= target.warningMs) {
      status = 'warning';
    } else {
      status = 'fail';
    }

    const deviationPercent =
      Math.round(((actualMs - target.targetMs) / target.targetMs) * 10000) / 100;

    return {
      name,
      actualMs,
      targetMs: target.targetMs,
      status,
      targetMet: status === 'pass',
      deviationPercent,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Validate pipeline timing
   * @param complexity - Feature complexity level being validated
   * @param timings - Measured timing values for pipeline phases
   * @param timings.documentGenerationMs - Time spent generating documentation
   * @param timings.issueGenerationMs - Time spent generating issues
   * @param timings.totalMs - Total pipeline execution time
   * @returns Validation result with pass/fail status and detailed breakdown
   */
  public validatePipeline(
    complexity: FeatureComplexity,
    timings: {
      documentGenerationMs?: number;
      issueGenerationMs?: number;
      totalMs?: number;
    }
  ): ValidationResult {
    const targets = this.benchmarks.pipeline[complexity];
    const results: BenchmarkResult[] = [];

    if (timings.documentGenerationMs !== undefined) {
      const target = this.createTarget(
        'document_generation',
        targets.documentGeneration,
        `Document generation for ${complexity} feature`
      );
      results.push(
        this.validateTiming('document_generation', timings.documentGenerationMs, target)
      );
    }

    if (timings.issueGenerationMs !== undefined) {
      const target = this.createTarget(
        'issue_generation',
        targets.issueGeneration,
        `Issue generation for ${complexity} feature`
      );
      results.push(this.validateTiming('issue_generation', timings.issueGenerationMs, target));
    }

    if (timings.totalMs !== undefined) {
      const target = this.createTarget(
        'total_pipeline',
        targets.total,
        `Total pipeline for ${complexity} feature`
      );
      results.push(this.validateTiming('total_pipeline', timings.totalMs, target));
    }

    return this.summarizeResults(results);
  }

  /**
   * Validate stage timings
   * @param stageTimes - Measured execution times for individual pipeline stages
   * @returns Validation result comparing each stage against its target
   */
  public validateStages(
    stageTimes: Partial<Record<keyof StageBenchmarks, number>>
  ): ValidationResult {
    const targets = this.benchmarks.stages;
    const results: BenchmarkResult[] = [];

    for (const [stage, actualMs] of Object.entries(stageTimes) as Array<
      [keyof StageBenchmarks, number]
    >) {
      const targetMs = targets[stage];
      const target = this.createTarget(stage, targetMs, `${stage} stage`);
      results.push(this.validateTiming(stage, actualMs, target));
    }

    return this.summarizeResults(results);
  }

  /**
   * Validate latency metrics
   * @param latencies - Measured latency values for system operations
   * @returns Validation result comparing each latency metric against its target
   */
  public validateLatency(
    latencies: Partial<Record<keyof LatencyBenchmarks, number>>
  ): ValidationResult {
    const targets = this.benchmarks.latency;
    const results: BenchmarkResult[] = [];

    for (const [metric, actualMs] of Object.entries(latencies) as Array<
      [keyof LatencyBenchmarks, number]
    >) {
      const targetMs = targets[metric];
      const target = this.createTarget(metric, targetMs, `${metric} latency`);
      results.push(this.validateTiming(metric, actualMs, target));
    }

    return this.summarizeResults(results);
  }

  /**
   * Summarize validation results
   * @param results - Array of individual benchmark validation results
   * @returns Overall validation summary with pass/warning/fail counts
   */
  private summarizeResults(results: BenchmarkResult[]): ValidationResult {
    const passed = results.filter((r) => r.status === 'pass').length;
    const warnings = results.filter((r) => r.status === 'warning').length;
    const failed = results.filter((r) => r.status === 'fail').length;
    const total = results.length;

    return {
      passed: failed === 0,
      results,
      summary: {
        total,
        passed,
        warnings,
        failed,
        passRate: total > 0 ? Math.round((passed / total) * 10000) / 100 : 0,
      },
    };
  }

  /**
   * Record a benchmark run
   * @param sessionId - Unique identifier for the session
   * @param complexity - Feature complexity level of the run
   * @param stageTimes - Execution times for each stage in the run
   * @param totalTimeMs - Total execution time for the entire run
   * @returns History entry that was recorded
   */
  public recordRun(
    sessionId: string,
    complexity: FeatureComplexity,
    stageTimes: Record<string, number>,
    totalTimeMs: number
  ): BenchmarkHistoryEntry {
    const validation = this.validatePipeline(complexity, { totalMs: totalTimeMs });

    const entry: BenchmarkHistoryEntry = {
      sessionId,
      timestamp: new Date().toISOString(),
      complexity,
      stageTimes,
      totalTimeMs,
      allPassed: validation.passed,
    };

    this.history.push(entry);

    // Trim history
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    return entry;
  }

  /**
   * Get benchmark history
   * @returns All recorded benchmark history entries
   */
  public getHistory(): readonly BenchmarkHistoryEntry[] {
    return [...this.history];
  }

  /**
   * Get history for a specific complexity
   * @param complexity - Feature complexity level to filter by
   * @returns History entries matching the specified complexity
   */
  public getHistoryByComplexity(complexity: FeatureComplexity): readonly BenchmarkHistoryEntry[] {
    return this.history.filter((h) => h.complexity === complexity);
  }

  /**
   * Get performance trend
   * @param complexity - Optional complexity level to analyze (if omitted, analyzes all)
   * @returns Performance statistics and trend direction
   */
  public getPerformanceTrend(complexity?: FeatureComplexity): {
    readonly avgTotalMs: number;
    readonly minTotalMs: number;
    readonly maxTotalMs: number;
    readonly passRate: number;
    readonly trend: 'improving' | 'stable' | 'degrading';
  } {
    const filtered =
      complexity !== undefined
        ? this.history.filter((h) => h.complexity === complexity)
        : this.history;

    if (filtered.length === 0) {
      return {
        avgTotalMs: 0,
        minTotalMs: 0,
        maxTotalMs: 0,
        passRate: 0,
        trend: 'stable',
      };
    }

    const times = filtered.map((h) => h.totalTimeMs);
    const avgTotalMs = times.reduce((a, b) => a + b, 0) / times.length;
    const passRate = (filtered.filter((h) => h.allPassed).length / filtered.length) * 100;

    // Calculate trend (compare first half vs second half)
    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (filtered.length >= 4) {
      const mid = Math.floor(filtered.length / 2);
      const firstHalf = filtered.slice(0, mid);
      const secondHalf = filtered.slice(mid);

      const firstAvg = firstHalf.reduce((sum, h) => sum + h.totalTimeMs, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, h) => sum + h.totalTimeMs, 0) / secondHalf.length;

      const change = (secondAvg - firstAvg) / firstAvg;
      if (change < -0.1) {
        trend = 'improving';
      } else if (change > 0.1) {
        trend = 'degrading';
      }
    }

    return {
      avgTotalMs: Math.round(avgTotalMs),
      minTotalMs: Math.min(...times),
      maxTotalMs: Math.max(...times),
      passRate: Math.round(passRate * 100) / 100,
      trend,
    };
  }

  /**
   * Generate a performance report
   * @returns Comprehensive report with benchmarks, history, and trend analysis
   */
  public generateReport(): {
    readonly benchmarks: AllBenchmarks;
    readonly history: {
      readonly total: number;
      readonly passed: number;
      readonly failed: number;
    };
    readonly byComplexity: Record<
      FeatureComplexity,
      {
        readonly count: number;
        readonly avgTimeMs: number;
        readonly passRate: number;
      }
    >;
    readonly trend: 'improving' | 'stable' | 'degrading';
  } {
    const complexities: FeatureComplexity[] = ['simple', 'medium', 'complex'];
    const byComplexity: Record<
      FeatureComplexity,
      { count: number; avgTimeMs: number; passRate: number }
    > = {
      simple: { count: 0, avgTimeMs: 0, passRate: 0 },
      medium: { count: 0, avgTimeMs: 0, passRate: 0 },
      complex: { count: 0, avgTimeMs: 0, passRate: 0 },
    };

    for (const complexity of complexities) {
      const entries = this.getHistoryByComplexity(complexity);
      if (entries.length > 0) {
        byComplexity[complexity] = {
          count: entries.length,
          avgTimeMs: Math.round(
            entries.reduce((sum, e) => sum + e.totalTimeMs, 0) / entries.length
          ),
          passRate:
            Math.round((entries.filter((e) => e.allPassed).length / entries.length) * 10000) / 100,
        };
      }
    }

    const overallTrend = this.getPerformanceTrend();

    return {
      benchmarks: this.benchmarks,
      history: {
        total: this.history.length,
        passed: this.history.filter((h) => h.allPassed).length,
        failed: this.history.filter((h) => !h.allPassed).length,
      },
      byComplexity,
      trend: overallTrend.trend,
    };
  }

  /**
   * Check if E2E target is met
   * @param complexity - Feature complexity level being validated
   * @param totalTimeMs - Total measured execution time in milliseconds
   * @returns Comparison of actual time against E2E target
   */
  public checkE2ETarget(
    complexity: FeatureComplexity,
    totalTimeMs: number
  ): {
    readonly targetMinutes: number;
    readonly actualMinutes: number;
    readonly met: boolean;
  } {
    const targetMinutes =
      complexity === 'complex'
        ? this.benchmarks.e2e.complexFeatureMinutes
        : this.benchmarks.e2e.simpleFeatureMinutes;

    const actualMinutes = totalTimeMs / 60000;

    return {
      targetMinutes,
      actualMinutes: Math.round(actualMinutes * 100) / 100,
      met: actualMinutes <= targetMinutes,
    };
  }

  /**
   * Clear history
   */
  public clearHistory(): void {
    this.history.length = 0;
  }
}

/**
 * Singleton instance for global access
 */
let globalResponseTimeBenchmarks: ResponseTimeBenchmarks | null = null;

/**
 * Get or create the global ResponseTimeBenchmarks instance
 * @param customBenchmarks - Optional custom benchmark values to override defaults
 * @returns The global singleton ResponseTimeBenchmarks instance
 */
export function getResponseTimeBenchmarks(
  customBenchmarks?: Partial<AllBenchmarks>
): ResponseTimeBenchmarks {
  if (globalResponseTimeBenchmarks === null) {
    globalResponseTimeBenchmarks = new ResponseTimeBenchmarks(customBenchmarks);
  }
  return globalResponseTimeBenchmarks;
}

/**
 * Reset the global ResponseTimeBenchmarks instance (for testing)
 */
export function resetResponseTimeBenchmarks(): void {
  if (globalResponseTimeBenchmarks !== null) {
    globalResponseTimeBenchmarks.clearHistory();
    globalResponseTimeBenchmarks = null;
  }
}
