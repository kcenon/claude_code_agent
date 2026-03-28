/**
 * Local Issue Reader - Reads issues from local scratchpad files
 *
 * Alternative to IssueReaderAgent for local-only pipelines (no GitHub).
 * Reads issue_list.json and dependency_graph.json from the scratchpad
 * directory and returns the same IssueImportResult contract.
 *
 * If dependency_graph.json is absent, it is auto-generated from the
 * blocked_by/blocks fields in issue_list.json using Kahn's algorithm.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { IAgent } from '../agents/types.js';
import type {
  IssueImportResult,
  ImportedIssue,
  ImportDependencyGraph,
  ImportGraphNode,
  ImportGraphEdge,
  ImportStats,
  Priority,
  EffortSize,
} from './types.js';
import { IssueReaderError, LocalIssueFileNotFoundError } from './errors.js';
import { EFFORT_HOURS, DEFAULT_PRIORITY } from './types.js';
import { getLogger } from '../logging/index.js';

const logger = getLogger();

export const LOCAL_ISSUE_READER_ID = 'local-issue-reader';

/**
 * Reads issues from local JSON files instead of GitHub API.
 * Implements IAgent for pipeline integration.
 */
export class LocalIssueReader implements IAgent {
  public readonly agentId = LOCAL_ISSUE_READER_ID;
  public readonly name = 'Local Issue Reader';

  /**
   *
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async initialize(): Promise<void> {
    logger.debug('LocalIssueReader initialized');
  }

  /**
   *
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async dispose(): Promise<void> {
    logger.debug('LocalIssueReader disposed');
  }

  /**
   * Import issues from local scratchpad directory.
   *
   * @param issueDir - Directory containing issue_list.json (and optionally dependency_graph.json)
   * @returns IssueImportResult compatible with Controller/Worker pipeline
   * @throws LocalIssueFileNotFoundError if issue_list.json is missing
   * @throws IssueReaderError if files are malformed
   */
  async importFromLocal(issueDir: string): Promise<IssueImportResult> {
    const issueListPath = join(issueDir, 'issue_list.json');
    const depGraphPath = join(issueDir, 'dependency_graph.json');

    // 1. Read and validate issue_list.json
    if (!existsSync(issueListPath)) {
      throw new LocalIssueFileNotFoundError(issueListPath);
    }

    let issueListData: unknown;
    try {
      const raw = await readFile(issueListPath, 'utf-8');
      issueListData = JSON.parse(raw);
    } catch (err) {
      throw new IssueReaderError(
        `Failed to parse issue_list.json: ${err instanceof Error ? err.message : String(err)}`,
        'PARSE_ERROR',
        { path: issueListPath }
      );
    }

    const issues = this.extractIssues(issueListData);
    logger.info(`Loaded ${String(issues.length)} issues from local file`);

    // 2. Read dependency_graph.json or auto-generate
    let dependencyGraph: ImportDependencyGraph;
    if (existsSync(depGraphPath)) {
      try {
        const raw = await readFile(depGraphPath, 'utf-8');
        dependencyGraph = JSON.parse(raw) as ImportDependencyGraph;
        logger.info('Loaded dependency graph from local file');
      } catch {
        logger.warn('Failed to parse dependency_graph.json, auto-generating');
        dependencyGraph = this.buildDependencyGraph(issues);
      }
    } else {
      logger.info('No dependency_graph.json found, auto-generating from issue dependencies');
      dependencyGraph = this.buildDependencyGraph(issues);
    }

    // 3. Compute statistics
    const stats = this.computeStats(issues);

    return {
      repository: 'local',
      importedAt: new Date().toISOString(),
      filterCriteria: {},
      issues,
      dependencyGraph,
      stats,
    };
  }

  /**
   * Extract ImportedIssue[] from raw JSON data.
   * Supports both IssueGenerator format (with nested structure) and
   * direct ImportedIssue[] format.
   * @param data
   */
  private extractIssues(data: unknown): ImportedIssue[] {
    if (data === null || data === undefined || typeof data !== 'object') {
      throw new IssueReaderError('Invalid issue_list.json: expected object', 'VALIDATION_ERROR');
    }

    const obj = data as Record<string, unknown>;

    // Support both { issues: [...] } wrapper and direct array
    const issuesProp: unknown = obj.issues;
    const rawIssues = Array.isArray(issuesProp) ? issuesProp : Array.isArray(data) ? data : null;
    if (rawIssues === null) {
      throw new IssueReaderError(
        'Invalid issue_list.json: expected "issues" array or top-level array',
        'VALIDATION_ERROR'
      );
    }

    return rawIssues.map((raw: unknown, idx: number) => this.normalizeIssue(raw, idx));
  }

