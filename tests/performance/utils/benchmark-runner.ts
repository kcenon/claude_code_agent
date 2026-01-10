/**
 * Benchmark Runner - Executes and measures performance of operations
 */

import type { BenchmarkResult } from './types.js';

export interface BenchmarkOptions {
  iterations?: number;
  warmupIterations?: number;
  name?: string;
}

const DEFAULT_OPTIONS: Required<BenchmarkOptions> = {
  iterations: 100,
  warmupIterations: 10,
  name: 'benchmark',
};

export class BenchmarkRunner {
  private readonly options: Required<BenchmarkOptions>;

  constructor(options: BenchmarkOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async run<T>(operation: () => T | Promise<T>, name?: string): Promise<BenchmarkResult> {
    const operationName = name ?? this.options.name;

    // Warmup phase
    for (let i = 0; i < this.options.warmupIterations; i++) {
      await operation();
    }

    // Force GC if available (run with --expose-gc)
    if (global.gc) {
      global.gc();
    }

    // Measurement phase
    const times: number[] = [];
    const startTime = Date.now();

    for (let i = 0; i < this.options.iterations; i++) {
      const iterStart = performance.now();
      await operation();
      const iterEnd = performance.now();
      times.push(iterEnd - iterStart);
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Calculate statistics
    const sortedTimes = [...times].sort((a, b) => a - b);
    const sum = times.reduce((a, b) => a + b, 0);
    const meanTime = sum / times.length;
    const medianTime = this.percentile(sortedTimes, 50);
    const p50 = medianTime;
    const p95 = this.percentile(sortedTimes, 95);
    const p99 = this.percentile(sortedTimes, 99);
    const minTime = sortedTimes[0] ?? 0;
    const maxTime = sortedTimes[sortedTimes.length - 1] ?? 0;
    const stdDev = this.standardDeviation(times, meanTime);
    const opsPerSecond = (this.options.iterations / totalTime) * 1000;

    return {
      name: operationName,
      operation: operationName,
      iterations: this.options.iterations,
      totalTime,
      meanTime,
      medianTime,
      p50,
      p95,
      p99,
      minTime,
      maxTime,
      stdDev,
      opsPerSecond,
      timestamp: new Date(),
    };
  }

  async runMultiple<T>(
    operations: Array<{ name: string; fn: () => T | Promise<T> }>
  ): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];

    for (const op of operations) {
      const result = await this.run(op.fn, op.name);
      results.push(result);
    }

    return results;
  }

  private percentile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) return 0;

    const index = (p / 100) * (sortedValues.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) {
      return sortedValues[lower] ?? 0;
    }

    const lowerValue = sortedValues[lower] ?? 0;
    const upperValue = sortedValues[upper] ?? 0;
    return lowerValue + (upperValue - lowerValue) * (index - lower);
  }

  private standardDeviation(values: number[], mean: number): number {
    if (values.length === 0) return 0;

    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  formatResult(result: BenchmarkResult): string {
    return [
      `Benchmark: ${result.name}`,
      `  Iterations: ${result.iterations}`,
      `  Total Time: ${result.totalTime.toFixed(2)}ms`,
      `  Mean: ${result.meanTime.toFixed(3)}ms`,
      `  Median (p50): ${result.p50.toFixed(3)}ms`,
      `  p95: ${result.p95.toFixed(3)}ms`,
      `  p99: ${result.p99.toFixed(3)}ms`,
      `  Min: ${result.minTime.toFixed(3)}ms`,
      `  Max: ${result.maxTime.toFixed(3)}ms`,
      `  Std Dev: ${result.stdDev.toFixed(3)}ms`,
      `  Throughput: ${result.opsPerSecond.toFixed(0)} ops/sec`,
    ].join('\n');
  }
}
