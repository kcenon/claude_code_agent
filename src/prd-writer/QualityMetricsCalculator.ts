/**
 * QualityMetricsCalculator - Calculates quality metrics for PRD documents
 *
 * Computes completeness, consistency, and clarity scores to provide
 * an overall quality assessment of the generated PRD.
 */

/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import type { CollectedInfo } from '../scratchpad/index.js';
import type {
  GapAnalysisResult,
  ConsistencyCheckResult,
  QualityMetrics,
  DetailedQualityMetrics,
  QualityMetricsConfig,
  ClarityAnalysisResult,
  ClarityIssue,
  ClarityIssueType,
} from './types.js';

/**
 * Default configuration for quality metrics calculation
 */
const DEFAULT_CONFIG: Required<QualityMetricsConfig> = {
  completenessWeight: 0.4,
  consistencyWeight: 0.35,
  clarityWeight: 0.25,
  maxSentenceLength: 40,
  maxPassiveVoicePercentage: 30,
};

/**
 * Ambiguous terms that reduce clarity
 */
const AMBIGUOUS_TERMS = [
  'some',
  'many',
  'few',
  'several',
  'various',
  'appropriate',
  'adequate',
  'reasonable',
  'sufficient',
  'good',
  'bad',
  'fast',
  'slow',
  'easy',
  'hard',
  'simple',
  'complex',
  'user-friendly',
  'intuitive',
  'efficient',
  'flexible',
  'scalable',
  'robust',
  'etc',
  'and so on',
  'and more',
  'as needed',
  'if necessary',
  'when appropriate',
  'as applicable',
  'where possible',
  'may',
  'might',
  'could',
  'possibly',
  'probably',
  'sometimes',
  'often',
  'usually',
  'generally',
  'normally',
  'typically',
];

/**
 * Passive voice indicators (past participle + by/was/were/is/are/been)
 */
const PASSIVE_INDICATORS = [
  /\b(?:is|are|was|were|be|been|being)\s+\w+ed\b/gi,
  /\b(?:is|are|was|were|be|been|being)\s+\w+en\b/gi,
];

/**
 * QualityMetricsCalculator class for calculating PRD quality metrics
 */
export class QualityMetricsCalculator {
  private readonly config: Required<QualityMetricsConfig>;
  private clarityIssueIdCounter: number = 0;