  /**
   * Normalize a raw issue object into ImportedIssue format.
   * Handles both IssueGenerator output and manually-created issue files.
   * @param raw
   * @param idx
   */
  private normalizeIssue(raw: unknown, idx: number): ImportedIssue {
    if (raw === null || raw === undefined || typeof raw !== 'object') {
      throw new IssueReaderError(
        `Issue at index ${String(idx)} is not an object`,
        'VALIDATION_ERROR'
      );
    }

    const issue = raw as Record<string, unknown>;

    // Required fields
    const id = (issue.id ?? issue.issueId ?? `ISS-${String(idx + 1).padStart(3, '0')}`) as string;
    const title = (issue.title ?? `Untitled Issue ${String(idx + 1)}`) as string;
    const body = (issue.body !== undefined && issue.body !== null ? issue.body : '') as string;

    // Labels — handle both flat and nested formats
    const labelsRaw = issue.labels as Record<string, unknown> | undefined;
    const labels = {
      raw: Array.isArray(labelsRaw?.raw) ? (labelsRaw.raw as string[]) : [],
      priority: (labelsRaw?.priority ?? DEFAULT_PRIORITY) as Priority,
      type: (labelsRaw?.type ?? 'feature') as string,
      size: (labelsRaw?.size ?? 'M') as EffortSize,
    };

    // Dependencies — handle both formats
    const deps = issue.dependencies as Record<string, unknown> | undefined;
    const dependsOn = this.extractDependencyNumbers(deps?.blocked_by ?? deps?.blockedBy);
    const blocks = this.extractDependencyNumbers(deps?.blocks);

    // Estimation
    const estimation = issue.estimation as Record<string, unknown> | undefined;
    const size = (estimation?.size ?? labels.size) as EffortSize;
    const estimatedHours = (estimation?.hours as number | undefined) ?? EFFORT_HOURS[size];

    return {
      id,
      number: (issue.number ?? issue.githubNumber ?? idx + 1) as number,
      url: (issue.url ?? '') as string,
      title,
      body,
      state: (issue.state ?? 'open') as string,
      labels,
      milestone: (issue.milestone ?? null) as string | null,
      assignees: Array.isArray(issue.assignees) ? (issue.assignees as string[]) : [],
      dependsOn,
      blocks,
      complexity: this.sizeToComplexity(size),
      estimatedHours,
      createdAt: (issue.createdAt ?? issue.created_at ?? new Date().toISOString()) as string,
      updatedAt: (issue.updatedAt ?? issue.updated_at ?? new Date().toISOString()) as string,
    };
  }

  /**
   * Extract dependency issue numbers from various input formats.
   * @param input
   */
  private extractDependencyNumbers(input: unknown): readonly number[] {
    if (!Array.isArray(input)) return [];
    return input
      .map((item: unknown) => {
        if (typeof item === 'number') return item;
        if (typeof item === 'string') {
          // Handle "ISS-001" format → convert to sequential number
          const match = /ISS-(\d+)/i.exec(item);
          if (match?.[1] !== undefined) return parseInt(match[1], 10);
          // Handle "#42" format
          const hashMatch = /^#?(\d+)$/.exec(item);
          if (hashMatch?.[1] !== undefined) return parseInt(hashMatch[1], 10);
        }
        return 0;
      })
      .filter((n: number) => n > 0);
  }

  private sizeToComplexity(size: EffortSize): 'small' | 'medium' | 'large' {
    if (size === 'XS' || size === 'S') return 'small';
    if (size === 'M') return 'medium';
    return 'large';
  }

  /**
   * Build dependency graph from issue dependency fields using Kahn's algorithm.
   * @param issues
   */
  private buildDependencyGraph(issues: readonly ImportedIssue[]): ImportDependencyGraph {
    const numberToId = new Map<number, string>();
    for (const issue of issues) {
      numberToId.set(issue.number, issue.id);
    }

    const nodes: ImportGraphNode[] = [];
    const edges: ImportGraphEdge[] = [];
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    // Build graph structure
    for (const issue of issues) {
      inDegree.set(issue.id, 0);
      adjacency.set(issue.id, []);
    }

    for (const issue of issues) {
      for (const depNum of issue.dependsOn) {
        const depId = numberToId.get(depNum);
        if (depId !== undefined) {
          edges.push({
            from: issue.id,
            to: depId,
            type: 'depends_on',
            githubFrom: issue.number,
            githubTo: depNum,
          });
          inDegree.set(issue.id, (inDegree.get(issue.id) ?? 0) + 1);
          adjacency.get(depId)?.push(issue.id);
        }
      }
    }

    // Kahn's algorithm for topological sort + cycle detection
    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    const topologicalOrder: string[] = [];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift() ?? '';
      topologicalOrder.push(current);
      visited.add(current);

      for (const neighbor of adjacency.get(current) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    const hasCycles = visited.size < issues.length;
    const cycleNodes = new Set<string>();
    if (hasCycles) {
      for (const issue of issues) {
        if (!visited.has(issue.id)) cycleNodes.add(issue.id);
      }
    }

    // Build nodes with status
    for (const issue of issues) {
      const status = cycleNodes.has(issue.id)
        ? ('in_cycle' as const)
        : (inDegree.get(issue.id) ?? 0) === 0
          ? ('ready' as const)
          : ('blocked' as const);

      nodes.push({
        id: issue.id,
        githubNumber: issue.number,
        title: issue.title,
        priority: issue.labels.priority,
        size: issue.labels.size,
        status,
      });
    }

    const roots = nodes.filter((n) => n.status === 'ready').map((n) => n.id);
    const leavesSet = new Set(issues.map((i) => i.id));
    for (const edge of edges) {
      leavesSet.delete(edge.to);
    }

    return {
      schemaVersion: '1.0',
      generatedAt: new Date().toISOString(),
      nodes,
      edges,
      roots,
      leaves: [...leavesSet],
      hasCycles,
      topologicalOrder: hasCycles ? [] : topologicalOrder,
    };
  }

  private computeStats(issues: readonly ImportedIssue[]): ImportStats {
    const byPriority: Record<Priority, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
    let withDependencies = 0;
    let totalEstimatedHours = 0;

    for (const issue of issues) {
      const p = issue.labels.priority;
      if (p in byPriority) byPriority[p]++;
      if (issue.dependsOn.length > 0 || issue.blocks.length > 0) withDependencies++;
      totalEstimatedHours += issue.estimatedHours;
    }

    return {
      total: issues.length,
      imported: issues.length,
      skipped: 0,
      withDependencies,
      byPriority,
      totalEstimatedHours,
    };
  }
}
