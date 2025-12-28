/**
 * InformationExtractor - Extracts structured information from parsed input
 *
 * Analyzes text content to identify requirements, constraints, assumptions,
 * dependencies, and generates clarification questions for unclear information.
 */

import type { Priority } from '../scratchpad/index.js';
import type {
  ParsedInput,
  ExtractionResult,
  ExtractedRequirement,
  ExtractedConstraint,
  ExtractedAssumption,
  ExtractedDependency,
  ClarificationQuestion,
} from './types.js';
import { ExtractionError } from './errors.js';

/**
 * Keyword sets for priority detection
 */
const PRIORITY_KEYWORDS: Record<Priority, readonly string[]> = {
  P0: ['critical', 'must', 'required', 'essential', 'mandatory', 'blocking', 'core'],
  P1: ['should', 'important', 'high priority', 'key', 'significant', 'primary'],
  P2: ['could', 'nice to have', 'would like', 'optional', 'consider', 'medium'],
  P3: ['low priority', 'future', 'later', 'maybe', 'if time', 'stretch goal'],
};

/**
 * NFR category keywords
 */
const NFR_KEYWORDS: Record<string, readonly string[]> = {
  performance: [
    'fast',
    'speed',
    'latency',
    'response time',
    'throughput',
    'performance',
    'ms',
    'seconds',
  ],
  security: ['secure', 'security', 'auth', 'encrypt', 'protect', 'access control', 'permission'],
  scalability: ['scale', 'scalable', 'concurrent', 'users', 'load', 'capacity', 'horizontal'],
  usability: ['easy', 'intuitive', 'user-friendly', 'accessible', 'ux', 'ui', 'interface'],
  reliability: ['reliable', 'uptime', 'availability', '99.9%', 'fault tolerant', 'backup'],
  maintainability: ['maintainable', 'modular', 'testable', 'clean', 'documented', 'readable'],
};

/**
 * Constraint type keywords
 */
const CONSTRAINT_KEYWORDS: Record<string, readonly string[]> = {
  technical: ['technology', 'stack', 'language', 'framework', 'platform', 'api', 'database'],
  business: ['budget', 'cost', 'timeline', 'deadline', 'resource', 'team', 'vendor'],
  regulatory: ['compliance', 'gdpr', 'hipaa', 'regulation', 'legal', 'policy', 'license'],
  resource: ['limited', 'constraint', 'restriction', 'only', 'maximum', 'minimum'],
};

/**
 * Dependency type keywords
 */
const DEPENDENCY_KEYWORDS: Record<string, readonly string[]> = {
  api: ['api', 'rest', 'graphql', 'endpoint', 'service', 'webhook'],
  library: ['library', 'package', 'npm', 'dependency', 'module', 'import'],
  service: ['service', 'aws', 'gcp', 'azure', 'cloud', 'database', 'redis'],
  tool: ['tool', 'cli', 'docker', 'kubernetes', 'jenkins', 'github'],
};

/**
 * InformationExtractor options
 */
export interface InformationExtractorOptions {
  /** Default priority for unclassified requirements */
  readonly defaultPriority?: Priority;
  /** Minimum confidence threshold for including extractions */
  readonly minConfidence?: number;
  /** Maximum number of clarification questions to generate */
  readonly maxQuestions?: number;
}

/**
 * Acceptance criteria indicator patterns
 */
const AC_INDICATORS: readonly string[] = [
  'given',
  'when',
  'then',
  'should be able to',
  'must result in',
  'verify that',
  'ensure that',
  'acceptance criteria',
  'success criteria',
  'done when',
  'complete when',
  'validated by',
  'confirmed by',
];

/**
 * Default options for InformationExtractor
 */
const DEFAULT_OPTIONS: Required<InformationExtractorOptions> = {
  defaultPriority: 'P2',
  minConfidence: 0.3,
  maxQuestions: 5,
};

/**
 * InformationExtractor class for analyzing and extracting structured information
 */
export class InformationExtractor {
  private readonly options: Required<InformationExtractorOptions>;
  private requirementCounter: number = 0;
  private nfrCounter: number = 0;
  private constraintCounter: number = 0;
  private assumptionCounter: number = 0;
  private questionCounter: number = 0;