  constructor(config: QualityMetricsConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Calculate quality metrics from analysis results
   *
   * @param collectedInfo - The collected information
   * @param gapAnalysis - Gap analysis result
   * @param consistencyCheck - Consistency check result
   * @returns Quality metrics
   */
  public calculate(
    collectedInfo: CollectedInfo,
    gapAnalysis: GapAnalysisResult,
    consistencyCheck: ConsistencyCheckResult
  ): QualityMetrics {
    const completeness = this.calculateCompleteness(gapAnalysis);
    const consistency = this.calculateConsistency(consistencyCheck);
    const clarityResult = this.analyzeClarity(collectedInfo);
    const clarity = clarityResult.clarityScore;
    const overall = this.calculateOverall(completeness, consistency, clarity);

    return {
      completeness,
      consistency,
      clarity,
      overall,
    };
  }

  /**
   * Calculate detailed quality metrics with full analysis
   *
   * @param collectedInfo - The collected information
   * @param gapAnalysis - Gap analysis result
   * @param consistencyCheck - Consistency check result
   * @returns Detailed quality metrics
   */
  public calculateDetailed(
    collectedInfo: CollectedInfo,
    gapAnalysis: GapAnalysisResult,
    consistencyCheck: ConsistencyCheckResult
  ): DetailedQualityMetrics {
    const completeness = this.calculateCompleteness(gapAnalysis);
    const consistency = this.calculateConsistency(consistencyCheck);
    const clarityAnalysis = this.analyzeClarity(collectedInfo);
    const clarity = clarityAnalysis.clarityScore;
    const overall = this.calculateOverall(completeness, consistency, clarity);

    return {
      completeness,
      consistency,
      clarity,
      overall,
      clarityAnalysis,
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * Calculate completeness score from gap analysis
   *
   * @param gapAnalysis - Gap analysis result
   * @returns Completeness score (0.0 - 1.0)
   */
  public calculateCompleteness(gapAnalysis: GapAnalysisResult): number {
    return gapAnalysis.completenessScore;
  }

  /**
   * Calculate consistency score from consistency check
   *
   * @param consistencyCheck - Consistency check result
   * @returns Consistency score (0.0 - 1.0)
   */
  public calculateConsistency(consistencyCheck: ConsistencyCheckResult): number {
    // Base score starts at 1.0
    let score = 1.0;

    // Deduct for issues based on severity
    for (const issue of consistencyCheck.issues) {
      switch (issue.severity) {
        case 'critical':
          score -= 0.25;
          break;
        case 'major':
          score -= 0.15;
          break;
        case 'minor':
          score -= 0.05;
          break;
        case 'info':
          score -= 0.02;
          break;
      }
    }

    // Additional deduction for unbalanced priorities
    if (!consistencyCheck.priorityDistribution.isBalanced) {
      score -= 0.05;
    }

    // Additional deduction for circular dependencies
    if (consistencyCheck.dependencyAnalysis.circularChains.length > 0) {
      score -= 0.1 * consistencyCheck.dependencyAnalysis.circularChains.length;
    }

    // Clamp to 0.0 - 1.0
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Analyze clarity of the collected information
   *
   * @param collectedInfo - The collected information
   * @returns Clarity analysis result
   */
  public analyzeClarity(collectedInfo: CollectedInfo): ClarityAnalysisResult {
    this.clarityIssueIdCounter = 0;
    const issues: ClarityIssue[] = [];

    // Collect all text to analyze
    const textsToAnalyze: Array<{ text: string; location: string }> = [];

    // Project description
    textsToAnalyze.push({
      text: collectedInfo.project.description,
      location: 'project.description',
    });

    // Functional requirements
    const functionalReqs = collectedInfo.requirements?.functional ?? [];
    for (const req of functionalReqs) {
      textsToAnalyze.push({
        text: req.title,
        location: req.id,
      });
      textsToAnalyze.push({
        text: req.description,
        location: req.id,
      });
      // Acceptance criteria
      for (const ac of req.acceptanceCriteria ?? []) {
        textsToAnalyze.push({
          text: ac.description,
          location: `${req.id}.${ac.id}`,
        });
      }
    }

    // Non-functional requirements
    const nfrs = collectedInfo.requirements?.nonFunctional ?? [];
    for (const nfr of nfrs) {
      textsToAnalyze.push({
        text: nfr.title,
        location: nfr.id,
      });
      textsToAnalyze.push({
        text: nfr.description,
        location: nfr.id,
      });
    }

    // Analyze each text
    let totalSentences = 0;
    let totalWords = 0;
    let passiveSentences = 0;
    let ambiguousTermCount = 0;

    for (const { text, location } of textsToAnalyze) {
      if (!text || text.length === 0) {
        continue;
      }

      // Check for ambiguous terms
      const foundTerms = this.findAmbiguousTerms(text);
      ambiguousTermCount += foundTerms.length;
      for (const term of foundTerms) {
        issues.push(
          this.createClarityIssue(
            location,
            'ambiguous_term',
            `Ambiguous term "${term}" found`,
            term,
            `Replace "${term}" with a specific, measurable value or concrete description`
          )
        );
      }

      // Analyze sentences
      const sentences = this.extractSentences(text);
      for (const sentence of sentences) {
        totalSentences++;
        const wordCount = this.countWords(sentence);
        totalWords += wordCount;

        // Check sentence length
        if (wordCount > this.config.maxSentenceLength) {
          issues.push(
            this.createClarityIssue(
              location,
              'long_sentence',
              `Sentence has ${String(wordCount)} words (max ${String(this.config.maxSentenceLength)} recommended)`,
              sentence.substring(0, 100) + (sentence.length > 100 ? '...' : ''),
              'Break this into shorter, more focused sentences'
            )
          );
        }

        // Check for passive voice
        if (this.isPassiveVoice(sentence)) {
          passiveSentences++;
          issues.push(
            this.createClarityIssue(
              location,
              'passive_voice',
              'Passive voice detected',
              sentence.substring(0, 100) + (sentence.length > 100 ? '...' : ''),
              'Consider rewriting in active voice for clarity'
            )
          );
        }

        // Check for vague references
        if (this.hasVagueReference(sentence)) {
          issues.push(
            this.createClarityIssue(
              location,
              'vague_reference',
              'Vague reference detected (e.g., "it", "this", "that" without clear antecedent)',
              sentence.substring(0, 100) + (sentence.length > 100 ? '...' : ''),
              'Specify what "it", "this", or "that" refers to'
            )
          );
        }
      }
    }

    // Calculate metrics
    const averageSentenceLength = totalSentences > 0 ? totalWords / totalSentences : 0;
    const passiveVoicePercentage =
      totalSentences > 0 ? (passiveSentences / totalSentences) * 100 : 0;

    // Calculate clarity score
    const clarityScore = this.calculateClarityScore(
      issues,
      averageSentenceLength,
      passiveVoicePercentage,
      ambiguousTermCount
    );

    return {
      clarityScore,
      issues,
      averageSentenceLength,
      passiveVoicePercentage,
      ambiguousTermCount,
    };
  }

  /**
   * Calculate overall score as weighted average
   */
  private calculateOverall(completeness: number, consistency: number, clarity: number): number {
    const totalWeight =
      this.config.completenessWeight + this.config.consistencyWeight + this.config.clarityWeight;

    const weightedSum =
      completeness * this.config.completenessWeight +
      consistency * this.config.consistencyWeight +
      clarity * this.config.clarityWeight;

    return Math.max(0, Math.min(1, weightedSum / totalWeight));
  }

  /**
   * Calculate clarity score based on analysis
   */
  private calculateClarityScore(
    issues: ClarityIssue[],
    avgSentenceLength: number,
    passivePercentage: number,
    ambiguousCount: number
  ): number {
    let score = 1.0;

    // Deduct for ambiguous terms (up to 0.3)
    score -= Math.min(0.3, ambiguousCount * 0.03);

    // Deduct for long sentences
    const longSentenceIssues = issues.filter((i) => i.type === 'long_sentence').length;
    score -= Math.min(0.2, longSentenceIssues * 0.05);

    // Deduct for excessive passive voice
    if (passivePercentage > this.config.maxPassiveVoicePercentage) {
      score -= 0.1;
    }

    // Deduct for vague references
    const vagueRefIssues = issues.filter((i) => i.type === 'vague_reference').length;
    score -= Math.min(0.2, vagueRefIssues * 0.03);

    // Bonus for optimal sentence length (15-25 words average)
    if (avgSentenceLength >= 15 && avgSentenceLength <= 25) {
      score += 0.05;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Find ambiguous terms in text
   */
  private findAmbiguousTerms(text: string): string[] {
    const lowerText = text.toLowerCase();
    const foundTerms: string[] = [];

    for (const term of AMBIGUOUS_TERMS) {
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      if (regex.test(lowerText)) {
        foundTerms.push(term);
      }
    }

    return foundTerms;
  }

  /**
   * Extract sentences from text
   */
  private extractSentences(text: string): string[] {
    // Split by sentence-ending punctuation, keeping the delimiter
    const sentences = text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    return sentences;
  }

  /**
   * Count words in a sentence
   */
  private countWords(sentence: string): number {
    return sentence
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
  }

  /**
   * Check if sentence is in passive voice
   */
  private isPassiveVoice(sentence: string): boolean {
    for (const pattern of PASSIVE_INDICATORS) {
      if (pattern.test(sentence)) {
        // Reset lastIndex for global regex
        pattern.lastIndex = 0;
        return true;
      }
    }
    return false;
  }

  /**
   * Check for vague references
   */
  private hasVagueReference(sentence: string): boolean {
    // Check for "it", "this", "that" at the start of a sentence or after a period
    const vaguePatterns = [
      /^it\s+(?:is|was|will|should|must|can|may)/i,
      /^this\s+(?:is|was|will|should|must|can|may)/i,
      /^that\s+(?:is|was|will|should|must|can|may)/i,
    ];

    for (const pattern of vaguePatterns) {
      if (pattern.test(sentence.trim())) {
        return true;
      }
    }

    return false;
  }

  /**
   * Create a clarity issue with auto-generated ID
   */
  private createClarityIssue(
    location: string,
    type: ClarityIssueType,
    description: string,
    text: string,
    suggestion: string
  ): ClarityIssue {
    this.clarityIssueIdCounter++;
    return {
      id: `CLR-${String(this.clarityIssueIdCounter).padStart(3, '0')}`,
      location,
      type,
      description,
      text,
      suggestion,
    };
  }
}
