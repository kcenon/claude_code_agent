/**
 * Dependency Graph module
 *
 * Builds and analyzes dependency graphs from SDS components,
 * detects cycles, and determines execution order.
 */

import type {
  SDSComponent,
  DependencyGraph as DependencyGraphType,
  DependencyNode,
  DependencyEdge,
  DependencyType,
  ParallelGroup,
} from './types.js';
import { CircularDependencyError, ComponentNotFoundError } from './errors.js';

/**
 * Internal node representation for graph algorithms
 */
interface InternalNode {
  id: string;
  componentId: string;
  dependencies: Set<string>;
  dependents: Set<string>;
  visited: boolean;
  inStack: boolean;
  depth: number;
}

/**
 * Builds and analyzes dependency graphs
 */
export class DependencyGraphBuilder {
  private nodes: Map<string, InternalNode> = new Map();
  private componentToIssue: Map<string, string> = new Map();

  /**
   * Build a dependency graph from SDS components
   * @param components - Array of SDS components
   * @param componentToIssueId - Map of component IDs to issue IDs
   * @returns Dependency graph structure
   */
  public build(
    components: readonly SDSComponent[],
    componentToIssueId: Map<string, string>
  ): DependencyGraphType {
    this.reset();
    this.componentToIssue = componentToIssueId;

    // Create nodes for each component
    for (const component of components) {
      const issueId = componentToIssueId.get(component.id);
      if (issueId === undefined) {
        throw new ComponentNotFoundError(component.id);
      }

      this.nodes.set(issueId, {
        id: issueId,
        componentId: component.id,
        dependencies: new Set(),
        dependents: new Set(),
        visited: false,
        inStack: false,
        depth: 0,
      });
    }

    // Build edges from component dependencies
    for (const component of components) {
      const issueId = componentToIssueId.get(component.id);
      if (issueId === undefined) continue;

      const node = this.nodes.get(issueId);
      if (!node) continue;

      for (const depComponentId of component.dependencies) {
        const depIssueId = componentToIssueId.get(depComponentId);
        if (depIssueId !== undefined) {
          node.dependencies.add(depIssueId);

          const depNode = this.nodes.get(depIssueId);
          if (depNode) {
            depNode.dependents.add(issueId);
          }
        }
      }
    }

    // Detect cycles
    this.detectCycles();

    // Calculate depths
    this.calculateDepths();

    // Build output structure
    return this.buildOutput();
  }

  /**
   * Reset internal state
   */
  private reset(): void {
    this.nodes.clear();
    this.componentToIssue.clear();
  }

  /**
   * Detect circular dependencies using DFS
   * @throws CircularDependencyError if a cycle is detected
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
  }

  /**
   * DFS helper for cycle detection
   * @param node - The current node being visited in the DFS traversal
   * @param path - The current path of node IDs from the DFS root to this node
   */
  private dfsDetectCycle(node: InternalNode, path: string[]): void {
    node.visited = true;
    node.inStack = true;
    path.push(node.id);

    for (const depId of node.dependencies) {
      const depNode = this.nodes.get(depId);
      if (!depNode) continue;

      if (!depNode.visited) {
        this.dfsDetectCycle(depNode, [...path]);
      } else if (depNode.inStack) {
        // Found a cycle
        const cycleStart = path.indexOf(depId);
        const cycle = [...path.slice(cycleStart), depId];
        throw new CircularDependencyError(cycle);
      }
    }

    node.inStack = false;
  }

  /**
   * Calculate depth for each node (longest path from root)
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
      if (!node || processed.has(node.id)) continue;

      processed.add(node.id);

      for (const depId of node.dependents) {
        const depNode = this.nodes.get(depId);
        if (depNode) {
          depNode.depth = Math.max(depNode.depth, node.depth + 1);
          if (!processed.has(depId)) {
            queue.push(depNode);
          }
        }
      }
    }
  }

  /**
   * Build the output dependency graph structure
   * @returns Complete dependency graph with nodes, edges, and execution order
   */
  private buildOutput(): DependencyGraphType {
    const nodes: DependencyNode[] = [];
    const edges: DependencyEdge[] = [];

    for (const node of this.nodes.values()) {
      nodes.push({
        id: node.id,
        componentId: node.componentId,
        priority: this.calculatePriority(node),
        depth: node.depth,
      });

      for (const depId of node.dependencies) {
        edges.push({
          from: node.id,
          to: depId,
          type: 'blocked_by' as DependencyType,
        });
      }
    }

    const executionOrder = this.topologicalSort();
    const parallelGroups = this.buildParallelGroups();

    return {
      nodes,
      edges,
      executionOrder,
      parallelGroups,
    };
  }