  constructor(options: InformationExtractorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Extract all information from parsed input
   *
   * @param input - Parsed input to analyze
   * @returns ExtractionResult with all extracted information
   */
  public extract(input: ParsedInput): ExtractionResult {
    this.resetCounters();

    const content = input.combinedContent;
    const warnings: string[] = [];

    try {
      // Extract project information
      const projectInfo = this.extractProjectInfo(content);

      // Extract requirements
      const { functional, nonFunctional } = this.extractRequirements(
        content,
        input.sources[0]?.reference ?? 'input'
      );

      // Extract constraints
      const constraints = this.extractConstraints(content, input.sources[0]?.reference ?? 'input');

      // Extract assumptions
      const assumptions = this.extractAssumptions(content, input.sources[0]?.reference ?? 'input');

      // Extract dependencies
      const dependencies = this.extractDependencies(
        content,
        input.sources[0]?.reference ?? 'input'
      );

      // Generate clarification questions
      const clarificationQuestions = this.generateClarificationQuestions({
        projectName: projectInfo.name,
        projectDescription: projectInfo.description,
        functionalRequirements: functional,
        nonFunctionalRequirements: nonFunctional,
        constraints,
        assumptions,
        dependencies,
      });

      // Calculate overall confidence
      const allExtractions = [...functional, ...nonFunctional, ...constraints, ...assumptions];
      const overallConfidence =
        allExtractions.length > 0
          ? allExtractions.reduce((sum, e) => sum + e.confidence, 0) / allExtractions.length
          : 0.5;

      // Add warnings for low extraction counts
      if (functional.length === 0) {
        warnings.push(
          'No functional requirements detected - consider providing more specific feature descriptions'
        );
      }
      if (projectInfo.name === undefined) {
        warnings.push('Project name not detected - will need to be provided');
      }

      return {
        projectName: projectInfo.name,
        projectDescription: projectInfo.description,
        functionalRequirements: functional,
        nonFunctionalRequirements: nonFunctional,
        constraints,
        assumptions,
        dependencies,
        clarificationQuestions,
        overallConfidence,
        warnings,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new ExtractionError('extraction', error.message);
      }
      throw error;
    }
  }

  /**
   * Reset ID counters
   */
  private resetCounters(): void {
    this.requirementCounter = 0;
    this.nfrCounter = 0;
    this.constraintCounter = 0;
    this.assumptionCounter = 0;
    this.questionCounter = 0;
  }

  /**
   * Generate next requirement ID
   */
  private nextRequirementId(): string {
    this.requirementCounter++;
    return `FR-${String(this.requirementCounter).padStart(3, '0')}`;
  }

  /**
   * Generate next NFR ID
   */
  private nextNfrId(): string {
    this.nfrCounter++;
    return `NFR-${String(this.nfrCounter).padStart(3, '0')}`;
  }

  /**
   * Generate next constraint ID
   */
  private nextConstraintId(): string {
    this.constraintCounter++;
    return `CON-${String(this.constraintCounter).padStart(3, '0')}`;
  }

  /**
   * Generate next assumption ID
   */
  private nextAssumptionId(): string {
    this.assumptionCounter++;
    return `ASM-${String(this.assumptionCounter).padStart(3, '0')}`;
  }

  /**
   * Generate next question ID
   */
  private nextQuestionId(): string {
    this.questionCounter++;
    return `Q-${String(this.questionCounter).padStart(3, '0')}`;
  }

  /**
   * Extract project name and description from content
   */
  private extractProjectInfo(content: string): {
    name?: string | undefined;
    description?: string | undefined;
  } {
    let name: string | undefined;
    let description: string | undefined;

    // Try to find project name
    const namePatterns = [
      /(?:project|app(?:lication)?|system|platform)\s*(?:name|title)?[:\s]+["']?([^"'\n]+)["']?/i,
      /^#\s+([^\n]+)/m,
      /(?:building|creating|developing)\s+(?:a|an|the)\s+([^.\n]+)/i,
    ];

    for (const pattern of namePatterns) {
      const match = content.match(pattern);
      if (match?.[1] !== undefined) {
        name = match[1].trim();
        break;
      }
    }

    // Try to find project description
    const descPatterns = [
      /(?:description|overview|about)[:\s]+([^.]+\.)/i,
      /(?:this|the)\s+(?:project|system|app(?:lication)?)\s+(?:is|will|should)\s+([^.]+\.)/i,
    ];

    for (const pattern of descPatterns) {
      const match = content.match(pattern);
      if (match?.[1] !== undefined) {
        description = match[1].trim();
        break;
      }
    }

    return { name, description };
  }

  /**
   * Extract requirements from content
   */
  private extractRequirements(
    content: string,
    source: string
  ): { functional: ExtractedRequirement[]; nonFunctional: ExtractedRequirement[] } {
    const functional: ExtractedRequirement[] = [];
    const nonFunctional: ExtractedRequirement[] = [];

    // Split content into sentences/bullet points
    const segments = this.splitIntoSegments(content);

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      if (segment === undefined) continue;

      const normalized = segment.toLowerCase();

      // Check if this is a requirement
      const isRequirement = this.isRequirementLike(normalized);
      if (!isRequirement) continue;

      // Detect NFR category
      const nfrCategory = this.detectNfrCategory(normalized);
      const priority = this.detectPriority(normalized);
      const confidence = this.calculateConfidence(segment, isRequirement);

      if (confidence < this.options.minConfidence) continue;

      // Extract acceptance criteria from surrounding segments
      const acceptanceCriteria = this.extractAcceptanceCriteria(segments, i);

      if (nfrCategory !== undefined) {
        nonFunctional.push({
          id: this.nextNfrId(),
          title: this.extractTitle(segment),
          description: segment.trim(),
          priority,
          source,
          confidence,
          isFunctional: false,
          nfrCategory,
          ...(acceptanceCriteria.length > 0 && { acceptanceCriteria }),
        });
      } else {
        functional.push({
          id: this.nextRequirementId(),
          title: this.extractTitle(segment),
          description: segment.trim(),
          priority,
          source,
          confidence,
          isFunctional: true,
          ...(acceptanceCriteria.length > 0 && { acceptanceCriteria }),
        });
      }
    }

    return { functional, nonFunctional };
  }

