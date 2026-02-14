/**
 * Technology Stack Generator for Architecture Generator
 *
 * Generates technology stack recommendations based on
 * architecture patterns and non-functional requirements.
 *
 * @module architecture-generator/TechnologyStackGenerator
 */

import { TechnologyStackError } from './errors.js';
import type {
  ParsedSRS,
  ArchitectureAnalysis,
  ArchitecturePattern,
  TechnologyStack,
  TechnologyLayerEntry,
  TechnologyAlternative,
  TechnologyLayer,
  NFRCategory,
} from './types.js';

// ============================================================
// Technology Definitions
// ============================================================

interface TechnologyOption {
  name: string;
  version: string;
  rationale: string;
  strengths: NFRCategory[];
  patterns: ArchitecturePattern[];
}

const RUNTIME_OPTIONS: TechnologyOption[] = [
  {
    name: 'Node.js',
    version: '20.x LTS',
    rationale: 'Excellent async I/O, large ecosystem, unified JavaScript stack',
    strengths: ['performance', 'scalability'],
    patterns: ['event-driven', 'microservices', 'hierarchical-multi-agent'],
  },
  {
    name: 'Python',
    version: '3.12',
    rationale: 'AI/ML integration, extensive libraries, rapid prototyping',
    strengths: ['maintainability', 'usability'],
    patterns: ['pipeline', 'hierarchical-multi-agent', 'scratchpad'],
  },
  {
    name: 'Go',
    version: '1.22',
    rationale: 'High performance, built-in concurrency, simple deployment',
    strengths: ['performance', 'reliability', 'scalability'],
    patterns: ['microservices', 'event-driven'],
  },
  {
    name: 'Rust',
    version: '1.75',
    rationale: 'Memory safety, zero-cost abstractions, high performance',
    strengths: ['performance', 'reliability', 'security'],
    patterns: ['microservices', 'pipeline'],
  },
];

const FRAMEWORK_OPTIONS: TechnologyOption[] = [
  {
    name: 'Express.js',
    version: '4.x',
    rationale: 'Minimal, flexible, well-documented Node.js framework',
    strengths: ['maintainability', 'usability'],
    patterns: ['layered', 'microservices'],
  },
  {
    name: 'Fastify',
    version: '4.x',
    rationale: 'High performance Node.js framework with schema validation',
    strengths: ['performance', 'security'],
    patterns: ['microservices', 'event-driven'],
  },
  {
    name: 'FastAPI',
    version: '0.109',
    rationale: 'Modern Python framework with automatic API documentation',
    strengths: ['performance', 'usability', 'maintainability'],
    patterns: ['layered', 'microservices', 'pipeline'],
  },
  {
    name: 'Gin',
    version: '1.9',
    rationale: 'Fast Go web framework with minimal overhead',
    strengths: ['performance', 'scalability'],
    patterns: ['microservices', 'hexagonal'],
  },
  {
    name: 'NestJS',
    version: '10.x',
    rationale: 'Enterprise-grade Node.js framework with dependency injection',
    strengths: ['maintainability', 'scalability'],
    patterns: ['layered', 'hexagonal', 'cqrs'],
  },
];

const DATABASE_OPTIONS: TechnologyOption[] = [
  {
    name: 'PostgreSQL',
    version: '16',
    rationale: 'Robust RDBMS with excellent JSON support and extensions',
    strengths: ['reliability', 'scalability', 'security'],
    patterns: ['layered', 'microservices', 'cqrs'],
  },
  {
    name: 'MongoDB',
    version: '7.0',
    rationale: 'Flexible document store for evolving schemas',
    strengths: ['scalability', 'maintainability'],
    patterns: ['microservices', 'event-driven'],
  },
  {
    name: 'SQLite',
    version: '3.45',
    rationale: 'Embedded database, zero configuration, file-based',
    strengths: ['maintainability', 'usability'],
    patterns: ['scratchpad', 'pipeline'],
  },
  {
    name: 'DynamoDB',
    version: 'Latest',
    rationale: 'Fully managed NoSQL with automatic scaling',
    strengths: ['availability', 'scalability', 'performance'],
    patterns: ['microservices', 'event-driven'],
  },
];

