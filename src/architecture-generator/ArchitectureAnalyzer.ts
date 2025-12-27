/**
 * Architecture Analyzer for Architecture Generator
 *
 * Analyzes SRS documents to determine appropriate architecture patterns
 * based on features, non-functional requirements, and constraints.
 *
 * @module architecture-generator/ArchitectureAnalyzer
 */

import { ArchitectureAnalysisError, PatternDetectionError } from './errors.js';
import type {
  ParsedSRS,
  ArchitectureAnalysis,
  ArchitecturePattern,
  PatternRecommendation,
  ArchitecturalConcern,
  NFRCategory,
} from './types.js';

// ============================================================
// Pattern Scoring Weights
// ============================================================

interface PatternScore {
  pattern: ArchitecturePattern;
  score: number;
  reasons: string[];
  drawbacks: string[];
}

interface PatternIndicators {
  keywords: string[];
  nfrCategories: NFRCategory[];
  useCasePatterns: RegExp[];
  weight: number;
}

const PATTERN_INDICATORS: Record<ArchitecturePattern, PatternIndicators> = {
  'hierarchical-multi-agent': {
    keywords: ['agent', 'autonomous', 'orchestration', 'coordinator', 'delegation', 'worker'],
    nfrCategories: ['scalability', 'maintainability'],
    useCasePatterns: [/orchestrat/i, /coordinat/i, /delegat/i, /multi.*agent/i],
    weight: 15,
  },
  pipeline: {
    keywords: ['pipeline', 'sequential', 'stage', 'phase', 'transform', 'process'],
    nfrCategories: ['performance', 'maintainability'],
    useCasePatterns: [/process/i, /transform/i, /stage/i, /step/i],
    weight: 12,
  },
  'event-driven': {
    keywords: ['event', 'message', 'async', 'publish', 'subscribe', 'reactive', 'notification'],
    nfrCategories: ['scalability', 'reliability'],
    useCasePatterns: [/event/i, /notif/i, /trigger/i, /react/i],
    weight: 14,
  },
  microservices: {
    keywords: ['service', 'api', 'independent', 'deploy', 'scale', 'distributed'],
    nfrCategories: ['scalability', 'availability', 'maintainability'],
    useCasePatterns: [/api/i, /service/i, /endpoint/i],
    weight: 13,
  },
  layered: {
    keywords: ['layer', 'tier', 'presentation', 'business', 'data', 'separation'],
    nfrCategories: ['maintainability', 'security'],
    useCasePatterns: [/user interface/i, /business logic/i, /database/i],
    weight: 10,
  },
  hexagonal: {
    keywords: ['port', 'adapter', 'domain', 'external', 'interface', 'core'],
    nfrCategories: ['maintainability', 'reliability'],
    useCasePatterns: [/external.*system/i, /integrat/i, /adapter/i],
    weight: 11,
  },
  cqrs: {
    keywords: ['command', 'query', 'read', 'write', 'separate', 'event sourcing'],
    nfrCategories: ['performance', 'scalability'],
    useCasePatterns: [/read.*write/i, /query/i, /command/i],
    weight: 12,
  },
  scratchpad: {
    keywords: ['file', 'state', 'shared', 'storage', 'workspace', 'document'],
    nfrCategories: ['maintainability', 'reliability'],
    useCasePatterns: [/file.*based/i, /state.*shar/i, /document/i],
    weight: 10,
  },
};

// ============================================================
// Architecture Analyzer Class
// ============================================================

/**
 * Analyzes SRS to determine appropriate architecture patterns
 */
export class ArchitectureAnalyzer {
  private readonly defaultPattern: ArchitecturePattern;

  constructor(defaultPattern: ArchitecturePattern = 'layered') {
    this.defaultPattern = defaultPattern;
  }