  /**
   * Extract acceptance criteria from segments following a requirement
   *
   * @param segments - All segments from the content
   * @param reqIndex - Index of the requirement segment
   * @returns Array of acceptance criteria strings
   */
  private extractAcceptanceCriteria(segments: string[], reqIndex: number): string[] {
    const criteria: string[] = [];

    // Look at the following segments for acceptance criteria patterns
    for (let i = reqIndex + 1; i < segments.length && i <= reqIndex + 5; i++) {
      const segment = segments[i];
      if (segment === undefined) continue;

      const normalized = segment.toLowerCase();

      // Check if this segment looks like acceptance criteria
      const isAC = AC_INDICATORS.some((indicator) => normalized.includes(indicator));

      if (isAC) {
        // Clean up and add the criterion
        const cleaned = segment.trim();
        if (cleaned.length > 10 && cleaned.length < 500) {
          criteria.push(cleaned);
        }
      } else if (this.isRequirementLike(normalized)) {
        // Stop if we hit another requirement
        break;
      }
    }

    // Also check for inline acceptance criteria (e.g., "The system must X so that Y")
    const reqSegment = segments[reqIndex];
    if (reqSegment === undefined) {
      return criteria;
    }

    const inlinePatterns = [
      /so\s+that\s+(.+?)(?:\.|$)/i,
      /in\s+order\s+to\s+(.+?)(?:\.|$)/i,
      /which\s+(?:will|should)\s+(.+?)(?:\.|$)/i,
    ];

    for (const pattern of inlinePatterns) {
      const match = reqSegment.match(pattern);
      if (match?.[1] !== undefined) {
        const criterion = match[1].trim();
        if (criterion.length > 10 && criterion.length < 300) {
          criteria.push(`Expected outcome: ${criterion}`);
        }
      }
    }

    return criteria;
  }

  /**
   * Extract constraints from content
   */
  private extractConstraints(content: string, source: string): ExtractedConstraint[] {
    const constraints: ExtractedConstraint[] = [];
    const segments = this.splitIntoSegments(content);

    for (const segment of segments) {
      const normalized = segment.toLowerCase();

      // Check for constraint indicators
      const constraintType = this.detectConstraintType(normalized);
      if (constraintType === undefined) continue;

      const confidence = this.calculateConfidence(segment, true);
      if (confidence < this.options.minConfidence) continue;

      constraints.push({
        id: this.nextConstraintId(),
        description: segment.trim(),
        type: constraintType,
        source,
        confidence,
      });
    }

    return constraints;
  }

  /**
   * Extract assumptions from content
   */
  private extractAssumptions(content: string, source: string): ExtractedAssumption[] {
    const assumptions: ExtractedAssumption[] = [];
    const segments = this.splitIntoSegments(content);

    const assumptionIndicators = [
      'assume',
      'assuming',
      'assumption',
      'expect',
      'expecting',
      'expectation',
      'presume',
      'presuming',
      'given that',
      'considering that',
    ];

    for (const segment of segments) {
      const normalized = segment.toLowerCase();

      const isAssumption = assumptionIndicators.some((indicator) => normalized.includes(indicator));

      if (!isAssumption) continue;

      const confidence = this.calculateConfidence(segment, true);
      if (confidence < this.options.minConfidence) continue;

      assumptions.push({
        id: this.nextAssumptionId(),
        description: segment.trim(),
        source,
        confidence,
      });
    }

    return assumptions;
  }

