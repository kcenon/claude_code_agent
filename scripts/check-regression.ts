/**
 * Regression Check Script
 *
 * Compares current benchmark results against baseline and reports regressions
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

interface Baseline {
  operation: string;
  p50: number;
  p95: number;
  maxMemoryMB: number;
  updatedAt: string;
}

interface BenchmarkResult {
  name: string;
  p50?: number;
  p95?: number;
  hz?: number; // ops per second
}

interface Regression {
  operation: string;
  metric: string;
  baseline: number;
  current: number;
  percentChange: number;
  severity: 'warning' | 'critical';
}

const WARNING_THRESHOLD = 0.1; // 10%
const CRITICAL_THRESHOLD = 0.2; // 20%

async function loadBaselines(): Promise<Map<string, Baseline>> {
  const baselinePath = join(rootDir, 'tests/performance/baselines/baseline-metrics.json');

  try {
    const content = await readFile(baselinePath, 'utf-8');
    const data = JSON.parse(content) as { baselines: Baseline[] };
    const map = new Map<string, Baseline>();
    for (const baseline of data.baselines) {
      map.set(baseline.operation, baseline);
    }
    return map;
  } catch {
    console.warn('No baseline file found. Skipping regression check.');
    return new Map();
  }
}

async function loadBenchmarkResults(): Promise<BenchmarkResult[]> {
  const resultsPath = join(rootDir, 'perf-results/benchmark-results.json');

  try {
    const content = await readFile(resultsPath, 'utf-8');
    const data = JSON.parse(content);

    // Handle vitest bench output format
    if (data.testResults) {
      return data.testResults.flatMap((tr: { assertionResults: BenchmarkResult[] }) =>
        tr.assertionResults.map((ar: BenchmarkResult) => ({
          name: ar.name,
          p50: ar.p50,
          p95: ar.p95,
        }))
      );
    }

    return data as BenchmarkResult[];
  } catch {
    console.warn('No benchmark results found. Run benchmarks first.');
    return [];
  }
}

function checkRegressions(baselines: Map<string, Baseline>, results: BenchmarkResult[]): Regression[] {
  const regressions: Regression[] = [];

  for (const result of results) {
    const baseline = baselines.get(result.name);
    if (!baseline) continue;

    // Check p50 regression
    if (result.p50 !== undefined) {
      const p50Change = (result.p50 - baseline.p50) / baseline.p50;
      if (p50Change > WARNING_THRESHOLD) {
        regressions.push({
          operation: result.name,
          metric: 'p50',
          baseline: baseline.p50,
          current: result.p50,
          percentChange: p50Change * 100,
          severity: p50Change > CRITICAL_THRESHOLD ? 'critical' : 'warning',
        });
      }
    }

    // Check p95 regression
    if (result.p95 !== undefined) {
      const p95Change = (result.p95 - baseline.p95) / baseline.p95;
      if (p95Change > WARNING_THRESHOLD) {
        regressions.push({
          operation: result.name,
          metric: 'p95',
          baseline: baseline.p95,
          current: result.p95,
          percentChange: p95Change * 100,
          severity: p95Change > CRITICAL_THRESHOLD ? 'critical' : 'warning',
        });
      }
    }
  }

  return regressions;
}

function generateReport(regressions: Regression[]): string {
  const lines: string[] = [];

  lines.push('# Performance Regression Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  if (regressions.length === 0) {
    lines.push('## Status: ✅ PASSED');
    lines.push('');
    lines.push('No performance regressions detected.');
  } else {
    const criticals = regressions.filter((r) => r.severity === 'critical');
    const warnings = regressions.filter((r) => r.severity === 'warning');

    if (criticals.length > 0) {
      lines.push('## Status: ❌ FAILED');
    } else {
      lines.push('## Status: ⚠️ WARNING');
    }
    lines.push('');

    lines.push('### Regressions Detected');
    lines.push('');
    lines.push('| Operation | Metric | Baseline | Current | Change | Severity |');
    lines.push('|-----------|--------|----------|---------|--------|----------|');

    for (const r of regressions) {
      const emoji = r.severity === 'critical' ? '🔴' : '🟡';
      lines.push(
        `| ${r.operation} | ${r.metric} | ${r.baseline.toFixed(2)}ms | ${r.current.toFixed(2)}ms | +${r.percentChange.toFixed(1)}% | ${emoji} ${r.severity} |`
      );
    }

    lines.push('');
    lines.push(`**Summary:** ${criticals.length} critical, ${warnings.length} warnings`);
  }

  return lines.join('\n');
}

async function main(): Promise<void> {
  console.log('Checking for performance regressions...\n');

  const baselines = await loadBaselines();
  if (baselines.size === 0) {
    console.log('No baselines to compare against. Exiting.');
    process.exit(0);
  }

  const results = await loadBenchmarkResults();
  if (results.length === 0) {
    console.log('No benchmark results to check. Run benchmarks first.');
    process.exit(0);
  }

  const regressions = checkRegressions(baselines, results);
  const report = generateReport(regressions);

  console.log(report);

  // Save report
  const reportDir = join(rootDir, 'perf-results');
  await mkdir(reportDir, { recursive: true });
  await writeFile(join(reportDir, 'performance-report.md'), report);

  // Exit with error if critical regressions found
  const criticals = regressions.filter((r) => r.severity === 'critical');
  if (criticals.length > 0) {
    console.error(`\n❌ Found ${criticals.length} critical regression(s). Build failed.`);
    process.exit(1);
  }

  if (regressions.length > 0) {
    console.warn(`\n⚠️ Found ${regressions.length} warning(s). Review recommended.`);
  } else {
    console.log('\n✅ No regressions detected.');
  }
}

main().catch((error) => {
  console.error('Error running regression check:', error);
  process.exit(1);
});
