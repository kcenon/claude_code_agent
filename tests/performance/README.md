# Performance Test Suite

This directory contains comprehensive performance tests for the AD-SDLC system, including benchmarks, memory profiling, scalability tests, and regression detection.

## Directory Structure

```
tests/performance/
├── benchmarks/           # Vitest benchmark tests
│   ├── graph-analysis.bench.ts
│   ├── scratchpad-io.bench.ts
│   └── state-persistence.bench.ts
├── memory/               # Memory profiling tests
│   ├── worker-memory.test.ts
│   └── leak-detection.test.ts
├── scalability/          # Scalability tests
│   └── scalability.test.ts
├── fixtures/             # Test data generators
│   └── graph-generator.ts
├── utils/                # Testing utilities
│   ├── benchmark-runner.ts
│   ├── memory-profiler.ts
│   ├── metrics-collector.ts
│   ├── regression-detector.ts
│   └── types.ts
└── baselines/            # Baseline metrics for regression detection
    └── baseline-metrics.json
```

## Running Tests

### Run All Performance Tests

```bash
npm run test:perf
```

### Run Benchmarks

```bash
npm run test:bench
```

### Run Memory Profiling Tests

```bash
npm run test:memory
```

For accurate memory measurements, run with exposed GC:

```bash
node --expose-gc ./node_modules/.bin/vitest run --config vitest.perf.config.ts tests/performance/memory/
```

### Run Scalability Tests

```bash
npm run test:scalability
```

## Regression Detection

### Check for Regressions

After running benchmarks, check for regressions against baseline:

```bash
npm run perf:check
```

This will:
- Compare current benchmark results against saved baselines
- Report warnings for >10% degradation
- Fail build for >20% degradation
- Generate a performance report in `perf-results/`

### Update Baselines

To update baseline metrics after intentional performance changes:

```bash
npm run perf:update-baseline
```

## Performance Targets

### Graph Analysis

| Operation | Target p95 |
|-----------|------------|
| 100-node analysis | < 100ms |
| 500-node analysis | < 500ms |
| 1000-node analysis | < 2000ms |

### Memory Usage

| Operation | Target Peak Memory |
|-----------|-------------------|
| 100-node graph | < 50MB |
| 500-node graph | < 100MB |
| 1000-node graph | < 200MB |

### Memory Leak Prevention

- Growth rate should be < 1MB per 100 operations
- No monotonic memory increase detected over extended runs

## CI Integration

Performance tests run automatically on:
- Push to `main` branch
- Pull requests targeting `main`

The CI workflow includes:
1. **Benchmark job**: Runs all benchmarks and checks for regressions
2. **Memory profile job**: Runs memory tests with `--expose-gc`
3. **Scalability job**: Runs scalability tests

Results are uploaded as artifacts and reported in PR comments.

## Writing New Tests

### Adding a Benchmark

```typescript
import { describe, bench } from 'vitest';

describe('My Benchmarks', () => {
  bench('operation name', () => {
    // Code to benchmark
  });
});
```

### Adding a Memory Test

```typescript
import { MemoryProfiler } from '../utils/memory-profiler.js';

const profiler = new MemoryProfiler();

const { metrics } = await profiler.measureOperation(async () => {
  // Code to profile
});

expect(metrics.leakSuspected).toBe(false);
```

### Adding a Scalability Test

```typescript
import { BenchmarkRunner } from '../utils/benchmark-runner.js';

const runner = new BenchmarkRunner({ iterations: 10 });

const result = await runner.run(() => {
  // Code to measure
}, 'operation-name');

expect(result.p95).toBeLessThan(threshold);
```

## Utilities Reference

### BenchmarkRunner

Runs operations and calculates statistics (p50, p95, p99, ops/sec).

```typescript
const runner = new BenchmarkRunner({ iterations: 100, warmupIterations: 10 });
const result = await runner.run(operation, 'name');
```

### MemoryProfiler

Tracks memory usage and detects potential leaks.

```typescript
const profiler = new MemoryProfiler();
const { metrics } = await profiler.measureOperation(operation);
```

### MetricsCollector

Aggregates results and generates reports.

```typescript
const collector = new MetricsCollector();
collector.addBenchmark(result);
const report = collector.generateReport();
```

### RegressionDetector

Compares results against baselines.

```typescript
const detector = new RegressionDetector();
await detector.loadBaselines(path);
const report = detector.check(results);
```
