/**
 * Graph Generator - Creates test data for performance benchmarks
 */

import type { IssueNode, DependencyEdge, RawDependencyGraph, Priority } from '../../../src/controller/types.js';

export interface GraphGeneratorOptions {
  density?: number; // Probability of edge creation (0-1)
  maxDependenciesPerNode?: number;
  priorityDistribution?: Record<Priority, number>;
  effortRange?: { min: number; max: number };
  statusDistribution?: Record<string, number>;
}

const DEFAULT_OPTIONS: Required<GraphGeneratorOptions> = {
  density: 0.15,
  maxDependenciesPerNode: 5,
  priorityDistribution: { P0: 0.1, P1: 0.2, P2: 0.4, P3: 0.3 },
  effortRange: { min: 1, max: 40 },
  statusDistribution: { pending: 0.7, completed: 0.2, in_progress: 0.1 },
};

export function generateIssueGraph(
  nodeCount: number,
  options: GraphGeneratorOptions = {}
): RawDependencyGraph {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const nodes: IssueNode[] = [];
  const edges: DependencyEdge[] = [];

  // Generate nodes
  for (let i = 1; i <= nodeCount; i++) {
    nodes.push(generateNode(`ISS-${String(i).padStart(4, '0')}`, opts));
  }

  // Generate edges (DAG - only edges from higher to lower indices)
  for (let i = 1; i < nodeCount; i++) {
    const possibleDependencies = nodes.slice(0, i);
    const numDeps = Math.min(
      Math.floor(Math.random() * opts.maxDependenciesPerNode),
      possibleDependencies.length
    );

    if (Math.random() < opts.density && numDeps > 0) {
      // Shuffle and pick dependencies
      const shuffled = possibleDependencies
        .map((n) => n.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, numDeps);

      for (const depId of shuffled) {
        edges.push({
          from: nodes[i]!.id,
          to: depId,
        });
      }
    }
  }

  return { nodes, edges };
}

function generateNode(id: string, opts: Required<GraphGeneratorOptions>): IssueNode {
  return {
    id,
    title: `Issue ${id}: Performance test task`,
    priority: selectByDistribution(opts.priorityDistribution) as Priority,
    effort: randomInt(opts.effortRange.min, opts.effortRange.max),
    status: selectByDistribution(opts.statusDistribution) as IssueNode['status'],
  };
}

function selectByDistribution<T extends string>(distribution: Record<T, number>): T {
  const entries = Object.entries(distribution) as [T, number][];
  const total = entries.reduce((sum, [, prob]) => sum + prob, 0);
  let random = Math.random() * total;

  for (const [key, prob] of entries) {
    random -= prob;
    if (random <= 0) return key;
  }

  return entries[0]![0];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a large project fixture for scalability tests
 */
export function generateLargeProjectData(
  issueCount: number
): { graph: RawDependencyGraph; metadata: ProjectMetadata } {
  const graph = generateIssueGraph(issueCount, {
    density: 0.1, // Lower density for large graphs
    maxDependenciesPerNode: 3,
  });

  const metadata: ProjectMetadata = {
    generatedAt: new Date().toISOString(),
    issueCount,
    edgeCount: graph.edges.length,
    averageDependencies: graph.edges.length / issueCount,
    priorityCounts: countByPriority(graph.nodes),
    statusCounts: countByStatus(graph.nodes),
  };

  return { graph, metadata };
}

interface ProjectMetadata {
  generatedAt: string;
  issueCount: number;
  edgeCount: number;
  averageDependencies: number;
  priorityCounts: Record<string, number>;
  statusCounts: Record<string, number>;
}

function countByPriority(nodes: readonly IssueNode[]): Record<string, number> {
  const counts: Record<string, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
  for (const node of nodes) {
    counts[node.priority] = (counts[node.priority] ?? 0) + 1;
  }
  return counts;
}

function countByStatus(nodes: readonly IssueNode[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const node of nodes) {
    counts[node.status] = (counts[node.status] ?? 0) + 1;
  }
  return counts;
}

/**
 * Generate graphs of different sizes for scalability testing
 */
export function generateScalabilityTestSuite(): Map<number, RawDependencyGraph> {
  const sizes = [100, 250, 500, 750, 1000];
  const suite = new Map<number, RawDependencyGraph>();

  for (const size of sizes) {
    suite.set(size, generateIssueGraph(size));
  }

  return suite;
}