  /**
   * Extract dependencies from content
   */
  private extractDependencies(content: string, source: string): ExtractedDependency[] {
    const dependencies: ExtractedDependency[] = [];
    const segments = this.splitIntoSegments(content);

    for (const segment of segments) {
      const normalized = segment.toLowerCase();

      // Check for dependency indicators
      const depType = this.detectDependencyType(normalized);
      if (depType === undefined) continue;

      // Extract dependency name
      const name = this.extractDependencyName(segment, depType);
      if (name === undefined) continue;

      dependencies.push({
        name,
        type: depType,
        required: !normalized.includes('optional'),
        source,
      });
    }

    return dependencies;
  }

  /**
   * Generate clarification questions based on extracted information
   */
  private generateClarificationQuestions(info: {
    projectName?: string | undefined;
    projectDescription?: string | undefined;
    functionalRequirements: readonly ExtractedRequirement[];
    nonFunctionalRequirements: readonly ExtractedRequirement[];
    constraints: readonly ExtractedConstraint[];
    assumptions: readonly ExtractedAssumption[];
    dependencies: readonly ExtractedDependency[];
  }): ClarificationQuestion[] {
    const questions: ClarificationQuestion[] = [];

    // Check for missing project information
    if (info.projectName === undefined) {
      questions.push({
        id: this.nextQuestionId(),
        category: 'scope',
        question: 'What is the name of this project?',
        context: 'A project name is needed to identify and organize the collected information.',
        required: true,
      });
    }

    if (info.projectDescription === undefined) {
      questions.push({
        id: this.nextQuestionId(),
        category: 'scope',
        question: 'Please provide a brief description of what this project aims to achieve.',
        context: 'A project description helps ensure all requirements align with the overall goal.',
        required: true,
      });
    }

    // Check for low-confidence requirements
    const lowConfidenceReqs = info.functionalRequirements.filter((r) => r.confidence < 0.6);
    for (const req of lowConfidenceReqs.slice(0, 3)) {
      questions.push({
        id: this.nextQuestionId(),
        category: 'requirement',
        question: `Could you clarify this requirement: "${req.title}"?`,
        context: `This requirement was detected with low confidence (${(req.confidence * 100).toFixed(0)}%). More detail would help ensure accurate interpretation.`,
        required: false,
        relatedTo: req.id,
      });
    }

    // Check for missing NFRs
    const nfrCategories = new Set(info.nonFunctionalRequirements.map((r) => r.nfrCategory));
    const missingNfrCategories = ['performance', 'security'].filter(
      (c) => !nfrCategories.has(c as never)
    );

    for (const category of missingNfrCategories) {
      questions.push({
        id: this.nextQuestionId(),
        category: 'requirement',
        question: `Are there any ${category} requirements for this project?`,
        context: `No ${category} requirements were detected. If applicable, please specify any ${category}-related needs.`,
        required: false,
      });
    }

    // Check for unvalidated assumptions
    for (const assumption of info.assumptions.slice(0, 2)) {
      questions.push({
        id: this.nextQuestionId(),
        category: 'assumption',
        question: `Can you confirm this assumption: "${assumption.description}"?`,
        context: 'Validating assumptions early helps prevent issues during development.',
        options: ['Yes, this is correct', 'No, this is incorrect', 'Partially correct'],
        required: false,
        relatedTo: assumption.id,
      });
    }

    // Limit number of questions
    return questions.slice(0, this.options.maxQuestions);
  }

  /**
   * Split content into segments (sentences, bullet points, etc.)
   */
  private splitIntoSegments(content: string): string[] {
    const segments: string[] = [];

    // Split by bullet points
    const bulletPattern = /^[\s]*[-*•]\s+(.+)$/gm;
    let match: RegExpExecArray | null;
    while ((match = bulletPattern.exec(content)) !== null) {
      if (match[1] !== undefined) {
        segments.push(match[1]);
      }
    }

    // Split by numbered lists
    const numberedPattern = /^[\s]*\d+[.)]\s+(.+)$/gm;
    while ((match = numberedPattern.exec(content)) !== null) {
      if (match[1] !== undefined) {
        segments.push(match[1]);
      }
    }

