/**
 * GapAnalyzer - Identifies missing information in collected data
 *
 * Analyzes CollectedInfo to find gaps that would result in
 * incomplete PRD sections and suggests remediation actions.
 */

/* eslint-disable @typescript-eslint/no-unnecessary-condition */

import type { CollectedInfo } from '../scratchpad/index.js';
import type { GapItem, GapAnalysisResult, GapCategory, GapSeverity, PRDSection } from './types.js';

/**
 * Configuration for gap analysis
 */
export interface GapAnalyzerOptions {
  /** Minimum number of functional requirements expected */
  readonly minFunctionalRequirements?: number;
  /** Minimum number of acceptance criteria per requirement */
  readonly minAcceptanceCriteria?: number;
  /** Whether to check for user stories */
  readonly requireUserStories?: boolean;
  /** Whether to check for metrics in NFRs */
  readonly requireNFRMetrics?: boolean;
}

/**
 * Default gap analyzer options
 */
const DEFAULT_OPTIONS: Required<GapAnalyzerOptions> = {
  minFunctionalRequirements: 1,
  minAcceptanceCriteria: 1,
  requireUserStories: false,
  requireNFRMetrics: true,
};

/**
 * GapAnalyzer class for identifying missing information
 */
export class GapAnalyzer {
  private readonly options: Required<GapAnalyzerOptions>;
  private gapIdCounter: number = 0;

