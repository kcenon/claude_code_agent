/**
 * ContextPruner - Prunes context to fit within token limits
 *
 * Features:
 * - Priority-based content retention
 * - Recency scoring for keeping recent content
 * - Relevance scoring for keeping important content
 * - Configurable pruning strategies
 */

/**
 * Content section for pruning analysis
 */
export interface ContentSection {
  /** Section identifier */
  readonly id: string;
  /** Section content */
  readonly content: string;
  /** Estimated token count */
  readonly estimatedTokens: number;
  /** Section priority (higher = more important) */
  readonly priority?: number;
  /** Section timestamp for recency scoring */
  readonly timestamp?: Date;
  /** Section type for categorization */
  readonly type?: 'system' | 'user' | 'assistant' | 'context' | 'example';
  /** Whether this section is required (cannot be pruned) */
  readonly required?: boolean;
}

/**
 * Pruning strategy type
 */
export type PruningStrategy = 'recency' | 'relevance' | 'priority' | 'balanced';

/**
 * Context pruner configuration
 */
export interface ContextPrunerConfig {
  /** Maximum tokens to keep */
  readonly maxTokens: number;
  /** Pruning strategy */
  readonly strategy?: PruningStrategy;
  /** Weight for recency in balanced mode (0-1) */
  readonly recencyWeight?: number;
  /** Weight for relevance in balanced mode (0-1) */
  readonly relevanceWeight?: number;
  /** Weight for priority in balanced mode (0-1) */
  readonly priorityWeight?: number;
  /** Keywords for relevance scoring */
  readonly relevanceKeywords?: readonly string[];
  /** Reserve tokens for system prompts */
  readonly systemReserve?: number;
  /** Reserve tokens for expected output */
  readonly outputReserve?: number;
}

/**
 * Pruning result
 */
export interface PruningResult {
  /** Retained sections */
  readonly retainedSections: readonly ContentSection[];
  /** Pruned sections */
  readonly prunedSections: readonly ContentSection[];
  /** Total tokens in retained content */
  readonly totalTokens: number;
  /** Tokens saved by pruning */
  readonly tokensSaved: number;
  /** Original token count */
  readonly originalTokens: number;
  /** Pruning statistics */
  readonly stats: PruningStats;
}

/**
 * Pruning statistics
 */
export interface PruningStats {
  /** Number of sections analyzed */
  readonly sectionsAnalyzed: number;
  /** Number of sections retained */
  readonly sectionsRetained: number;
  /** Number of sections pruned */
  readonly sectionsPruned: number;
  /** Reduction percentage */
  readonly reductionPercent: number;
  /** Strategy used */
  readonly strategy: PruningStrategy;
}

/**
 * Scored section for internal processing
 */
interface ScoredSection {
  section: ContentSection;
  score: number;
  recencyScore: number;
  relevanceScore: number;
  priorityScore: number;
}

/**
 * Default configuration values
 */
const DEFAULT_STRATEGY: PruningStrategy = 'balanced';
const DEFAULT_RECENCY_WEIGHT = 0.3;
const DEFAULT_RELEVANCE_WEIGHT = 0.4;
const DEFAULT_PRIORITY_WEIGHT = 0.3;
const DEFAULT_SYSTEM_RESERVE = 500;
const DEFAULT_OUTPUT_RESERVE = 2000;

/**
 * Average characters per token (rough estimate)
 */
const CHARS_PER_TOKEN = 4;

/**
 * ContextPruner class for managing context size
 */
export class ContextPruner {
  private readonly config: Required<
    Pick<
      ContextPrunerConfig,
      'strategy' | 'recencyWeight' | 'relevanceWeight' | 'priorityWeight' | 'systemReserve' | 'outputReserve'
    >
  > &
    ContextPrunerConfig;

  constructor(config: ContextPrunerConfig) {
    this.config = {
      ...config,
      strategy: config.strategy ?? DEFAULT_STRATEGY,
      recencyWeight: config.recencyWeight ?? DEFAULT_RECENCY_WEIGHT,
      relevanceWeight: config.relevanceWeight ?? DEFAULT_RELEVANCE_WEIGHT,
      priorityWeight: config.priorityWeight ?? DEFAULT_PRIORITY_WEIGHT,
      systemReserve: config.systemReserve ?? DEFAULT_SYSTEM_RESERVE,
      outputReserve: config.outputReserve ?? DEFAULT_OUTPUT_RESERVE,
    };
  }

