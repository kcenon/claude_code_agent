/**
 * Compare current Vitest benchmark results against the committed baseline.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateRegressionGate,
  parseBaselines,
  parseBenchmarkResults,
  type RegressionEvaluation,
} from './performance/benchmark-data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const baselinePath = join(rootDir, 'tests/performance/baselines/baseline-metrics.json');
const resultsPath = join(rootDir, 'perf-results/benchmark-results.json');
const reportPath = join(rootDir, 'perf-results/performance-report.md');

async function readJson(path: string, description: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, 'utf-8')) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read ${description} at ${path}: ${detail}`, { cause: error });
  }
}

function generateReport(evaluation: RegressionEvaluation): string {
  const lines: string[] = [
    '# Performance Regression Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
  ];
  const criticals = evaluation.regressions.filter(
    (regression) => regression.severity === 'critical'
  );
  const warnings = evaluation.regressions.filter((regression) => regression.severity === 'warning');

  if (evaluation.failed) {
    lines.push('## Status: ❌ FAILED', '');
  } else if (warnings.length > 0) {
    lines.push('## Status: ⚠️ WARNING', '');
  } else {
    lines.push('## Status: ✅ PASSED', '');
  }

  if (evaluation.missingBaselines.length > 0 || evaluation.missingResults.length > 0) {
    lines.push('### Baseline Coverage Errors', '');

    for (const operation of evaluation.missingBaselines) {
      lines.push(`- Current benchmark has no baseline: \`${operation}\``);
    }
    for (const operation of evaluation.missingResults) {
      lines.push(`- Baseline has no current benchmark result: \`${operation}\``);
    }
    lines.push('');
  }

  if (evaluation.regressions.length > 0) {
    lines.push(
      '### Regressions Detected',
      '',
      '| Operation | Metric | Baseline | Current | Change | Severity |',
      '|-----------|--------|----------|---------|--------|----------|'
    );

    for (const regression of evaluation.regressions) {
      const emoji = regression.severity === 'critical' ? '🔴' : '🟡';
      lines.push(
        `| ${regression.operation} | ${regression.metric} | ${regression.baseline.toFixed(4)}ms | ${regression.current.toFixed(4)}ms | +${regression.percentChange.toFixed(1)}% | ${emoji} ${regression.severity} |`
      );
    }

    lines.push('', `**Summary:** ${criticals.length} critical, ${warnings.length} warnings`, '');
  } else if (!evaluation.failed) {
    lines.push('No performance regressions detected.', '');
  }

  return lines.join('\n');
}

async function main(): Promise<void> {
  console.log('Checking for performance regressions...\n');

  const [baselineData, resultsData] = await Promise.all([
    readJson(baselinePath, 'performance baselines'),
    readJson(resultsPath, 'benchmark results'),
  ]);
  const baselines = parseBaselines(baselineData);
  const results = parseBenchmarkResults(resultsData);
  const evaluation = evaluateRegressionGate(baselines, results);
  const report = generateReport(evaluation);

  console.log(report);
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, report);

  if (evaluation.failed) {
    const criticalCount = evaluation.regressions.filter(
      (regression) => regression.severity === 'critical'
    ).length;
    const coverageErrorCount =
      evaluation.missingBaselines.length + evaluation.missingResults.length;
    console.error(
      `\n❌ Performance gate failed: ${criticalCount} critical regression(s), ${coverageErrorCount} baseline coverage error(s).`
    );
    process.exitCode = 1;
    return;
  }

  if (evaluation.regressions.length > 0) {
    console.warn(`\n⚠️ Found ${evaluation.regressions.length} warning(s). Review recommended.`);
  } else {
    console.log('\n✅ No regressions detected.');
  }
}

main().catch((error) => {
  console.error('Error running regression check:', error);
  process.exitCode = 1;
});
