/**
 * InvestigationEngine — Multi-round structured investigation for requirements elicitation
 *
 * Manages investigation phases, generates questions (via LLM or templates),
 * processes answers, and enriches the extraction result.
 *
 * @module collector/InvestigationEngine
 */

import { promises as fs } from 'node:fs';
import { z } from 'zod';
import type { ExecutionAdapter, StageExecutionResult } from '../execution/index.js';
import { getLogger } from '../logging/index.js';
import type {
  InvestigationDepth,
  InvestigationPhase,
  InvestigationQuestion,
  InvestigationAnswer,
  InvestigationRound,
  InvestigationState,
  InvestigationEngineConfig,
  InvestigationPhaseConfig,
} from './investigation-types.js';
import {
  getPhasesForDepth,
  getMaxTotalQuestions,
  isEarlyExitAllowed,
  InvestigationQuestionFormatSchema,
  InvestigationEngineConfigSchema,
} from './investigation-types.js';
import { InvestigationTemplates } from './InvestigationTemplates.js';
import type {
  ExtractionResult,
  ExtractedRequirement,
  ExtractedConstraint,
  ExtractedAssumption,
} from './types.js';
import { InvestigationError } from './errors.js';

// =============================================================================
// LLM Response Schema
// =============================================================================

const LLMQuestionResponseSchema = z.object({
  format: InvestigationQuestionFormatSchema,
  question: z.string().min(5),
  context: z.string().optional(),
  options: z.array(z.string()).optional(),
  scaleRange: z.tuple([z.number(), z.number()]).optional(),
  scaleLabels: z.record(z.string(), z.string()).optional(),
  required: z.boolean(),
  category: z.string().optional(),
});

const LLMQuestionsArraySchema = z.array(LLMQuestionResponseSchema);

// =============================================================================
// InvestigationEngine
// =============================================================================

/**
 * Multi-round investigation engine for structured requirements elicitation.
 *
 * Conducts phased investigation with configurable depth, generating
 * context-aware questions via LLM or falling back to predefined templates.
 */
export class InvestigationEngine {
  private readonly config: Required<InvestigationEngineConfig>;
  private readonly adapter: ExecutionAdapter | null;
  private readonly templates: InvestigationTemplates;
  private state: InvestigationState;
  private questionCounter: number;
  private totalQuestionsAsked: number;
  private readonly maxTotalQuestions: number;

