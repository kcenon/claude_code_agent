/**
 * Priority Analyzer module
 *
 * Analyzes dependency graphs and determines optimal execution order
 * based on priorities, dependencies, and critical path analysis.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

import type {
  Priority,
  IssueNode,
  DependencyEdge,
  RawDependencyGraph,
  AnalyzedIssue,
  ParallelGroup,
  CriticalPath,
  PrioritizedQueue,
  GraphAnalysisResult,
  GraphStatistics,
  PriorityAnalyzerConfig,
  IssueStatus,
  CycleInfo,
} from './types.js';
import { DEFAULT_ANALYZER_CONFIG } from './types.js';
import {
  EmptyGraphError,
  GraphNotFoundError,
  GraphParseError,
  GraphValidationError,
  IssueNotFoundError,
} from './errors.js';

/**
 * Internal node representation for graph algorithms
 */
interface InternalNode {
  id: string;
  node: IssueNode;
  dependencies: Set<string>;
  dependents: Set<string>;
  visited: boolean;
  inStack: boolean;
  depth: number;
  priorityScore: number;
  isOnCriticalPath: boolean;
  longestPath: number;
  isBlockedByCycle: boolean;
}

/**
 * Priority Analyzer for dependency graph analysis and work prioritization
 */
export class PriorityAnalyzer {
  private readonly config: Required<PriorityAnalyzerConfig>;
  private nodes: Map<string, InternalNode> = new Map();
  private criticalPathIds: Set<string> = new Set();
  private detectedCycles: CycleInfo[] = [];
  private blockedByCycleIds: Set<string> = new Set();

  constructor(config: PriorityAnalyzerConfig = {}) {
    this.config = {
      weights: config.weights ?? DEFAULT_ANALYZER_CONFIG.weights,
      criticalPathBonus: config.criticalPathBonus ?? DEFAULT_ANALYZER_CONFIG.criticalPathBonus,
      dependentMultiplier:
        config.dependentMultiplier ?? DEFAULT_ANALYZER_CONFIG.dependentMultiplier,
      quickWinBonus: config.quickWinBonus ?? DEFAULT_ANALYZER_CONFIG.quickWinBonus,
      quickWinThreshold: config.quickWinThreshold ?? DEFAULT_ANALYZER_CONFIG.quickWinThreshold,
    };
  }

  /**
   * Load and parse a dependency graph from a JSON file
   * @param filePath - Path to the dependency graph JSON file
   * @returns Parsed dependency graph
   * @throws GraphNotFoundError if file does not exist
   * @throws GraphParseError if JSON parsing fails
   * @throws GraphValidationError if graph structure is invalid
   */
  public async loadGraph(filePath: string): Promise<RawDependencyGraph> {
    if (!existsSync(filePath)) {
      throw new GraphNotFoundError(filePath);
    }

    let content: string;
    try {
      content = await readFile(filePath, 'utf-8');
    } catch (error) {
      throw new GraphParseError(filePath, error instanceof Error ? error : undefined);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new GraphParseError(filePath, error instanceof Error ? error : undefined);
    }

    return this.validateGraph(parsed, filePath);
  }

  /**
   * Validate the structure of a parsed dependency graph
   */
  private validateGraph(data: unknown, _filePath: string): RawDependencyGraph {
    const errors: string[] = [];

    if (typeof data !== 'object' || data === null) {
      throw new GraphValidationError(['Graph must be an object']);
    }

    const graph = data as Record<string, unknown>;

    if (!Array.isArray(graph['nodes'])) {
      errors.push('Missing or invalid "nodes" array');
    }

    if (!Array.isArray(graph['edges'])) {
      errors.push('Missing or invalid "edges" array');
    }

    if (errors.length > 0) {
      throw new GraphValidationError(errors);
    }

    const nodes = graph['nodes'] as unknown[];
    const edges = graph['edges'] as unknown[];

    // Validate each node
    const nodeIds = new Set<string>();
    const validatedNodes: IssueNode[] = [];

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (typeof node !== 'object' || node === null) {
        errors.push(`Node at index ${String(i)} must be an object`);
        continue;
      }

      const nodeObj = node as Record<string, unknown>;
      const nodeErrors = this.validateNode(nodeObj, i);
      errors.push(...nodeErrors);

      if (nodeErrors.length === 0) {
        const id = nodeObj['id'] as string;
        if (nodeIds.has(id)) {
          errors.push(`Duplicate node ID: ${id}`);
        } else {
          nodeIds.add(id);
          validatedNodes.push(this.createIssueNode(nodeObj));
        }
      }
    }

