/**
 * ConsistencyChecker - Validates requirement consistency
 *
 * Checks for conflicts, duplicates, and balance issues
 * in the collected requirements.
 */

/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import type { CollectedInfo } from '../scratchpad/index.js';
import type {
  ConsistencyIssue,
  ConsistencyCheckResult,
  ConsistencyIssueType,
  GapSeverity,
  PriorityDistribution,
  DependencyAnalysis,
} from './types.js';

/**
 * Configuration for consistency checking
 */
export interface ConsistencyCheckerOptions {
  /** Maximum percentage of P0 requirements allowed */
  readonly maxP0Percentage?: number;
  /** Minimum percentage of P2/P3 requirements expected */
  readonly minLowPriorityPercentage?: number;
  /** Whether to check for bidirectional dependencies */
  readonly checkBidirectionalDeps?: boolean;
  /** Similarity threshold for duplicate detection (0.0 - 1.0) */
  readonly duplicateSimilarityThreshold?: number;
}

/**
 * Default consistency checker options
 */
const DEFAULT_OPTIONS: Required<ConsistencyCheckerOptions> = {
  maxP0Percentage: 30,
  minLowPriorityPercentage: 20,
  checkBidirectionalDeps: true,
  duplicateSimilarityThreshold: 0.8,
};

/**
 * ConsistencyChecker class for validating requirement consistency
 */
export class ConsistencyChecker {
  private readonly options: Required<ConsistencyCheckerOptions>;
  private issueIdCounter: number = 0;

  constructor(options: ConsistencyCheckerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Check collected info for consistency issues
   *
   * @param collectedInfo - The collected information to check
   * @returns Consistency check result
   */
  public check(collectedInfo: CollectedInfo): ConsistencyCheckResult {
    this.issueIdCounter = 0;
    const issues: ConsistencyIssue[] = [];

    // Check priority distribution
    const priorityDistribution = this.analyzePriorityDistribution(collectedInfo);
    if (!priorityDistribution.isBalanced) {
      issues.push(
        this.createIssue(
          'unbalanced_priorities',
          'minor',
          priorityDistribution.recommendation ?? 'Priority distribution is unbalanced',
          [],
          'Review and adjust requirement priorities for better balance'
        )
      );
    }

    // Check for duplicate requirements
    issues.push(...this.checkDuplicates(collectedInfo));

    // Check for conflicting requirements
    issues.push(...this.checkConflicts(collectedInfo));

    // Analyze dependencies
    const dependencyAnalysis = this.analyzeDependencies(collectedInfo);

    // Check for circular dependencies
    for (const chain of dependencyAnalysis.circularChains) {
      issues.push(
        this.createIssue(
          'circular_dependency',
          'major',
          `Circular dependency detected: ${chain.join(' -> ')}`,
          chain,
          'Break the circular dependency by reordering or restructuring requirements'
        )
      );
    }

    // Check for missing bidirectional dependencies
    if (this.options.checkBidirectionalDeps) {
      for (const missingDep of dependencyAnalysis.missingBidirectional) {
        issues.push(
          this.createIssue(
            'missing_bidirectional_dependency',
            'info',
            `Dependency reference is not bidirectional: ${missingDep}`,
            [missingDep],
            'Add reverse dependency reference for completeness'
          )
        );
      }
    }

    return {
      isConsistent:
        issues.filter((i) => i.severity === 'critical' || i.severity === 'major').length === 0,
      issues,
      priorityDistribution,
      dependencyAnalysis,
    };
  }

  /**
   * Analyze priority distribution across requirements
   * @param info
   */
  private analyzePriorityDistribution(info: CollectedInfo): PriorityDistribution {
    const functionalReqs = info.requirements?.functional ?? [];
    const total = functionalReqs.length;

    if (total === 0) {
      return {
        p0Count: 0,
        p1Count: 0,
        p2Count: 0,
        p3Count: 0,
        isBalanced: true,
      };
    }

    const p0Count = functionalReqs.filter((r) => r.priority === 'P0').length;
    const p1Count = functionalReqs.filter((r) => r.priority === 'P1').length;
    const p2Count = functionalReqs.filter((r) => r.priority === 'P2').length;
    const p3Count = functionalReqs.filter((r) => r.priority === 'P3').length;

    const p0Percentage = (p0Count / total) * 100;
    const lowPriorityPercentage = ((p2Count + p3Count) / total) * 100;

    let isBalanced = true;
    let recommendation: string | undefined;

    if (p0Percentage > this.options.maxP0Percentage) {
      isBalanced = false;
      recommendation = `Too many P0 requirements (${String(Math.round(p0Percentage))}%). Consider demoting some to P1.`;
    } else if (lowPriorityPercentage < this.options.minLowPriorityPercentage && total >= 3) {
      isBalanced = false;
      recommendation = `Not enough P2/P3 requirements (${String(Math.round(lowPriorityPercentage))}%). Consider adding lower priority nice-to-haves.`;
    }

    const result: PriorityDistribution = {
      p0Count,
      p1Count,
      p2Count,
      p3Count,
      isBalanced,
    };

    if (recommendation !== undefined) {
      return { ...result, recommendation };
    }
    return result;
  }

  /**
   * Check for duplicate requirements
   * @param info
   */
  private checkDuplicates(info: CollectedInfo): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];
    const functionalReqs = info.requirements?.functional ?? [];