  constructor(options: GapAnalyzerOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Analyze collected info for gaps
   *
   * @param collectedInfo - The collected information to analyze
   * @returns Gap analysis result
   */
  public analyze(collectedInfo: CollectedInfo): GapAnalysisResult {
    this.gapIdCounter = 0;
    const gaps: GapItem[] = [];

    // Check project info
    gaps.push(...this.analyzeProjectInfo(collectedInfo));

    // Check functional requirements
    gaps.push(...this.analyzeFunctionalRequirements(collectedInfo));

    // Check non-functional requirements
    gaps.push(...this.analyzeNonFunctionalRequirements(collectedInfo));

    // Check constraints and assumptions
    gaps.push(...this.analyzeConstraintsAndAssumptions(collectedInfo));

    // Check dependencies
    gaps.push(...this.analyzeDependencies(collectedInfo));

    // Categorize gaps by severity
    const criticalGaps = gaps.filter((g) => g.severity === 'critical');
    const majorGaps = gaps.filter((g) => g.severity === 'major');
    const minorGaps = gaps.filter((g) => g.severity === 'minor');
    const infoGaps = gaps.filter((g) => g.severity === 'info');

    // Calculate completeness score
    const completenessScore = this.calculateCompletenessScore(collectedInfo, gaps);

    // Get unique sections with gaps
    const sectionsWithGaps = [...new Set(gaps.map((g) => g.section))];

    return {
      totalGaps: gaps.length,
      criticalGaps,
      majorGaps,
      minorGaps,
      infoGaps,
      completenessScore,
      sectionsWithGaps,
    };
  }

  /**
   * Analyze project information for gaps
   */
  private analyzeProjectInfo(info: CollectedInfo): GapItem[] {
    const gaps: GapItem[] = [];

    // Check project name
    if (info.project.name.length === 0 || info.project.name.startsWith('Project-')) {
      gaps.push(
        this.createGap(
          'missing_description',
          'major',
          'executive_summary',
          'Project name is missing or auto-generated',
          'Provide a meaningful product name that reflects its purpose'
        )
      );
    }

    // Check project description
    if (info.project.description.length < 20) {
      gaps.push(
        this.createGap(
          'missing_description',
          'major',
          'executive_summary',
          'Project description is too short or missing',
          'Provide a comprehensive description of the product (at least 20 characters)'
        )
      );
    }

    return gaps;
  }

  /**
   * Analyze functional requirements for gaps
   */
  private analyzeFunctionalRequirements(info: CollectedInfo): GapItem[] {
    const gaps: GapItem[] = [];
    const functionalReqs = info.requirements?.functional ?? [];

    // Check if we have minimum functional requirements
    if (functionalReqs.length < this.options.minFunctionalRequirements) {
      gaps.push(
        this.createGap(
          'missing_requirement',
          'critical',
          'functional_requirements',
          `No functional requirements defined (minimum ${String(this.options.minFunctionalRequirements)} expected)`,
          'Define at least one functional requirement with clear acceptance criteria'
        )
      );
    }

    // Analyze each functional requirement
    for (const req of functionalReqs) {
      // Check title
      if (req.title.length === 0) {
        gaps.push(
          this.createGap(
            'incomplete_requirement',
            'major',
            'functional_requirements',
            `Requirement ${req.id} is missing a title`,
            'Add a concise, descriptive title for the requirement',
            req.id
          )
        );
      }

      // Check description
      if (req.description.length < 10) {
        gaps.push(
          this.createGap(
            'missing_description',
            'major',
            'functional_requirements',
            `Requirement ${req.id} has insufficient description`,
            'Provide a detailed description explaining what the requirement entails',
            req.id
          )
        );
      }

      // Check acceptance criteria
      const criteria = req.acceptanceCriteria ?? [];
      if (criteria.length < this.options.minAcceptanceCriteria) {
        gaps.push(
          this.createGap(
            'missing_acceptance_criteria',
            'major',
            'functional_requirements',
            `Requirement ${req.id} has no acceptance criteria`,
            'Add testable acceptance criteria to verify requirement completion',
            req.id
          )
        );
      }
    }

    return gaps;
  }

  /**
   * Analyze non-functional requirements for gaps
   */
  private analyzeNonFunctionalRequirements(info: CollectedInfo): GapItem[] {
    const gaps: GapItem[] = [];
    const nfrs = info.requirements?.nonFunctional ?? [];

    // Check if we have at least some NFRs
    if (nfrs.length === 0) {
      gaps.push(
        this.createGap(
          'missing_requirement',
          'minor',
          'non_functional_requirements',
          'No non-functional requirements defined',
          'Consider adding requirements for performance, security, or scalability'
        )
      );
    }

    // Check each NFR for metrics
    if (this.options.requireNFRMetrics) {
      for (const nfr of nfrs) {
        if (
          (nfr.metric === undefined || nfr.metric === '') &&
          (nfr.target === undefined || nfr.target === '')
        ) {
          gaps.push(
            this.createGap(
              'missing_metric',
              'minor',
              'non_functional_requirements',
              `NFR ${nfr.id} is missing a measurable target metric`,
              'Add specific, measurable targets (e.g., "response time < 200ms")',
              nfr.id
            )
          );
        }
      }
    }

    return gaps;
  }

  /**
   * Analyze constraints and assumptions for gaps
   */
  private analyzeConstraintsAndAssumptions(info: CollectedInfo): GapItem[] {
    const gaps: GapItem[] = [];
    const constraints = info.constraints ?? [];
    const assumptions = info.assumptions ?? [];

    // Check constraints have reasons
    for (const constraint of constraints) {
      if (constraint.reason === undefined || constraint.reason === '') {
        gaps.push(
          this.createGap(
            'missing_description',
            'info',
            'constraints_assumptions',
            `Constraint ${constraint.id} is missing a reason`,
            'Explain why this constraint exists',
            constraint.id
          )
        );
      }
    }

    // Check assumptions have risk assessments
    for (const assumption of assumptions) {
      if (assumption.riskIfWrong === undefined || assumption.riskIfWrong === '') {
        gaps.push(
          this.createGap(
            'missing_description',
            'info',
            'constraints_assumptions',
            `Assumption ${assumption.id} is missing risk assessment`,
            'Describe what could go wrong if this assumption is incorrect',
            assumption.id
          )
        );
      }
    }

    return gaps;
  }

  /**
   * Analyze dependencies for gaps
   */
  private analyzeDependencies(info: CollectedInfo): GapItem[] {
    const gaps: GapItem[] = [];
    const dependencies = info.dependencies ?? [];

    // Check each dependency for purpose
    for (const dep of dependencies) {
      if (dep.purpose === undefined || dep.purpose === '') {
        gaps.push(
          this.createGap(
            'missing_dependency',
            'info',
            'dependencies',
            `Dependency "${dep.name}" is missing purpose description`,
            'Explain why this dependency is needed',
            dep.name
          )
        );
      }
    }

    return gaps;
  }

  /**
   * Calculate completeness score based on collected info and gaps
   */
  private calculateCompletenessScore(info: CollectedInfo, gaps: GapItem[]): number {
    // Base score starts at 1.0
    let score = 1.0;

    // Deduct for critical gaps
    const criticalCount = gaps.filter((g) => g.severity === 'critical').length;
    score -= criticalCount * 0.2;

    // Deduct for major gaps
    const majorCount = gaps.filter((g) => g.severity === 'major').length;
    score -= majorCount * 0.1;

    // Deduct for minor gaps
    const minorCount = gaps.filter((g) => g.severity === 'minor').length;
    score -= minorCount * 0.03;

    // Add points for completeness
    const functionalReqs = info.requirements?.functional ?? [];
    const nfrs = info.requirements?.nonFunctional ?? [];
    const constraints = info.constraints ?? [];
    const assumptions = info.assumptions ?? [];
    const dependencies = info.dependencies ?? [];

    // Bonus for having diverse content
    if (functionalReqs.length >= 3) score += 0.05;
    if (nfrs.length >= 2) score += 0.03;
    if (constraints.length >= 1) score += 0.02;
    if (assumptions.length >= 1) score += 0.02;
    if (dependencies.length >= 1) score += 0.02;

    // Clamp to 0.0 - 1.0
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Create a gap item with auto-generated ID
   */
  private createGap(
    category: GapCategory,
    severity: GapSeverity,
    section: PRDSection,
    description: string,
    suggestion: string,
    relatedId?: string
  ): GapItem {
    this.gapIdCounter++;
    const gap: GapItem = {
      id: `GAP-${String(this.gapIdCounter).padStart(3, '0')}`,
      category,
      severity,
      section,
      description,
      suggestion,
    };

    if (relatedId !== undefined) {
      return { ...gap, relatedId };
    }
    return gap;
  }
}
