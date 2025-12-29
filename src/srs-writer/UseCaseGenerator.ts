/**
 * Use Case Generator for SRS Writer Agent
 *
 * Generates detailed use cases from system features and requirements.
 * Creates structured flows with main, alternative, and exception paths.
 */

import type { SRSFeature, SRSUseCase } from '../architecture-generator/types.js';
import type {
  ParsedPRDRequirement,
  UseCaseInput,
  DetailedUseCase,
  FlowStep,
  AlternativeFlow,
  ExceptionFlow,
} from './types.js';
import { UseCaseGenerationError } from './errors.js';

/**
 * Use case generator configuration options
 */
export interface UseCaseGeneratorOptions {
  /** Minimum use cases per feature (default: 1) */
  readonly minUseCasesPerFeature?: number;
  /** Maximum use cases per feature (default: 5) */
  readonly maxUseCasesPerFeature?: number;
  /** Generate exception flows (default: true) */
  readonly generateExceptionFlows?: boolean;
  /** Include secondary actors (default: true) */
  readonly includeSecondaryActors?: boolean;
}

/**
 * Default generator options
 */
const DEFAULT_OPTIONS: Required<UseCaseGeneratorOptions> = {
  minUseCasesPerFeature: 1,
  maxUseCasesPerFeature: 5,
  generateExceptionFlows: true,
  includeSecondaryActors: true,
};

/**
 * Use case generation result for a feature
 */
export interface UseCaseGenerationResult {
  /** Generated detailed use cases */
  readonly useCases: readonly DetailedUseCase[];
  /** Feature ID */
  readonly featureId: string;
  /** Source requirement IDs */
  readonly sourceRequirementIds: readonly string[];
  /** Coverage metrics */
  readonly coverage: UseCaseCoverage;
}

/**
 * Use case coverage metrics
 */
export interface UseCaseCoverage {
  /** Acceptance criteria covered */
  readonly criteriaCovered: number;
  /** Total acceptance criteria */
  readonly totalCriteria: number;
  /** Coverage percentage */
  readonly percentage: number;
}

/**
 * Use Case Generator class
 *
 * Generates structured use cases from requirements and features,
 * including main flows, alternative flows, and exception handling.
 */
export class UseCaseGenerator {
  private readonly options: Required<UseCaseGeneratorOptions>;
  private useCaseCounter: number = 0;