    // Compare each pair of requirements for similarity
    for (let i = 0; i < functionalReqs.length; i++) {
      for (let j = i + 1; j < functionalReqs.length; j++) {
        const req1 = functionalReqs[i];
        const req2 = functionalReqs[j];

        if (req1 === undefined || req2 === undefined) {
          continue;
        }

        const titleSimilarity = this.calculateSimilarity(req1.title, req2.title);
        const descSimilarity = this.calculateSimilarity(req1.description, req2.description);

        // Check if either title or description is too similar
        if (
          titleSimilarity >= this.options.duplicateSimilarityThreshold ||
          descSimilarity >= this.options.duplicateSimilarityThreshold
        ) {
          issues.push(
            this.createIssue(
              'duplicate_requirement',
              'major',
              `Potential duplicate: ${req1.id} and ${req2.id} are ${String(Math.round(Math.max(titleSimilarity, descSimilarity) * 100))}% similar`,
              [req1.id, req2.id],
              'Merge or differentiate these requirements'
            )
          );
        }
      }
    }

    return issues;
  }

  /**
   * Check for conflicting requirements
   * @param info
   */
  private checkConflicts(info: CollectedInfo): ConsistencyIssue[] {
    const issues: ConsistencyIssue[] = [];
    const functionalReqs = info.requirements?.functional ?? [];
    const nfrs = info.requirements?.nonFunctional ?? [];

    // Check for common conflict patterns
    // 1. Performance vs Security NFRs
    const perfNFRs = nfrs.filter((n) => n.category === 'performance');
    const secNFRs = nfrs.filter((n) => n.category === 'security');

    if (perfNFRs.length > 0 && secNFRs.length > 0) {
      // Check if there are strict performance targets alongside heavy security requirements
      for (const perf of perfNFRs) {
        for (const sec of secNFRs) {
          // Check for potential conflicts in descriptions
          if (
            this.containsConflictingTerms(perf.description, ['encryption', 'logging', 'audit']) &&
            this.containsConflictingTerms(sec.description, ['fast', 'minimal', 'overhead'])
          ) {
            issues.push(
              this.createIssue(
                'conflicting_requirements',
                'info',
                `Potential conflict between ${perf.id} (performance) and ${sec.id} (security)`,
                [perf.id, sec.id],
                'Clarify how these requirements will be balanced'
              )
            );
          }
        }
      }
    }

    // 2. Check for contradictory functional requirements
    for (let i = 0; i < functionalReqs.length; i++) {
      for (let j = i + 1; j < functionalReqs.length; j++) {
        const req1 = functionalReqs[i];
        const req2 = functionalReqs[j];

        if (req1 === undefined || req2 === undefined) {
          continue;
        }

        if (this.areContradictory(req1.description, req2.description)) {
          issues.push(
            this.createIssue(
              'conflicting_requirements',
              'major',
              `Potential contradiction between ${req1.id} and ${req2.id}`,
              [req1.id, req2.id],
              'Review and resolve the conflicting requirements'
            )
          );
        }
      }
    }

    return issues;
  }

  /**
   * Analyze dependencies in requirements
   * @param info
   */
  private analyzeDependencies(info: CollectedInfo): DependencyAnalysis {
    const functionalReqs = info.requirements?.functional ?? [];
    const dependencyMap = new Map<string, string[]>();

    // Build dependency map
    for (const req of functionalReqs) {
      const deps = req.dependencies ?? [];
      dependencyMap.set(req.id, [...deps]);
    }

    // Find circular dependencies
    const circularChains: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const detectCycle = (node: string, path: string[]): void => {
      visited.add(node);
      recursionStack.add(node);

      const deps = dependencyMap.get(node) ?? [];
      for (const dep of deps) {
        if (!visited.has(dep)) {
          detectCycle(dep, [...path, dep]);
        } else if (recursionStack.has(dep)) {
          // Found a cycle
          const cycleStart = path.indexOf(dep);
          if (cycleStart >= 0) {
            circularChains.push([...path.slice(cycleStart), dep]);
          } else {
            circularChains.push([...path, dep]);
          }
        }
      }

      recursionStack.delete(node);
    };

    for (const reqId of dependencyMap.keys()) {
      if (!visited.has(reqId)) {
        detectCycle(reqId, [reqId]);
      }
    }

    // Find missing bidirectional dependencies
    const missingBidirectional: string[] = [];
    for (const [reqId, deps] of dependencyMap) {
      for (const dep of deps) {
        const reverseDeps = dependencyMap.get(dep) ?? [];
        if (!reverseDeps.includes(reqId)) {
          missingBidirectional.push(`${reqId} -> ${dep}`);
        }
      }
    }

    // Count total dependencies
    let totalDeps = 0;
    for (const deps of dependencyMap.values()) {
      totalDeps += deps.length;
    }

    return {
      totalDependencies: totalDeps,
      missingBidirectional,
      circularChains,
    };
  }

  /**
   * Calculate string similarity using Jaccard index
   * @param str1
   * @param str2
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const set1 = new Set(str1.toLowerCase().split(/\s+/));
    const set2 = new Set(str2.toLowerCase().split(/\s+/));

    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    if (union.size === 0) return 0;
    return intersection.size / union.size;
  }

  /**
   * Check if text contains any of the specified terms
   * @param text
   * @param terms
   */
  private containsConflictingTerms(text: string, terms: string[]): boolean {
    const lowerText = text.toLowerCase();
    return terms.some((term) => lowerText.includes(term.toLowerCase()));
  }

  /**
   * Check if two descriptions are contradictory
   * @param desc1
   * @param desc2
   */
  private areContradictory(desc1: string, desc2: string): boolean {
    const contradictionPairs: Array<[string, string]> = [
      ['must', 'must not'],
      ['always', 'never'],
      ['enable', 'disable'],
      ['allow', 'prevent'],
      ['require', 'optional'],
      ['mandatory', 'forbidden'],
    ];

    const lower1 = desc1.toLowerCase();
    const lower2 = desc2.toLowerCase();

    for (const pair of contradictionPairs) {
      const term1 = pair[0];
      const term2 = pair[1];
      if (
        (lower1.includes(term1) && lower2.includes(term2)) ||
        (lower1.includes(term2) && lower2.includes(term1))
      ) {
        // Check if they're about the same subject (simple heuristic)
        const commonWords = this.getCommonNonTrivialWords(lower1, lower2);
        if (commonWords.length >= 2) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Get common non-trivial words between two texts
   * @param text1
   * @param text2
   */
  private getCommonNonTrivialWords(text1: string, text2: string): string[] {
    const trivialWords = new Set([
      'the',
      'a',
      'an',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'to',
      'of',
      'and',
      'or',
      'in',
      'on',
      'at',
      'for',
      'with',
      'by',
      'from',
      'as',
      'it',
      'this',
      'that',
      'which',
      'should',
      'must',
      'will',
      'can',
      'may',
    ]);

    const words1 = new Set(text1.split(/\s+/).filter((w) => w.length > 2 && !trivialWords.has(w)));
    const words2 = new Set(text2.split(/\s+/).filter((w) => w.length > 2 && !trivialWords.has(w)));

    return [...words1].filter((w) => words2.has(w));
  }

  /**
   * Create a consistency issue with auto-generated ID
   * @param type
   * @param severity
   * @param description
   * @param relatedIds
   * @param suggestion
   */
  private createIssue(
    type: ConsistencyIssueType,
    severity: GapSeverity,
    description: string,
    relatedIds: readonly string[],
    suggestion: string
  ): ConsistencyIssue {
    this.issueIdCounter++;
    return {
      id: `CON-${String(this.issueIdCounter).padStart(3, '0')}`,
      type,
      severity,
      description,
      relatedIds,
      suggestion,
    };
  }
}
