/**
 * Update Baseline Script
 *
 * Updates baseline metrics from the latest benchmark results
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
}

async function loadBenchmarkResults(): Promise<BenchmarkResult[]> {
  const resultsPath = join(rootDir, 'perf-results/benchmark-results.json');

  try {
    const content = await readFile(resultsPath, 'utf-8');
    const data = JSON.parse(content);

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
    console.error('No benchmark results found. Run benchmarks first.');
    process.exit(1);
  }
}

async function loadExistingBaselines(): Promise<Map<string, Baseline>> {
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
    return new Map();
  }
}

async function main(): Promise<void> {
  console.log('Updating baseline metrics...\n');

  const results = await loadBenchmarkResults();
  const existingBaselines = await loadExistingBaselines();

  const now = new Date().toISOString();
  let updated = 0;
  let added = 0;

  for (const result of results) {
    if (result.p50 === undefined || result.p95 === undefined) continue;

    const existing = existingBaselines.get(result.name);
    if (existing) {
      updated++;
    } else {
      added++;
    }

    existingBaselines.set(result.name, {
      operation: result.name,
      p50: result.p50,
      p95: result.p95,
      maxMemoryMB: existing?.maxMemoryMB ?? 0,
      updatedAt: now,
    });
  }

  const baselines = Array.from(existingBaselines.values());
  const data = {
    baselines,
    updatedAt: now,
  };

  const baselinePath = join(rootDir, 'tests/performance/baselines/baseline-metrics.json');
  await mkdir(dirname(baselinePath), { recursive: true });
  await writeFile(baselinePath, JSON.stringify(data, null, 2));

  console.log(`✅ Baseline updated successfully!`);
  console.log(`   - Updated: ${updated} metrics`);
  console.log(`   - Added: ${added} new metrics`);
  console.log(`   - Total: ${baselines.length} baselines`);
}

main().catch((error) => {
  console.error('Error updating baselines:', error);
  process.exit(1);
});