  /**
   * Analyze SRS and recommend architecture patterns
   */
  public analyze(srs: ParsedSRS): ArchitectureAnalysis {
    try {
      const patternScores = this.scorePatterns(srs);
      const sortedPatterns = this.sortPatternsByScore(patternScores);
      const recommendations = this.buildRecommendations(sortedPatterns);
      const concerns = this.identifyConcerns(srs);

      const primaryPattern = sortedPatterns[0]?.pattern ?? this.defaultPattern;
      const supportingPatterns = this.selectSupportingPatterns(sortedPatterns, primaryPattern);
      const rationale = this.buildRationale(primaryPattern, srs, sortedPatterns);

      return {
        primaryPattern,
        supportingPatterns,
        rationale,
        recommendations,
        concerns,
      };
    } catch (error) {
      if (error instanceof PatternDetectionError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new ArchitectureAnalysisError('pattern-detection', message);
    }
  }

  /**
   * Score each pattern based on SRS content
   */
  private scorePatterns(srs: ParsedSRS): PatternScore[] {
    const scores: PatternScore[] = [];
    const allText = this.extractAllText(srs);

    for (const [pattern, indicators] of Object.entries(PATTERN_INDICATORS)) {
      const score = this.calculatePatternScore(srs, indicators, allText);
      scores.push({
        pattern: pattern as ArchitecturePattern,
        score: score.total,
        reasons: score.reasons,
        drawbacks: this.getPatternDrawbacks(pattern as ArchitecturePattern),
      });
    }

    return scores;
  }

  /**
   * Calculate score for a specific pattern
   */
  private calculatePatternScore(
    srs: ParsedSRS,
    indicators: PatternIndicators,
    allText: string
  ): { total: number; reasons: string[] } {
    let total = 0;
    const reasons: string[] = [];

    // Keyword matching
    for (const keyword of indicators.keywords) {
      const count = (allText.match(new RegExp(keyword, 'gi')) ?? []).length;
      if (count > 0) {
        total += Math.min(count * 2, indicators.weight);
        reasons.push(`Found keyword "${keyword}" ${String(count)} time(s)`);
      }
    }

    // NFR category matching
    for (const category of indicators.nfrCategories) {
      const matchingNFRs = srs.nfrs.filter((nfr) => nfr.category === category);
      if (matchingNFRs.length > 0) {
        total += matchingNFRs.length * 5;
        reasons.push(`Matches ${String(matchingNFRs.length)} ${category} NFR(s)`);
      }
    }

    // Use case pattern matching
    for (const feature of srs.features) {
      for (const useCase of feature.useCases) {
        for (const pattern of indicators.useCasePatterns) {
          if (pattern.test(useCase.name) || pattern.test(useCase.description)) {
            total += 8;
            reasons.push(`Use case "${useCase.id}" matches pattern`);
            break;
          }
        }
      }
    }

    // Constraint influence
    for (const constraint of srs.constraints) {
      if (this.constraintSupportsPattern(constraint.description, indicators)) {
        total += 5;
        reasons.push(`Constraint "${constraint.id}" supports this pattern`);
      }
    }

    return { total, reasons };
  }

  /**
   * Check if constraint supports a pattern
   */
  private constraintSupportsPattern(description: string, indicators: PatternIndicators): boolean {
    const lowerDesc = description.toLowerCase();
    return indicators.keywords.some((keyword) => lowerDesc.includes(keyword.toLowerCase()));
  }

  /**
   * Extract all text from SRS for analysis
   */
  private extractAllText(srs: ParsedSRS): string {
    const parts: string[] = [];

    parts.push(srs.metadata.productName);

    for (const feature of srs.features) {
      parts.push(feature.name, feature.description);
      for (const useCase of feature.useCases) {
        parts.push(useCase.name, useCase.description);
        parts.push(...useCase.mainFlow);
      }
    }

    for (const nfr of srs.nfrs) {
      parts.push(nfr.description, nfr.target);
    }

    for (const constraint of srs.constraints) {
      parts.push(constraint.description, constraint.architectureImpact);
    }

    parts.push(...srs.assumptions);

    return parts.join(' ');
  }

  /**
   * Sort patterns by score descending
   */
  private sortPatternsByScore(scores: PatternScore[]): PatternScore[] {
    return [...scores].sort((a, b) => b.score - a.score);
  }

  /**
   * Build pattern recommendations
   */
  private buildRecommendations(sortedPatterns: PatternScore[]): PatternRecommendation[] {
    const maxScore = sortedPatterns[0]?.score ?? 100;

    return sortedPatterns.slice(0, 4).map((ps) => ({
      pattern: ps.pattern,
      score: maxScore > 0 ? Math.round((ps.score / maxScore) * 100) : 0,
      reasons: ps.reasons.slice(0, 5),
      drawbacks: ps.drawbacks,
    }));
  }

  /**
   * Get known drawbacks for a pattern
   */
  private getPatternDrawbacks(pattern: ArchitecturePattern): string[] {
    const drawbacks: Record<ArchitecturePattern, string[]> = {
      'hierarchical-multi-agent': [
        'Complex coordination logic',
        'Potential for cascading failures',
        'Higher operational overhead',
      ],
      pipeline: [
        'Latency accumulation across stages',
        'Difficult to handle branching logic',
        'Stage coupling can limit flexibility',
      ],
      'event-driven': [
        'Event ordering challenges',
        'Debugging complexity',
        'Eventually consistent data',
      ],
      microservices: [
        'Distributed system complexity',
        'Network overhead',
        'Data consistency challenges',
      ],
      layered: [
        'Can lead to unnecessary indirection',
        'Potential performance overhead',
        'May not scale well horizontally',
      ],
      hexagonal: [
        'Higher initial complexity',
        'Many adapter implementations needed',
        'Learning curve for team',
      ],
      cqrs: [
        'Increased system complexity',
        'Eventually consistent reads',
        'More infrastructure to maintain',
      ],
      scratchpad: [
        'File I/O overhead',
        'Potential race conditions',
        'Not suitable for high-throughput scenarios',
      ],
    };

    return drawbacks[pattern];
  }

  /**
   * Select supporting patterns that complement the primary pattern
   */
  private selectSupportingPatterns(
    sortedPatterns: PatternScore[],
    primaryPattern: ArchitecturePattern
  ): ArchitecturePattern[] {
    const compatible = this.getCompatiblePatterns(primaryPattern);
    const supporting: ArchitecturePattern[] = [];

    for (const ps of sortedPatterns) {
      if (ps.pattern === primaryPattern) {
        continue;
      }

      if (compatible.includes(ps.pattern) && ps.score > 20) {
        supporting.push(ps.pattern);
        if (supporting.length >= 2) {
          break;
        }
      }
    }

    return supporting;
  }

  /**
   * Get patterns that are compatible with the given pattern
   */
  private getCompatiblePatterns(pattern: ArchitecturePattern): ArchitecturePattern[] {
    const compatibility: Record<ArchitecturePattern, ArchitecturePattern[]> = {
      'hierarchical-multi-agent': ['event-driven', 'scratchpad', 'pipeline'],
      pipeline: ['event-driven', 'layered', 'scratchpad'],
      'event-driven': ['microservices', 'cqrs', 'hexagonal'],
      microservices: ['event-driven', 'cqrs', 'hexagonal'],
      layered: ['hexagonal', 'cqrs', 'pipeline'],
      hexagonal: ['layered', 'event-driven', 'cqrs'],
      cqrs: ['event-driven', 'microservices', 'hexagonal'],
      scratchpad: ['pipeline', 'hierarchical-multi-agent', 'layered'],
    };

    return compatibility[pattern];
  }

  /**
   * Build rationale for pattern selection
   */
  private buildRationale(
    pattern: ArchitecturePattern,
    srs: ParsedSRS,
    sortedPatterns: PatternScore[]
  ): string {
    const topPattern = sortedPatterns[0];
    if (!topPattern) {
      return `Default pattern "${pattern}" selected due to insufficient requirements data.`;
    }

    const parts: string[] = [
      `The "${pattern}" pattern is recommended based on analysis of ${String(srs.features.length)} features and ${String(srs.nfrs.length)} non-functional requirements.`,
    ];

    if (topPattern.reasons.length > 0) {
      parts.push(`Key indicators: ${topPattern.reasons.slice(0, 3).join('; ')}.`);
    }

    const secondPattern = sortedPatterns[1];
    if (secondPattern && secondPattern.score > topPattern.score * 0.7) {
      parts.push(
        `Alternative consideration: "${secondPattern.pattern}" pattern also scored highly.`
      );
    }

    return parts.join(' ');
  }

  /**
   * Identify architectural concerns from SRS
   */
  private identifyConcerns(srs: ParsedSRS): ArchitecturalConcern[] {
    const concerns: ArchitecturalConcern[] = [];

    // Check for high-priority NFRs that need attention
    for (const nfr of srs.nfrs) {
      if (nfr.priority === 'P0' || nfr.priority === 'P1') {
        concerns.push({
          category: nfr.category,
          description: `High-priority ${nfr.category} requirement: ${nfr.description}`,
          mitigation: this.suggestMitigation(nfr.category, nfr.description),
          priority: nfr.priority === 'P0' ? 'high' : 'medium',
        });
      }
    }

    // Check for potential conflicts between constraints
    for (const constraint of srs.constraints) {
      if (constraint.type === 'technical' || constraint.type === 'resource') {
        concerns.push({
          category: 'maintainability',
          description: `Constraint may impact architecture: ${constraint.description}`,
          mitigation: constraint.architectureImpact || 'Consider design trade-offs carefully',
          priority: 'medium',
        });
      }
    }

    // Add concerns for missing critical NFR categories
    const coveredCategories = new Set(srs.nfrs.map((nfr) => nfr.category));
    const criticalCategories: NFRCategory[] = ['security', 'reliability', 'performance'];

    for (const category of criticalCategories) {
      if (!coveredCategories.has(category)) {
        concerns.push({
          category,
          description: `No explicit ${category} requirements defined`,
          mitigation: `Consider adding ${category} requirements to ensure comprehensive design`,
          priority: 'low',
        });
      }
    }

    return concerns;
  }

  /**
   * Suggest mitigation strategy for an NFR category
   */
  private suggestMitigation(category: NFRCategory, _description: string): string {
    const mitigations: Record<NFRCategory, string> = {
      performance:
        'Implement caching, optimize critical paths, consider async processing for heavy operations',
      scalability:
        'Design for horizontal scaling, use stateless components, implement load balancing',
      reliability: 'Implement retry mechanisms, circuit breakers, and comprehensive error handling',
      security:
        'Apply defense in depth, implement authentication/authorization, encrypt sensitive data',
      maintainability:
        'Follow SOLID principles, maintain clear module boundaries, document architecture decisions',
      usability: 'Design intuitive interfaces, provide clear feedback, minimize user effort',
      availability: 'Implement redundancy, health checks, and automated failover mechanisms',
    };

    return mitigations[category];
  }
}
