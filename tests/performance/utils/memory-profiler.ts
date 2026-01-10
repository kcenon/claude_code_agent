/**
 * Memory Profiler - Tracks memory usage and detects leaks
 */

import type { MemorySnapshot, MemoryMetrics } from './types.js';

export interface MemoryProfilerOptions {
  sampleInterval?: number; // ms between samples
  gcBetweenSamples?: boolean;
}

const DEFAULT_OPTIONS: Required<MemoryProfilerOptions> = {
  sampleInterval: 100,
  gcBetweenSamples: false,
};

export class MemoryProfiler {
  private readonly options: Required<MemoryProfilerOptions>;
  private snapshots: MemorySnapshot[] = [];
  private isRecording: boolean = false;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(options: MemoryProfilerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  takeSnapshot(): MemorySnapshot {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      rss: memUsage.rss,
      timestamp: new Date(),
    };
  }

  startRecording(): void {
    if (this.isRecording) return;

    this.isRecording = true;
    this.snapshots = [this.takeSnapshot()];

    this.intervalId = setInterval(() => {
      if (this.options.gcBetweenSamples && global.gc) {
        global.gc();
      }
      this.snapshots.push(this.takeSnapshot());
    }, this.options.sampleInterval);
  }

  stopRecording(): MemoryMetrics {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isRecording = false;

    // Take final snapshot
    if (global.gc) {
      global.gc();
    }
    this.snapshots.push(this.takeSnapshot());

    return this.calculateMetrics();
  }

  async measureOperation<T>(operation: () => T | Promise<T>): Promise<{ result: T; metrics: MemoryMetrics }> {
    if (global.gc) {
      global.gc();
    }

    const initial = this.takeSnapshot();
    let peak = initial;

    // Start background sampling
    const samples: MemorySnapshot[] = [initial];
    const sampleInterval = setInterval(() => {
      const snapshot = this.takeSnapshot();
      samples.push(snapshot);
      if (snapshot.heapUsed > peak.heapUsed) {
        peak = snapshot;
      }
    }, 10);

    try {
      const result = await operation();

      clearInterval(sampleInterval);

      if (global.gc) {
        global.gc();
      }

      const final = this.takeSnapshot();
      samples.push(final);

      if (final.heapUsed > peak.heapUsed) {
        peak = final;
      }

      const metrics = this.calculateMetricsFromSnapshots(samples, initial, peak, final);

      return { result, metrics };
    } finally {
      clearInterval(sampleInterval);
    }
  }

  private calculateMetrics(): MemoryMetrics {
    if (this.snapshots.length < 2) {
      const snapshot = this.snapshots[0] ?? this.takeSnapshot();
      return {
        initial: snapshot,
        peak: snapshot,
        final: snapshot,
        snapshots: this.snapshots,
        growthRate: 0,
        leakSuspected: false,
      };
    }

    const initial = this.snapshots[0]!;
    const final = this.snapshots[this.snapshots.length - 1]!;
    const peak = this.snapshots.reduce((max, s) => (s.heapUsed > max.heapUsed ? s : max), initial);

    return this.calculateMetricsFromSnapshots([...this.snapshots], initial, peak, final);
  }

  private calculateMetricsFromSnapshots(
    snapshots: MemorySnapshot[],
    initial: MemorySnapshot,
    peak: MemorySnapshot,
    final: MemorySnapshot
  ): MemoryMetrics {
    // Calculate growth rate (MB per 100 operations based on time)
    const durationMs = final.timestamp.getTime() - initial.timestamp.getTime();
    const heapGrowthBytes = final.heapUsed - initial.heapUsed;
    const heapGrowthMB = heapGrowthBytes / (1024 * 1024);

    // Normalize to per-100-ops equivalent (assuming ~10ms per op)
    const estimatedOps = durationMs / 10;
    const growthRate = estimatedOps > 0 ? (heapGrowthMB / estimatedOps) * 100 : 0;

    // Check for monotonic increase pattern (potential leak)
    const leakSuspected = this.detectPotentialLeak(snapshots);

    return {
      initial,
      peak,
      final,
      snapshots,
      growthRate,
      leakSuspected,
    };
  }

  private detectPotentialLeak(snapshots: MemorySnapshot[]): boolean {
    if (snapshots.length < 5) return false;

    // Sample at intervals to check for consistent growth
    const sampleCount = Math.min(10, snapshots.length);
    const step = Math.floor(snapshots.length / sampleCount);
    const samples: number[] = [];

    for (let i = 0; i < snapshots.length; i += step) {
      samples.push(snapshots[i]!.heapUsed);
    }

    // Check if memory is monotonically increasing
    let increases = 0;
    for (let i = 1; i < samples.length; i++) {
      if (samples[i]! > samples[i - 1]!) {
        increases++;
      }
    }

    // If more than 80% of samples show increase, suspect a leak
    return increases / (samples.length - 1) > 0.8;
  }

  getHeapUsedMB(): number {
    return process.memoryUsage().heapUsed / (1024 * 1024);
  }

  formatMetrics(metrics: MemoryMetrics): string {
    const toMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2);

    return [
      'Memory Profile:',
      `  Initial Heap: ${toMB(metrics.initial.heapUsed)}MB`,
      `  Peak Heap: ${toMB(metrics.peak.heapUsed)}MB`,
      `  Final Heap: ${toMB(metrics.final.heapUsed)}MB`,
      `  Growth: ${toMB(metrics.final.heapUsed - metrics.initial.heapUsed)}MB`,
      `  Growth Rate: ${metrics.growthRate.toFixed(3)}MB per 100 ops`,
      `  Leak Suspected: ${metrics.leakSuspected ? 'Yes ⚠️' : 'No ✓'}`,
      `  Samples: ${metrics.snapshots.length}`,
    ].join('\n');
  }
}