const CACHING_OPTIONS: TechnologyOption[] = [
  {
    name: 'Redis',
    version: '7.2',
    rationale: 'In-memory data store with persistence and pub/sub',
    strengths: ['performance', 'scalability'],
    patterns: ['microservices', 'event-driven', 'cqrs'],
  },
  {
    name: 'Memcached',
    version: '1.6',
    rationale: 'Simple, high-performance distributed cache',
    strengths: ['performance', 'scalability'],
    patterns: ['microservices', 'layered'],
  },
  {
    name: 'Node-Cache',
    version: '5.x',
    rationale: 'In-process caching for Node.js applications',
    strengths: ['performance', 'maintainability'],
    patterns: ['layered', 'pipeline', 'scratchpad'],
  },
];

const MESSAGING_OPTIONS: TechnologyOption[] = [
  {
    name: 'RabbitMQ',
    version: '3.13',
    rationale: 'Reliable message broker with flexible routing',
    strengths: ['reliability', 'scalability'],
    patterns: ['event-driven', 'microservices', 'pipeline'],
  },
  {
    name: 'Apache Kafka',
    version: '3.7',
    rationale: 'High-throughput distributed streaming platform',
    strengths: ['scalability', 'performance', 'reliability'],
    patterns: ['event-driven', 'cqrs', 'microservices'],
  },
  {
    name: 'Redis Streams',
    version: '7.2',
    rationale: 'Lightweight streaming with Redis infrastructure',
    strengths: ['performance', 'maintainability'],
    patterns: ['event-driven', 'pipeline'],
  },
  {
    name: 'BullMQ',
    version: '5.x',
    rationale: 'Redis-based queue for Node.js with job processing',
    strengths: ['reliability', 'maintainability'],
    patterns: ['pipeline', 'hierarchical-multi-agent'],
  },
];

const MONITORING_OPTIONS: TechnologyOption[] = [
  {
    name: 'Prometheus + Grafana',
    version: 'Latest',
    rationale: 'Industry-standard metrics collection and visualization',
    strengths: ['reliability', 'maintainability'],
    patterns: ['microservices', 'event-driven', 'hierarchical-multi-agent'],
  },
  {
    name: 'OpenTelemetry',
    version: '1.x',
    rationale: 'Vendor-neutral observability framework',
    strengths: ['maintainability', 'reliability'],
    patterns: ['microservices', 'event-driven'],
  },
  {
    name: 'Pino',
    version: '8.x',
    rationale: 'Fast Node.js logger with JSON output',
    strengths: ['performance', 'maintainability'],
    patterns: ['layered', 'pipeline', 'scratchpad'],
  },
];

const TESTING_OPTIONS: TechnologyOption[] = [
  {
    name: 'Vitest',
    version: '1.x',
    rationale: 'Fast Vite-native test framework with ESM support',
    strengths: ['performance', 'maintainability'],
    patterns: ['layered', 'hexagonal', 'pipeline'],
  },
  {
    name: 'Jest',
    version: '29.x',
    rationale: 'Full-featured testing framework with mocking',
    strengths: ['maintainability', 'usability'],
    patterns: ['layered', 'microservices'],
  },
  {
    name: 'pytest',
    version: '8.x',
    rationale: 'Powerful Python testing framework with fixtures',
    strengths: ['maintainability', 'usability'],
    patterns: ['pipeline', 'scratchpad'],
  },
];

const BUILD_OPTIONS: TechnologyOption[] = [
  {
    name: 'TypeScript',
    version: '5.x',
    rationale: 'Type safety for JavaScript with excellent tooling',
    strengths: ['maintainability', 'reliability'],
    patterns: ['layered', 'hexagonal', 'cqrs', 'microservices'],
  },
  {
    name: 'esbuild',
    version: '0.20',
    rationale: 'Extremely fast JavaScript/TypeScript bundler',
    strengths: ['performance', 'maintainability'],
    patterns: ['layered', 'pipeline'],
  },
  {
    name: 'Docker',
    version: '25.x',
    rationale: 'Container runtime for consistent deployment',
    strengths: ['reliability', 'scalability', 'maintainability'],
    patterns: ['microservices', 'event-driven'],
  },
];

