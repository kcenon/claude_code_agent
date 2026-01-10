/**
 * Regression Detector - Compares benchmark results against baselines
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Baseline, BenchmarkResult, Regression, MemoryMetrics } from './types.js';

export interface RegressionThresholds {
  warning: number; // Percentage increase to trigger warning (e.g., 0.1 = 10%)
  critical: number; // Percentage increase to trigger critical (e.g., 0.2 = 20%)
}

const DEFAULT_THRESHOLDS: RegressionThresholds = {
  warning: 0.1, // 10% regression
  critical: 0.2, // 20% regression
};

export interface RegressionReport {
  passed: boolean;
  regressions: Regression[];
  summary: string;
  markdownSummary: string;
}

export class RegressionDetector {
  private baselines: Map<string, Baseline> = new Map();
  private readonly thresholds: RegressionThresholds;

  constructor(thresholds: RegressionThresholds = DEFAULT_THRESHOLDS) {
    this.thresholds = thresholds;
  }

  async loadBaselines(filePath: string): Promise<void> {
    try {
      const content = await readFile(filePath, 'utf-8');
      const data = JSON.parse(content) as { baselines: Baseline[] };

      this.baselines.clear();
      for (const baseline of data.baselines) {
        this.baselines.set(baseline.operation, {
          ...baseline,
          updatedAt: new Date(baseline.updatedAt),
        });
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist, start with empty baselines
        this.baselines.clear();
      } else {
        throw error;
      }
    }
  }

  async saveBaselines(filePath: string): Promise<void> {
    const data = {
      baselines: Array.from(this.baselines.values()),
      updatedAt: new Date().toISOString(),
    };

    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, JSON.stringify(data, null, 2));
  }

  updateBaseline(result: BenchmarkResult, maxMemoryMB?: number): void {
    this.baselines.set(result.operation, {
      operation: result.operation,
      p50: result.p50,
      p95: result.p95,
      maxMemoryMB: maxMemoryMB ?? 0,
      updatedAt: new Date(),
    });
  }

  check(results: BenchmarkResult[], memoryMetrics?: MemoryMetrics[]): RegressionReport {
    const regressions: Regression[] = [];

    for (const result of results) {
      const baseline = this.baselines.get(result.operation);
      if (!baseline) continue;

      // Check p50 regression
      const p50Change = (result.p50 - baseline.p50) / baseline.p50;
      if (p50Change > this.thresholds.warning) {
        regressions.push({
          operation: result.operation,
          metric: 'p50',
          baseline: baseline.p50,
          current: result.p50,
          percentChange: p50Change * 100,
          severity: p50Change > this.thresholds.critical ? 'critical' : 'warning',
        });
      }

      // Check p95 regression
      const p95Change = (result.p95 - baseline.p95) / baseline.p95;
      if (p95Change > this.thresholds.warning) {
        regressions.push({
          operation: result.operation,
          metric: 'p95',
          baseline: baseline.p95,
          current: result.p95,
          percentChange: p95Change * 100,
          severity: p95Change > this.thresholds.critical ? 'critical' : 'warning',
        });
      }
    }

    // Check memory regression if provided
    if (memoryMetrics) {
      for (const metrics of memoryMetrics) {
        // Memory regression check would go here
        // For now, we flag if leak is suspected
        if (metrics.leakSuspected) {
          regressions.push({
            operation: 'memory-leak-detection',
            metric: 'memory',
            baseline: 0,
            current: metrics.growthRate,
            percentChange: 100,
            severity: 'critical',
          });
        }
      }
    }

    const passed = regressions.filter((r) => r.severity === 'critical').length === 0;

    return {
      passed,
      regressions,
      summary: this.generateSummary(regressions),
      markdownSummary: this.generateMarkdownSummary(regressions, passed),
    };
  }

  private generateSummary(regressions: Regression[]): string {
    if (regressions.length === 0) {
      return 'No regressions detected. All benchmarks within acceptable thresholds.';
    }

    const warnings = regressions.filter((r) => r.severity === 'warning').length;
    const criticals = regressions.filter((r) => r.severity === 'critical').length;

    const parts: string[] = [];
    if (criticals > 0) {
      parts.push(`${criticals} critical regression(s)`);
    }
    if (warnings > 0) {
      parts.push(`${warnings} warning(s)`);
    }

    return `Performance issues detected: ${parts.join(', ')}`;
  }

  private generateMarkdownSummary(regressions: Regression[], passed: boolean): string {
    const lines: string[] = [];

    lines.push('## Performance Regression Check');
    lines.push('');

    if (passed) {
      lines.push('✅ **Status: PASSED**');
    } else {
      lines.push('❌ **Status: FAILED**');
    }
    lines.push('');

    if (regressions.length === 0) {
      lines.push('All benchmarks within acceptable thresholds.');
    } else {
      lines.push('### Detected Regressions');
      lines.push('');
      lines.push('| Operation | Metric | Baseline | Current | Change |');
      lines.push('|-----------|--------|----------|---------|--------|');

      for (const r of regressions) {
        const emoji = r.severity === 'critical' ? '🔴' : '🟡';
        lines.push(
          `| ${emoji} ${r.operation} | ${r.metric} | ${r.baseline.toFixed(2)}ms | ${r.current.toFixed(2)}ms | +${r.percentChange.toFixed(1)}% |`
        );
      }
    }

    return lines.join('\n');
  }

  hasBaseline(operation: string): boolean {
    return this.baselines.has(operation);
  }

  getBaseline(operation: string): Baseline | undefined {
    return this.baselines.get(operation);
  }

  getAllBaselines(): Baseline[] {
    return Array.from(this.baselines.values());
  }
}
