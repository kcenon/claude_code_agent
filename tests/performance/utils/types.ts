/**
 * Performance testing types and interfaces
 */

export interface BenchmarkResult {
  name: string;
  operation: string;
  iterations: number;
  totalTime: number;
  meanTime: number;
  medianTime: number;
  p50: number;
  p95: number;
  p99: number;
  minTime: number;
  maxTime: number;
  stdDev: number;
  opsPerSecond: number;
  timestamp: Date;
}

export interface MemorySnapshot {
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  rss: number;
  timestamp: Date;
}

export interface MemoryMetrics {
  initial: MemorySnapshot;
  peak: MemorySnapshot;
  final: MemorySnapshot;
  snapshots: MemorySnapshot[];
  growthRate: number; // MB per 100 operations
  leakSuspected: boolean;
}

export interface PerformanceReport {
  timestamp: Date;
  environment: EnvironmentInfo;
  benchmarks: BenchmarkResult[];
  memoryMetrics: MemoryMetrics[];
  regressions: Regression[];
  summary: ReportSummary;
}

export interface EnvironmentInfo {
  nodeVersion: string;
  platform: string;
  arch: string;
  cpuModel: string;
  cpuCount: number;
  totalMemory: number;
  freeMemory: number;
}

export interface Baseline {
  operation: string;
  p50: number;
  p95: number;
  maxMemoryMB: number;
  updatedAt: Date;
}

export interface Regression {
  operation: string;
  metric: 'p50' | 'p95' | 'memory';
  baseline: number;
  current: number;
  percentChange: number;
  severity: 'warning' | 'critical';
}

export interface ReportSummary {
  totalBenchmarks: number;
  passed: number;
  regressions: number;
  warnings: number;
  criticalIssues: number;
  overallStatus: 'pass' | 'warning' | 'fail';
}

export interface ScalabilityResult {
  size: number;
  duration: number;
  memoryUsed: number;
  throughput: number;
  scalingFactor: number;
}