    // Validate each edge
    const validatedEdges: DependencyEdge[] = [];

    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      if (typeof edge !== 'object' || edge === null) {
        errors.push(`Edge at index ${String(i)} must be an object`);
        continue;
      }

      const edgeObj = edge as Record<string, unknown>;
      const edgeErrors = this.validateEdge(edgeObj, i, nodeIds);
      errors.push(...edgeErrors);

      if (edgeErrors.length === 0) {
        validatedEdges.push({
          from: edgeObj['from'] as string,
          to: edgeObj['to'] as string,
        });
      }
    }

    if (errors.length > 0) {
      throw new GraphValidationError(errors);
    }

    return {
      nodes: validatedNodes,
      edges: validatedEdges,
    };
  }

  /**
   * Validate a single node object
   */
  private validateNode(node: Record<string, unknown>, index: number): string[] {
    const errors: string[] = [];
    const prefix = `Node at index ${String(index)}`;

    if (typeof node['id'] !== 'string' || node['id'] === '') {
      errors.push(`${prefix}: missing or invalid "id"`);
    }

    if (typeof node['title'] !== 'string' || node['title'] === '') {
      errors.push(`${prefix}: missing or invalid "title"`);
    }

    const validPriorities = ['P0', 'P1', 'P2', 'P3'];
    if (!validPriorities.includes(node['priority'] as string)) {
      errors.push(`${prefix}: invalid "priority" (must be P0, P1, P2, or P3)`);
    }

    if (typeof node['effort'] !== 'number' || node['effort'] < 0) {
      errors.push(`${prefix}: missing or invalid "effort" (must be non-negative number)`);
    }

    const validStatuses = ['pending', 'ready', 'in_progress', 'completed', 'blocked', 'failed'];
    if (!validStatuses.includes(node['status'] as string)) {
      errors.push(`${prefix}: invalid "status"`);
    }

    return errors;
  }

  /**
   * Validate a single edge object
   */
  private validateEdge(
    edge: Record<string, unknown>,
    index: number,
    nodeIds: Set<string>
  ): string[] {
    const errors: string[] = [];
    const prefix = `Edge at index ${String(index)}`;

    if (typeof edge['from'] !== 'string' || edge['from'] === '') {
      errors.push(`${prefix}: missing or invalid "from"`);
    } else if (!nodeIds.has(edge['from'])) {
      errors.push(`${prefix}: "from" references unknown node "${edge['from']}"`);
    }

    if (typeof edge['to'] !== 'string' || edge['to'] === '') {
      errors.push(`${prefix}: missing or invalid "to"`);
    } else if (!nodeIds.has(edge['to'])) {
      errors.push(`${prefix}: "to" references unknown node "${edge['to']}"`);
    }

    if (edge['from'] === edge['to']) {
      errors.push(`${prefix}: self-dependency not allowed`);
    }

    return errors;
  }

  /**
   * Create an IssueNode from validated data
   */
  private createIssueNode(data: Record<string, unknown>): IssueNode {
    const base = {
      id: data['id'] as string,
      title: data['title'] as string,
      priority: data['priority'] as Priority,
      effort: data['effort'] as number,
      status: data['status'] as IssueStatus,
    };

    // Build node with optional properties only if they exist
    const url = typeof data['url'] === 'string' ? data['url'] : undefined;
    const componentId = typeof data['componentId'] === 'string' ? data['componentId'] : undefined;

    if (url !== undefined && componentId !== undefined) {
      return { ...base, url, componentId };
    } else if (url !== undefined) {
      return { ...base, url };
    } else if (componentId !== undefined) {
      return { ...base, componentId };
    }

    return base;
  }

  /**
   * Analyze a dependency graph and compute prioritization
   *
   * Gracefully handles circular dependencies by:
   * 1. Detecting all cycles without throwing
   * 2. Marking cyclic nodes as blocked
   * 3. Propagating blocking to dependent nodes
   * 4. Continuing analysis for non-blocked nodes
   *
   * @param graph - The dependency graph to analyze
   * @returns Complete analysis result including cycle information
   * @throws EmptyGraphError if graph has no nodes
   */
  public analyze(graph: RawDependencyGraph): GraphAnalysisResult {
    if (graph.nodes.length === 0) {
      throw new EmptyGraphError();
    }

    this.reset();
    this.buildInternalGraph(graph);
    this.detectCycles();
    this.calculateDepths();
    this.calculateCriticalPath();
    this.calculatePriorityScores();

    const executionOrder = this.topologicalSortWithPriority();
    const parallelGroups = this.buildParallelGroups();
    const prioritizedQueue = this.buildPrioritizedQueue();
    const statistics = this.computeStatistics();

    const issues = new Map<string, AnalyzedIssue>();
    for (const [id, node] of this.nodes) {
      issues.set(id, this.buildAnalyzedIssue(node));
    }

    return {
      issues,
      executionOrder,
      parallelGroups,
      criticalPath: this.buildCriticalPath(),
      prioritizedQueue,
      statistics,
      cycles: [...this.detectedCycles],
      blockedByCycle: Array.from(this.blockedByCycleIds),
    };
  }

  /**
   * Reset internal state
   */
  private reset(): void {
    this.nodes.clear();
    this.criticalPathIds.clear();
    this.detectedCycles = [];
    this.blockedByCycleIds.clear();
  }

  /**
   * Build internal graph representation
   */
  private buildInternalGraph(graph: RawDependencyGraph): void {
    // Create nodes
    for (const node of graph.nodes) {
      this.nodes.set(node.id, {
        id: node.id,
        node,
        dependencies: new Set(),
        dependents: new Set(),
        visited: false,
        inStack: false,
        depth: 0,
        priorityScore: 0,
        isOnCriticalPath: false,
        longestPath: 0,
        isBlockedByCycle: false,
      });
    }

    // Build edges
    for (const edge of graph.edges) {
      const fromNode = this.nodes.get(edge.from);
      const toNode = this.nodes.get(edge.to);

      if (fromNode !== undefined && toNode !== undefined) {
        // "from" depends on "to"
        fromNode.dependencies.add(edge.to);
        toNode.dependents.add(edge.from);
      }
    }
  }

  /**
   * Detect circular dependencies using DFS
   * Instead of throwing, cycles are recorded and nodes are marked as blocked.
   * This allows partial execution of non-cyclic nodes.
   */
  private detectCycles(): void {
    for (const node of this.nodes.values()) {
      node.visited = false;
      node.inStack = false;
    }

    for (const node of this.nodes.values()) {
      if (!node.visited) {
        this.dfsDetectCycle(node, []);
      }
    }

    // After detecting all cycles, propagate blocking to dependent nodes
    this.propagateBlocking();
  }

  /**
   * DFS helper for cycle detection
   * Records cycles instead of throwing exceptions
   */
  private dfsDetectCycle(node: InternalNode, path: string[]): void {
    node.visited = true;
    node.inStack = true;
    path.push(node.id);

    for (const depId of node.dependencies) {
      const depNode = this.nodes.get(depId);
      if (depNode === undefined) continue;

      if (!depNode.visited) {
        this.dfsDetectCycle(depNode, [...path]);
      } else if (depNode.inStack) {
        // Found a cycle - record it instead of throwing
        const cycleStart = path.indexOf(depId);
        const cycleNodes = [...path.slice(cycleStart), depId];

        // Record the cycle
        this.detectedCycles.push({
          nodes: cycleNodes,
          detectedAt: new Date(),
          status: 'detected',
        });

        // Mark all nodes in the cycle as blocked
        for (const cycleNodeId of cycleNodes) {
          this.blockedByCycleIds.add(cycleNodeId);
          const cycleNode = this.nodes.get(cycleNodeId);
          if (cycleNode !== undefined) {
            cycleNode.isBlockedByCycle = true;
          }
        }
      }
    }

    node.inStack = false;
  }

  /**
   * Propagate blocking status to nodes that depend on blocked nodes
   * A node is blocked if any of its dependencies are blocked by a cycle
   */
  private propagateBlocking(): void {
    let changed = true;
    while (changed) {
      changed = false;
      for (const node of this.nodes.values()) {
        if (node.isBlockedByCycle) continue;

        for (const depId of node.dependencies) {
          if (this.blockedByCycleIds.has(depId)) {
            node.isBlockedByCycle = true;
            this.blockedByCycleIds.add(node.id);
            changed = true;
            break;
          }
        }
      }
    }
  }

  /**
   * Calculate depth for each node (longest path from roots)
   */
  private calculateDepths(): void {
    // Find root nodes (no dependencies)
    const roots = Array.from(this.nodes.values()).filter((n) => n.dependencies.size === 0);

    // BFS to calculate depths
    const queue: InternalNode[] = [...roots];
    const processed = new Set<string>();

    for (const root of roots) {
      root.depth = 0;
    }

    while (queue.length > 0) {
      const node = queue.shift();
      if (node === undefined || processed.has(node.id)) continue;

      processed.add(node.id);

      for (const depId of node.dependents) {
        const depNode = this.nodes.get(depId);
        if (depNode !== undefined) {
          depNode.depth = Math.max(depNode.depth, node.depth + 1);
          if (!processed.has(depId)) {
            queue.push(depNode);
          }
        }
      }
    }
  }

  /**
   * Calculate the critical path through the graph
   * Critical path is the longest path considering effort as weight
   */
  private calculateCriticalPath(): void {
    // Calculate longest path from each node to any leaf
    const longestPathToLeaf = new Map<string, number>();
    const nextOnPath = new Map<string, string | null>();

    // Find leaf nodes
    const leaves = Array.from(this.nodes.values()).filter((n) => n.dependents.size === 0);

    // Initialize leaves
    for (const leaf of leaves) {
      longestPathToLeaf.set(leaf.id, leaf.node.effort);
      nextOnPath.set(leaf.id, null);
    }

    // Process in reverse topological order
    const topoOrder = this.getTopologicalOrder();

    for (let i = topoOrder.length - 1; i >= 0; i--) {
      const nodeId = topoOrder[i];
      if (nodeId === undefined) continue;

      const node = this.nodes.get(nodeId);
      if (node === undefined) continue;

      if (node.dependents.size === 0) {
        // Already handled as leaf
        node.longestPath = node.node.effort;
        continue;
      }

      let maxPath = 0;
      let maxNext: string | null = null;

      for (const depId of node.dependents) {
        const depPath = longestPathToLeaf.get(depId) ?? 0;
        if (depPath > maxPath) {
          maxPath = depPath;
          maxNext = depId;
        }
      }

      const totalPath = node.node.effort + maxPath;
      longestPathToLeaf.set(nodeId, totalPath);
      nextOnPath.set(nodeId, maxNext);
      node.longestPath = totalPath;
    }

    // Find the starting point with longest path
    let maxStart: string | null = null;
    let maxLength = 0;

    for (const node of this.nodes.values()) {
      if (node.dependencies.size === 0) {
        const pathLength = longestPathToLeaf.get(node.id) ?? 0;
        if (pathLength > maxLength) {
          maxLength = pathLength;
          maxStart = node.id;
        }
      }
    }

    // Build critical path
    if (maxStart !== null) {
      let current: string | null = maxStart;
      while (current !== null) {
        this.criticalPathIds.add(current);
        const node = this.nodes.get(current);
        if (node !== undefined) {
          node.isOnCriticalPath = true;
        }
        current = nextOnPath.get(current) ?? null;
      }
    }
  }

  /**
   * Get a basic topological order (without priority)
   */
  private getTopologicalOrder(): readonly string[] {
    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    const result: string[] = [];

    for (const node of this.nodes.values()) {
      inDegree.set(node.id, node.dependencies.size);
      if (node.dependencies.size === 0) {
        queue.push(node.id);
      }
    }

    while (queue.length > 0) {
      const nodeId = queue.shift();
      if (nodeId === undefined) continue;

      result.push(nodeId);

      const node = this.nodes.get(nodeId);
      if (node === undefined) continue;

      for (const depId of node.dependents) {
        const currentDegree = inDegree.get(depId) ?? 0;
        inDegree.set(depId, currentDegree - 1);
        if (currentDegree - 1 === 0) {
          queue.push(depId);
        }
      }
    }

    return result;
  }

  /**
   * Calculate priority scores for all nodes
   */
  private calculatePriorityScores(): void {
    for (const node of this.nodes.values()) {
      node.priorityScore = this.computePriorityScore(node);
    }
  }

  /**
   * Compute priority score for a single node
   */
  private computePriorityScore(node: InternalNode): number {
    let score = 0;

    // Base priority weight
    score += this.config.weights[node.node.priority];

    // Dependent impact (more dependents = higher priority)
    score += node.dependents.size * this.config.dependentMultiplier;

    // Critical path bonus
    if (node.isOnCriticalPath) {
      score += this.config.criticalPathBonus;
    }

    // Quick win bonus (smaller effort = earlier for quick wins)
    if (node.node.effort <= this.config.quickWinThreshold) {
      score += this.config.quickWinBonus;
    }

    return score;
  }

  /**
   * Perform topological sort with priority ordering
   * Nodes with same depth are ordered by priority score
   */
  private topologicalSortWithPriority(): readonly string[] {
    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    const result: string[] = [];

    // Initialize in-degrees
    for (const node of this.nodes.values()) {
      inDegree.set(node.id, node.dependencies.size);
      if (node.dependencies.size === 0) {
        queue.push(node.id);
      }
    }

    while (queue.length > 0) {
      // Sort queue by priority score (descending)
      queue.sort((a, b) => {
        const nodeA = this.nodes.get(a);
        const nodeB = this.nodes.get(b);
        return (nodeB?.priorityScore ?? 0) - (nodeA?.priorityScore ?? 0);
      });

      const nodeId = queue.shift();
      if (nodeId === undefined) continue;

      result.push(nodeId);

      const node = this.nodes.get(nodeId);
      if (node === undefined) continue;

      for (const depId of node.dependents) {
        const currentDegree = inDegree.get(depId) ?? 0;
        inDegree.set(depId, currentDegree - 1);
        if (currentDegree - 1 === 0) {
          queue.push(depId);
        }
      }
    }

    return result;
  }

  /**
   * Build groups of issues that can be executed in parallel
   */
  private buildParallelGroups(): readonly ParallelGroup[] {
    const groups: ParallelGroup[] = [];
    const maxDepth = Math.max(...Array.from(this.nodes.values()).map((n) => n.depth), 0);

    for (let depth = 0; depth <= maxDepth; depth++) {
      const nodesAtDepth = Array.from(this.nodes.values())
        .filter((n) => n.depth === depth)
        .sort((a, b) => b.priorityScore - a.priorityScore);

      if (nodesAtDepth.length > 0) {
        const totalEffort = nodesAtDepth.reduce((sum, n) => sum + n.node.effort, 0);

        groups.push({
          groupIndex: depth,
          issueIds: nodesAtDepth.map((n) => n.id),
          totalEffort,
        });
      }
    }

    return groups;
  }

  /**
   * Build the critical path result object
   */
  private buildCriticalPath(): CriticalPath {
    const path = Array.from(this.criticalPathIds);
    const totalDuration = path.reduce((sum, id) => {
      const node = this.nodes.get(id);
      return sum + (node?.node.effort ?? 0);
    }, 0);

    // Find bottleneck (highest effort on path)
    let bottleneck: string | null = null;
    let maxEffort = 0;

    for (const id of path) {
      const node = this.nodes.get(id);
      if (node !== undefined && node.node.effort > maxEffort) {
        maxEffort = node.node.effort;
        bottleneck = id;
      }
    }

    return {
      path,
      totalDuration,
      bottleneck,
    };
  }

  /**
   * Build the prioritized work queue
   */
  private buildPrioritizedQueue(): PrioritizedQueue {
    const allNodes = Array.from(this.nodes.values());

    // Sort by priority score (descending)
    const sorted = [...allNodes].sort((a, b) => b.priorityScore - a.priorityScore);
    const queue = sorted.map((n) => n.id);

    // Find ready issues (no pending dependencies)
    const readyForExecution = allNodes
      .filter((n) => {
        if (n.node.status === 'completed' || n.node.status === 'in_progress') {
          return false;
        }
        return this.areDependenciesResolved(n.id);
      })
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .map((n) => n.id);

    // Find blocked issues
    const blocked = allNodes
      .filter((n) => {
        if (n.node.status === 'completed' || n.node.status === 'in_progress') {
          return false;
        }
        return !this.areDependenciesResolved(n.id);
      })
      .map((n) => n.id);

    return {
      queue,
      readyForExecution,
      blocked,
    };
  }

  /**
   * Check if all dependencies of an issue are resolved
   */
  public areDependenciesResolved(issueId: string): boolean {
    const node = this.nodes.get(issueId);
    if (node === undefined) {
      return false;
    }

    for (const depId of node.dependencies) {
      const depNode = this.nodes.get(depId);
      if (depNode === undefined || depNode.node.status !== 'completed') {
        return false;
      }
    }

    return true;
  }

  /**
   * Get the next executable issue
   * @returns The highest priority issue with resolved dependencies, or null
   */
  public getNextExecutableIssue(): string | null {
    const ready = Array.from(this.nodes.values())
      .filter(
        (n) =>
          n.node.status !== 'completed' &&
          n.node.status !== 'in_progress' &&
          this.areDependenciesResolved(n.id)
      )
      .sort((a, b) => b.priorityScore - a.priorityScore);

    const first = ready[0];
    return first !== undefined ? first.id : null;
  }

  /**
   * Get direct dependencies for an issue
   */
  public getDependencies(issueId: string): readonly string[] {
    const node = this.nodes.get(issueId);
    if (node === undefined) {
      throw new IssueNotFoundError(issueId, 'getDependencies');
    }
    return Array.from(node.dependencies);
  }

  /**
   * Get direct dependents for an issue
   */
  public getDependents(issueId: string): readonly string[] {
    const node = this.nodes.get(issueId);
    if (node === undefined) {
      throw new IssueNotFoundError(issueId, 'getDependents');
    }
    return Array.from(node.dependents);
  }

  /**
   * Get all transitive dependencies for an issue
   */
  public getTransitiveDependencies(issueId: string): readonly string[] {
    const node = this.nodes.get(issueId);
    if (node === undefined) {
      throw new IssueNotFoundError(issueId, 'getTransitiveDependencies');
    }

    const result = new Set<string>();
    const queue = [issueId];

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) continue;

      const currentNode = this.nodes.get(current);
      if (currentNode === undefined) continue;

      for (const dep of currentNode.dependencies) {
        if (!result.has(dep)) {
          result.add(dep);
          queue.push(dep);
        }
      }
    }

    return Array.from(result).sort();
  }

  /**
   * Check if issue A depends on issue B (directly or transitively)
   */
  public dependsOn(issueA: string, issueB: string): boolean {
    const transitive = this.getTransitiveDependencies(issueA);
    return transitive.includes(issueB);
  }

  /**
   * Build the analyzed issue result for a node
   */
  private buildAnalyzedIssue(node: InternalNode): AnalyzedIssue {
    return {
      node: node.node,
      dependencies: Array.from(node.dependencies),
      dependents: Array.from(node.dependents),
      transitiveDependencies: this.getTransitiveDependenciesInternal(node.id),
      depth: node.depth,
      priorityScore: node.priorityScore,
      isOnCriticalPath: node.isOnCriticalPath,
      dependenciesResolved: this.areDependenciesResolved(node.id),
    };
  }

  /**
   * Internal method to get transitive dependencies (no error throwing)
   */
  private getTransitiveDependenciesInternal(issueId: string): readonly string[] {
    const result = new Set<string>();
    const queue = [issueId];

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) continue;

      const currentNode = this.nodes.get(current);
      if (currentNode === undefined) continue;

      for (const dep of currentNode.dependencies) {
        if (!result.has(dep)) {
          result.add(dep);
          queue.push(dep);
        }
      }
    }

    return Array.from(result).sort();
  }

  /**
   * Compute statistics about the graph
   */
  private computeStatistics(): GraphStatistics {
    const nodes = Array.from(this.nodes.values());

    const byPriority: Record<Priority, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
    const byStatus: Record<IssueStatus, number> = {
      pending: 0,
      ready: 0,
      in_progress: 0,
      completed: 0,
      blocked: 0,
      failed: 0,
    };

    for (const node of nodes) {
      byPriority[node.node.priority]++;
      byStatus[node.node.status]++;
    }

    return {
      totalIssues: nodes.length,
      totalDependencies: nodes.reduce((sum, n) => sum + n.dependencies.size, 0),
      maxDepth: Math.max(...nodes.map((n) => n.depth), 0),
      rootIssues: nodes.filter((n) => n.dependencies.size === 0).length,
      leafIssues: nodes.filter((n) => n.dependents.size === 0).length,
      criticalPathLength: this.criticalPathIds.size,
      byPriority,
      byStatus,
    };
  }

  // ============================================================================
  // Cycle Detection Public API
  // ============================================================================

  /**
   * Get all detected cycles in the graph
   * @returns Array of cycle information
   */
  public getCycles(): readonly CycleInfo[] {
    return [...this.detectedCycles];
  }

  /**
   * Check if the graph has any circular dependencies
   * @returns true if cycles were detected
   */
  public hasCycles(): boolean {
    return this.detectedCycles.length > 0;
  }

  /**
   * Check if a specific issue is blocked by a circular dependency
   * @param issueId - The issue ID to check
   * @returns true if the issue is blocked by a cycle
   */
  public isBlockedByCycle(issueId: string): boolean {
    return this.blockedByCycleIds.has(issueId);
  }

  /**
   * Get all issue IDs that are blocked by circular dependencies
   * This includes both nodes directly in cycles and nodes that depend on cyclic nodes
   * @returns Array of blocked issue IDs
   */
  public getBlockedByCycle(): readonly string[] {
    return Array.from(this.blockedByCycleIds);
  }

  /**
   * Get issues that can be executed (not blocked by cycles)
   * @returns Array of executable issue IDs sorted by priority
   */
  public getExecutableIssues(): readonly string[] {
    return Array.from(this.nodes.values())
      .filter((n) => !n.isBlockedByCycle)
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .map((n) => n.id);
  }
}
