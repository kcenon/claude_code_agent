/**
 * Traceability Mapper module
 *
 * Builds traceability matrices between SRS features, use cases,
 * and SDS components, ensuring complete coverage and identifying gaps.
 */

import type {
  ParsedSRS,
  ParsedSRSFeature,
  ParsedUseCase,
  SDSComponent,
  TraceabilityEntry,
  TraceabilityMatrix,
} from './types.js';
import { LowCoverageError } from './errors.js';

/**
 * Traceability mapper options
 */
export interface TraceabilityMapperOptions {
  /** Minimum coverage threshold (0-100) */
  readonly coverageThreshold?: number;
  /** Fail if coverage is below threshold */
  readonly failOnLowCoverage?: boolean;
  /** Include use case traceability */
  readonly traceUseCases?: boolean;
  /** Include PRD requirement traceability */
  readonly tracePRDRequirements?: boolean;
}

/**
 * Default mapper options
 */
const DEFAULT_OPTIONS: Required<TraceabilityMapperOptions> = {
  coverageThreshold: 80,
  failOnLowCoverage: false,
  traceUseCases: true,
  tracePRDRequirements: true,
};

/**
 * Traceability analysis result
 */
export interface TraceabilityAnalysis {
  /** Complete traceability matrix */
  readonly matrix: TraceabilityMatrix;
  /** Coverage statistics */
  readonly stats: TraceabilityStats;
  /** Warnings about incomplete traceability */
  readonly warnings: readonly string[];
}

/**
 * Traceability statistics
 */
export interface TraceabilityStats {
  /** Total SRS features */
  readonly totalFeatures: number;
  /** Features with components */
  readonly coveredFeatures: number;
  /** Total SDS components */
  readonly totalComponents: number;
  /** Components with features */
  readonly tracedComponents: number;
  /** Forward coverage (SRS -> SDS) */
  readonly forwardCoverage: number;
  /** Backward coverage (SDS -> SRS) */
  readonly backwardCoverage: number;
  /** Total use cases */
  readonly totalUseCases: number;
  /** Use cases linked to components */
  readonly linkedUseCases: number;
}

/**
 * Mapper for building traceability matrices
 */
export class TraceabilityMapper {
  private readonly options: Required<TraceabilityMapperOptions>;

