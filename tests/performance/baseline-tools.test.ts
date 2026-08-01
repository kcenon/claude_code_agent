import { describe, expect, it } from 'vitest';
import {
  benchmarkOperationName,
  evaluateRegressionGate,
  parseBenchmarkResults,
  type Baseline,
  type BenchmarkResult,
} from '../../scripts/performance/benchmark-data.js';

const operation =
  'tests/performance/benchmarks/graph-analysis.bench.ts > Graph Analysis Benchmarks > analyze() - 100 nodes > full graph analysis';

function baseline(overrides: Partial<Baseline> = {}): Baseline {
  return {
    operation,
    p50: 10,
    p95: 20,
    maxMemoryMB: 0,
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function result(overrides: Partial<BenchmarkResult> = {}): BenchmarkResult {
  return {
    name: operation,
    p50: 10,
    p95: 20,
    ...overrides,
  };
}

describe('benchmark result parsing', () => {
  it('uses stable group-qualified names and the shared percentile mapping', () => {
    const parsed = parseBenchmarkResults({
      files: [
        {
          filepath:
            '/home/runner/work/claude_code_agent/claude_code_agent/tests/performance/benchmarks/graph-analysis.bench.ts',
          groups: [
            {
              fullName:
                'tests/performance/benchmarks/graph-analysis.bench.ts > Graph Analysis Benchmarks > analyze() - 100 nodes',
              benchmarks: [
                {
                  name: 'full graph analysis',
                  mean: 11,
                  median: 10,
                  p75: 15,
                  p99: 20,
                  hz: 100,
                },
              ],
            },
          ],
        },
      ],
    });

    expect(parsed).toEqual([{ name: operation, p50: 10, p95: 20, hz: 100 }]);
  });

  it('normalizes Windows report paths to the same operation name', () => {
    expect(
      benchmarkOperationName(
        'D:\\a\\repo\\tests\\performance\\benchmarks\\graph-analysis.bench.ts',
        'D:\\a\\repo\\tests\\performance\\benchmarks\\graph-analysis.bench.ts > Graph Analysis Benchmarks > analyze() - 100 nodes',
        'full graph analysis'
      )
    ).toBe(operation);
  });

  it('rejects successful-looking entries that have no finite timings', () => {
    expect(() =>
      parseBenchmarkResults({
        files: [
          {
            filepath: 'tests/performance/benchmarks/io.bench.ts',
            groups: [
              {
                fullName: 'tests/performance/benchmarks/io.bench.ts > I/O',
                benchmarks: [{ name: 'write', median: null, p99: null }],
              },
            ],
          },
        ],
      })
    ).toThrow('has no valid p50/median timing');
  });

  it('rejects duplicate fully-qualified operation names', () => {
    const benchmark = { name: 'write', median: 1, p99: 2 };

    expect(() =>
      parseBenchmarkResults({
        files: [
          {
            filepath: 'tests/performance/benchmarks/io.bench.ts',
            groups: [
              {
                fullName: 'tests/performance/benchmarks/io.bench.ts > I/O',
                benchmarks: [benchmark, benchmark],
              },
            ],
          },
        ],
      })
    ).toThrow('Duplicate benchmark operation');
  });
});

describe('performance regression gate', () => {
  it('fails for an intentional critical regression', () => {
    const evaluation = evaluateRegressionGate([baseline()], [result({ p50: 12.1, p95: 20 })]);

    expect(evaluation.failed).toBe(true);
    expect(evaluation.regressions).toEqual([
      expect.objectContaining({ metric: 'p50', severity: 'critical' }),
    ]);
  });

  it('reports warnings without failing the gate', () => {
    const evaluation = evaluateRegressionGate([baseline()], [result({ p50: 11.5, p95: 20 })]);

    expect(evaluation.failed).toBe(false);
    expect(evaluation.regressions).toEqual([
      expect.objectContaining({ metric: 'p50', severity: 'warning' }),
    ]);
  });

  it('keeps the p99-derived upper-tail metric advisory', () => {
    const evaluation = evaluateRegressionGate([baseline()], [result({ p50: 10, p95: 100 })]);

    expect(evaluation.failed).toBe(false);
    expect(evaluation.regressions).toEqual([
      expect.objectContaining({ metric: 'p95', severity: 'warning' }),
    ]);
  });

  it('fails when current and baseline operation sets do not match', () => {
    const unbaselinedOperation = `${operation} changed`;
    const evaluation = evaluateRegressionGate(
      [baseline()],
      [result({ name: unbaselinedOperation })]
    );

    expect(evaluation.failed).toBe(true);
    expect(evaluation.missingBaselines).toEqual([unbaselinedOperation]);
    expect(evaluation.missingResults).toEqual([operation]);
  });
});
