/**
 * Traceability Builder for SRS Writer Agent
 *
 * Builds and validates traceability matrices between PRD requirements
 * and SRS features/use cases. Ensures complete coverage and identifies gaps.
 */

import type {
  ParsedPRD,
  ParsedPRDRequirement,
  FeatureDecompositionResult,
  TraceabilityMatrix,
  TraceabilityEntry,
} from './types.js';

/**
 * Traceability builder options
 */
export interface TraceabilityBuilderOptions {
  /** Require 100% coverage */
  readonly requireFullCoverage?: boolean;
  /** Include NFR traceability */
  readonly includeNFRs?: boolean;
  /** Validate bidirectional traceability */
  readonly validateBidirectional?: boolean;
}

/**
 * Default builder options
 */
const DEFAULT_OPTIONS: Required<TraceabilityBuilderOptions> = {
  requireFullCoverage: true,
  includeNFRs: true,
  validateBidirectional: true,
};

/**
 * Traceability Builder class
 */
export class TraceabilityBuilder {
  private readonly options: Required<TraceabilityBuilderOptions>;

  constructor(options: TraceabilityBuilderOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Build traceability matrix from PRD and decomposition result
   *
   * @param parsedPRD - The parsed PRD document
   * @param decompositionResult - The feature decomposition result
   * @returns Complete traceability matrix
   */
  public build(
    parsedPRD: ParsedPRD,
    decompositionResult: FeatureDecompositionResult
  ): TraceabilityMatrix {
    const entries: TraceabilityEntry[] = [];
    const coveredRequirements = new Set<string>();
    const allFeatureIds = new Set<string>();
    const tracedFeatureIds = new Set<string>();

    // Collect all feature IDs
    for (const feature of decompositionResult.features) {
      allFeatureIds.add(feature.id);
    }

    // Build entries from traceability map
    for (const [requirementId, featureIds] of decompositionResult.traceabilityMap) {
      coveredRequirements.add(requirementId);

      // Collect use case IDs from features
      const useCaseIds: string[] = [];
      for (const featureId of featureIds) {
        tracedFeatureIds.add(featureId);
        const feature = decompositionResult.features.find((f) => f.id === featureId);
        if (feature !== undefined) {
          useCaseIds.push(...feature.useCases.map((uc) => uc.id));
        }
      }

      // Collect NFR references
      const nfrIds: string[] = [];
      if (this.options.includeNFRs) {
        const requirement = parsedPRD.functionalRequirements.find((r) => r.id === requirementId);
        if (requirement !== undefined) {
          nfrIds.push(...this.findRelatedNFRs(requirement, parsedPRD));
        }
      }

      entries.push({
        requirementId,
        featureIds: [...featureIds],
        useCaseIds: [...new Set(useCaseIds)],
        nfrIds: [...new Set(nfrIds)],
      });
    }

    // Calculate coverage
    const totalRequirements = parsedPRD.functionalRequirements.length;
    const forwardCoverage =
      totalRequirements > 0 ? (coveredRequirements.size / totalRequirements) * 100 : 100;

    // Find orphan features (not traced to any requirement)
    const orphanFeatures: string[] = [];
    for (const featureId of allFeatureIds) {
      if (!tracedFeatureIds.has(featureId)) {
        orphanFeatures.push(featureId);
      }
    }

    // Find uncovered requirements
    const uncoveredRequirements: string[] = [];
    for (const requirement of parsedPRD.functionalRequirements) {
      if (!coveredRequirements.has(requirement.id)) {
        uncoveredRequirements.push(requirement.id);
      }
    }

    return {
      entries,
      forwardCoverage,
      orphanFeatures,
      uncoveredRequirements,
    };
  }

  /**
   * Find NFRs related to a requirement
   */
  private findRelatedNFRs(requirement: ParsedPRDRequirement, parsedPRD: ParsedPRD): string[] {
    const relatedNFRs: string[] = [];

    // Check for explicit NFR references in description
    const nfrPattern = /NFR-\d{3}/g;
    let match: RegExpExecArray | null;
    while ((match = nfrPattern.exec(requirement.description)) !== null) {
      relatedNFRs.push(match[0]);
    }

    // Infer NFR relationships based on keywords
    const description = requirement.description.toLowerCase();

    for (const nfr of parsedPRD.nonFunctionalRequirements) {
      const nfrDesc = nfr.description.toLowerCase();
      const nfrCategory = nfr.category.toLowerCase();

      // Check for keyword overlap
      if (this.hasKeywordOverlap(description, nfrDesc)) {
        relatedNFRs.push(nfr.id);
        continue;
      }

      // Check category-based relationship
      if (this.isCategoryRelevant(description, nfrCategory)) {
        relatedNFRs.push(nfr.id);
      }
    }

    return [...new Set(relatedNFRs)];
  }

  /**
   * Check if there's keyword overlap between texts
   */
  private hasKeywordOverlap(text1: string, text2: string): boolean {
    // Extract significant words (4+ characters)
    const words1 = new Set(text1.match(/\b\w{4,}\b/g) ?? []);
    const words2 = new Set(text2.match(/\b\w{4,}\b/g) ?? []);

    // Check for overlap
    let overlapCount = 0;
    for (const word of words1) {
      if (words2.has(word)) {
        overlapCount++;
      }
    }

    // Require at least 2 overlapping words
    return overlapCount >= 2;
  }

  /**
   * Check if a category is relevant to the description
   */
  private isCategoryRelevant(description: string, category: string): boolean {
    const categoryKeywords: Record<string, string[]> = {
      performance: ['fast', 'speed', 'latency', 'response time', 'throughput'],
      security: ['secure', 'auth', 'encrypt', 'password', 'token', 'access'],
      scalability: ['scale', 'load', 'concurrent', 'capacity', 'growth'],
      reliability: ['reliable', 'uptime', 'available', 'failover', 'backup'],
      usability: ['user', 'interface', 'intuitive', 'easy', 'experience'],
      maintainability: ['maintain', 'modular', 'extensible', 'configur'],
    };

    const keywords = categoryKeywords[category] ?? [];
    return keywords.some((keyword) => description.includes(keyword));
  }

  /**
   * Validate the traceability matrix
   *
   * @param matrix - The traceability matrix to validate
   * @returns Validation result with any issues found
   */
  public validate(matrix: TraceabilityMatrix): TraceabilityValidationResult {
    const issues: TraceabilityIssue[] = [];

    // Check for uncovered requirements
    if (matrix.uncoveredRequirements.length > 0) {
      issues.push({
        type: 'uncovered_requirement',
        severity: 'error',
        message: `${String(matrix.uncoveredRequirements.length)} requirements are not traced to any feature`,
        affectedIds: [...matrix.uncoveredRequirements],
      });
    }

    // Check for orphan features
    if (matrix.orphanFeatures.length > 0) {
      issues.push({
        type: 'orphan_feature',
        severity: 'warning',
        message: `${String(matrix.orphanFeatures.length)} features are not traced to any requirement`,
        affectedIds: [...matrix.orphanFeatures],
      });
    }

    // Check for requirements without use cases
    for (const entry of matrix.entries) {
      if (entry.useCaseIds.length === 0) {
        issues.push({
          type: 'missing_use_cases',
          severity: 'warning',
          message: `Requirement ${entry.requirementId} has no associated use cases`,
          affectedIds: [entry.requirementId],
        });
      }
    }

    // Check coverage threshold
    if (this.options.requireFullCoverage && matrix.forwardCoverage < 100) {
      issues.push({
        type: 'low_coverage',
        severity: 'error',
        message: `Coverage ${matrix.forwardCoverage.toFixed(1)}% is below 100%`,
        affectedIds: [...matrix.uncoveredRequirements],
      });
    }

    return {
      isValid: issues.filter((i) => i.severity === 'error').length === 0,
      issues,
      coverage: matrix.forwardCoverage,
    };
  }

  /**
   * Generate traceability matrix as markdown
   *
   * @param matrix - The traceability matrix
   * @returns Markdown representation
   */
  public toMarkdown(matrix: TraceabilityMatrix): string {
    const lines: string[] = [];

    lines.push('## Traceability Matrix');
    lines.push('');
    lines.push('| PRD Requirement | SRS Features | Use Cases | NFRs |');
    lines.push('|-----------------|--------------|-----------|------|');

    for (const entry of matrix.entries) {
      const features = entry.featureIds.join(', ') || '-';
      const useCases = entry.useCaseIds.join(', ') || '-';
      const nfrs = entry.nfrIds.join(', ') || '-';
      lines.push(`| ${entry.requirementId} | ${features} | ${useCases} | ${nfrs} |`);
    }

    lines.push('');
    lines.push(`**Coverage**: ${matrix.forwardCoverage.toFixed(1)}%`);

    if (matrix.uncoveredRequirements.length > 0) {
      lines.push('');
      lines.push(`**Uncovered Requirements**: ${matrix.uncoveredRequirements.join(', ')}`);
    }

    if (matrix.orphanFeatures.length > 0) {
      lines.push('');
      lines.push(`**Orphan Features**: ${matrix.orphanFeatures.join(', ')}`);
    }

    return lines.join('\n');
  }

  /**
   * Generate reverse traceability (feature to requirements)
   */
  public buildReverseTraceability(matrix: TraceabilityMatrix): Map<string, string[]> {
    const reverseMap = new Map<string, string[]>();

    for (const entry of matrix.entries) {
      for (const featureId of entry.featureIds) {
        const existing = reverseMap.get(featureId) ?? [];
        existing.push(entry.requirementId);
        reverseMap.set(featureId, existing);
      }
    }

    return reverseMap;
  }
}

/**
 * Traceability validation result
 */
export interface TraceabilityValidationResult {
  /** Whether the matrix is valid */
  readonly isValid: boolean;
  /** List of issues found */
  readonly issues: readonly TraceabilityIssue[];
  /** Forward coverage percentage */
  readonly coverage: number;
}

/**
 * Traceability issue
 */
export interface TraceabilityIssue {
  /** Issue type */
  readonly type:
    | 'uncovered_requirement'
    | 'orphan_feature'
    | 'missing_use_cases'
    | 'low_coverage'
    | 'broken_reference';
  /** Issue severity */
  readonly severity: 'error' | 'warning' | 'info';
  /** Issue message */
  readonly message: string;
  /** Affected IDs */
  readonly affectedIds: readonly string[];
}