  constructor(options: UseCaseGeneratorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  /**
   * Reset the use case counter
   */
  public reset(): void {
    this.useCaseCounter = 0;
  }

  /**
   * Generate use cases for a feature based on its requirements
   *
   * @param input - Use case generation input
   * @returns Use case generation result
   */
  public generateForFeature(input: UseCaseInput): UseCaseGenerationResult {
    const { feature, requirement, actors } = input;

    try {
      const useCases: DetailedUseCase[] = [];
      const coveredCriteria = new Set<string>();

      // Generate primary use case from main requirement
      const primaryUC = this.generatePrimaryUseCase(feature, requirement, actors);
      useCases.push(primaryUC);

      // Track covered criteria
      this.trackCoveredCriteria(primaryUC, requirement, coveredCriteria);

      // Generate additional use cases from acceptance criteria
      const additionalUCs = this.generateFromAcceptanceCriteria(
        feature,
        requirement,
        actors,
        coveredCriteria
      );
      useCases.push(...additionalUCs);

      // Ensure minimum use cases
      while (useCases.length < this.options.minUseCasesPerFeature) {
        const supplementaryUC = this.generateSupplementaryUseCase(
          feature,
          requirement,
          actors,
          useCases.length
        );
        useCases.push(supplementaryUC);
      }

      // Calculate coverage
      const coverage: UseCaseCoverage = {
        criteriaCovered: coveredCriteria.size,
        totalCriteria: requirement.acceptanceCriteria.length,
        percentage:
          requirement.acceptanceCriteria.length > 0
            ? (coveredCriteria.size / requirement.acceptanceCriteria.length) * 100
            : 100,
      };

      return {
        useCases,
        featureId: feature.id,
        sourceRequirementIds: [requirement.id],
        coverage,
      };
    } catch (error) {
      if (error instanceof UseCaseGenerationError) {
        throw error;
      }
      throw new UseCaseGenerationError(
        feature.id,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Generate a primary use case for the main feature flow
   */
  private generatePrimaryUseCase(
    feature: SRSFeature,
    requirement: ParsedPRDRequirement,
    actors: readonly string[]
  ): DetailedUseCase {
    this.useCaseCounter++;
    const ucId = `UC-${String(this.useCaseCounter).padStart(3, '0')}`;

    const primaryActor = this.selectPrimaryActor(requirement, actors);
    const secondaryActors = this.options.includeSecondaryActors
      ? this.identifySecondaryActors(requirement, actors, primaryActor)
      : [];

    const mainFlow = this.generateMainFlow(requirement);
    const alternativeFlows = this.generateAlternativeFlows(requirement, mainFlow);
    const exceptionFlows = this.options.generateExceptionFlows
      ? this.generateExceptionFlows(requirement)
      : [];

    return {
      id: ucId,
      title: this.generateTitle(requirement.title),
      description: requirement.description,
      actor: primaryActor,
      secondaryActors,
      preconditions: this.generatePreconditions(requirement),
      mainFlow,
      alternativeFlows,
      exceptionFlows,
      postconditions: this.generatePostconditions(requirement),
      sourceFeatureId: feature.id,
      sourceRequirementId: requirement.id,
    };
  }

  /**
   * Generate use cases from acceptance criteria
   */
  private generateFromAcceptanceCriteria(
    feature: SRSFeature,
    requirement: ParsedPRDRequirement,
    actors: readonly string[],
    coveredCriteria: Set<string>
  ): DetailedUseCase[] {
    const useCases: DetailedUseCase[] = [];

    // Filter significant criteria that warrant separate use cases
    const significantCriteria = requirement.acceptanceCriteria.filter(
      (criterion) =>
        !coveredCriteria.has(criterion) &&
        criterion.length > 30 &&
        this.isSignificantCriterion(criterion)
    );

    // Limit to max use cases
    const maxAdditional = this.options.maxUseCasesPerFeature - 1;
    const criteriaToProcess = significantCriteria.slice(0, maxAdditional);

    for (const criterion of criteriaToProcess) {
      this.useCaseCounter++;
      const ucId = `UC-${String(this.useCaseCounter).padStart(3, '0')}`;

      const useCase = this.createUseCaseFromCriterion(
        ucId,
        criterion,
        feature,
        requirement,
        actors
      );
      useCases.push(useCase);
      coveredCriteria.add(criterion);
    }

    return useCases;
  }

  /**
   * Check if a criterion is significant enough for a separate use case
   */
  private isSignificantCriterion(criterion: string): boolean {
    const significantPatterns = [
      /\b(?:when|if)\s+.+\s+then\b/i,
      /\b(?:user|admin|system)\s+(?:can|should|must|shall)\b/i,
      /\b(?:validate|verify|check|ensure)\b/i,
      /\b(?:display|show|present|render)\b/i,
      /\b(?:save|store|persist|update|delete)\b/i,
    ];

    return significantPatterns.some((pattern) => pattern.test(criterion));
  }

  /**
   * Create a use case from a single criterion
   */
  private createUseCaseFromCriterion(
    ucId: string,
    criterion: string,
    feature: SRSFeature,
    requirement: ParsedPRDRequirement,
    actors: readonly string[]
  ): DetailedUseCase {
    const primaryActor = this.selectPrimaryActor(requirement, actors);
    const title = this.extractTitleFromCriterion(criterion);

    const mainFlow = this.generateFlowFromCriterion(criterion);

    return {
      id: ucId,
      title,
      description: criterion,
      actor: primaryActor,
      secondaryActors: [],
      preconditions: ['System is operational', 'User is authenticated'],
      mainFlow,
      alternativeFlows: [],
      exceptionFlows: this.options.generateExceptionFlows
        ? this.generateGenericExceptionFlows()
        : [],
      postconditions: ['Criterion is satisfied'],
      sourceFeatureId: feature.id,
      sourceRequirementId: requirement.id,
    };
  }

  /**
   * Generate a supplementary use case when minimum is not met
   */
  private generateSupplementaryUseCase(
    feature: SRSFeature,
    requirement: ParsedPRDRequirement,
    actors: readonly string[],
    index: number
  ): DetailedUseCase {
    this.useCaseCounter++;
    const ucId = `UC-${String(this.useCaseCounter).padStart(3, '0')}`;

    const supplementaryTypes = ['Validation', 'Error Handling', 'Confirmation', 'Cleanup'];
    const typeIndex = index % supplementaryTypes.length;
    const supplementaryType = supplementaryTypes[typeIndex] ?? 'Supplementary';

    return {
      id: ucId,
      title: `${requirement.title} - ${supplementaryType}`,
      description: `${supplementaryType} scenario for ${requirement.title}`,
      actor: actors[0] ?? 'User',
      secondaryActors: [],
      preconditions: ['Primary use case prerequisites are met'],
      mainFlow: [
        { stepNumber: 1, description: `User triggers ${supplementaryType.toLowerCase()} action` },
        {
          stepNumber: 2,
          description: `System performs ${supplementaryType.toLowerCase()}`,
          systemResponse: 'Operation completed',
        },
      ],
      alternativeFlows: [],
      exceptionFlows: [],
      postconditions: [`${supplementaryType} is completed`],
      sourceFeatureId: feature.id,
      sourceRequirementId: requirement.id,
    };
  }

  /**
   * Select the primary actor based on requirement context
   */
  private selectPrimaryActor(requirement: ParsedPRDRequirement, actors: readonly string[]): string {
    const text = `${requirement.title} ${requirement.description} ${requirement.userStory ?? ''}`;
    const lowerText = text.toLowerCase();

    // Check for specific actor mentions
    for (const actor of actors) {
      if (lowerText.includes(actor.toLowerCase())) {
        return actor;
      }
    }

    // Check for common actor patterns
    if (/\b(?:admin|administrator)\b/i.test(text)) {
      return actors.find((a) => /admin/i.test(a)) ?? 'Administrator';
    }
    if (/\b(?:system|automated|cron|scheduler)\b/i.test(text)) {
      return 'System';
    }

    return actors[0] ?? 'User';
  }

  /**
   * Identify secondary actors from requirement
   */
  private identifySecondaryActors(
    requirement: ParsedPRDRequirement,
    actors: readonly string[],
    primaryActor: string
  ): string[] {
    const secondaryActors: string[] = [];
    const text = `${requirement.description} ${requirement.userStory ?? ''}`;
    const lowerText = text.toLowerCase();

    for (const actor of actors) {
      if (actor !== primaryActor && lowerText.includes(actor.toLowerCase())) {
        secondaryActors.push(actor);
      }
    }

    // Check for implicit secondary actors
    if (primaryActor !== 'System' && /\b(?:notify|alert|email|send)\b/i.test(text)) {
      if (!secondaryActors.includes('System')) {
        secondaryActors.push('System');
      }
    }

    return secondaryActors;
  }

  /**
   * Generate main flow steps from requirement
   */
  private generateMainFlow(requirement: ParsedPRDRequirement): FlowStep[] {
    const steps: FlowStep[] = [];

    // Parse user story if available
    if (requirement.userStory !== undefined && requirement.userStory.length > 0) {
      steps.push(...this.parseUserStoryToSteps(requirement.userStory));
    } else {
      // Generate steps from description
      steps.push(...this.generateStepsFromDescription(requirement));
    }

    // Ensure we have at least basic steps
    if (steps.length === 0) {
      steps.push(
        { stepNumber: 1, description: `User initiates ${requirement.title}` },
        {
          stepNumber: 2,
          description: 'System validates the request',
          systemResponse: 'Validation passed',
        },
        {
          stepNumber: 3,
          description: 'System processes the request',
          systemResponse: 'Processing complete',
        },
        {
          stepNumber: 4,
          description: 'System displays the result',
          systemResponse: 'Result displayed to user',
        }
      );
    }

    return steps;
  }

  /**
   * Parse user story into flow steps
   */
  private parseUserStoryToSteps(userStory: string): FlowStep[] {
    const steps: FlowStep[] = [];

    // User story format: "As a <role>, I want <action> so that <benefit>"
    const match = userStory.match(/as\s+a\s+(.+?),\s*i\s+want\s+(.+?)\s+so\s+that\s+(.+)/i);

    if (match !== null) {
      const [, , action, benefit] = match;
      steps.push(
        { stepNumber: 1, description: `User initiates: ${action?.trim() ?? 'action'}` },
        {
          stepNumber: 2,
          description: 'System validates the request',
          systemResponse: 'Request validated',
        },
        {
          stepNumber: 3,
          description: 'System processes the request',
          systemResponse: 'Processing complete',
        },
        {
          stepNumber: 4,
          description: `System confirms: ${benefit?.trim() ?? 'benefit achieved'}`,
          systemResponse: 'Operation successful',
        }
      );
    }

    return steps;
  }

  /**
   * Generate flow steps from requirement description
   */
  private generateStepsFromDescription(requirement: ParsedPRDRequirement): FlowStep[] {
    const steps: FlowStep[] = [];
    const description = requirement.description;

    // Extract action verbs and create steps
    const sentences = description.split(/[.;]/).filter((s) => s.trim().length > 0);

    let stepNumber = 1;
    for (const sentence of sentences.slice(0, 5)) {
      const trimmed = sentence.trim();
      if (trimmed.length > 10) {
        const isSystemAction =
          /\b(?:system|shall|must|will|should)\b/i.test(trimmed) ||
          /\b(?:display|store|validate|process|generate)\b/i.test(trimmed);

        const step: FlowStep = {
          stepNumber: stepNumber++,
          description: trimmed,
        };

        if (isSystemAction) {
          steps.push({ ...step, systemResponse: 'Action completed' });
        } else {
          steps.push(step);
        }
      }
    }

    return steps;
  }

  /**
   * Generate flow from a criterion
   */
  private generateFlowFromCriterion(criterion: string): FlowStep[] {
    const steps: FlowStep[] = [];

    // Extract condition and action
    const whenMatch = criterion.match(/when\s+(.+?),?\s*then\s+(.+)/i);
    if (whenMatch !== null) {
      const [, condition, action] = whenMatch;
      steps.push(
        { stepNumber: 1, description: condition?.trim() ?? 'condition' },
        {
          stepNumber: 2,
          description: action?.trim() ?? 'action',
          systemResponse: 'Criterion satisfied',
        }
      );
    } else {
      steps.push({
        stepNumber: 1,
        description: criterion,
        systemResponse: 'Completed',
      });
    }

    return steps;
  }

  /**
   * Generate alternative flows based on main flow
   */
  private generateAlternativeFlows(
    requirement: ParsedPRDRequirement,
    mainFlow: readonly FlowStep[]
  ): AlternativeFlow[] {
    const alternatives: AlternativeFlow[] = [];

    // Check acceptance criteria for alternative scenarios
    for (const criterion of requirement.acceptanceCriteria) {
      const altMatch = criterion.match(/\b(?:if|when|alternatively|unless)\s+(.+)/i);
      if (altMatch !== null) {
        const condition = altMatch[1]?.trim() ?? 'alternative condition';

        // Determine branch point
        const branchStep = this.determineBranchPoint(condition, mainFlow);
        const label = `${String(branchStep)}a`;

        alternatives.push({
          label,
          condition,
          steps: [
            {
              stepNumber: 1,
              description: `Handle: ${condition}`,
              systemResponse: 'Alternative path completed',
            },
          ],
        });
      }
    }

    // Add a default validation alternative if none found
    if (alternatives.length === 0 && mainFlow.length > 1) {
      alternatives.push({
        label: '2a',
        condition: 'Validation fails',
        steps: [
          {
            stepNumber: 1,
            description: 'System detects validation error',
            systemResponse: 'Error message displayed',
          },
          {
            stepNumber: 2,
            description: 'User corrects the input',
          },
          {
            stepNumber: 3,
            description: 'Return to main flow step 2',
          },
        ],
      });
    }

    return alternatives;
  }

  /**
   * Determine which main flow step an alternative branches from
   */
  private determineBranchPoint(condition: string, mainFlow: readonly FlowStep[]): number {
    const lowerCondition = condition.toLowerCase();

    // Check for validation-related conditions
    if (/\b(?:invalid|error|fail|incorrect)\b/i.test(lowerCondition)) {
      // Find validation step
      for (const step of mainFlow) {
        if (/\b(?:validate|check|verify)\b/i.test(step.description.toLowerCase())) {
          return step.stepNumber;
        }
      }
      return 2; // Default to step 2
    }

    // Check for input-related conditions
    if (/\b(?:empty|missing|incomplete)\b/i.test(lowerCondition)) {
      return 1; // Branch from first step
    }

    // Default to middle of flow
    return Math.max(1, Math.floor(mainFlow.length / 2));
  }

  /**
   * Generate exception flows for error scenarios
   */
  private generateExceptionFlows(requirement: ParsedPRDRequirement): ExceptionFlow[] {
    const exceptions: ExceptionFlow[] = [];

    // Check for explicit error handling in criteria
    for (const criterion of requirement.acceptanceCriteria) {
      if (/\b(?:error|exception|fail|timeout|unavailable)\b/i.test(criterion)) {
        const exceptionType = this.extractExceptionType(criterion);
        exceptions.push({
          label: `E${String(exceptions.length + 1)}`,
          exception: exceptionType,
          handling: this.inferExceptionHandling(criterion, exceptionType),
        });
      }
    }

    // Add standard exception flows if none found
    if (exceptions.length === 0) {
      exceptions.push(...this.generateGenericExceptionFlows());
    }

    return exceptions;
  }

  /**
   * Generate generic exception flows
   */
  private generateGenericExceptionFlows(): ExceptionFlow[] {
    return [
      {
        label: 'E1',
        exception: 'System unavailable',
        handling: 'Display maintenance message and suggest retry later',
      },
      {
        label: 'E2',
        exception: 'Network timeout',
        handling: 'Display timeout error and offer retry option',
      },
    ];
  }

  /**
   * Extract exception type from criterion text
   */
  private extractExceptionType(criterion: string): string {
    const patterns: Array<{ pattern: RegExp; type: string }> = [
      { pattern: /timeout/i, type: 'Operation timeout' },
      { pattern: /unavailable/i, type: 'Service unavailable' },
      { pattern: /authentication/i, type: 'Authentication failure' },
      { pattern: /authorization|permission/i, type: 'Authorization denied' },
      { pattern: /network/i, type: 'Network error' },
      { pattern: /database/i, type: 'Database error' },
      { pattern: /validation/i, type: 'Validation error' },
    ];

    for (const { pattern, type } of patterns) {
      if (pattern.test(criterion)) {
        return type;
      }
    }

    return 'Unexpected error';
  }

  /**
   * Infer exception handling from criterion
   */
  private inferExceptionHandling(criterion: string, exceptionType: string): string {
    // Check if criterion specifies handling
    const handlingMatch = criterion.match(/(?:then|should|must)\s+(.+?)(?:\.|$)/i);
    if (handlingMatch !== null && handlingMatch[1] !== undefined) {
      return handlingMatch[1].trim();
    }

    // Default handling based on exception type
    const defaultHandling: Record<string, string> = {
      'Operation timeout': 'Notify user of timeout and offer retry option',
      'Service unavailable': 'Display service unavailable message with estimated recovery time',
      'Authentication failure': 'Clear session and redirect to login page',
      'Authorization denied': 'Display access denied message with contact information',
      'Network error': 'Show offline indicator and queue operation for retry',
      'Database error': 'Log error details and display generic error message',
      'Validation error': 'Highlight invalid fields and display specific error messages',
      'Unexpected error': 'Log error for investigation and display generic error message',
    };

    return defaultHandling[exceptionType] ?? 'Handle error appropriately and notify user';
  }

  /**
   * Generate preconditions from requirement
   */
  private generatePreconditions(requirement: ParsedPRDRequirement): string[] {
    const preconditions: string[] = [];

    // Default preconditions
    preconditions.push('User is authenticated');
    preconditions.push('System is operational');

    // Add dependency-based preconditions
    for (const dep of requirement.dependencies) {
      preconditions.push(`${dep} is available`);
    }

    // Infer preconditions from description
    const description = requirement.description.toLowerCase();
    if (/\b(?:edit|update|modify|delete)\b/.test(description)) {
      preconditions.push('Resource exists and is accessible');
    }
    if (/\b(?:permission|authorized|role)\b/.test(description)) {
      preconditions.push('User has required permissions');
    }

    return preconditions;
  }

  /**
   * Generate postconditions from requirement
   */
  private generatePostconditions(requirement: ParsedPRDRequirement): string[] {
    const postconditions: string[] = [];

    // Derive from acceptance criteria
    const firstCriterion = requirement.acceptanceCriteria[0];
    if (firstCriterion !== undefined) {
      postconditions.push(firstCriterion);
    }

    // Add standard postconditions
    postconditions.push(`${requirement.title} is completed successfully`);

    // Infer additional postconditions
    const description = requirement.description.toLowerCase();
    if (/\b(?:create|add|register)\b/.test(description)) {
      postconditions.push('New resource is persisted in the system');
    }
    if (/\b(?:update|modify|edit)\b/.test(description)) {
      postconditions.push('Changes are saved and reflected');
    }
    if (/\b(?:delete|remove)\b/.test(description)) {
      postconditions.push('Resource is removed from the system');
    }
    if (/\b(?:notify|email|alert)\b/.test(description)) {
      postconditions.push('Relevant parties are notified');
    }

    return [...new Set(postconditions)];
  }

  /**
   * Generate use case title from requirement title
   */
  private generateTitle(title: string): string {
    let processedTitle = title.trim();

    // Remove common prefixes
    processedTitle = processedTitle.replace(/^(?:the\s+|a\s+|an\s+)/i, '');

    // Capitalize first letter
    return processedTitle.charAt(0).toUpperCase() + processedTitle.slice(1);
  }

  /**
   * Extract title from criterion text
   */
  private extractTitleFromCriterion(criterion: string): string {
    // Try to extract action
    const actionMatch = criterion.match(
      /(?:user|admin|system)\s+(?:can|should|must|shall)\s+(.+?)(?:\.|,|when|if|$)/i
    );
    if (actionMatch !== null && actionMatch[1] !== undefined) {
      return this.generateTitle(actionMatch[1]);
    }

    // Try to extract from "when...then" pattern
    const whenMatch = criterion.match(/then\s+(.+?)(?:\.|,|$)/i);
    if (whenMatch !== null && whenMatch[1] !== undefined) {
      return this.generateTitle(whenMatch[1]);
    }

    // Fallback to truncated criterion
    return criterion.slice(0, 50).trim() + (criterion.length > 50 ? '...' : '');
  }

  /**
   * Track which criteria are covered by a use case
   */
  private trackCoveredCriteria(
    useCase: DetailedUseCase,
    requirement: ParsedPRDRequirement,
    coveredCriteria: Set<string>
  ): void {
    const useCaseText = `${useCase.title} ${useCase.description}`.toLowerCase();

    for (const criterion of requirement.acceptanceCriteria) {
      // Check if criterion is substantially covered
      const criterionWords = criterion.toLowerCase().split(/\s+/);
      const matchedWords = criterionWords.filter((word) => useCaseText.includes(word));

      if (matchedWords.length >= criterionWords.length * 0.5) {
        coveredCriteria.add(criterion);
      }
    }
  }

  /**
   * Convert detailed use case to basic SRSUseCase format
   *
   * @param detailed - Detailed use case to convert
   * @returns Basic SRSUseCase format
   */
  public toBasicUseCase(detailed: DetailedUseCase): SRSUseCase {
    return {
      id: detailed.id,
      name: detailed.title,
      description: detailed.description,
      actor: detailed.actor,
      preconditions: [...detailed.preconditions],
      mainFlow: detailed.mainFlow.map(
        (step) =>
          `${String(step.stepNumber)}. ${step.description}${step.systemResponse !== undefined ? ` (${step.systemResponse})` : ''}`
      ),
      alternativeFlows: detailed.alternativeFlows.map(
        (alt) =>
          `${alt.label}: ${alt.condition} - ${alt.steps.map((s) => s.description).join(', ')}`
      ),
      postconditions: [...detailed.postconditions],
    };
  }

  /**
   * Convert multiple detailed use cases to basic format
   *
   * @param detailedUseCases - Array of detailed use cases
   * @returns Array of basic SRSUseCase format
   */
  public toBasicUseCases(detailedUseCases: readonly DetailedUseCase[]): SRSUseCase[] {
    return detailedUseCases.map((uc) => this.toBasicUseCase(uc));
  }
}