// ============================================================
// Technology Stack Generator Class
// ============================================================

/**
 * Generates technology stack recommendations
 */
export class TechnologyStackGenerator {
  private readonly includeAlternatives: boolean;

  constructor(includeAlternatives: boolean = true) {
    this.includeAlternatives = includeAlternatives;
  }

  /**
   * Generate technology stack based on analysis
   * @param srs - Parsed SRS document containing NFRs and requirements
   * @param analysis - Architecture analysis results with pattern and concern information
   * @returns Complete technology stack with selected technologies for all layers
   */
  public generate(srs: ParsedSRS, analysis: ArchitectureAnalysis): TechnologyStack {
    try {
      const nfrPriorities = this.extractNFRPriorities(srs);
      const layers: TechnologyLayerEntry[] = [];

      // Generate each layer
      layers.push(this.selectTechnology('runtime', RUNTIME_OPTIONS, analysis, nfrPriorities));
      layers.push(this.selectTechnology('framework', FRAMEWORK_OPTIONS, analysis, nfrPriorities));
      layers.push(this.selectTechnology('database', DATABASE_OPTIONS, analysis, nfrPriorities));
      layers.push(this.selectTechnology('caching', CACHING_OPTIONS, analysis, nfrPriorities));
      layers.push(this.selectTechnology('messaging', MESSAGING_OPTIONS, analysis, nfrPriorities));
      layers.push(this.selectTechnology('monitoring', MONITORING_OPTIONS, analysis, nfrPriorities));
      layers.push(this.selectTechnology('testing', TESTING_OPTIONS, analysis, nfrPriorities));
      layers.push(this.selectTechnology('build', BUILD_OPTIONS, analysis, nfrPriorities));

      const rationale = this.buildStackRationale(layers, analysis);
      const compatibilityNotes = this.checkCompatibility(layers);

      return {
        layers,
        rationale,
        compatibilityNotes,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new TechnologyStackError('all', message);
    }
  }

  /**
   * Extract NFR priorities from SRS
   * @param srs - Parsed SRS document containing non-functional requirements
   * @returns Map of NFR categories to their highest priority scores (0-100)
   */
  private extractNFRPriorities(srs: ParsedSRS): Map<NFRCategory, number> {
    const priorities = new Map<NFRCategory, number>();

    for (const nfr of srs.nfrs) {
      const priorityScore = this.getPriorityScore(nfr.priority);
      const current = priorities.get(nfr.category) ?? 0;
      priorities.set(nfr.category, Math.max(current, priorityScore));
    }

    return priorities;
  }

  /**
   * Get numeric score for priority
   * @param priority - Priority level (P0 highest, P3 lowest)
   * @returns Numeric score from 0-100 based on priority level
   */
  private getPriorityScore(priority: 'P0' | 'P1' | 'P2' | 'P3'): number {
    const scores: Record<string, number> = {
      P0: 100,
      P1: 75,
      P2: 50,
      P3: 25,
    };
    return scores[priority] ?? 0;
  }

  /**
   * Select best technology for a layer
   * @param layer - Technology layer to select for (runtime, framework, database, etc.)
   * @param options - Available technology options for this layer
   * @param analysis - Architecture analysis with pattern and concerns
   * @param nfrPriorities - Map of NFR categories to priority scores
   * @returns Selected technology for the layer with rationale and alternatives
   */
  private selectTechnology(
    layer: TechnologyLayer,
    options: TechnologyOption[],
    analysis: ArchitectureAnalysis,
    nfrPriorities: Map<NFRCategory, number>
  ): TechnologyLayerEntry {
    const scoredOptions = options.map((option) => ({
      option,
      score: this.scoreTechnology(option, analysis, nfrPriorities),
    }));

    scoredOptions.sort((a, b) => b.score - a.score);

    const selected = scoredOptions[0];
    if (!selected) {
      throw new TechnologyStackError(layer, 'No technology options available');
    }

    const alternatives: TechnologyAlternative[] = this.includeAlternatives
      ? scoredOptions.slice(1, 3).map((so) => ({
          name: so.option.name,
          reason: this.getAlternativeReason(so.option, selected.option),
        }))
      : [];

    return {
      layer,
      technology: selected.option.name,
      version: selected.option.version,
      rationale: selected.option.rationale,
      alternatives,
    };
  }

  /**
   * Score a technology option
   * @param option - Technology option to score
   * @param analysis - Architecture analysis with pattern and concerns
   * @param nfrPriorities - Map of NFR categories to priority scores
   * @returns Numeric score based on pattern compatibility, NFR alignment, and concern mitigation
   */
  private scoreTechnology(
    option: TechnologyOption,
    analysis: ArchitectureAnalysis,
    nfrPriorities: Map<NFRCategory, number>
  ): number {
    let score = 0;

    // Pattern compatibility
    if (option.patterns.includes(analysis.primaryPattern)) {
      score += 50;
    }
    for (const pattern of analysis.supportingPatterns) {
      if (option.patterns.includes(pattern)) {
        score += 20;
      }
    }

    // NFR alignment
    for (const strength of option.strengths) {
      const priority = nfrPriorities.get(strength) ?? 0;
      score += priority * 0.3;
    }

    // Concern mitigation
    for (const concern of analysis.concerns) {
      if (option.strengths.includes(concern.category)) {
        score += concern.priority === 'high' ? 15 : concern.priority === 'medium' ? 10 : 5;
      }
    }

    return score;
  }

  /**
   * Get reason why alternative wasn't selected
   * @param alternative - Technology option that wasn't selected
   * @param selected - Technology option that was selected
   * @returns Explanation of why alternative wasn't chosen over selected option
   */
  private getAlternativeReason(alternative: TechnologyOption, selected: TechnologyOption): string {
    const missingStrengths = alternative.strengths.filter((s) => !selected.strengths.includes(s));

    if (missingStrengths.length > 0) {
      return `Offers ${missingStrengths.join(', ')} but less aligned with selected pattern`;
    }

    return 'Similar capabilities but less pattern compatibility';
  }

  /**
   * Build overall stack rationale
   * @param layers - Selected technologies for all layers
   * @param analysis - Architecture analysis with pattern information
   * @returns Summary explanation of why this technology stack was chosen
   */
  private buildStackRationale(
    layers: TechnologyLayerEntry[],
    analysis: ArchitectureAnalysis
  ): string {
    const runtime = layers.find((l) => l.layer === 'runtime')?.technology ?? 'selected runtime';
    const framework = layers.find((l) => l.layer === 'framework')?.technology ?? 'framework';

    const parts: string[] = [
      `This technology stack is optimized for the ${analysis.primaryPattern} pattern.`,
      `${runtime} with ${framework} provides a solid foundation for the application.`,
    ];

    if (analysis.supportingPatterns.length > 0) {
      parts.push(`The stack also supports ${analysis.supportingPatterns.join(' and ')} patterns.`);
    }

    return parts.join(' ');
  }

  /**
   * Check compatibility between selected technologies
   * @param layers - Selected technologies for all layers
   * @returns Array of compatibility warnings and recommendations for the technology stack
   */
  private checkCompatibility(layers: TechnologyLayerEntry[]): string[] {
    const notes: string[] = [];
    const runtime = layers.find((l) => l.layer === 'runtime')?.technology;
    const framework = layers.find((l) => l.layer === 'framework')?.technology;
    const testing = layers.find((l) => l.layer === 'testing')?.technology;

    // Runtime/Framework compatibility
    if (runtime === 'Node.js' && framework === 'FastAPI') {
      notes.push('FastAPI requires Python runtime instead of Node.js');
    }
    if (runtime === 'Python' && framework === 'Express.js') {
      notes.push('Express.js requires Node.js runtime instead of Python');
    }
    if (runtime === 'Go' && framework === 'NestJS') {
      notes.push('NestJS requires Node.js runtime instead of Go');
    }

    // Testing framework compatibility
    if (runtime === 'Python' && (testing === 'Vitest' || testing === 'Jest')) {
      notes.push('Consider pytest for Python projects instead of JavaScript test frameworks');
    }

    // General notes
    if (runtime === 'Node.js') {
      notes.push('Ensure all packages support ESM if using ES modules');
    }

    return notes;
  }
}
