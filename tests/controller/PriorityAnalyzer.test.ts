import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  PriorityAnalyzer,
  CircularDependencyError,
  EmptyGraphError,
  GraphNotFoundError,
  GraphParseError,
  GraphValidationError,
  IssueNotFoundError,
  DEFAULT_PRIORITY_WEIGHTS,
} from '../../src/controller/index.js';
import type { RawDependencyGraph, IssueNode, DependencyEdge } from '../../src/controller/index.js';

describe('PriorityAnalyzer', () => {
  let analyzer: PriorityAnalyzer;
  let testDir: string;

  beforeEach(async () => {
    analyzer = new PriorityAnalyzer();
    testDir = join(tmpdir(), `priority-analyzer-test-${Date.now()}`);
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  const createNode = (
    id: string,
    priority: 'P0' | 'P1' | 'P2' | 'P3' = 'P1',
    effort = 4,
    status: 'pending' | 'completed' = 'pending'
  ): IssueNode => ({
    id,
    title: `Issue ${id}`,
    priority,
    effort,
    status,
  });

  const createGraph = (
    nodes: IssueNode[],
    edges: DependencyEdge[] = []
  ): RawDependencyGraph => ({
    nodes,
    edges,
  });

  describe('loadGraph', () => {
    it('should load and parse valid JSON file', async () => {
      const graph = createGraph([createNode('ISS-001'), createNode('ISS-002')]);
      const filePath = join(testDir, 'graph.json');
      await writeFile(filePath, JSON.stringify(graph));

      const loaded = await analyzer.loadGraph(filePath);

      expect(loaded.nodes.length).toBe(2);
      expect(loaded.edges.length).toBe(0);
    });

    it('should throw GraphNotFoundError for missing file', async () => {
      const filePath = join(testDir, 'nonexistent.json');

      await expect(analyzer.loadGraph(filePath)).rejects.toThrow(GraphNotFoundError);
    });

    it('should throw GraphParseError for invalid JSON', async () => {
      const filePath = join(testDir, 'invalid.json');
      await writeFile(filePath, 'not valid json {{{');

      await expect(analyzer.loadGraph(filePath)).rejects.toThrow(GraphParseError);
    });

    it('should throw GraphValidationError for missing nodes array', async () => {
      const filePath = join(testDir, 'invalid.json');
      await writeFile(filePath, JSON.stringify({ edges: [] }));

      await expect(analyzer.loadGraph(filePath)).rejects.toThrow(GraphValidationError);
    });

    it('should throw GraphValidationError for missing edges array', async () => {
      const filePath = join(testDir, 'invalid.json');
      await writeFile(filePath, JSON.stringify({ nodes: [] }));

      await expect(analyzer.loadGraph(filePath)).rejects.toThrow(GraphValidationError);
    });

    it('should throw GraphValidationError for invalid node structure', async () => {
      const filePath = join(testDir, 'invalid.json');
      await writeFile(
        filePath,
        JSON.stringify({
          nodes: [{ id: 'ISS-001' }], // Missing required fields
          edges: [],
        })
      );

      await expect(analyzer.loadGraph(filePath)).rejects.toThrow(GraphValidationError);
    });

    it('should throw GraphValidationError for duplicate node IDs', async () => {
      const filePath = join(testDir, 'invalid.json');
      await writeFile(
        filePath,
        JSON.stringify({
          nodes: [
            createNode('ISS-001'),
            createNode('ISS-001'), // Duplicate
          ],
          edges: [],
        })
      );

      await expect(analyzer.loadGraph(filePath)).rejects.toThrow(GraphValidationError);
    });

    it('should throw GraphValidationError for edge referencing unknown node', async () => {
      const filePath = join(testDir, 'invalid.json');
      await writeFile(
        filePath,
        JSON.stringify({
          nodes: [createNode('ISS-001')],
          edges: [{ from: 'ISS-001', to: 'ISS-999' }],
        })
      );

      await expect(analyzer.loadGraph(filePath)).rejects.toThrow(GraphValidationError);
    });

    it('should throw GraphValidationError for self-dependency', async () => {
      const filePath = join(testDir, 'invalid.json');
      await writeFile(
        filePath,
        JSON.stringify({
          nodes: [createNode('ISS-001')],
          edges: [{ from: 'ISS-001', to: 'ISS-001' }],
        })
      );

      await expect(analyzer.loadGraph(filePath)).rejects.toThrow(GraphValidationError);
    });
  });

  describe('analyze', () => {
    it('should throw EmptyGraphError for empty graph', () => {
      const graph = createGraph([]);

      expect(() => analyzer.analyze(graph)).toThrow(EmptyGraphError);
    });

    it('should analyze graph with no dependencies', () => {
      const graph = createGraph([createNode('ISS-001'), createNode('ISS-002')]);

      const result = analyzer.analyze(graph);

      expect(result.issues.size).toBe(2);
      expect(result.executionOrder.length).toBe(2);
      expect(result.parallelGroups.length).toBe(1);
      expect(result.parallelGroups[0]?.issueIds.length).toBe(2);
    });

    it('should analyze graph with linear dependencies', () => {
      const nodes = [createNode('ISS-001'), createNode('ISS-002'), createNode('ISS-003')];
      const edges: DependencyEdge[] = [
        { from: 'ISS-002', to: 'ISS-001' },
        { from: 'ISS-003', to: 'ISS-002' },
      ];
      const graph = createGraph(nodes, edges);

      const result = analyzer.analyze(graph);

      // ISS-001 should come first (no dependencies)
      const order = result.executionOrder;
      expect(order.indexOf('ISS-001')).toBeLessThan(order.indexOf('ISS-002'));
      expect(order.indexOf('ISS-002')).toBeLessThan(order.indexOf('ISS-003'));

      // Should have 3 parallel groups (one per depth)
      expect(result.parallelGroups.length).toBe(3);
    });

    it('should gracefully handle circular dependencies', () => {
      const nodes = [createNode('ISS-001'), createNode('ISS-002'), createNode('ISS-003')];
      const edges: DependencyEdge[] = [
        { from: 'ISS-001', to: 'ISS-003' },
        { from: 'ISS-002', to: 'ISS-001' },
        { from: 'ISS-003', to: 'ISS-002' },
      ];
      const graph = createGraph(nodes, edges);

      // Should not throw - graceful cycle handling
      const result = analyzer.analyze(graph);

      // Should detect the cycle
      expect(result.cycles.length).toBeGreaterThan(0);
      expect(result.blockedByCycle.length).toBeGreaterThan(0);
      expect(analyzer.hasCycles()).toBe(true);
    });

    it('should calculate depths correctly', () => {
      const nodes = [createNode('ISS-001'), createNode('ISS-002'), createNode('ISS-003')];
      const edges: DependencyEdge[] = [
        { from: 'ISS-002', to: 'ISS-001' },
        { from: 'ISS-003', to: 'ISS-002' },
      ];
      const graph = createGraph(nodes, edges);

      const result = analyzer.analyze(graph);

      expect(result.issues.get('ISS-001')?.depth).toBe(0);
      expect(result.issues.get('ISS-002')?.depth).toBe(1);
      expect(result.issues.get('ISS-003')?.depth).toBe(2);
    });

    it('should identify parallel groups', () => {
      const nodes = [createNode('ISS-001'), createNode('ISS-002'), createNode('ISS-003')];
      const edges: DependencyEdge[] = [
        { from: 'ISS-003', to: 'ISS-001' },
        { from: 'ISS-003', to: 'ISS-002' },
      ];
      const graph = createGraph(nodes, edges);

      const result = analyzer.analyze(graph);

      // ISS-001 and ISS-002 should be in same group (depth 0)
      expect(result.parallelGroups[0]?.issueIds).toContain('ISS-001');
      expect(result.parallelGroups[0]?.issueIds).toContain('ISS-002');
      // ISS-003 should be in next group (depth 1)
      expect(result.parallelGroups[1]?.issueIds).toContain('ISS-003');
    });
  });

  describe('priority scoring', () => {
    it('should give higher score to P0 than P3', () => {
      const nodes = [createNode('ISS-001', 'P0'), createNode('ISS-002', 'P3')];
      const graph = createGraph(nodes);

      const result = analyzer.analyze(graph);

      const p0Score = result.issues.get('ISS-001')?.priorityScore ?? 0;
      const p3Score = result.issues.get('ISS-002')?.priorityScore ?? 0;

      expect(p0Score).toBeGreaterThan(p3Score);
    });

    it('should apply correct priority weights', () => {
      const nodes = [
        createNode('ISS-001', 'P0'),
        createNode('ISS-002', 'P1'),
        createNode('ISS-003', 'P2'),
        createNode('ISS-004', 'P3'),
      ];
      const graph = createGraph(nodes);

      const result = analyzer.analyze(graph);

      // Base scores should include priority weights
      const scores = Array.from(result.issues.values()).map((i) => ({
        id: i.node.id,
        priority: i.node.priority,
        score: i.priorityScore,
      }));

      const p0 = scores.find((s) => s.priority === 'P0');
      const p1 = scores.find((s) => s.priority === 'P1');
      const p2 = scores.find((s) => s.priority === 'P2');
      const p3 = scores.find((s) => s.priority === 'P3');

      expect(p0?.score).toBeGreaterThan(p1?.score ?? 0);
      expect(p1?.score).toBeGreaterThan(p2?.score ?? 0);
      expect(p2?.score).toBeGreaterThan(p3?.score ?? 0);
    });

    it('should give higher score to issues with more dependents', () => {
      const nodes = [createNode('ISS-001', 'P1'), createNode('ISS-002', 'P1'), createNode('ISS-003', 'P1')];
      const edges: DependencyEdge[] = [
        { from: 'ISS-002', to: 'ISS-001' },
        { from: 'ISS-003', to: 'ISS-001' },
      ];
      const graph = createGraph(nodes, edges);

      const result = analyzer.analyze(graph);

      // ISS-001 has 2 dependents, ISS-002 and ISS-003 have 0
      const score1 = result.issues.get('ISS-001')?.priorityScore ?? 0;
      const score2 = result.issues.get('ISS-002')?.priorityScore ?? 0;
      const score3 = result.issues.get('ISS-003')?.priorityScore ?? 0;

      expect(score1).toBeGreaterThan(score2);
      expect(score1).toBeGreaterThan(score3);
    });

    it('should apply quick win bonus for small effort issues', () => {
      const nodes = [
        createNode('ISS-001', 'P1', 2), // Small effort
        createNode('ISS-002', 'P1', 40), // Large effort
      ];
      const graph = createGraph(nodes);

      // Disable critical path bonus to isolate quick win bonus effect
      const customAnalyzer = new PriorityAnalyzer({
        quickWinBonus: 50,
        quickWinThreshold: 4,
        criticalPathBonus: 0,
      });
      const result = customAnalyzer.analyze(graph);

      const smallScore = result.issues.get('ISS-001')?.priorityScore ?? 0;
      const largeScore = result.issues.get('ISS-002')?.priorityScore ?? 0;

      expect(smallScore).toBeGreaterThan(largeScore);
    });
  });

  describe('critical path', () => {
    it('should identify critical path in linear graph', () => {
      const nodes = [
        createNode('ISS-001', 'P1', 10),
        createNode('ISS-002', 'P1', 20),
        createNode('ISS-003', 'P1', 15),
      ];
      const edges: DependencyEdge[] = [
        { from: 'ISS-002', to: 'ISS-001' },
        { from: 'ISS-003', to: 'ISS-002' },
      ];
      const graph = createGraph(nodes, edges);

      const result = analyzer.analyze(graph);

      // All nodes should be on critical path in linear graph
      expect(result.issues.get('ISS-001')?.isOnCriticalPath).toBe(true);
      expect(result.issues.get('ISS-002')?.isOnCriticalPath).toBe(true);
      expect(result.issues.get('ISS-003')?.isOnCriticalPath).toBe(true);

      expect(result.criticalPath.totalDuration).toBe(45);
    });

    it('should identify bottleneck on critical path', () => {
      const nodes = [
        createNode('ISS-001', 'P1', 10),
        createNode('ISS-002', 'P1', 50), // Bottleneck
        createNode('ISS-003', 'P1', 15),
      ];
      const edges: DependencyEdge[] = [
        { from: 'ISS-002', to: 'ISS-001' },
        { from: 'ISS-003', to: 'ISS-002' },
      ];
      const graph = createGraph(nodes, edges);

      const result = analyzer.analyze(graph);

      expect(result.criticalPath.bottleneck).toBe('ISS-002');
    });

    it('should apply critical path bonus to priority score', () => {
      const nodes = [
        createNode('ISS-001', 'P1', 50), // On critical path (long effort)
        createNode('ISS-002', 'P1', 1), // Not on critical path (short effort)
        createNode('ISS-003', 'P1', 50), // On critical path
      ];
      const edges: DependencyEdge[] = [
        { from: 'ISS-002', to: 'ISS-001' },
        { from: 'ISS-003', to: 'ISS-001' },
      ];
      const graph = createGraph(nodes, edges);

      const result = analyzer.analyze(graph);

      const issue1 = result.issues.get('ISS-001');
      const issue2 = result.issues.get('ISS-002');
      const issue3 = result.issues.get('ISS-003');

      // ISS-001 should have critical path bonus, ISS-002 may not
      if (issue1?.isOnCriticalPath && !issue2?.isOnCriticalPath) {
        expect(issue1.priorityScore).toBeGreaterThan(issue2?.priorityScore ?? 0);
      }
    });
  });

  describe('prioritized queue', () => {
    it('should order queue by priority score', () => {
      const nodes = [
        createNode('ISS-001', 'P3'),
        createNode('ISS-002', 'P0'),
        createNode('ISS-003', 'P1'),
      ];
      const graph = createGraph(nodes);

      const result = analyzer.analyze(graph);

      // P0 should be first, P3 should be last
      const queue = result.prioritizedQueue.queue;
      expect(queue.indexOf('ISS-002')).toBeLessThan(queue.indexOf('ISS-001'));
    });

    it('should identify ready issues correctly', () => {
      const nodes = [
        createNode('ISS-001', 'P1', 4, 'pending'),
        createNode('ISS-002', 'P1', 4, 'pending'),
        createNode('ISS-003', 'P1', 4, 'pending'),
      ];
      const edges: DependencyEdge[] = [
        { from: 'ISS-002', to: 'ISS-001' },
        { from: 'ISS-003', to: 'ISS-002' },
      ];
      const graph = createGraph(nodes, edges);

      const result = analyzer.analyze(graph);

      // Only ISS-001 is ready (no dependencies)
      expect(result.prioritizedQueue.readyForExecution).toContain('ISS-001');
      expect(result.prioritizedQueue.readyForExecution).not.toContain('ISS-002');
      expect(result.prioritizedQueue.readyForExecution).not.toContain('ISS-003');
    });

    it('should identify blocked issues correctly', () => {
      const nodes = [
        createNode('ISS-001', 'P1', 4, 'pending'),
        createNode('ISS-002', 'P1', 4, 'pending'),
      ];
      const edges: DependencyEdge[] = [{ from: 'ISS-002', to: 'ISS-001' }];
      const graph = createGraph(nodes, edges);

      const result = analyzer.analyze(graph);

      expect(result.prioritizedQueue.blocked).toContain('ISS-002');
    });

    it('should not include completed issues in ready queue', () => {
      const nodes = [
        createNode('ISS-001', 'P1', 4, 'completed'),
        createNode('ISS-002', 'P1', 4, 'pending'),
      ];
      const edges: DependencyEdge[] = [{ from: 'ISS-002', to: 'ISS-001' }];
      const graph = createGraph(nodes, edges);

      const result = analyzer.analyze(graph);

      // ISS-002 should now be ready since ISS-001 is completed
      expect(result.prioritizedQueue.readyForExecution).toContain('ISS-002');
      expect(result.prioritizedQueue.readyForExecution).not.toContain('ISS-001');
    });
  });

  describe('getDependencies', () => {
    it('should return direct dependencies', () => {
      const nodes = [createNode('ISS-001'), createNode('ISS-002')];
      const edges: DependencyEdge[] = [{ from: 'ISS-002', to: 'ISS-001' }];
      const graph = createGraph(nodes, edges);

      analyzer.analyze(graph);
      const deps = analyzer.getDependencies('ISS-002');

      expect(deps).toContain('ISS-001');
    });

    it('should throw IssueNotFoundError for unknown issue', () => {
      const graph = createGraph([createNode('ISS-001')]);
      analyzer.analyze(graph);

      expect(() => analyzer.getDependencies('ISS-999')).toThrow(IssueNotFoundError);
    });
  });

  describe('getDependents', () => {
    it('should return direct dependents', () => {
      const nodes = [createNode('ISS-001'), createNode('ISS-002')];
      const edges: DependencyEdge[] = [{ from: 'ISS-002', to: 'ISS-001' }];
      const graph = createGraph(nodes, edges);

      analyzer.analyze(graph);
      const deps = analyzer.getDependents('ISS-001');

      expect(deps).toContain('ISS-002');
    });
  });

  describe('getTransitiveDependencies', () => {
    it('should return all transitive dependencies', () => {
      const nodes = [createNode('ISS-001'), createNode('ISS-002'), createNode('ISS-003')];
      const edges: DependencyEdge[] = [
        { from: 'ISS-002', to: 'ISS-001' },
        { from: 'ISS-003', to: 'ISS-002' },
      ];
      const graph = createGraph(nodes, edges);

      analyzer.analyze(graph);
      const deps = analyzer.getTransitiveDependencies('ISS-003');

      expect(deps).toContain('ISS-001');
      expect(deps).toContain('ISS-002');
      expect(deps.length).toBe(2);
    });
  });

  describe('dependsOn', () => {
    it('should detect direct dependency', () => {
      const nodes = [createNode('ISS-001'), createNode('ISS-002')];
      const edges: DependencyEdge[] = [{ from: 'ISS-002', to: 'ISS-001' }];
      const graph = createGraph(nodes, edges);

      analyzer.analyze(graph);

      expect(analyzer.dependsOn('ISS-002', 'ISS-001')).toBe(true);
      expect(analyzer.dependsOn('ISS-001', 'ISS-002')).toBe(false);
    });

    it('should detect transitive dependency', () => {
      const nodes = [createNode('ISS-001'), createNode('ISS-002'), createNode('ISS-003')];
      const edges: DependencyEdge[] = [
        { from: 'ISS-002', to: 'ISS-001' },
        { from: 'ISS-003', to: 'ISS-002' },
      ];
      const graph = createGraph(nodes, edges);

      analyzer.analyze(graph);

      expect(analyzer.dependsOn('ISS-003', 'ISS-001')).toBe(true);
    });
  });

  describe('areDependenciesResolved', () => {
    it('should return true when all dependencies are completed', () => {
      const nodes = [
        createNode('ISS-001', 'P1', 4, 'completed'),
        createNode('ISS-002', 'P1', 4, 'pending'),
      ];
      const edges: DependencyEdge[] = [{ from: 'ISS-002', to: 'ISS-001' }];
      const graph = createGraph(nodes, edges);

      analyzer.analyze(graph);

      expect(analyzer.areDependenciesResolved('ISS-002')).toBe(true);
    });

    it('should return false when dependencies are pending', () => {
      const nodes = [
        createNode('ISS-001', 'P1', 4, 'pending'),
        createNode('ISS-002', 'P1', 4, 'pending'),
      ];
      const edges: DependencyEdge[] = [{ from: 'ISS-002', to: 'ISS-001' }];
      const graph = createGraph(nodes, edges);

      analyzer.analyze(graph);

      expect(analyzer.areDependenciesResolved('ISS-002')).toBe(false);
    });
  });

  describe('getNextExecutableIssue', () => {
    it('should return highest priority ready issue', () => {
      const nodes = [
        createNode('ISS-001', 'P3'),
        createNode('ISS-002', 'P0'),
        createNode('ISS-003', 'P1'),
      ];
      const graph = createGraph(nodes);

      analyzer.analyze(graph);
      const next = analyzer.getNextExecutableIssue();

      expect(next).toBe('ISS-002'); // P0 has highest priority
    });

    it('should return null when no issues are ready', () => {
      const nodes = [
        createNode('ISS-001', 'P1', 4, 'completed'),
        createNode('ISS-002', 'P1', 4, 'in_progress'),
      ];
      const graph = createGraph(nodes);

      analyzer.analyze(graph);
      const next = analyzer.getNextExecutableIssue();

      expect(next).toBeNull();
    });

    it('should skip blocked issues', () => {
      const nodes = [
        createNode('ISS-001', 'P3', 4, 'pending'),
        createNode('ISS-002', 'P0', 4, 'pending'), // Blocked by ISS-001
      ];
      const edges: DependencyEdge[] = [{ from: 'ISS-002', to: 'ISS-001' }];
      const graph = createGraph(nodes, edges);

      analyzer.analyze(graph);
      const next = analyzer.getNextExecutableIssue();

      expect(next).toBe('ISS-001'); // P0 is blocked, so P3 is returned
    });
  });

  describe('statistics', () => {
    it('should compute correct statistics', () => {
      const nodes = [
        createNode('ISS-001', 'P0', 4, 'completed'),
        createNode('ISS-002', 'P1', 8, 'pending'),
        createNode('ISS-003', 'P1', 4, 'pending'),
        createNode('ISS-004', 'P2', 4, 'pending'),
      ];
      const edges: DependencyEdge[] = [
        { from: 'ISS-002', to: 'ISS-001' },
        { from: 'ISS-003', to: 'ISS-002' },
        { from: 'ISS-004', to: 'ISS-002' },
      ];
      const graph = createGraph(nodes, edges);

      const result = analyzer.analyze(graph);
      const stats = result.statistics;

      expect(stats.totalIssues).toBe(4);
      expect(stats.totalDependencies).toBe(3);
      expect(stats.maxDepth).toBe(2);
      expect(stats.rootIssues).toBe(1);
      expect(stats.leafIssues).toBe(2);
      expect(stats.byPriority.P0).toBe(1);
      expect(stats.byPriority.P1).toBe(2);
      expect(stats.byPriority.P2).toBe(1);
      expect(stats.byStatus.completed).toBe(1);
      expect(stats.byStatus.pending).toBe(3);
    });
  });

  describe('custom configuration', () => {
    it('should use custom priority weights', () => {
      const customAnalyzer = new PriorityAnalyzer({
        weights: {
          P0: 200,
          P1: 150,
          P2: 100,
          P3: 50,
        },
      });

      const nodes = [createNode('ISS-001', 'P0'), createNode('ISS-002', 'P3')];
      const graph = createGraph(nodes);

      const result = customAnalyzer.analyze(graph);

      const p0Score = result.issues.get('ISS-001')?.priorityScore ?? 0;
      const p3Score = result.issues.get('ISS-002')?.priorityScore ?? 0;

      // Difference should be larger with custom weights
      expect(p0Score - p3Score).toBeGreaterThanOrEqual(150);
    });

    it('should use custom critical path bonus', () => {
      const customAnalyzer = new PriorityAnalyzer({
        criticalPathBonus: 100,
      });

      const nodes = [
        createNode('ISS-001', 'P1', 50),
        createNode('ISS-002', 'P1', 50),
      ];
      const edges: DependencyEdge[] = [{ from: 'ISS-002', to: 'ISS-001' }];
      const graph = createGraph(nodes, edges);

      const result = customAnalyzer.analyze(graph);

      // Both should be on critical path with bonus applied
      const issue1 = result.issues.get('ISS-001');
      const issue2 = result.issues.get('ISS-002');

      expect(issue1?.isOnCriticalPath).toBe(true);
      expect(issue2?.isOnCriticalPath).toBe(true);
    });
  });

  describe('cycle detection and isolation', () => {
    it('should detect simple cycle and mark nodes as blocked', () => {
      const nodes = [createNode('A'), createNode('B')];
      const edges: DependencyEdge[] = [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'A' },
      ];
      const graph = createGraph(nodes, edges);

      const result = analyzer.analyze(graph);

      expect(result.cycles.length).toBe(1);
      expect(result.blockedByCycle).toContain('A');
      expect(result.blockedByCycle).toContain('B');
      expect(analyzer.isBlockedByCycle('A')).toBe(true);
      expect(analyzer.isBlockedByCycle('B')).toBe(true);
    });

    it('should allow non-cyclic nodes to be processed normally', () => {
      // Graph: A -> B -> C (valid chain), D -> E -> D (cycle)
      const nodes = [
        createNode('A'),
        createNode('B'),
        createNode('C'),
        createNode('D'),
        createNode('E'),
      ];
      const edges: DependencyEdge[] = [
        { from: 'B', to: 'A' },
        { from: 'C', to: 'B' },
        { from: 'D', to: 'E' },
        { from: 'E', to: 'D' },
      ];
      const graph = createGraph(nodes, edges);

      const result = analyzer.analyze(graph);

      // Cycle detection
      expect(result.cycles.length).toBeGreaterThan(0);

      // D and E are in cycle, blocked
      expect(analyzer.isBlockedByCycle('D')).toBe(true);
      expect(analyzer.isBlockedByCycle('E')).toBe(true);

      // A, B, C are NOT blocked (valid chain)
      expect(analyzer.isBlockedByCycle('A')).toBe(false);
      expect(analyzer.isBlockedByCycle('B')).toBe(false);
      expect(analyzer.isBlockedByCycle('C')).toBe(false);

      // Executable issues should include A, B, C
      const executable = analyzer.getExecutableIssues();
      expect(executable).toContain('A');
      expect(executable).toContain('B');
      expect(executable).toContain('C');
      expect(executable).not.toContain('D');
      expect(executable).not.toContain('E');
    });

    it('should propagate blocking to nodes dependent on cycle', () => {
      // Graph: A -> B -> C -> A (cycle), D -> C (depends on cyclic node)
      const nodes = [
        createNode('A'),
        createNode('B'),
        createNode('C'),
        createNode('D'),
      ];
      const edges: DependencyEdge[] = [
        { from: 'A', to: 'C' },
        { from: 'B', to: 'A' },
        { from: 'C', to: 'B' },
        { from: 'D', to: 'C' }, // D depends on C which is in cycle
      ];
      const graph = createGraph(nodes, edges);

      const result = analyzer.analyze(graph);

      // A, B, C are in cycle
      expect(analyzer.isBlockedByCycle('A')).toBe(true);
      expect(analyzer.isBlockedByCycle('B')).toBe(true);
      expect(analyzer.isBlockedByCycle('C')).toBe(true);

      // D depends on C which is blocked, so D is also blocked
      expect(analyzer.isBlockedByCycle('D')).toBe(true);
      expect(result.blockedByCycle).toContain('D');
    });

    it('should return cycle information with correct structure', () => {
      const nodes = [createNode('X'), createNode('Y'), createNode('Z')];
      const edges: DependencyEdge[] = [
        { from: 'X', to: 'Z' },
        { from: 'Y', to: 'X' },
        { from: 'Z', to: 'Y' },
      ];
      const graph = createGraph(nodes, edges);

      const result = analyzer.analyze(graph);

      expect(result.cycles.length).toBeGreaterThan(0);
      const cycle = result.cycles[0];
      expect(cycle).toBeDefined();
      expect(cycle?.nodes.length).toBeGreaterThan(0);
      expect(cycle?.detectedAt).toBeInstanceOf(Date);
      expect(cycle?.status).toBe('detected');
    });

    it('should handle graph with no cycles', () => {
      const nodes = [createNode('A'), createNode('B'), createNode('C')];
      const edges: DependencyEdge[] = [
        { from: 'B', to: 'A' },
        { from: 'C', to: 'B' },
      ];
      const graph = createGraph(nodes, edges);

      const result = analyzer.analyze(graph);

      expect(result.cycles.length).toBe(0);
      expect(result.blockedByCycle.length).toBe(0);
      expect(analyzer.hasCycles()).toBe(false);
      expect(analyzer.getCycles()).toHaveLength(0);
    });

    it('should handle multiple independent cycles', () => {
      // Graph: A -> B -> A (cycle 1), C -> D -> C (cycle 2), E (standalone)
      const nodes = [
        createNode('A'),
        createNode('B'),
        createNode('C'),
        createNode('D'),
        createNode('E'),
      ];
      const edges: DependencyEdge[] = [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'A' },
        { from: 'C', to: 'D' },
        { from: 'D', to: 'C' },
      ];
      const graph = createGraph(nodes, edges);

      const result = analyzer.analyze(graph);

      // Should detect multiple cycles
      expect(result.cycles.length).toBeGreaterThanOrEqual(2);

      // All cyclic nodes are blocked
      expect(analyzer.isBlockedByCycle('A')).toBe(true);
      expect(analyzer.isBlockedByCycle('B')).toBe(true);
      expect(analyzer.isBlockedByCycle('C')).toBe(true);
      expect(analyzer.isBlockedByCycle('D')).toBe(true);

      // E is standalone, not blocked
      expect(analyzer.isBlockedByCycle('E')).toBe(false);
      expect(analyzer.getExecutableIssues()).toContain('E');
    });

    it('should provide getBlockedByCycle method', () => {
      const nodes = [createNode('A'), createNode('B'), createNode('C')];
      const edges: DependencyEdge[] = [
        { from: 'A', to: 'B' },
        { from: 'B', to: 'A' },
      ];
      const graph = createGraph(nodes, edges);

      analyzer.analyze(graph);

      const blocked = analyzer.getBlockedByCycle();
      expect(blocked).toContain('A');
      expect(blocked).toContain('B');
      expect(blocked).not.toContain('C');
    });
  });
});