  /**
   * Calculate priority based on number of dependents
   * @param node - The internal node to calculate priority for
   * @returns Priority score based on the number of dependents
   */
  private calculatePriority(node: InternalNode): number {
    // Higher priority for nodes with more dependents
    return node.dependents.size;
  }

  /**
   * Perform topological sort using Kahn's algorithm
   * @returns Ordered list of issue IDs
   */
  private topologicalSort(): readonly string[] {
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
      // Sort queue by priority (dependents count) for deterministic order
      queue.sort((a, b) => {
        const nodeA = this.nodes.get(a);
        const nodeB = this.nodes.get(b);
        return (nodeB?.dependents.size ?? 0) - (nodeA?.dependents.size ?? 0);
      });

      const nodeId = queue.shift();
      if (nodeId === undefined) continue;

      result.push(nodeId);

      const node = this.nodes.get(nodeId);
      if (!node) continue;

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
   * @returns Array of parallel groups organized by depth level
   */
  private buildParallelGroups(): readonly ParallelGroup[] {
    const groups: ParallelGroup[] = [];
    const maxDepth = Math.max(...Array.from(this.nodes.values()).map((n) => n.depth));

    for (let depth = 0; depth <= maxDepth; depth++) {
      const issueIds = Array.from(this.nodes.values())
        .filter((n) => n.depth === depth)
        .map((n) => n.id)
        .sort(); // Sort for deterministic order

      if (issueIds.length > 0) {
        groups.push({
          groupIndex: depth,
          issueIds,
        });
      }
    }

    return groups;
  }

  /**
   * Get direct dependencies for an issue
   * @param issueId - The issue ID to get dependencies for
   * @returns Array of issue IDs that this issue depends on
   */
  public getDependencies(issueId: string): readonly string[] {
    const node = this.nodes.get(issueId);
    return node ? Array.from(node.dependencies) : [];
  }

  /**
   * Get direct dependents for an issue
   * @param issueId - The issue ID to get dependents for
   * @returns Array of issue IDs that depend on this issue
   */
  public getDependents(issueId: string): readonly string[] {
    const node = this.nodes.get(issueId);
    return node ? Array.from(node.dependents) : [];
  }

  /**
   * Check if issue A depends on issue B (directly or transitively)
   * @param issueA - The dependent issue ID
   * @param issueB - The dependency issue ID to check for
   * @returns True if issueA depends on issueB, false otherwise
   */
  public dependsOn(issueA: string, issueB: string): boolean {
    const visited = new Set<string>();
    const queue = [issueA];

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined || visited.has(current)) continue;

      visited.add(current);

      const node = this.nodes.get(current);
      if (!node) continue;

      if (node.dependencies.has(issueB)) {
        return true;
      }

      for (const dep of node.dependencies) {
        if (!visited.has(dep)) {
          queue.push(dep);
        }
      }
    }

    return false;
  }

  /**
   * Get all transitive dependencies for an issue
   * @param issueId - The issue ID to get transitive dependencies for
   * @returns Sorted array of all issue IDs that this issue transitively depends on
   */
  public getTransitiveDependencies(issueId: string): readonly string[] {
    const result = new Set<string>();
    const queue = [issueId];

    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) continue;

      const node = this.nodes.get(current);
      if (!node) continue;

      for (const dep of node.dependencies) {
        if (!result.has(dep)) {
          result.add(dep);
          queue.push(dep);
        }
      }
    }

    return Array.from(result).sort();
  }

  /**
   * Get statistics about the graph
   * @returns Graph statistics including node count, edge count, and depth metrics
   */
  public getStatistics(): {
    totalNodes: number;
    totalEdges: number;
    maxDepth: number;
    rootNodes: number;
    leafNodes: number;
  } {
    const nodesArray = Array.from(this.nodes.values());

    return {
      totalNodes: this.nodes.size,
      totalEdges: nodesArray.reduce((sum, n) => sum + n.dependencies.size, 0),
      maxDepth: Math.max(...nodesArray.map((n) => n.depth), 0),
      rootNodes: nodesArray.filter((n) => n.dependencies.size === 0).length,
      leafNodes: nodesArray.filter((n) => n.dependents.size === 0).length,
    };
  }
}
