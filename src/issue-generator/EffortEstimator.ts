/**
 * Effort Estimator module
 *
 * Estimates implementation effort for SDS components
 * using complexity analysis and configurable factors.
 */

import type {
  SDSComponent,
  EffortSize,
  IssueEstimation,
  EstimationFactors,
} from './types.js';
import { EstimationError } from './errors.js';

/**
 * Effort size thresholds
 */
interface EffortThresholds {
  readonly xs: number;
  readonly s: number;
  readonly m: number;
  readonly l: number;
}

/**
 * Default thresholds for effort estimation
 */
const DEFAULT_THRESHOLDS: EffortThresholds = {
  xs: 2,
  s: 4,
  m: 6,
  l: 8,
};

/**
 * Hours mapping for each effort size
 */
const SIZE_TO_HOURS: Record<EffortSize, number> = {
  XS: 2,
  S: 4,
  M: 8,
  L: 16,
  XL: 32,
};

/**
 * Weights for estimation factors
 */
interface EstimationWeights {
  /** Weight for complexity factor (0-1) */
  readonly complexity: number;
  /** Weight for interface count (0-1) */
  readonly interfaces: number;
  /** Weight for dependency count (0-1) */
  readonly dependencies: number;
  /** Weight for method count (0-1) */
  readonly methods: number;
}

/**
 * Default weights for estimation factors
 */
const DEFAULT_WEIGHTS: EstimationWeights = {
  complexity: 0.35,
  interfaces: 0.25,
  dependencies: 0.2,
  methods: 0.2,
};

/**
 * Effort estimator configuration options
 */
export interface EffortEstimatorOptions {
  /** Custom thresholds for effort sizes */
  readonly thresholds?: Partial<EffortThresholds>;
  /** Custom weights for estimation factors */
  readonly weights?: Partial<EstimationWeights>;
  /** Minimum complexity score */
  readonly minComplexity?: number;
  /** Maximum complexity score */
  readonly maxComplexity?: number;
}

/**
 * Estimates implementation effort for SDS components
 */
export class EffortEstimator {
  private readonly thresholds: EffortThresholds;
  private readonly weights: EstimationWeights;
  private readonly minComplexity: number;
  private readonly maxComplexity: number;

  constructor(options: EffortEstimatorOptions = {}) {
    this.thresholds = { ...DEFAULT_THRESHOLDS, ...options.thresholds };
    this.weights = { ...DEFAULT_WEIGHTS, ...options.weights };
    this.minComplexity = options.minComplexity ?? 1;
    this.maxComplexity = options.maxComplexity ?? 10;

    this.validateWeights();
  }

  /**
   * Validate that weights sum to approximately 1
   */
  private validateWeights(): void {
    const sum =
      this.weights.complexity +
      this.weights.interfaces +
      this.weights.dependencies +
      this.weights.methods;

    if (Math.abs(sum - 1) > 0.01) {
      throw new EstimationError(
        'config',
        `Weights must sum to 1, got ${sum.toFixed(2)}`
      );
    }
  }

  /**
   * Estimate effort for a single component
   * @param component - The SDS component to estimate
   * @returns Effort estimation with factors
   */
  public estimate(component: SDSComponent): IssueEstimation {
    const factors = this.calculateFactors(component);
    const score = this.calculateScore(factors);
    const size = this.scoreToSize(score);

    return {
      size,
      hours: SIZE_TO_HOURS[size],
      factors,
    };
  }

  /**
   * Estimate effort for multiple components
   * @param components - Array of SDS components
   * @returns Map of component ID to estimation
   */
  public estimateAll(
    components: readonly SDSComponent[]
  ): Map<string, IssueEstimation> {
    const results = new Map<string, IssueEstimation>();

    for (const component of components) {
      results.set(component.id, this.estimate(component));
    }

    return results;
  }

  /**
   * Calculate estimation factors for a component
   */
  private calculateFactors(component: SDSComponent): EstimationFactors {
    const complexity = this.analyzeComplexity(component);
    const interfaceCount = component.interfaces.length;
    const dependencyCount = component.dependencies.length;
    const methodCount = this.countMethods(component);

    return {
      complexity,
      interfaceCount,
      dependencyCount,
      methodCount,
    };
  }