  constructor(
    config: Partial<InvestigationEngineConfig>,
    adapter: ExecutionAdapter | null,
    templates?: InvestigationTemplates
  ) {
    const parsed = InvestigationEngineConfigSchema.parse(config);
    this.config = {
      depth: parsed.depth,
      maxQuestionsPerRound: parsed.maxQuestionsPerRound,
      confidenceTarget: parsed.confidenceTarget,
      earlyExitOnHighConfidence: parsed.earlyExitOnHighConfidence,
      enableLLMQuestions: parsed.enableLLMQuestions,
    };
    this.adapter = adapter;
    this.templates = templates ?? new InvestigationTemplates();
    this.questionCounter = 0;
    this.totalQuestionsAsked = 0;
    this.maxTotalQuestions = getMaxTotalQuestions(this.config.depth);

    // Initialize default state
    this.state = {
      depth: this.config.depth,
      currentRound: 0,
      maxRounds: 0,
      phases: [],
      rounds: [],
      status: 'pending',
    };
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /**
   * Initialize investigation state for the configured depth.
   * @param depth
   */
  public initialize(depth?: InvestigationDepth): InvestigationState {
    const effectiveDepth = depth ?? this.config.depth;
    const phaseConfigs = getPhasesForDepth(effectiveDepth);

    this.state = {
      depth: effectiveDepth,
      currentRound: 0,
      maxRounds: phaseConfigs.length,
      phases: phaseConfigs.map((p) => p.phase),
      rounds: [],
      status: 'pending',
      startedAt: new Date().toISOString(),
    };

    this.questionCounter = 0;
    this.totalQuestionsAsked = 0;

    return this.state;
  }

  /**
   * Get current investigation state.
   */
  public getState(): InvestigationState {
    return this.state;
  }

  /**
   * Check if investigation is complete.
   */
  public isComplete(): boolean {
    return this.state.status === 'completed' || this.state.status === 'skipped';
  }

  // ===========================================================================
  // Round Management
  // ===========================================================================

  /**
   * Generate questions for the next round based on current extraction.
   * @param currentExtraction
   * @param priorAnswers
   */
  public async generateNextRound(
    currentExtraction: ExtractionResult,
    priorAnswers: readonly InvestigationAnswer[]
  ): Promise<InvestigationRound> {
    if (this.isComplete()) {
      throw new InvestigationError(
        this.getCurrentPhaseName(),
        this.state.currentRound,
        'Investigation is already complete'
      );
    }

    const nextRoundNumber = this.state.currentRound + 1;
    const phaseIndex = nextRoundNumber - 1;

    if (phaseIndex >= this.state.phases.length) {
      this.completeInvestigation();
      throw new InvestigationError('none', nextRoundNumber, 'All phases completed');
    }

    const phase = this.state.phases[phaseIndex];
    if (phase === undefined) {
      this.completeInvestigation();
      throw new InvestigationError('none', nextRoundNumber, 'Phase not found');
    }
    const phaseConfig = getPhasesForDepth(this.state.depth).find((p) => p.phase === phase);
    const maxQForPhase = Math.min(
      phaseConfig?.maxQuestions ?? this.config.maxQuestionsPerRound,
      this.maxTotalQuestions - this.totalQuestionsAsked
    );

    if (maxQForPhase <= 0) {
      this.completeInvestigation();
      throw new InvestigationError(phase, nextRoundNumber, 'Maximum total questions reached');
    }

    // Generate questions
    let questions: InvestigationQuestion[];
    if (this.config.enableLLMQuestions && this.adapter !== null) {
      questions = await this.generateLLMQuestions(
        phase,
        currentExtraction,
        priorAnswers,
        maxQForPhase,
        nextRoundNumber
      );
    } else {
      questions = this.generateTemplateQuestions(
        phase,
        currentExtraction,
        priorAnswers,
        maxQForPhase,
        nextRoundNumber
      );
    }

    const round: InvestigationRound = {
      roundNumber: nextRoundNumber,
      phase,
      questions,
      answers: [],
      startedAt: new Date().toISOString(),
      confidenceBefore: currentExtraction.overallConfidence,
    };

    this.state = {
      ...this.state,
      currentRound: nextRoundNumber,
      status: 'in_progress',
      rounds: [...this.state.rounds, round],
    };

    this.totalQuestionsAsked += questions.length;

    return round;
  }

  /**
   * Submit answers for the current round.
   * Returns updated state.
   * @param roundNumber
   * @param answers
   */
  public submitRoundAnswers(
    roundNumber: number,
    answers: readonly InvestigationAnswer[]
  ): InvestigationState {
    const roundIndex = this.state.rounds.findIndex((r) => r.roundNumber === roundNumber);
    if (roundIndex === -1) {
      throw new InvestigationError(
        this.getCurrentPhaseName(),
        roundNumber,
        `Round ${String(roundNumber)} not found`
      );
    }

    const existingRound = this.state.rounds[roundIndex];
    if (existingRound === undefined) {
      throw new InvestigationError(this.getCurrentPhaseName(), roundNumber, 'Round data missing');
    }

    const updatedRound: InvestigationRound = {
      ...existingRound,
      answers: [...answers],
      completedAt: new Date().toISOString(),
    };

    const updatedRounds = [...this.state.rounds];
    updatedRounds[roundIndex] = updatedRound;

    // Check if all phases are done
    const allPhasesDone = this.state.currentRound >= this.state.phases.length;

    this.state = {
      ...this.state,
      rounds: updatedRounds,
      status: allPhasesDone ? 'completed' : 'in_progress',
      completedAt: allPhasesDone ? new Date().toISOString() : undefined,
    };

    return this.state;
  }

  /**
   * Skip remaining investigation rounds.
   */
  public skipRemaining(): InvestigationState {
    this.state = {
      ...this.state,
      status: 'skipped',
      completedAt: new Date().toISOString(),
    };
    return this.state;
  }

  /**
   * Check if early exit is appropriate based on current confidence.
   * @param currentConfidence
   */
  public shouldEarlyExit(currentConfidence: number): boolean {
    if (!this.config.earlyExitOnHighConfidence) {
      return false;
    }
    if (!isEarlyExitAllowed(this.state.depth)) {
      return false;
    }
    return currentConfidence >= this.config.confidenceTarget;
  }

  // ===========================================================================
  // Question Generation - LLM
  // ===========================================================================

  private async generateLLMQuestions(
    phase: InvestigationPhase,
    extraction: ExtractionResult,
    priorAnswers: readonly InvestigationAnswer[],
    maxQuestions: number,
    roundNumber: number
  ): Promise<InvestigationQuestion[]> {
    try {
      const prompt = this.buildLLMPrompt(phase, extraction, priorAnswers, maxQuestions);

      if (this.adapter === null) {
        return this.generateTemplateQuestions(
          phase,
          extraction,
          priorAnswers,
          maxQuestions,
          roundNumber
        );
      }

      const result = await this.adapter.execute({
        agentType: 'collector',
        workOrder: prompt,
        priorOutputs: {},
      });

      if (result.status !== 'success') {
        getLogger().warn('LLM question generation unsuccessful, falling back to templates', {
          agent: 'InvestigationEngine',
          phase,
        });
        return this.generateTemplateQuestions(
          phase,
          extraction,
          priorAnswers,
          maxQuestions,
          roundNumber
        );
      }

      const payload = await this.readQuestionsPayload(result);
      if (payload === null) {
        return this.generateTemplateQuestions(
          phase,
          extraction,
          priorAnswers,
          maxQuestions,
          roundNumber
        );
      }

      return this.parseLLMQuestions(payload, phase, roundNumber);
    } catch (error) {
      getLogger().warn('LLM question generation failed, falling back to templates', {
        agent: 'InvestigationEngine',
        phase,
        error: error instanceof Error ? error.message : String(error),
      });
      return this.generateTemplateQuestions(
        phase,
        extraction,
        priorAnswers,
        maxQuestions,
        roundNumber
      );
    }
  }

  private buildLLMPrompt(
    phase: InvestigationPhase,
    extraction: ExtractionResult,
    priorAnswers: readonly InvestigationAnswer[],
    maxQuestions: number
  ): string {
    const phaseConfig = this.getPhaseConfig(phase);
    const phaseDesc = phaseConfig?.description ?? phase;
    const focusAreas = phaseConfig?.focusAreas.join(', ') ?? '';

    const frCount = String(extraction.functionalRequirements.length);
    const nfrCount = String(extraction.nonFunctionalRequirements.length);
    const conCount = String(extraction.constraints.length);
    const asmCount = String(extraction.assumptions.length);
    const confidence = String(Math.round(extraction.overallConfidence * 100));

    const qaHistory =
      priorAnswers.length > 0
        ? priorAnswers.map((a) => `Q[${a.questionId}]: ${a.answer}`).join('\n')
        : 'No prior Q&A history.';

    return `You are an expert requirements analyst conducting a structured investigation.
Current phase: "${phase}" — ${phaseDesc}
Focus areas: ${focusAreas}

CURRENT EXTRACTION STATE:
- Project: ${extraction.projectName ?? 'NOT DETECTED'} — ${extraction.projectDescription ?? 'NOT DETECTED'}
- Functional requirements: ${frCount} (confidence: ${confidence}%)
- Non-functional requirements: ${nfrCount}
- Constraints: ${conCount}, Assumptions: ${asmCount}

PRIOR Q&A HISTORY:
${qaHistory}

Generate ${String(maxQuestions)} investigation questions for this phase.
Return a JSON array of objects with this shape:
[
  {
    "format": "free_text|single_select|multi_select|yes_no|priority_ranking|confirmation|scale_rating",
    "question": "The question text",
    "context": "Why this question matters",
    "options": ["opt1", "opt2"],
    "required": true,
    "category": "requirement|constraint|assumption|priority|scope|architecture|stakeholder|timeline|quality|risk"
  }
]

Rules:
- Use format types: free_text, single_select, multi_select, yes_no, priority_ranking, confirmation, scale_rating
- Provide "options" for select/ranking formats
- Questions should be specific to gaps in current extraction
- Do not repeat questions already answered
- Focus on information GAPS in current extraction`;
  }

  private parseLLMQuestions(
    output: string,
    phase: InvestigationPhase,
    roundNumber: number
  ): InvestigationQuestion[] {
    const jsonMatch = output.match(/\[[\s\S]*\]/);
    if (jsonMatch === null) {
      throw new Error('No JSON array found in LLM output');
    }

    const parsed: unknown = JSON.parse(jsonMatch[0]);
    const validated = LLMQuestionsArraySchema.parse(parsed);

    return validated.map((q) => {
      this.questionCounter++;
      const qId = `IQ-LLM-${String(this.questionCounter).padStart(3, '0')}`;

      return {
        id: qId,
        phase,
        round: roundNumber,
        format: q.format,
        question: q.question,
        context: q.context ?? '',
        options: q.options,
        scaleRange:
          q.scaleRange !== undefined
            ? {
                min: q.scaleRange[0],
                max: q.scaleRange[1],
                labels:
                  q.scaleLabels !== undefined
                    ? { min: q.scaleLabels['min'] ?? '', max: q.scaleLabels['max'] ?? '' }
                    : undefined,
              }
            : undefined,
        required: q.required,
        relatedTo: undefined,
        category:
          q.category !== undefined
            ? (q.category as InvestigationQuestion['category'])
            : 'requirement',
      };
    });
  }

  /**
   * Resolve the JSON questions payload from the adapter result.
   *
   * Mirrors the contract used by {@link LLMExtractor.readExtractionPayload}:
   * the first artifact's `description` (preferred for tests/stubs) holds the
   * payload inline, otherwise the artifact `path` points to a file written
   * by the SDK that we read from disk. Returns null when neither channel
   * produced a payload.
   * @param result
   */
  private async readQuestionsPayload(result: StageExecutionResult): Promise<string | null> {
    const first = result.artifacts[0];
    if (first === undefined) {
      return null;
    }
    if (first.description !== undefined && first.description.length > 0) {
      return first.description;
    }
    try {
      return await fs.readFile(first.path, 'utf8');
    } catch (error) {
      getLogger().warn('Failed to read investigation questions artifact from disk', {
        agent: 'InvestigationEngine',
        path: first.path,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  // ===========================================================================
  // Question Generation - Templates
  // ===========================================================================

  private generateTemplateQuestions(
    phase: InvestigationPhase,
    extraction: ExtractionResult,
    _priorAnswers: readonly InvestigationAnswer[],
    maxQuestions: number,
    roundNumber: number
  ): InvestigationQuestion[] {
    // Collect tags from already-completed rounds
    const alreadyAskedTags: string[] = [];
    for (const round of this.state.rounds) {
      // Get tags from the templates that were used
      const phaseTags = this.templates.getTagsForPhases([round.phase]);
      alreadyAskedTags.push(...phaseTags);
    }

    const selectedTemplates = this.templates.getTemplatesForPhase(
      phase,
      extraction,
      alreadyAskedTags,
      maxQuestions
    );

    return selectedTemplates.map((template) => {
      this.questionCounter++;
      const qId = `IQ-TPL-${String(this.questionCounter).padStart(3, '0')}`;
      return this.templates.templateToQuestion(template, extraction, qId, roundNumber);
    });
  }

  // ===========================================================================
  // Extraction Enrichment
  // ===========================================================================

  /**
   * Merge investigation answers back into ExtractionResult.
   *
   * Each answer format is processed differently:
   * - free_text: stored as-is, may become additional requirements
   * - single_select/multi_select: mapped to fields
   * - yes_no: boolean field updates
   * - priority_ranking: requirement priority reassignment
   * - confirmation: confidence adjustments
   * - scale_rating: NFR generation
   * @param extraction
   * @param state
   */
  public enrichExtraction(
    extraction: ExtractionResult,
    state: InvestigationState
  ): ExtractionResult {
    let enriched = { ...extraction };

    for (const round of state.rounds) {
      for (const answer of round.answers) {
        const question = round.questions.find((q) => q.id === answer.questionId);
        if (question === undefined) {
          continue;
        }
        enriched = this.applyAnswer(enriched, question, answer);
      }
    }

    // Recalculate overall confidence
    enriched = {
      ...enriched,
      overallConfidence: this.recalculateConfidence(enriched),
    };

    return enriched;
  }

  private applyAnswer(
    extraction: ExtractionResult,
    question: InvestigationQuestion,
    answer: InvestigationAnswer
  ): ExtractionResult {
    switch (question.format) {
      case 'free_text':
        return this.applyFreeTextAnswer(extraction, question, answer);
      case 'single_select':
        return this.applySingleSelectAnswer(extraction, question, answer);
      case 'multi_select':
        return this.applyMultiSelectAnswer(extraction, question, answer);
      case 'yes_no':
        return this.applyYesNoAnswer(extraction, question, answer);
      case 'priority_ranking':
        return this.applyPriorityRankingAnswer(extraction, answer);
      case 'confirmation':
        return this.applyConfirmationAnswer(extraction, question, answer);
      case 'scale_rating':
        return this.applyScaleRatingAnswer(extraction, question, answer);
      default:
        return extraction;
    }
  }

  private applyFreeTextAnswer(
    extraction: ExtractionResult,
    question: InvestigationQuestion,
    answer: InvestigationAnswer
  ): ExtractionResult {
    // Map to project fields if applicable
    if (
      question.category === 'scope' &&
      question.question.toLowerCase().includes('primary business problem')
    ) {
      return {
        ...extraction,
        projectDescription: extraction.projectDescription ?? answer.answer,
      };
    }
    // For other free text, store context for later processing
    return extraction;
  }

  private applySingleSelectAnswer(
    extraction: ExtractionResult,
    _question: InvestigationQuestion,
    _answer: InvestigationAnswer
  ): ExtractionResult {
    // Single select answers are contextual — stored for downstream use
    return extraction;
  }

  private applyMultiSelectAnswer(
    extraction: ExtractionResult,
    question: InvestigationQuestion,
    answer: InvestigationAnswer
  ): ExtractionResult {
    const selected = answer.selectedOptions ?? [answer.answer];

    // Security measures → NFR entries
    if (question.category === 'quality' && question.question.toLowerCase().includes('security')) {
      const newNfrs: ExtractedRequirement[] = selected
        .filter((s) => s !== 'No constraints')
        .map((measure, index) => ({
          id: `NFR-INV-${String(extraction.nonFunctionalRequirements.length + index + 1).padStart(3, '0')}`,
          title: measure,
          description: `Security requirement: ${measure}`,
          priority: 'P1' as const,
          source: 'investigation',
          confidence: 0.9,
          isFunctional: false as const,
          nfrCategory: 'security' as const,
        }));

      return {
        ...extraction,
        nonFunctionalRequirements: [...extraction.nonFunctionalRequirements, ...newNfrs],
      };
    }

    // Technology constraints → constraint entries
    if (question.category === 'constraint') {
      const newConstraints: ExtractedConstraint[] = selected
        .filter((s) => s !== 'No constraints')
        .map((constraint, index) => ({
          id: `CON-INV-${String(extraction.constraints.length + index + 1).padStart(3, '0')}`,
          description: constraint,
          type: 'technical' as const,
          source: 'investigation',
          confidence: 0.9,
        }));

      return {
        ...extraction,
        constraints: [...extraction.constraints, ...newConstraints],
      };
    }

    return extraction;
  }

  private applyYesNoAnswer(
    extraction: ExtractionResult,
    question: InvestigationQuestion,
    answer: InvestigationAnswer
  ): ExtractionResult {
    const isYes = answer.answer.toLowerCase() === 'yes';

    // Assumption validation
    if (question.category === 'assumption' && question.relatedTo !== undefined) {
      const updatedAssumptions: ExtractedAssumption[] = extraction.assumptions.map((a) => {
        if (a.id === question.relatedTo) {
          return { ...a, confidence: isYes ? 1.0 : 0.0 };
        }
        return a;
      });
      return { ...extraction, assumptions: updatedAssumptions };
    }

    // Regulatory requirements
    if (
      question.category === 'constraint' &&
      question.question.toLowerCase().includes('regulatory')
    ) {
      if (isYes) {
        const newConstraint: ExtractedConstraint = {
          id: `CON-INV-${String(extraction.constraints.length + 1).padStart(3, '0')}`,
          description: 'Regulatory/compliance requirements apply',
          type: 'regulatory',
          source: 'investigation',
          confidence: 0.9,
        };
        return { ...extraction, constraints: [...extraction.constraints, newConstraint] };
      }
    }

    return extraction;
  }

  private applyPriorityRankingAnswer(
    extraction: ExtractionResult,
    answer: InvestigationAnswer
  ): ExtractionResult {
    const rankings = answer.rankings ?? [];
    if (rankings.length === 0) {
      return extraction;
    }

    const updatedFrs = extraction.functionalRequirements.map((fr) => {
      // Find position in ranking
      const rankIndex = rankings.findIndex((r) => r.includes(fr.id));
      if (rankIndex === -1) {
        return fr;
      }
      const position = rankIndex / rankings.length;
      let priority: 'P0' | 'P1' | 'P2' | 'P3';
      if (position < 0.25) {
        priority = 'P0';
      } else if (position < 0.5) {
        priority = 'P1';
      } else if (position < 0.75) {
        priority = 'P2';
      } else {
        priority = 'P3';
      }
      return { ...fr, priority };
    });

    return { ...extraction, functionalRequirements: updatedFrs };
  }

  private applyConfirmationAnswer(
    extraction: ExtractionResult,
    _question: InvestigationQuestion,
    answer: InvestigationAnswer
  ): ExtractionResult {
    const response = answer.answer.toLowerCase();

    if (response === 'agree' || response === 'yes') {
      // Boost confidence of all requirements
      const updatedFrs = extraction.functionalRequirements.map((fr) => ({
        ...fr,
        confidence: Math.min(1.0, fr.confidence + 0.15),
      }));
      return { ...extraction, functionalRequirements: updatedFrs };
    }

    if (response === 'disagree' || response === 'no') {
      // Reduce confidence of low-confidence requirements
      const updatedFrs = extraction.functionalRequirements.map((fr) => {
        if (fr.confidence < 0.7) {
          return { ...fr, confidence: Math.max(0, fr.confidence - 0.2) };
        }
        return fr;
      });
      return { ...extraction, functionalRequirements: updatedFrs };
    }

    return extraction;
  }

  private applyScaleRatingAnswer(
    extraction: ExtractionResult,
    question: InvestigationQuestion,
    answer: InvestigationAnswer
  ): ExtractionResult {
    const value = answer.scaleValue ?? Number(answer.answer);
    if (isNaN(value)) {
      return extraction;
    }

    // Availability rating → NFR
    if (question.question.toLowerCase().includes('availability')) {
      const availabilityMap: Record<number, string> = {
        1: 'Best effort availability',
        2: '99% uptime (7.3h downtime/month)',
        3: '99.9% uptime (43.8m downtime/month)',
        4: '99.95% uptime (21.9m downtime/month)',
        5: '99.99% uptime (4.38m downtime/month)',
      };
      const description = availabilityMap[value] ?? `Availability level: ${String(value)}`;
      const nfr: ExtractedRequirement = {
        id: `NFR-INV-${String(extraction.nonFunctionalRequirements.length + 1).padStart(3, '0')}`,
        title: 'Availability Requirement',
        description,
        priority: value >= 4 ? ('P0' as const) : ('P1' as const),
        source: 'investigation',
        confidence: 0.9,
        isFunctional: false,
        nfrCategory: 'reliability',
      };
      return {
        ...extraction,
        nonFunctionalRequirements: [...extraction.nonFunctionalRequirements, nfr],
      };
    }

    return extraction;
  }

  // ===========================================================================
  // Helpers
  // ===========================================================================

  private recalculateConfidence(extraction: ExtractionResult): number {
    const allItems = [
      ...extraction.functionalRequirements.map((r) => r.confidence),
      ...extraction.nonFunctionalRequirements.map((r) => r.confidence),
    ];

    const baseConfidence =
      allItems.length > 0 ? allItems.reduce((sum, c) => sum + c, 0) / allItems.length : 0.5;

    let coverageBonus = 0;
    if (extraction.projectName !== undefined && extraction.projectName !== '') {
      coverageBonus += 0.05;
    }
    if (extraction.projectDescription !== undefined && extraction.projectDescription !== '') {
      coverageBonus += 0.05;
    }
    if (extraction.functionalRequirements.length >= 3) {
      coverageBonus += 0.05;
    }
    if (extraction.nonFunctionalRequirements.length >= 2) {
      coverageBonus += 0.05;
    }
    if (extraction.constraints.length >= 1) {
      coverageBonus += 0.03;
    }

    return Math.min(1.0, baseConfidence + coverageBonus);
  }

  private getCurrentPhaseName(): string {
    const phaseIndex = this.state.currentRound - 1;
    if (phaseIndex >= 0 && phaseIndex < this.state.phases.length) {
      return this.state.phases[phaseIndex] ?? 'unknown';
    }
    return 'unknown';
  }

  private getPhaseConfig(phase: InvestigationPhase): InvestigationPhaseConfig | undefined {
    return getPhasesForDepth(this.state.depth).find((p) => p.phase === phase);
  }

  private completeInvestigation(): void {
    this.state = {
      ...this.state,
      status: 'completed',
      completedAt: new Date().toISOString(),
    };
  }
}
