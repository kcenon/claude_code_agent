/**
 * Graph Analysis Benchmarks
 *
 * Benchmarks for dependency graph analysis operations:
 * - Graph loading and parsing
 * - Topological sort
 * - Critical path calculation
 * - Cycle detection
 */

import { describe, bench, beforeAll } from 'vitest';
import { PriorityAnalyzer } from '../../../src/controller/index.js';
import { generateIssueGraph } from '../fixtures/graph-generator.js';
import type { RawDependencyGraph } from '../../../src/controller/types.js';

describe('Graph Analysis Benchmarks', () => {
  const graphs: Map<number, RawDependencyGraph> = new Map();

  beforeAll(() => {
    // Pre-generate graphs to avoid generation overhead in benchmarks
    for (const size of [100, 500, 1000]) {
      graphs.set(size, generateIssueGraph(size));
    }
  });

  describe('analyze() - 100 nodes', () => {
    const graph = generateIssueGraph(100);

    bench('full graph analysis', () => {
      const analyzer = new PriorityAnalyzer();
      analyzer.analyze(graph);
    });

    bench('with custom weights', () => {
      const analyzer = new PriorityAnalyzer({
        weights: { P0: 200, P1: 150, P2: 100, P3: 50 },
        criticalPathBonus: 100,
        quickWinBonus: 50,
      });
      analyzer.analyze(graph);
    });
  });

  describe('analyze() - 500 nodes', () => {
    const graph = generateIssueGraph(500);

    bench('full graph analysis', () => {
      const analyzer = new PriorityAnalyzer();
      analyzer.analyze(graph);
    });
  });

  describe('analyze() - 1000 nodes', () => {
    const graph = generateIssueGraph(1000);

    bench('full graph analysis', () => {
      const analyzer = new PriorityAnalyzer();
      analyzer.analyze(graph);
    });
  });

  describe('Critical Path Calculation', () => {
    const sizes = [100, 500, 1000] as const;

    for (const size of sizes) {
      const graph = generateIssueGraph(size, { density: 0.2 });

      bench(`critical path - ${size} nodes`, () => {
        const analyzer = new PriorityAnalyzer();
        const result = analyzer.analyze(graph);
        result.criticalPath;
      });
    }
  });

  describe('Cycle Detection', () => {
    // Create graphs with potential cycles
    const graphWithCycle = (() => {
      const graph = generateIssueGraph(100);
      // Add a cycle by connecting last to first
      const nodes = graph.nodes;
      const edges = [
        ...graph.edges,
        { from: nodes[0]!.id, to: nodes[nodes.length - 1]!.id },
      ];
      return { nodes, edges };
    })();

    bench('detect cycles - 100 nodes with cycle', () => {
      const analyzer = new PriorityAnalyzer();
      analyzer.analyze(graphWithCycle);
      analyzer.hasCycles();
    });

    const graphNoCycle = generateIssueGraph(100);

    bench('detect cycles - 100 nodes no cycle', () => {
      const analyzer = new PriorityAnalyzer();
      analyzer.analyze(graphNoCycle);
      analyzer.hasCycles();
    });
  });

  describe('Dependency Queries', () => {
    const graph = generateIssueGraph(500);
    const analyzer = new PriorityAnalyzer();
    analyzer.analyze(graph);
    const nodes = graph.nodes;

    bench('getDependencies', () => {
      for (let i = 0; i < 10; i++) {
        const node = nodes[Math.floor(Math.random() * nodes.length)]!;
        analyzer.getDependencies(node.id);
      }
    });

    bench('getDependents', () => {
      for (let i = 0; i < 10; i++) {
        const node = nodes[Math.floor(Math.random() * nodes.length)]!;
        analyzer.getDependents(node.id);
      }
    });

    bench('getTransitiveDependencies', () => {
      // Pick a node from the middle
      const middleNode = nodes[Math.floor(nodes.length / 2)]!;
      analyzer.getTransitiveDependencies(middleNode.id);
    });
  });

  describe('Queue Operations', () => {
    const graph = generateIssueGraph(500);

    bench('getNextExecutableIssue', () => {
      const analyzer = new PriorityAnalyzer();
      analyzer.analyze(graph);
      for (let i = 0; i < 10; i++) {
        analyzer.getNextExecutableIssue();
      }
    });

    bench('getExecutableIssues', () => {
      const analyzer = new PriorityAnalyzer();
      analyzer.analyze(graph);
      analyzer.getExecutableIssues();
    });
  });
});
