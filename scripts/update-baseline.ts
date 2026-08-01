/**
 * Regenerate performance baselines from Vitest's native benchmark JSON report.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseBaselines,
  parseBenchmarkResults,
  type Baseline,
} from './performance/benchmark-data.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const baselinePath = join(rootDir, 'tests/performance/baselines/baseline-metrics.json');
const resultsPath = join(rootDir, 'perf-results/benchmark-results.json');

async function readJson(path: string, description: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, 'utf-8')) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read ${description} at ${path}: ${detail}`, { cause: error });
  }
}

async function loadExistingBaselines(): Promise<Map<string, Baseline>> {
  try {
    const data = await readJson(baselinePath, 'existing performance baselines');
    return new Map(parseBaselines(data).map((baseline) => [baseline.operation, baseline]));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).cause) {
      const cause = (error as Error & { cause?: NodeJS.ErrnoException }).cause;
      if (cause?.code === 'ENOENT') return new Map();
    }
    throw error;
  }
}

async function main(): Promise<void> {
  console.log('Updating baseline metrics...\n');

  const results = parseBenchmarkResults(await readJson(resultsPath, 'benchmark results'));
  const existingBaselines = await loadExistingBaselines();
  const now = new Date().toISOString();
  const baselines = results
    .map<Baseline>((result) => ({
      operation: result.name,
      p50: result.p50,
      p95: result.p95,
      maxMemoryMB: existingBaselines.get(result.name)?.maxMemoryMB ?? 0,
      updatedAt: now,
    }))
    .sort((left, right) => left.operation.localeCompare(right.operation));
  const baselineOperations = new Set(baselines.map((baseline) => baseline.operation));
  const updated = baselines.filter((baseline) => existingBaselines.has(baseline.operation)).length;
  const removed = [...existingBaselines.keys()].filter(
    (operation) => !baselineOperations.has(operation)
  ).length;
  const data = {
    baselines,
    updatedAt: now,
    notes:
      'Generated from Vitest benchmark output on the designated CI runner. p50 uses median; p95 uses Vitest/Tinybench p99 as a conservative upper-tail proxy.',
  };

  await mkdir(dirname(baselinePath), { recursive: true });
  await writeFile(baselinePath, `${JSON.stringify(data, null, 2)}\n`);

  console.log('✅ Baseline updated successfully!');
  console.log(`   - Updated: ${updated} metrics`);
  console.log(`   - Added: ${baselines.length - updated} new metrics`);
  console.log(`   - Removed: ${removed} stale metrics`);
  console.log(`   - Total: ${baselines.length} baselines`);
}

main().catch((error) => {
  console.error('Error updating baselines:', error);
  process.exitCode = 1;
});