  /**
   * Prune content sections to fit within token limit
   */
  public prune(sections: readonly ContentSection[]): PruningResult {
    const availableTokens = this.config.maxTokens - this.config.systemReserve - this.config.outputReserve;
    const originalTokens = sections.reduce((sum, s) => sum + s.estimatedTokens, 0);

    // If within limit, return all sections
    if (originalTokens <= availableTokens) {
      return {
        retainedSections: sections,
        prunedSections: [],
        totalTokens: originalTokens,
        tokensSaved: 0,
        originalTokens,
        stats: {
          sectionsAnalyzed: sections.length,
          sectionsRetained: sections.length,
          sectionsPruned: 0,
          reductionPercent: 0,
          strategy: this.config.strategy,
        },
      };
    }

    // Score all sections
    const scoredSections = this.scoreSections(sections);

    // Separate required and optional sections
    const requiredSections = scoredSections.filter((s) => s.section.required === true);
    const optionalSections = scoredSections.filter((s) => s.section.required !== true);

    // Sort optional sections by score (descending)
    optionalSections.sort((a, b) => b.score - a.score);

    // Calculate tokens used by required sections
    const requiredTokens = requiredSections.reduce((sum, s) => sum + s.section.estimatedTokens, 0);

    // Select optional sections that fit
    const retained: ScoredSection[] = [...requiredSections];
    const pruned: ScoredSection[] = [];
    let currentTokens = requiredTokens;

    for (const scored of optionalSections) {
      if (currentTokens + scored.section.estimatedTokens <= availableTokens) {
        retained.push(scored);
        currentTokens += scored.section.estimatedTokens;
      } else {
        pruned.push(scored);
      }
    }

    const tokensSaved = originalTokens - currentTokens;

    return {
      retainedSections: retained.map((s) => s.section),
      prunedSections: pruned.map((s) => s.section),
      totalTokens: currentTokens,
      tokensSaved,
      originalTokens,
      stats: {
        sectionsAnalyzed: sections.length,
        sectionsRetained: retained.length,
        sectionsPruned: pruned.length,
        reductionPercent: Math.round((tokensSaved / originalTokens) * 100),
        strategy: this.config.strategy,
      },
    };
  }

  /**
   * Estimate token count for text
   */
  public estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  /**
   * Create a content section from text
   */
  public createSection(
    id: string,
    content: string,
    options?: {
      priority?: number;
      timestamp?: Date;
      type?: ContentSection['type'];
      required?: boolean;
    }
  ): ContentSection {
    const section: ContentSection = {
      id,
      content,
      estimatedTokens: this.estimateTokens(content),
    };

    if (options?.priority !== undefined) {
      (section as { priority?: number }).priority = options.priority;
    }
    if (options?.timestamp !== undefined) {
      (section as { timestamp?: Date }).timestamp = options.timestamp;
    }
    if (options?.type !== undefined) {
      (section as { type?: ContentSection['type'] }).type = options.type;
    }
    if (options?.required !== undefined) {
      (section as { required?: boolean }).required = options.required;
    }

    return section;
  }

  /**
   * Score sections based on strategy
   */
  private scoreSections(sections: readonly ContentSection[]): ScoredSection[] {
    const now = Date.now();
    const maxAge = this.getMaxAge(sections);

    return sections.map((section) => {
      const recencyScore = this.calculateRecencyScore(section, now, maxAge);
      const relevanceScore = this.calculateRelevanceScore(section);
      const priorityScore = this.calculatePriorityScore(section);

      let score: number;

      switch (this.config.strategy) {
        case 'recency':
          score = recencyScore;
          break;
        case 'relevance':
          score = relevanceScore;
          break;
        case 'priority':
          score = priorityScore;
          break;
        case 'balanced':
        default:
          score =
            recencyScore * this.config.recencyWeight +
            relevanceScore * this.config.relevanceWeight +
            priorityScore * this.config.priorityWeight;
          break;
      }

      return {
        section,
        score,
        recencyScore,
        relevanceScore,
        priorityScore,
      };
    });
  }

  /**
   * Calculate recency score (0-1, higher = more recent)
   */
  private calculateRecencyScore(section: ContentSection, now: number, maxAge: number): number {
    if (section.timestamp === undefined) {
      return 0.5; // Default score for sections without timestamp
    }

    const age = now - section.timestamp.getTime();
    if (maxAge === 0) return 1;

    return 1 - age / maxAge;
  }

  /**
   * Calculate relevance score (0-1, higher = more relevant)
   */
  private calculateRelevanceScore(section: ContentSection): number {
    const keywords = this.config.relevanceKeywords;
    if (keywords === undefined || keywords.length === 0) {
      return 0.5; // Default score when no keywords specified
    }

    const contentLower = section.content.toLowerCase();
    let matches = 0;

    for (const keyword of keywords) {
      if (contentLower.includes(keyword.toLowerCase())) {
        matches++;
      }
    }

    return matches / keywords.length;
  }

  /**
   * Calculate priority score (0-1, normalized from priority value)
   */
  private calculatePriorityScore(section: ContentSection): number {
    if (section.priority === undefined) {
      return 0.5; // Default priority
    }

    // Normalize priority to 0-1 range (assuming priority 0-10)
    return Math.min(1, Math.max(0, section.priority / 10));
  }

  /**
   * Get maximum age among sections with timestamps
   */
  private getMaxAge(sections: readonly ContentSection[]): number {
    const timestamps: number[] = [];
    for (const s of sections) {
      if (s.timestamp !== undefined) {
        timestamps.push(s.timestamp.getTime());
      }
    }

    if (timestamps.length === 0) return 0;

    const now = Date.now();
    const oldest = Math.min(...timestamps);
    return now - oldest;
  }

  /**
   * Suggest optimal token limit based on model
   */
  public static suggestTokenLimit(model: string): number {
    const limits: Record<string, number> = {
      haiku: 100000,
      sonnet: 200000,
      opus: 200000,
    };

    // Return 80% of model limit for safety margin
    return Math.floor((limits[model] ?? 100000) * 0.8);
  }
}

/**
 * Factory function to create a ContextPruner with common configurations
 */
export function createContextPruner(
  maxTokens: number,
  options?: Partial<Omit<ContextPrunerConfig, 'maxTokens'>>
): ContextPruner {
  return new ContextPruner({
    maxTokens,
    ...options,
  });
}