  constructor(options: TraceabilityMapperOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Build a traceability matrix from SRS and SDS components
   * @param srs - Parsed SRS document
   * @param components - Designed SDS components
   * @returns Traceability analysis
   * @throws LowCoverageError if coverage is below threshold and failOnLowCoverage is true
   */
  public build(srs: ParsedSRS, components: readonly SDSComponent[]): TraceabilityAnalysis {
    const entries: TraceabilityEntry[] = [];
    const warnings: string[] = [];

    // Create lookups
    const featureById = new Map<string, ParsedSRSFeature>();
    for (const feature of srs.features) {
      featureById.set(feature.id, feature);
    }

    const useCasesByFeature = new Map<string, ParsedUseCase[]>();
    for (const useCase of srs.useCases) {
      const existing = useCasesByFeature.get(useCase.sourceFeatureId) ?? [];
      existing.push(useCase);
      useCasesByFeature.set(useCase.sourceFeatureId, existing);
    }

    // Track which features have components
    const coveredFeatures = new Set<string>();
    const coveredUseCases = new Set<string>();

    // Build entries from components
    for (const component of components) {
      const featureId = component.sourceFeature;
      const feature = featureById.get(featureId);

      if (!feature) {
        warnings.push(`Component ${component.id} references unknown feature ${featureId}`);
        continue;
      }

      coveredFeatures.add(featureId);

      // Get use cases for this feature
      const useCases = useCasesByFeature.get(featureId) ?? [];
      const useCaseIds = useCases.map((uc) => uc.id);
      for (const ucId of useCaseIds) {
        coveredUseCases.add(ucId);
      }

      // Get PRD requirements
      const prdRequirements = this.options.tracePRDRequirements
        ? feature.sourceRequirements
        : [];

      entries.push({
        componentId: component.id,
        srsFeature: featureId,
        useCases: this.options.traceUseCases ? useCaseIds : [],
        prdRequirement: prdRequirements[0] ?? '',
      });
    }

    // Find orphan components (components without valid feature reference)
    const orphanComponents: string[] = [];
    for (const component of components) {
      if (!featureById.has(component.sourceFeature)) {
        orphanComponents.push(component.id);
      }
    }

    // Find uncovered features
    const uncoveredFeatures: string[] = [];
    for (const feature of srs.features) {
      if (!coveredFeatures.has(feature.id)) {
        uncoveredFeatures.push(feature.id);
        warnings.push(`Feature ${feature.id} (${feature.name}) has no SDS component`);
      }
    }

    // Calculate coverage
    const forwardCoverage =
      srs.features.length > 0
        ? Math.round((coveredFeatures.size / srs.features.length) * 100)
        : 100;

    // Build matrix
    const matrix: TraceabilityMatrix = {
      entries,
      forwardCoverage,
      orphanComponents,
      uncoveredFeatures,
    };

    // Build stats
    const stats: TraceabilityStats = {
      totalFeatures: srs.features.length,
      coveredFeatures: coveredFeatures.size,
      totalComponents: components.length,
      tracedComponents: components.length - orphanComponents.length,
      forwardCoverage,
      backwardCoverage:
        components.length > 0
          ? Math.round(((components.length - orphanComponents.length) / components.length) * 100)
          : 100,
      totalUseCases: srs.useCases.length,
      linkedUseCases: coveredUseCases.size,
    };

    // Check coverage threshold
    if (this.options.failOnLowCoverage && forwardCoverage < this.options.coverageThreshold) {
      throw new LowCoverageError(forwardCoverage, this.options.coverageThreshold, uncoveredFeatures);
    }

    if (forwardCoverage < this.options.coverageThreshold) {
      warnings.push(
        `Forward coverage ${forwardCoverage}% is below threshold ${this.options.coverageThreshold}%`
      );
    }

    return {
      matrix,
      stats,
      warnings,
    };
  }

  /**
   * Generate a markdown table from the traceability matrix
   * @param matrix - Traceability matrix
   * @returns Markdown table string
   */
  public toMarkdownTable(matrix: TraceabilityMatrix): string {
    const lines: string[] = [];

    // Header
    lines.push('| Component | SRS Feature | Use Cases | PRD Requirement |');
    lines.push('|-----------|-------------|-----------|-----------------|');

    // Entries
    for (const entry of matrix.entries) {
      const useCases = entry.useCases.length > 0 ? entry.useCases.join(', ') : '-';
      const prdReq = entry.prdRequirement || '-';
      lines.push(`| ${entry.componentId} | ${entry.srsFeature} | ${useCases} | ${prdReq} |`);
    }

    // Summary
    lines.push('');
    lines.push(`**Coverage:** ${matrix.forwardCoverage}%`);

    if (matrix.uncoveredFeatures.length > 0) {
      lines.push('');
      lines.push('**Uncovered Features:**');
      for (const feature of matrix.uncoveredFeatures) {
        lines.push(`- ${feature}`);
      }
    }

    if (matrix.orphanComponents.length > 0) {
      lines.push('');
      lines.push('**Orphan Components (no valid feature reference):**');
      for (const component of matrix.orphanComponents) {
        lines.push(`- ${component}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Validate traceability completeness
   * @param matrix - Traceability matrix
   * @returns Validation errors
   */
  public validate(matrix: TraceabilityMatrix): readonly string[] {
    const errors: string[] = [];

    // Check for components without feature
    if (matrix.orphanComponents.length > 0) {
      errors.push(
        `${matrix.orphanComponents.length} component(s) have no valid feature reference`
      );
    }

    // Check for uncovered features
    if (matrix.uncoveredFeatures.length > 0) {
      errors.push(`${matrix.uncoveredFeatures.length} feature(s) have no SDS component`);
    }

    // Check coverage
    if (matrix.forwardCoverage < this.options.coverageThreshold) {
      errors.push(
        `Coverage ${matrix.forwardCoverage}% is below threshold ${this.options.coverageThreshold}%`
      );
    }

    return errors;
  }

  /**
   * Get a summary report of the traceability
   * @param analysis - Traceability analysis
   * @returns Summary report
   */
  public getSummary(analysis: TraceabilityAnalysis): string {
    const { stats, matrix, warnings } = analysis;

    const lines: string[] = [
      '## Traceability Summary',
      '',
      '### Coverage Metrics',
      '',
      '| Metric | Value |',
      '|--------|-------|',
      `| SRS Features | ${stats.coveredFeatures}/${stats.totalFeatures} (${stats.forwardCoverage}%) |`,
      `| SDS Components | ${stats.tracedComponents}/${stats.totalComponents} (${stats.backwardCoverage}%) |`,
      `| Use Cases Linked | ${stats.linkedUseCases}/${stats.totalUseCases} |`,
      '',
    ];

    if (matrix.uncoveredFeatures.length > 0) {
      lines.push('### Uncovered Features');
      lines.push('');
      lines.push('The following SRS features do not have corresponding SDS components:');
      lines.push('');
      for (const feature of matrix.uncoveredFeatures) {
        lines.push(`- ${feature}`);
      }
      lines.push('');
    }

    if (matrix.orphanComponents.length > 0) {
      lines.push('### Orphan Components');
      lines.push('');
      lines.push('The following SDS components do not reference valid SRS features:');
      lines.push('');
      for (const component of matrix.orphanComponents) {
        lines.push(`- ${component}`);
      }
      lines.push('');
    }

    if (warnings.length > 0) {
      lines.push('### Warnings');
      lines.push('');
      for (const warning of warnings) {
        lines.push(`- ⚠️ ${warning}`);
      }
      lines.push('');
    }

    // Status
    const status =
      stats.forwardCoverage >= this.options.coverageThreshold
        ? '✅ **Status: PASS** - Coverage meets threshold'
        : '❌ **Status: FAIL** - Coverage below threshold';

    lines.push(status);

    return lines.join('\n');
  }

  /**
   * Merge multiple traceability matrices
   * @param matrices - Matrices to merge
   * @returns Merged matrix
   */
  public merge(...matrices: TraceabilityMatrix[]): TraceabilityMatrix {
    const allEntries: TraceabilityEntry[] = [];
    const allOrphanComponents: string[] = [];
    const allUncoveredFeatures: string[] = [];

    for (const matrix of matrices) {
      allEntries.push(...matrix.entries);
      allOrphanComponents.push(...matrix.orphanComponents);
      allUncoveredFeatures.push(...matrix.uncoveredFeatures);
    }

    // Deduplicate
    const seenEntries = new Set<string>();
    const uniqueEntries = allEntries.filter((entry) => {
      const key = `${entry.componentId}-${entry.srsFeature}`;
      if (seenEntries.has(key)) {
        return false;
      }
      seenEntries.add(key);
      return true;
    });

    const uniqueOrphanComponents = [...new Set(allOrphanComponents)];
    const uniqueUncoveredFeatures = [...new Set(allUncoveredFeatures)];

    // Recalculate coverage
    const coveredFeatures = new Set(uniqueEntries.map((e) => e.srsFeature));
    const totalFeatures = coveredFeatures.size + uniqueUncoveredFeatures.length;
    const forwardCoverage =
      totalFeatures > 0 ? Math.round((coveredFeatures.size / totalFeatures) * 100) : 100;

    return {
      entries: uniqueEntries,
      forwardCoverage,
      orphanComponents: uniqueOrphanComponents,
      uncoveredFeatures: uniqueUncoveredFeatures,
    };
  }

  /**
   * Filter matrix by priority
   * @param matrix - Traceability matrix
   * @param components - Components with priority info
   * @param minPriority - Minimum priority to include (P0 is highest)
   * @returns Filtered matrix
   */
  public filterByPriority(
    matrix: TraceabilityMatrix,
    components: readonly SDSComponent[],
    minPriority: 'P0' | 'P1' | 'P2' | 'P3'
  ): TraceabilityMatrix {
    const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
    const minOrder = priorityOrder[minPriority];

    const componentMap = new Map<string, SDSComponent>();
    for (const component of components) {
      componentMap.set(component.id, component);
    }

    const filteredEntries = matrix.entries.filter((entry) => {
      const component = componentMap.get(entry.componentId);
      if (!component) return false;
      return priorityOrder[component.priority] <= minOrder;
    });

    // Recalculate coverage for filtered entries
    const coveredFeatures = new Set(filteredEntries.map((e) => e.srsFeature));
    const totalFeatures = coveredFeatures.size + matrix.uncoveredFeatures.length;
    const forwardCoverage =
      totalFeatures > 0 ? Math.round((coveredFeatures.size / totalFeatures) * 100) : 100;

    return {
      entries: filteredEntries,
      forwardCoverage,
      orphanComponents: matrix.orphanComponents.filter((c) => {
        const component = componentMap.get(c);
        if (!component) return true;
        return priorityOrder[component.priority] <= minOrder;
      }),
      uncoveredFeatures: matrix.uncoveredFeatures,
    };
  }
}