    // Split remaining content by sentences
    const remaining = content.replace(bulletPattern, '').replace(numberedPattern, '');

    const sentences = remaining.split(/(?<=[.!?])\s+/);
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed.length > 10) {
        segments.push(trimmed);
      }
    }

    return segments;
  }

  /**
   * Check if a segment looks like a requirement
   */
  private isRequirementLike(text: string): boolean {
    const indicators = [
      'must',
      'should',
      'shall',
      'need',
      'require',
      'want',
      'will',
      'can',
      'able to',
      'feature',
      'function',
      'capability',
      'user',
      'system',
      'application',
    ];

    return indicators.some((indicator) => text.includes(indicator));
  }

  /**
   * Detect NFR category from text
   */
  private detectNfrCategory(
    text: string
  ):
    | 'performance'
    | 'security'
    | 'scalability'
    | 'usability'
    | 'reliability'
    | 'maintainability'
    | undefined {
    for (const [category, keywords] of Object.entries(NFR_KEYWORDS)) {
      if (keywords.some((keyword) => text.includes(keyword))) {
        return category as
          | 'performance'
          | 'security'
          | 'scalability'
          | 'usability'
          | 'reliability'
          | 'maintainability';
      }
    }
    return undefined;
  }

  /**
   * Detect priority from text
   */
  private detectPriority(text: string): Priority {
    for (const [priority, keywords] of Object.entries(PRIORITY_KEYWORDS)) {
      if (keywords.some((keyword) => text.includes(keyword))) {
        return priority as Priority;
      }
    }
    return this.options.defaultPriority;
  }

  /**
   * Detect constraint type from text
   */
  private detectConstraintType(
    text: string
  ): 'technical' | 'business' | 'regulatory' | 'resource' | undefined {
    for (const [type, keywords] of Object.entries(CONSTRAINT_KEYWORDS)) {
      if (keywords.some((keyword) => text.includes(keyword))) {
        return type as 'technical' | 'business' | 'regulatory' | 'resource';
      }
    }
    return undefined;
  }

  /**
   * Detect dependency type from text
   */
  private detectDependencyType(text: string): 'api' | 'library' | 'service' | 'tool' | undefined {
    for (const [type, keywords] of Object.entries(DEPENDENCY_KEYWORDS)) {
      if (keywords.some((keyword) => text.includes(keyword))) {
        return type as 'api' | 'library' | 'service' | 'tool';
      }
    }
    return undefined;
  }

  /**
   * Extract a title from a segment
   */
  private extractTitle(segment: string): string {
    // Take first part up to first punctuation or 60 chars
    const title = segment.split(/[.,:;!?]/)[0] ?? segment;
    if (title.length > 60) {
      return title.slice(0, 57) + '...';
    }
    return title.trim();
  }

  /**
   * Extract dependency name from segment
   */
  private extractDependencyName(segment: string, type: string): string | undefined {
    // Look for quoted names
    const quotedMatch = segment.match(/["']([^"']+)["']/);
    if (quotedMatch?.[1] !== undefined) {
      return quotedMatch[1];
    }

    // Look for common dependency patterns
    const patterns: Record<string, RegExp> = {
      api: /(?:use|integrate|call)\s+(?:the\s+)?(\w+)\s+api/i,
      library: /(?:npm|yarn)\s+(?:install\s+)?(\S+)/i,
      service: /(?:aws|gcp|azure)\s+(\w+)/i,
      tool: /(?:use|using)\s+(\w+)/i,
    };

    const pattern = patterns[type];
    if (pattern !== undefined) {
      const match = segment.match(pattern);
      if (match?.[1] !== undefined) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * Calculate confidence score for an extraction
   */
  private calculateConfidence(segment: string, isRelevant: boolean): number {
    if (!isRelevant) return 0;

    let confidence = 0.5;

    // Increase confidence for longer, more detailed segments
    if (segment.length > 50) confidence += 0.1;
    if (segment.length > 100) confidence += 0.1;

    // Increase confidence for segments with specific keywords
    const specificKeywords = ['must', 'shall', 'required', 'essential'];
    if (specificKeywords.some((k) => segment.toLowerCase().includes(k))) {
      confidence += 0.15;
    }

    // Decrease confidence for vague language
    const vagueKeywords = ['maybe', 'possibly', 'might', 'could be'];
    if (vagueKeywords.some((k) => segment.toLowerCase().includes(k))) {
      confidence -= 0.2;
    }

    return Math.min(1, Math.max(0, confidence));
  }
}
