/**
 * Issue Reader Agent
 *
 * Imports existing GitHub issues and converts them to AD-SDLC internal format.
 * Parses issue metadata, extracts dependencies from body text, builds a
 * dependency graph, and outputs issue_list.json and dependency_graph.json.
 *
 * Implements SDS-001 CMP-028 (Section 3.28).
 * Implements IAgent interface for unified agent instantiation through AgentFactory.
 */

import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import type { IAgent } from '../agents/types.js';
import { getCommandSanitizer } from '../security/index.js';

import type {
  IssueImportOptions,
  IssueImportResult,
  ImportedIssue,
  ImportedIssueLabels,
  ImportDependencyGraph,
  ImportGraphNode,
  ImportGraphEdge,
  ImportStats,
  IssueReaderConfig,
  IssueReaderSession,
  Priority,
  EffortSize,
} from './types.js';

import {
  DEFAULT_ISSUE_READER_CONFIG,
  PRIORITY_LABEL_MAP,
  DEFAULT_PRIORITY,
  EFFORT_LABEL_MAP,
  DEFAULT_EFFORT_SIZE,
  EFFORT_HOURS,
  TYPE_LABEL_KEYWORDS,
  DEFAULT_ISSUE_TYPE,
} from './types.js';

import { GhAuthError, IssueFetchError, OutputWriteError } from './errors.js';

/**
 * Agent ID for IssueReaderAgent used in AgentFactory
 */
export const ISSUE_READER_AGENT_ID = 'issue-reader-agent';

/**
 * Dependency patterns to detect in issue body text (case-insensitive).
 * Each pattern captures a list of issue numbers.
 */
const DEPENDS_ON_PATTERNS: readonly RegExp[] = [
  /depends\s+on\s+#(\d+)/gi,
  /blocked\s+by\s+#(\d+)/gi,
  /requires\s+#(\d+)/gi,
  /after\s+#(\d+)/gi,
];

