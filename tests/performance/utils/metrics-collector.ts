/**
 * Metrics Collector - Collects and aggregates performance metrics
 */

import * as os from 'node:os';
import type {
  BenchmarkResult,
  MemorySnapshot,
  EnvironmentInfo,
  PerformanceReport,
  ReportSummary,
  Regression,
  MemoryMetrics,
} from './types.js';

export class MetricsCollector {
  private benchmarks: BenchmarkResult[] = [];
  private memoryMetrics: MemoryMetrics[] = [];
  private regressions: Regression[] = [];

  addBenchmark(result: BenchmarkResult): void {
    this.benchmarks.push(result);
  }

  addMemoryMetrics(metrics: MemoryMetrics): void {
    this.memoryMetrics.push(metrics);
  }

  addRegression(regression: Regression): void {
    this.regressions.push(regression);
  }

  getEnvironmentInfo(): EnvironmentInfo {
    const cpus = os.cpus();
    return {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cpuModel: cpus[0]?.model ?? 'unknown',
      cpuCount: cpus.length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
    };
  }

  takeMemorySnapshot(): MemorySnapshot {
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

  generateReport(): PerformanceReport {
    const summary = this.calculateSummary();
    return {
      timestamp: new Date(),
      environment: this.getEnvironmentInfo(),
      benchmarks: [...this.benchmarks],
      memoryMetrics: [...this.memoryMetrics],
      regressions: [...this.regressions],
      summary,
    };
  }

  private calculateSummary(): ReportSummary {
    const warnings = this.regressions.filter((r) => r.severity === 'warning').length;
    const criticalIssues = this.regressions.filter((r) => r.severity === 'critical').length;

    let overallStatus: 'pass' | 'warning' | 'fail' = 'pass';
    if (criticalIssues > 0) {
      overallStatus = 'fail';
    } else if (warnings > 0) {
      overallStatus = 'warning';
    }

    return {
      totalBenchmarks: this.benchmarks.length,
      passed: this.benchmarks.length - this.regressions.length,
      regressions: this.regressions.length,
      warnings,
      criticalIssues,
      overallStatus,
    };
  }

  reset(): void {
    this.benchmarks = [];
    this.memoryMetrics = [];
    this.regressions = [];
  }

  formatReportAsMarkdown(): string {
    const report = this.generateReport();
    const lines: string[] = [];

    lines.push('# Performance Test Report');
    lines.push('');
    lines.push(`**Generated:** ${report.timestamp.toISOString()}`);
    lines.push(`**Status:** ${report.summary.overallStatus.toUpperCase()}`);
    lines.push('');

    lines.push('## Environment');
    lines.push('');
    lines.push(`- **Node.js:** ${report.environment.nodeVersion}`);
    lines.push(`- **Platform:** ${report.environment.platform} (${report.environment.arch})`);
    lines.push(`- **CPU:** ${report.environment.cpuModel} (${report.environment.cpuCount} cores)`);
    lines.push(`- **Memory:** ${Math.round(report.environment.totalMemory / (1024 * 1024 * 1024))}GB`);
    lines.push('');

    lines.push('## Summary');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Total Benchmarks | ${report.summary.totalBenchmarks} |`);
    lines.push(`| Passed | ${report.summary.passed} |`);
    lines.push(`| Regressions | ${report.summary.regressions} |`);
    lines.push(`| Warnings | ${report.summary.warnings} |`);
    lines.push(`| Critical Issues | ${report.summary.criticalIssues} |`);
    lines.push('');

    if (report.benchmarks.length > 0) {
      lines.push('## Benchmark Results');
      lines.push('');
      lines.push('| Operation | p50 (ms) | p95 (ms) | ops/sec |');
      lines.push('|-----------|----------|----------|---------|');
      for (const b of report.benchmarks) {
        lines.push(
          `| ${b.operation} | ${b.p50.toFixed(2)} | ${b.p95.toFixed(2)} | ${b.opsPerSecond.toFixed(0)} |`
        );
      }
      lines.push('');
    }

    if (report.regressions.length > 0) {
      lines.push('## Regressions');
      lines.push('');
      for (const r of report.regressions) {
        const emoji = r.severity === 'critical' ? '🔴' : '🟡';
        lines.push(
          `${emoji} **${r.operation}** (${r.metric}): ${r.baseline.toFixed(2)} → ${r.current.toFixed(2)} (${r.percentChange > 0 ? '+' : ''}${r.percentChange.toFixed(1)}%)`
        );
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
