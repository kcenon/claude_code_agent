/**
 * Shared parsing and comparison helpers for the performance regression gate.
 *
 * Vitest's benchmark JSON contains a file path, a full suite name, and a leaf
 * benchmark name. The full operation key uses all three components so repeated
 * leaf names (for example, "full graph analysis") remain unambiguous.
 */

export interface Baseline {
  operation: string;
  p50: number;
  p95: number;
  maxMemoryMB: number;
  updatedAt: string;
}

export interface BenchmarkResult {
  name: string;
  p50: number;
  p95: number;
  hz?: number;
}

export interface Regression {
  operation: string;
  metric: 'p50' | 'p95';
  baseline: number;
  current: number;
  percentChange: number;
  severity: 'warning' | 'critical';
}

export interface RegressionEvaluation {
  regressions: Regression[];
  missingBaselines: string[];
  missingResults: string[];
  failed: boolean;
}

export const WARNING_THRESHOLD = 0.1;
export const CRITICAL_THRESHOLD = 0.2;

type JsonObject = Record<string, unknown>;

function asObject(value: unknown, context: string): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${context} must be an object`);
  }
  return value as JsonObject;
}

function asArray(value: unknown, context: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${context} must be an array`);
  }
  return value;
}

function asString(value: unknown, context: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${context} must be a non-empty string`);
  }
  return value;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function requiredPositiveNumber(value: unknown, context: string): number {
  const number = finiteNumber(value);
  if (number === undefined || number <= 0) {
    throw new Error(`${context} must be a positive finite number`);
  }
  return number;
}

function normalizeSlashes(value: string): string {
  return value.replaceAll('\\', '/');
}

function stableBenchmarkFilepath(filepath: string): string {
  const normalized = normalizeSlashes(filepath);
  const testsMarker = '/tests/';
  const testsIndex = normalized.lastIndexOf(testsMarker);

  if (testsIndex >= 0) {
    return normalized.slice(testsIndex + 1);
  }

  return normalized.replace(/^\.\//, '');
}

/** Build a stable, unique operation name from a Vitest benchmark entry. */
export function benchmarkOperationName(
  filepath: string,
  fullName: string,
  benchmarkName: string
): string {
  const normalizedFilepath = normalizeSlashes(filepath);
  const stableFilepath = stableBenchmarkFilepath(filepath);
  const normalizedFullName = normalizeSlashes(fullName);

  let suiteName = normalizedFullName;
  for (const prefix of [normalizedFilepath, stableFilepath]) {
    if (suiteName === prefix) {
      suiteName = '';
      break;
    }
    if (suiteName.startsWith(`${prefix} > `)) {
      suiteName = suiteName.slice(prefix.length + 3);
      break;
    }
  }

  return [stableFilepath, suiteName, benchmarkName]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join(' > ');
}

/**
 * Parse Vitest's native benchmark JSON report.
 *
 * Tinybench exposes `median` and `p99`, not p50 and p95. Median is the exact
 * p50. We intentionally use p99 as a conservative upper-tail proxy for p95;
 * both baseline generation and regression checking call this same parser.
 */
export function parseBenchmarkResults(data: unknown): BenchmarkResult[] {
  const root = asObject(data, 'Benchmark report');
  const files = asArray(root.files, 'Benchmark report files');
  const results: BenchmarkResult[] = [];
  const operationNames = new Set<string>();

  for (const [fileIndex, rawFile] of files.entries()) {
    const file = asObject(rawFile, `Benchmark file ${fileIndex}`);
    const filepath = asString(file.filepath, `Benchmark file ${fileIndex} filepath`);
    const groups = asArray(file.groups, `Benchmark file ${filepath} groups`);

    for (const [groupIndex, rawGroup] of groups.entries()) {
      const group = asObject(rawGroup, `Benchmark group ${groupIndex} in ${filepath}`);
      const fullName = asString(
        group.fullName,
        `Benchmark group ${groupIndex} fullName in ${filepath}`
      );
      const benchmarks = asArray(group.benchmarks, `Benchmark group ${fullName} benchmarks`);

      for (const [benchmarkIndex, rawBenchmark] of benchmarks.entries()) {
        const benchmark = asObject(
          rawBenchmark,
          `Benchmark ${benchmarkIndex} in group ${fullName}`
        );
        const leafName = asString(
          benchmark.name,
          `Benchmark ${benchmarkIndex} name in group ${fullName}`
        );
        const operation = benchmarkOperationName(filepath, fullName, leafName);

        if (operationNames.has(operation)) {
          throw new Error(`Duplicate benchmark operation: ${operation}`);
        }
        operationNames.add(operation);

        const p50 =
          finiteNumber(benchmark.p50) ??
          finiteNumber(benchmark.median) ??
          finiteNumber(benchmark.mean);
        const p95 = finiteNumber(benchmark.p95) ?? finiteNumber(benchmark.p99);

        if (p50 === undefined || p50 <= 0) {
          throw new Error(`Benchmark ${operation} has no valid p50/median timing`);
        }
        if (p95 === undefined || p95 <= 0) {
          throw new Error(`Benchmark ${operation} has no valid p95/p99 timing`);
        }

        const hz = finiteNumber(benchmark.hz);
        results.push({
          name: operation,
          p50,
          p95,
          ...(hz === undefined ? {} : { hz }),
        });
      }
    }
  }

  if (results.length === 0) {
    throw new Error('Benchmark report contains no benchmark results');
  }

  return results;
}

/** Parse and validate the committed baseline file. */
export function parseBaselines(data: unknown): Baseline[] {
  const root = asObject(data, 'Baseline file');
  const rawBaselines = asArray(root.baselines, 'Baseline file baselines');
  const baselines: Baseline[] = [];
  const operationNames = new Set<string>();

  for (const [index, rawBaseline] of rawBaselines.entries()) {
    const baseline = asObject(rawBaseline, `Baseline ${index}`);
    const operation = asString(baseline.operation, `Baseline ${index} operation`);

    if (operationNames.has(operation)) {
      throw new Error(`Duplicate baseline operation: ${operation}`);
    }
    operationNames.add(operation);

    const maxMemoryMB = finiteNumber(baseline.maxMemoryMB);
    if (maxMemoryMB === undefined || maxMemoryMB < 0) {
      throw new Error(`Baseline ${operation} maxMemoryMB must be a non-negative finite number`);
    }

    baselines.push({
      operation,
      p50: requiredPositiveNumber(baseline.p50, `Baseline ${operation} p50`),
      p95: requiredPositiveNumber(baseline.p95, `Baseline ${operation} p95`),
      maxMemoryMB,
      updatedAt: asString(baseline.updatedAt, `Baseline ${operation} updatedAt`),
    });
  }

  if (baselines.length === 0) {
    throw new Error('Baseline file contains no baselines');
  }

  return baselines;
}

/** Compare a complete current benchmark set against a complete baseline set. */
export function evaluateRegressionGate(
  baselines: Baseline[],
  results: BenchmarkResult[]
): RegressionEvaluation {
  const baselineByOperation = new Map(
    baselines.map((baseline) => [baseline.operation, baseline] as const)
  );
  const resultByOperation = new Map(results.map((result) => [result.name, result] as const));
  const regressions: Regression[] = [];

  for (const result of results) {
    const baseline = baselineByOperation.get(result.name);
    if (!baseline) continue;

    for (const metric of ['p50', 'p95'] as const) {
      const current = result[metric];
      const baselineValue = baseline[metric];
      const percentChange = (current - baselineValue) / baselineValue;

      if (percentChange > WARNING_THRESHOLD) {
        regressions.push({
          operation: result.name,
          metric,
          baseline: baselineValue,
          current,
          percentChange: percentChange * 100,
          // Median/p50 is stable enough to gate CI. Vitest only exposes p99 as
          // our p95 proxy, and hosted-runner tail outliers are advisory.
          severity: metric === 'p50' && percentChange > CRITICAL_THRESHOLD ? 'critical' : 'warning',
        });
      }
    }
  }

  const missingBaselines = results
    .filter((result) => !baselineByOperation.has(result.name))
    .map((result) => result.name)
    .sort();
  const missingResults = baselines
    .filter((baseline) => !resultByOperation.has(baseline.operation))
    .map((baseline) => baseline.operation)
    .sort();
  const hasCriticalRegression = regressions.some(
    (regression) => regression.severity === 'critical'
  );

  return {
    regressions,
    missingBaselines,
    missingResults,
    failed: hasCriticalRegression || missingBaselines.length > 0 || missingResults.length > 0,
  };
}