const BLOCKS_PATTERNS: readonly RegExp[] = [/blocks\s+#(\d+)/gi, /required\s+by\s+#(\d+)/gi];

/**
 * Raw issue structure returned by gh CLI JSON output
 */
interface GhIssueRaw {
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly state: string;
  readonly url: string;
  readonly labels: readonly { readonly name: string }[];
  readonly assignees: readonly { readonly login: string }[];
  readonly milestone: { readonly title: string } | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Issue Reader Agent
 *
 * Imports GitHub issues and converts them to AD-SDLC internal format.
 * Entry point for the Import Pipeline.
 */
export class IssueReaderAgent implements IAgent {
  public readonly agentId = ISSUE_READER_AGENT_ID;
  public readonly name = 'Issue Reader Agent';

  private readonly config: Required<IssueReaderConfig>;
  private session: IssueReaderSession | null = null;
  private initialized = false;

  constructor(config: IssueReaderConfig = {}) {
    this.config = {
      ...DEFAULT_ISSUE_READER_CONFIG,
      ...config,
    };
  }

  /**
   *
   */
  public async initialize(): Promise<void> {
    if (this.initialized) return;
    await Promise.resolve();
    this.initialized = true;
  }

  /**
   *
   */
  public async dispose(): Promise<void> {
    await Promise.resolve();
    this.session = null;
    this.initialized = false;
  }

  // ---------------------------------------------------------------------------
  // Session Management
  // ---------------------------------------------------------------------------

  /**
   * Start a new import session
   * @param repository
   */
  public startSession(repository: string): IssueReaderSession {
    const now = new Date().toISOString();

    this.session = {
      sessionId: randomUUID(),
      repository,
      status: 'pending',
      result: null,
      startedAt: now,
      updatedAt: now,
      errors: [],
    };

    return this.session;
  }

  /**
   * Get the current session
   */
  public getSession(): IssueReaderSession | null {
    return this.session;
  }

  // ---------------------------------------------------------------------------
  // Core: Import Issues
  // ---------------------------------------------------------------------------

  /**
   * Import issues from a GitHub repository
   *
   * Implements the IIssueReaderAgent.importIssues interface from SDS-001 Section 3.28.
   * @param repoUrl
   * @param options
   */
  public async importIssues(
    repoUrl: string,
    options: IssueImportOptions = {}
  ): Promise<IssueImportResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const repository = this.normalizeRepoUrl(repoUrl);
    const session = this.session ?? this.startSession(repository);

    this.session = { ...session, status: 'importing', repository };

    try {
      // Step 1: Verify gh authentication
      this.verifyGhAuth();

      // Step 2: Fetch issues from GitHub
      const rawIssues = this.fetchIssues(repository, options);

      // Step 3: Convert to internal format
      const issues = this.convertIssues(rawIssues, repository);

      // Step 4: Build dependency graph
      const dependencyGraph = this.buildDependencyGraph(issues);

      // Step 5: Compute statistics
      const stats = this.computeStats(issues);

      const result: IssueImportResult = {
        repository,
        importedAt: new Date().toISOString(),
        filterCriteria: options,
        issues,
        dependencyGraph,
        stats,
      };

      // Step 6: Save output
      this.saveOutput(repository, result);

      // Update session
      this.session = {
        ...this.session,
        status: 'completed',
        result,
        updatedAt: new Date().toISOString(),
      };

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.session = {
        ...this.session,
        status: 'failed',
        updatedAt: new Date().toISOString(),
        errors: [...this.session.errors, errorMessage],
      };

      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Private: GitHub Operations
  // ---------------------------------------------------------------------------

  /**
   * Verify gh CLI authentication
   */
  private verifyGhAuth(): void {
    const result = this.runGhCommand(['auth', 'status']);
    if (!result.success) {
      throw new GhAuthError();
    }
  }

  /**
   * Fetch issues from GitHub using gh CLI
   * @param repository
   * @param options
   */
  private fetchIssues(repository: string, options: IssueImportOptions): readonly GhIssueRaw[] {
    const args = [
      'issue',
      'list',
      '--repo',
      repository,
      '--json',
      'number,title,body,state,url,labels,assignees,milestone,createdAt,updatedAt',
      '--limit',
      String(options.limit ?? this.config.maxIssues),
      '--state',
      options.state ?? this.config.defaultState,
    ];

    if (options.labels !== undefined && options.labels.length > 0) {
      for (const label of options.labels) {
        args.push('--label', label);
      }
    }

    if (options.milestone !== undefined && options.milestone !== '') {
      args.push('--milestone', options.milestone);
    }

    if (options.assignee !== undefined && options.assignee !== '') {
      args.push('--assignee', options.assignee);
    }

    const result = this.runGhCommand(args);

    if (!result.success) {
      const errorMsg = result.error ?? 'Unknown error';
      throw new IssueFetchError(repository, errorMsg);
    }

    const trimmed = result.output.trim();
    if (trimmed === '' || trimmed === '[]') {
      return [];
    }

    return JSON.parse(trimmed) as GhIssueRaw[];
  }

  // ---------------------------------------------------------------------------
  // Private: Issue Conversion
  // ---------------------------------------------------------------------------

  /**
   * Convert raw GitHub issues to AD-SDLC internal format
   * @param rawIssues
   * @param repository
   */
  private convertIssues(
    rawIssues: readonly GhIssueRaw[],
    repository: string
  ): readonly ImportedIssue[] {
    // Collect all valid issue numbers for reference validation
    const validNumbers = new Set(rawIssues.map((issue) => issue.number));

    return rawIssues.map((raw, index) => {
      const labelNames = raw.labels.map((l) => l.name);
      const labels = this.mapLabels(labelNames);
      const { dependsOn, blocks } = this.extractDependencies(raw.body, validNumbers);
      const complexity = this.estimateComplexity(labels.size);

      return {
        id: `ISS-${String(index + 1).padStart(3, '0')}`,
        number: raw.number,
        url:
          raw.url !== ''
            ? raw.url
            : `https://github.com/${repository}/issues/${String(raw.number)}`,
        title: raw.title,
        body: raw.body,
        state: raw.state.toLowerCase(),
        labels,
        milestone: raw.milestone?.title ?? null,
        assignees: raw.assignees.map((a) => a.login),
        dependsOn,
        blocks,
        complexity,
        estimatedHours: EFFORT_HOURS[labels.size],
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      };
    });
  }

  /**
   * Map raw GitHub labels to structured AD-SDLC labels
   * @param labelNames
   */
  private mapLabels(labelNames: readonly string[]): ImportedIssueLabels {
    let priority: Priority = DEFAULT_PRIORITY;
    let size: EffortSize = DEFAULT_EFFORT_SIZE;
    let type = DEFAULT_ISSUE_TYPE;

    for (const name of labelNames) {
      const lower = name.toLowerCase();

      // Priority mapping
      if (PRIORITY_LABEL_MAP[lower] !== undefined) {
        priority = PRIORITY_LABEL_MAP[lower];
      }

      // Effort size mapping
      if (EFFORT_LABEL_MAP[name] !== undefined) {
        size = EFFORT_LABEL_MAP[name];
      }

      // Type mapping
      for (const [keyword, mappedType] of Object.entries(TYPE_LABEL_KEYWORDS)) {
        if (lower.includes(keyword)) {
          type = mappedType;
          break;
        }
      }
    }

    return { raw: labelNames, priority, type, size };
  }

  /**
   * Extract dependency relationships from issue body text
   * @param body
   * @param validNumbers
   */
  private extractDependencies(
    body: string,
    validNumbers: ReadonlySet<number>
  ): { dependsOn: readonly number[]; blocks: readonly number[] } {
    const dependsOn = new Set<number>();
    const blocks = new Set<number>();

    if (body === '') {
      return { dependsOn: [], blocks: [] };
    }

    for (const pattern of DEPENDS_ON_PATTERNS) {
      // Reset lastIndex for global regexes
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(body)) !== null) {
        const num = Number(match[1]);
        if (validNumbers.has(num)) {
          dependsOn.add(num);
        }
      }
    }

    for (const pattern of BLOCKS_PATTERNS) {
      pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(body)) !== null) {
        const num = Number(match[1]);
        if (validNumbers.has(num)) {
          blocks.add(num);
        }
      }
    }

    return {
      dependsOn: [...dependsOn],
      blocks: [...blocks],
    };
  }

  /**
   * Estimate issue complexity from effort size
   * @param size
   */
  private estimateComplexity(size: EffortSize): 'small' | 'medium' | 'large' {
    if (size === 'XS' || size === 'S') return 'small';
    if (size === 'M') return 'medium';
    return 'large';
  }

  // ---------------------------------------------------------------------------
  // Private: Dependency Graph
  // ---------------------------------------------------------------------------

  /**
   * Build a dependency graph from imported issues
   * @param issues
   */
  private buildDependencyGraph(issues: readonly ImportedIssue[]): ImportDependencyGraph {
    const numberToId = new Map<number, ImportedIssue>();
    for (const issue of issues) {
      numberToId.set(issue.number, issue);
    }

    // Build nodes
    const nodes: ImportGraphNode[] = issues.map((issue) => ({
      id: issue.id,
      githubNumber: issue.number,
      title: issue.title,
      priority: issue.labels.priority,
      size: issue.labels.size,
      status: 'ready' as const,
    }));

    // Build edges
    const edges: ImportGraphEdge[] = [];
    for (const issue of issues) {
      for (const depNum of issue.dependsOn) {
        const dep = numberToId.get(depNum);
        if (dep !== undefined) {
          edges.push({
            from: issue.id,
            to: dep.id,
            type: 'depends_on',
            githubFrom: issue.number,
            githubTo: depNum,
          });
        }
      }
      for (const blockNum of issue.blocks) {
        const blocked = numberToId.get(blockNum);
        if (blocked !== undefined) {
          edges.push({
            from: issue.id,
            to: blocked.id,
            type: 'blocks',
            githubFrom: issue.number,
            githubTo: blockNum,
          });
        }
      }
    }

    // Detect cycles and compute topological order
    const { hasCycles, topologicalOrder, cycleNodes } = this.topologicalSort(issues, numberToId);

    // Mark blocked and cycle nodes
    const blockedIds = this.findBlockedNodes(issues, numberToId);
    const finalNodes = nodes.map((node) => {
      if (cycleNodes.has(node.id)) return { ...node, status: 'in_cycle' as const };
      if (blockedIds.has(node.id)) return { ...node, status: 'blocked' as const };
      return node;
    });

    // Roots: no incoming depends_on edges
    const hasIncoming = new Set<string>();
    for (const edge of edges) {
      if (edge.type === 'depends_on') {
        hasIncoming.add(edge.from); // "from" depends on "to" => "from" has incoming
      }
    }
    const roots = issues.filter((i) => !hasIncoming.has(i.id)).map((i) => i.id);

    // Leaves: no outgoing depends_on edges
    const hasOutgoing = new Set<string>();
    for (const edge of edges) {
      if (edge.type === 'depends_on') {
        hasOutgoing.add(edge.to); // "to" is depended upon => "to" has outgoing
      }
    }
    const leaves = issues.filter((i) => !hasOutgoing.has(i.id)).map((i) => i.id);

    return {
      schemaVersion: '1.0',
      generatedAt: new Date().toISOString(),
      nodes: finalNodes,
      edges,
      roots,
      leaves,
      hasCycles,
      topologicalOrder,
    };
  }

  /**
   * Perform topological sort using Kahn's algorithm on depends_on edges
   * @param issues
   * @param numberToId
   */
  private topologicalSort(
    issues: readonly ImportedIssue[],
    numberToId: ReadonlyMap<number, ImportedIssue>
  ): { hasCycles: boolean; topologicalOrder: readonly string[]; cycleNodes: ReadonlySet<string> } {
    // Build adjacency: for depends_on, the dependency must come first
    // If A depends on B, then B → A in execution order
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const issue of issues) {
      inDegree.set(issue.id, 0);
      adjacency.set(issue.id, []);
    }

    for (const issue of issues) {
      for (const depNum of issue.dependsOn) {
        const dep = numberToId.get(depNum);
        if (dep !== undefined) {
          // dep must complete before issue
          adjacency.get(dep.id)?.push(issue.id);
          inDegree.set(issue.id, (inDegree.get(issue.id) ?? 0) + 1);
        }
      }
    }

    // Kahn's algorithm
    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) {
        queue.push(id);
      }
    }

    const order: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) break;
      order.push(current);

      for (const neighbor of adjacency.get(current) ?? []) {
        const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    const hasCycles = order.length < issues.length;
    const orderedSet = new Set(order);
    const cycleNodes = new Set(issues.filter((i) => !orderedSet.has(i.id)).map((i) => i.id));

    return {
      hasCycles,
      topologicalOrder: hasCycles ? [] : order,
      cycleNodes,
    };
  }

  /**
   * Find nodes that are blocked (have unresolved dependencies)
   * @param issues
   * @param numberToId
   */
  private findBlockedNodes(
    issues: readonly ImportedIssue[],
    numberToId: ReadonlyMap<number, ImportedIssue>
  ): ReadonlySet<string> {
    const blocked = new Set<string>();
    for (const issue of issues) {
      if (issue.dependsOn.length > 0) {
        // Check if any dependency is still in the set (i.e., not yet resolved)
        const hasUnresolved = issue.dependsOn.some((depNum) => numberToId.has(depNum));
        if (hasUnresolved) {
          blocked.add(issue.id);
        }
      }
    }
    return blocked;
  }

  // ---------------------------------------------------------------------------
  // Private: Statistics
  // ---------------------------------------------------------------------------

  /**
   * Compute import statistics
   * @param issues
   */
  private computeStats(issues: readonly ImportedIssue[]): ImportStats {
    const byPriority: Record<Priority, number> = { P0: 0, P1: 0, P2: 0, P3: 0 };
    let totalHours = 0;
    let withDeps = 0;

    for (const issue of issues) {
      byPriority[issue.labels.priority]++;
      totalHours += issue.estimatedHours;
      if (issue.dependsOn.length > 0 || issue.blocks.length > 0) {
        withDeps++;
      }
    }

    return {
      total: issues.length,
      imported: issues.length,
      skipped: 0,
      withDependencies: withDeps,
      byPriority,
      totalEstimatedHours: totalHours,
    };
  }

  // ---------------------------------------------------------------------------
  // Private: Command Execution
  // ---------------------------------------------------------------------------

  /**
   * Run a gh command via CommandSanitizer
   * @param args
   */
  private runGhCommand(args: readonly string[]): {
    success: boolean;
    output: string;
    error?: string;
  } {
    const sanitizer = getCommandSanitizer();

    const result = sanitizer.execGhSync([...args], {
      cwd: process.cwd(),
      timeout: this.config.ghCommandTimeoutMs,
    });

    return {
      success: result.success,
      output: result.stdout,
      ...(result.success ? {} : { error: result.stderr }),
    };
  }

  // ---------------------------------------------------------------------------
  // Private: Utility
  // ---------------------------------------------------------------------------

  /**
   * Normalize a repository URL to owner/repo format
   * @param repoUrl
   */
  private normalizeRepoUrl(repoUrl: string): string {
    // Already in owner/repo format
    if (/^[^/]+\/[^/]+$/.test(repoUrl)) {
      return repoUrl;
    }

    // Extract from full URL
    const match = repoUrl.match(/github\.com\/([^/]+\/[^/]+?)(?:\.git)?(?:\/.*)?$/);
    if (match !== null && typeof match[1] === 'string') {
      return match[1];
    }

    return repoUrl;
  }

  // ---------------------------------------------------------------------------
  // Private: State Persistence
  // ---------------------------------------------------------------------------

  /**
   * Save import results to scratchpad
   * @param repository
   * @param result
   */
  private saveOutput(repository: string, result: IssueImportResult): void {
    const projectId = repository.replace('/', '_');
    const outputDir = path.join(process.cwd(), this.config.scratchpadBasePath, 'issues', projectId);

    try {
      fs.mkdirSync(outputDir, { recursive: true });

      // Write issue_list.json
      const issueListPath = path.join(outputDir, 'issue_list.json');
      fs.writeFileSync(
        issueListPath,
        JSON.stringify(
          {
            schema_version: '1.0',
            source: 'github_import',
            repository: result.repository,
            imported_at: result.importedAt,
            filter_criteria: result.filterCriteria,
            issues: result.issues,
            statistics: result.stats,
          },
          null,
          2
        ),
        'utf-8'
      );

      // Write dependency_graph.json
      const graphPath = path.join(outputDir, 'dependency_graph.json');
      fs.writeFileSync(graphPath, JSON.stringify(result.dependencyGraph, null, 2), 'utf-8');
    } catch (error) {
      throw new OutputWriteError(
        outputDir,
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton Management
// ---------------------------------------------------------------------------

let instance: IssueReaderAgent | null = null;

/**
 * Get the singleton Issue Reader Agent instance
 * @param config
 */
export function getIssueReaderAgent(config?: IssueReaderConfig): IssueReaderAgent {
  if (instance === null) {
    instance = new IssueReaderAgent(config);
  }
  return instance;
}

/**
 * Reset the singleton instance (useful for testing)
 */
export function resetIssueReaderAgent(): void {
  instance = null;
}