  /**
   * Analyze component complexity based on various factors
   */
  private analyzeComplexity(component: SDSComponent): number {
    let score = this.minComplexity;

    // Description length indicates scope
    const descLength = component.description.length;
    if (descLength > 500) score += 2;
    else if (descLength > 200) score += 1;

    // Implementation notes indicate complexity
    const notesLength = component.implementationNotes.length;
    if (notesLength > 300) score += 2;
    else if (notesLength > 100) score += 1;

    // Interface complexity
    for (const iface of component.interfaces) {
      // Each method adds to complexity
      score += iface.methods.length * 0.3;

      // Complex return types add more
      for (const method of iface.methods) {
        if (method.returnType.includes('Promise')) score += 0.2;
        if (method.returnType.includes('|')) score += 0.1;
        if (method.returnType.length > 30) score += 0.2;
      }
    }

    // Dependencies add integration complexity
    score += component.dependencies.length * 0.4;

    // Priority affects perceived complexity
    const priorityBonus: Record<string, number> = {
      P0: 1.5,
      P1: 1.0,
      P2: 0.5,
      P3: 0.0,
    };
    score += priorityBonus[component.priority] ?? 0;

    // Clamp to valid range
    return Math.min(
      this.maxComplexity,
      Math.max(this.minComplexity, Math.round(score))
    );
  }

  /**
   * Count total methods across all interfaces
   */
  private countMethods(component: SDSComponent): number {
    return component.interfaces.reduce(
      (sum, iface) => sum + iface.methods.length,
      0
    );
  }

  /**
   * Calculate weighted score from factors
   */
  private calculateScore(factors: EstimationFactors): number {
    // Normalize each factor to 0-10 scale
    const normalizedComplexity = factors.complexity;
    const normalizedInterfaces = Math.min(10, factors.interfaceCount * 2);
    const normalizedDependencies = Math.min(10, factors.dependencyCount * 1.5);
    const normalizedMethods = Math.min(10, factors.methodCount);

    // Apply weights
    const score =
      normalizedComplexity * this.weights.complexity +
      normalizedInterfaces * this.weights.interfaces +
      normalizedDependencies * this.weights.dependencies +
      normalizedMethods * this.weights.methods;

    return score;
  }

  /**
   * Convert score to effort size
   */
  private scoreToSize(score: number): EffortSize {
    if (score < this.thresholds.xs) return 'XS';
    if (score < this.thresholds.s) return 'S';
    if (score < this.thresholds.m) return 'M';
    if (score < this.thresholds.l) return 'L';
    return 'XL';
  }

  /**
   * Get effort size description
   */
  public static getSizeDescription(size: EffortSize): string {
    const descriptions: Record<EffortSize, string> = {
      XS: 'Trivial change (< 2 hours)',
      S: 'Small feature (2-4 hours)',
      M: 'Medium feature (4-8 hours)',
      L: 'Large feature (1-2 days)',
      XL: 'Complex feature (> 2 days - consider splitting)',
    };
    return descriptions[size];
  }

  /**
   * Check if a component should be decomposed based on size
   */
  public shouldDecompose(
    component: SDSComponent,
    maxSize: EffortSize = 'L'
  ): boolean {
    const estimation = this.estimate(component);
    const sizeOrder: Record<EffortSize, number> = {
      XS: 0,
      S: 1,
      M: 2,
      L: 3,
      XL: 4,
    };

    return sizeOrder[estimation.size] > sizeOrder[maxSize];
  }

  /**
   * Suggest decomposition for large components
   * @param component - The component to analyze
   * @returns Suggested sub-tasks if decomposition is needed
   */
  public suggestDecomposition(
    component: SDSComponent
  ): readonly string[] | null {
    if (!this.shouldDecompose(component)) {
      return null;
    }

    const suggestions: string[] = [];

    // Suggest splitting by interface
    if (component.interfaces.length > 1) {
      for (const iface of component.interfaces) {
        suggestions.push(`Implement ${iface.name} interface`);
      }
    }

    // Suggest splitting by functionality
    if (component.interfaces.length <= 1) {
      const methodCount = this.countMethods(component);
      if (methodCount > 5) {
        suggestions.push('Implement core functionality');
        suggestions.push('Implement helper methods');
        suggestions.push('Implement edge case handling');
      } else {
        suggestions.push('Implement main logic');
        suggestions.push('Add unit tests');
        suggestions.push('Add documentation');
      }
    }

    // Add integration task if there are dependencies
    if (component.dependencies.length > 0) {
      suggestions.push('Integrate with dependent components');
    }

    return suggestions;
  }
}
