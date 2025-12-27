/**
 * Issue Generator module
 *
 * Main entry point for generating GitHub Issues from SDS documents.
 * Orchestrates parsing, transformation, and dependency analysis.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  ParsedSDS,
  GeneratedIssue,
  IssueGenerationResult,
  GenerationSummary,
  IssueGeneratorOptions,
  SDSParserOptions,
  Priority,
  IssueType,
  EffortSize,
} from './types.js';
import { SDSParser } from './SDSParser.js';
import { IssueTransformer } from './IssueTransformer.js';
import { EffortEstimator, type EffortEstimatorOptions } from './EffortEstimator.js';
import { DependencyGraphBuilder } from './DependencyGraph.js';
import { SDSNotFoundError, SDSValidationError } from './errors.js';

/**
 * Full configuration options for IssueGenerator
 */
export interface IssueGeneratorConfig {
  /** Generator options */
  readonly generator?: IssueGeneratorOptions;
  /** Parser options */
  readonly parser?: SDSParserOptions;
  /** Estimator options */
  readonly estimator?: EffortEstimatorOptions;
  /** Base path for output files */
  readonly outputPath?: string;
  /** Validate SDS before processing */
  readonly validateSDS?: boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<IssueGeneratorConfig> = {
  generator: {},
  parser: {},
  estimator: {},
  outputPath: '.ad-sdlc/scratchpad/issues',
  validateSDS: true,
};

/**
 * Global singleton instance
 */
let globalInstance: IssueGenerator | null = null;

/**
 * Main Issue Generator class
 *
 * Orchestrates the transformation of SDS documents into GitHub Issues
 * with proper dependencies, labels, and effort estimates.
 */
export class IssueGenerator {
  private readonly config: Required<IssueGeneratorConfig>;
  private readonly parser: SDSParser;
  private readonly transformer: IssueTransformer;
  private readonly estimator: EffortEstimator;
  private readonly graphBuilder: DependencyGraphBuilder;

  constructor(config: IssueGeneratorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.parser = new SDSParser(this.config.parser);
    this.estimator = new EffortEstimator(this.config.estimator);
    this.transformer = new IssueTransformer(this.config.generator, this.estimator);
    this.graphBuilder = new DependencyGraphBuilder();
  }

  /**
   * Generate issues from an SDS file
   * @param sdsPath - Path to the SDS markdown file
   * @param projectId - Project identifier for output
   * @returns Issue generation result
   */
  public async generateFromFile(
    sdsPath: string,
    projectId: string
  ): Promise<IssueGenerationResult> {
    // Verify file exists
    if (!fs.existsSync(sdsPath)) {
      throw new SDSNotFoundError(sdsPath);
    }

    // Read SDS content
    const content = await fs.promises.readFile(sdsPath, 'utf-8');

    // Generate issues
    const result = this.generate(content);

    // Save output files
    await this.saveResults(result, projectId);

    return result;
  }

  /**
   * Generate issues from SDS content
   * @param sdsContent - SDS markdown content
   * @returns Issue generation result
   */
  public generate(sdsContent: string): IssueGenerationResult {
    // Parse SDS
    const parsedSDS = this.parser.parse(sdsContent);

    // Validate if enabled
    if (this.config.validateSDS) {
      const errors = this.parser.validate(parsedSDS);
      if (errors.length > 0) {
        throw new SDSValidationError(errors);
      }
    }

    // Transform to issues
    const issues = this.transformer.transformAll(parsedSDS);

    // Build dependency graph
    const componentToIssue = this.transformer.getComponentToIssueMap(issues);
    const dependencyGraph = this.graphBuilder.build(parsedSDS.components, componentToIssue);

    // Resolve dependencies (replace component IDs with issue IDs)
    const resolvedIssues = this.resolveDependencies(issues, componentToIssue);

    // Generate summary
    const summary = this.buildSummary(resolvedIssues, parsedSDS);

    return {
      issues: resolvedIssues,
      dependencyGraph,
      summary,
    };
  }

  /**
   * Generate issues from a parsed SDS
   * @param sds - Already parsed SDS
   * @returns Issue generation result
   */
  public generateFromParsed(sds: ParsedSDS): IssueGenerationResult {
    // Validate if enabled
    if (this.config.validateSDS) {
      const errors = this.parser.validate(sds);
      if (errors.length > 0) {
        throw new SDSValidationError(errors);
      }
    }

    // Transform to issues
    const issues = this.transformer.transformAll(sds);

    // Build dependency graph
    const componentToIssue = this.transformer.getComponentToIssueMap(issues);
    const dependencyGraph = this.graphBuilder.build(sds.components, componentToIssue);

    // Resolve dependencies
    const resolvedIssues = this.resolveDependencies(issues, componentToIssue);

    // Generate summary
    const summary = this.buildSummary(resolvedIssues, sds);

    return {
      issues: resolvedIssues,
      dependencyGraph,
      summary,
    };
  }

  /**
   * Parse SDS content without generating issues
   * @param content - SDS markdown content
   * @returns Parsed SDS structure
   */
  public parse(content: string): ParsedSDS {
    return this.parser.parse(content);
  }

  /**
   * Validate SDS content
   * @param content - SDS markdown content
   * @returns Array of validation errors (empty if valid)
   */
  public validate(content: string): readonly string[] {
    const sds = this.parser.parse(content);
    return this.parser.validate(sds);
  }

  /**
   * Resolve component dependencies to issue IDs
   */
  private resolveDependencies(
    issues: readonly GeneratedIssue[],
    componentToIssue: Map<string, string>
  ): readonly GeneratedIssue[] {
    return issues.map((issue) => {
      const resolvedBlockedBy = issue.dependencies.blockedBy
        .map((dep) => {
          // If it's already an issue ID, keep it
          if (dep.startsWith('ISS-')) return dep;
          // Otherwise resolve from component ID
          return componentToIssue.get(dep) ?? dep;
        })
        .filter((dep) => dep.startsWith('ISS-'));

      return {
        ...issue,
        dependencies: {
          blockedBy: resolvedBlockedBy,
          blocks: issue.dependencies.blocks,
        },
      };
    });
  }

  /**
   * Build generation summary
   */
  private buildSummary(issues: readonly GeneratedIssue[], sds: ParsedSDS): GenerationSummary {
    const byPriority: Record<Priority, number> = {
      P0: 0,
      P1: 0,
      P2: 0,
      P3: 0,
    };

    const byType: Record<IssueType, number> = {
      feature: 0,
      enhancement: 0,
      bug: 0,
      docs: 0,
      chore: 0,
    };

    const bySize: Record<EffortSize, number> = {
      XS: 0,
      S: 0,
      M: 0,
      L: 0,
      XL: 0,
    };

    let totalHours = 0;
    const warnings: string[] = [];

    for (const issue of issues) {
      byPriority[issue.labels.priority]++;
      byType[issue.labels.type]++;
      bySize[issue.estimation.size]++;
      totalHours += issue.estimation.hours;

      // Check for potential issues
      if (issue.estimation.size === 'XL') {
        warnings.push(`Issue ${issue.issueId} is XL size - consider splitting`);
      }
      if (issue.dependencies.blockedBy.length > 3) {
        warnings.push(
          `Issue ${issue.issueId} has ${String(issue.dependencies.blockedBy.length)} dependencies`
        );
      }
    }

    return {
      totalIssues: issues.length,
      byPriority,
      byType,
      bySize,
      totalEstimatedHours: totalHours,
      componentsProcessed: sds.components.length,
      generatedAt: new Date().toISOString(),
      warnings,
    };
  }

  /**
   * Save results to output files
   */
  private async saveResults(result: IssueGenerationResult, projectId: string): Promise<void> {
    const outputDir = path.join(this.config.outputPath, projectId);

    // Create directory if needed
    await fs.promises.mkdir(outputDir, { recursive: true, mode: 0o700 });

    // Save issue list
    const issueListPath = path.join(outputDir, 'issue_list.json');
    await fs.promises.writeFile(issueListPath, JSON.stringify(result.issues, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });

    // Save dependency graph
    const graphPath = path.join(outputDir, 'dependency_graph.json');
    await fs.promises.writeFile(graphPath, JSON.stringify(result.dependencyGraph, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });

    // Save summary
    const summaryPath = path.join(outputDir, 'generation_summary.json');
    await fs.promises.writeFile(summaryPath, JSON.stringify(result.summary, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });
  }

  /**
   * Get execution order for issues
   * @param result - Issue generation result
   * @returns Ordered issue IDs for execution
   */
  public getExecutionOrder(result: IssueGenerationResult): readonly string[] {
    return result.dependencyGraph.executionOrder;
  }

  /**
   * Get issues that can be executed in parallel
   * @param result - Issue generation result
   * @returns Groups of parallel-executable issues
   */
  public getParallelGroups(
    result: IssueGenerationResult
  ): readonly { groupIndex: number; issues: readonly GeneratedIssue[] }[] {
    return result.dependencyGraph.parallelGroups.map((group) => ({
      groupIndex: group.groupIndex,
      issues: group.issueIds
        .map((id) => result.issues.find((i) => i.issueId === id))
        .filter((i): i is GeneratedIssue => i !== undefined),
    }));
  }

  /**
   * Get graph statistics
   */
  public getGraphStatistics(result: IssueGenerationResult): {
    totalNodes: number;
    totalEdges: number;
    maxDepth: number;
    rootNodes: number;
    leafNodes: number;
  } {
    const graph = result.dependencyGraph;
    return {
      totalNodes: graph.nodes.length,
      totalEdges: graph.edges.length,
      maxDepth: Math.max(...graph.nodes.map((n) => n.depth), 0),
      rootNodes: graph.nodes.filter((n) => !graph.edges.some((e) => e.from === n.id)).length,
      leafNodes: graph.nodes.filter((n) => !graph.edges.some((e) => e.to === n.id)).length,
    };
  }
}

/**
 * Get the global IssueGenerator instance
 * Creates a new instance with default config if none exists
 */
export function getIssueGenerator(config?: IssueGeneratorConfig): IssueGenerator {
  if (!globalInstance) {
    globalInstance = new IssueGenerator(config);
  }
  return globalInstance;
}

/**
 * Reset the global IssueGenerator instance
 * Primarily useful for testing
 */
export function resetIssueGenerator(): void {
  globalInstance = null;
}
