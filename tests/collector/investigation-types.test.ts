import { describe, it, expect } from 'vitest';
import {
  InvestigationDepthSchema,
  InvestigationQuestionFormatSchema,
  InvestigationPhaseSchema,
  InvestigationQuestionSchema,
  InvestigationAnswerSchema,
  InvestigationRoundSchema,
  InvestigationStateSchema,
  InvestigationEngineConfigSchema,
  InvestigationMetadataSchema,
  getPhasesForDepth,
  getMaxTotalQuestions,
  isEarlyExitAllowed,
  THOROUGH_PHASES,
  STANDARD_PHASES,
  QUICK_PHASES,
} from '../../src/collector/investigation-types.js';
import type {
  InvestigationDepth,
  InvestigationQuestion,
  InvestigationAnswer,
  InvestigationRound,
  InvestigationState,
} from '../../src/collector/investigation-types.js';

// =============================================================================
// Helpers
// =============================================================================

function validQuestion(overrides?: Partial<InvestigationQuestion>): InvestigationQuestion {
  return {
    id: 'IQ-VIS-001',
    phase: 'project_vision',
    round: 1,
    format: 'free_text',
    question: 'What is the primary goal of this project?',
    context: 'Understanding the vision helps shape the requirements.',
    required: true,
    category: 'requirement',
    ...overrides,
  };
}

function validAnswer(overrides?: Partial<InvestigationAnswer>): InvestigationAnswer {
  return {
    questionId: 'IQ-VIS-001',
    answer: 'Build a task management app',
    answeredAt: new Date().toISOString(),
    ...overrides,
  };
}

function validRound(overrides?: Partial<InvestigationRound>): InvestigationRound {
  return {
    roundNumber: 1,
    phase: 'project_vision',
    questions: [validQuestion()],
    answers: [validAnswer()],
    startedAt: new Date().toISOString(),
    confidenceBefore: 0.3,
    ...overrides,
  };
}

// =============================================================================
// InvestigationDepthSchema
// =============================================================================

describe('InvestigationDepthSchema', () => {
  it.each(['thorough', 'standard', 'quick'] as const)('should accept valid depth "%s"', (value) => {
    expect(InvestigationDepthSchema.parse(value)).toBe(value);
  });

  it('should reject invalid string "extreme"', () => {
    const result = InvestigationDepthSchema.safeParse('extreme');
    expect(result.success).toBe(false);
  });

  it('should reject empty string', () => {
    const result = InvestigationDepthSchema.safeParse('');
    expect(result.success).toBe(false);
  });

  it('should reject non-string value (number)', () => {
    const result = InvestigationDepthSchema.safeParse(123);
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// InvestigationQuestionFormatSchema
// =============================================================================

describe('InvestigationQuestionFormatSchema', () => {
  const validFormats = [
    'free_text',
    'single_select',
    'multi_select',
    'yes_no',
    'priority_ranking',
    'confirmation',
    'scale_rating',
  ] as const;

  it.each(validFormats)('should accept valid format "%s"', (value) => {
    expect(InvestigationQuestionFormatSchema.parse(value)).toBe(value);
  });

  it('should reject invalid format "other"', () => {
    const result = InvestigationQuestionFormatSchema.safeParse('other');
    expect(result.success).toBe(false);
  });

  it('should reject undefined', () => {
    const result = InvestigationQuestionFormatSchema.safeParse(undefined);
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// InvestigationPhaseSchema
// =============================================================================

describe('InvestigationPhaseSchema', () => {
  const allPhases = [
    'project_vision',
    'user_analysis',
    'functional_deep_dive',
    'nonfunctional_analysis',
    'constraints_risks',
    'validation_synthesis',
    'core_discovery',
    'requirements_analysis',
    'constraints_validation',
    'basic_clarification',
  ] as const;

  it.each(allPhases)('should accept valid phase "%s"', (value) => {
    expect(InvestigationPhaseSchema.parse(value)).toBe(value);
  });

  it('should reject invalid phase "planning"', () => {
    const result = InvestigationPhaseSchema.safeParse('planning');
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// InvestigationQuestionSchema
// =============================================================================

describe('InvestigationQuestionSchema', () => {
  it('should accept a valid question object', () => {
    const q = validQuestion();
    const result = InvestigationQuestionSchema.parse(q);
    expect(result.id).toBe('IQ-VIS-001');
    expect(result.phase).toBe('project_vision');
    expect(result.format).toBe('free_text');
    expect(result.required).toBe(true);
    expect(result.category).toBe('requirement');
  });

  it('should accept a question with optional fields', () => {
    const q = validQuestion({
      options: ['Option A', 'Option B'],
      scaleRange: { min: 1, max: 5, labels: { min: 'Low', max: 'High' } },
      relatedTo: 'FR-001',
    });
    const result = InvestigationQuestionSchema.parse(q);
    expect(result.options).toEqual(['Option A', 'Option B']);
    expect(result.scaleRange).toEqual({ min: 1, max: 5, labels: { min: 'Low', max: 'High' } });
    expect(result.relatedTo).toBe('FR-001');
  });

  it('should accept a question with scaleRange without labels', () => {
    const q = validQuestion({
      format: 'scale_rating',
      scaleRange: { min: 0, max: 10 },
    });
    const result = InvestigationQuestionSchema.parse(q);
    expect(result.scaleRange?.labels).toBeUndefined();
  });

  it('should reject when required fields are missing', () => {
    const result = InvestigationQuestionSchema.safeParse({
      id: 'IQ-001',
      // missing phase, round, format, question, context, required, category
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty id', () => {
    const result = InvestigationQuestionSchema.safeParse(validQuestion({ id: '' }));
    expect(result.success).toBe(false);
  });

  it('should reject invalid format in question', () => {
    const result = InvestigationQuestionSchema.safeParse({
      ...validQuestion(),
      format: 'essay',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid phase in question', () => {
    const result = InvestigationQuestionSchema.safeParse({
      ...validQuestion(),
      phase: 'unknown_phase',
    });
    expect(result.success).toBe(false);
  });

  it('should reject round less than 1', () => {
    const result = InvestigationQuestionSchema.safeParse(validQuestion({ round: 0 }));
    expect(result.success).toBe(false);
  });

  it('should reject invalid category', () => {
    const result = InvestigationQuestionSchema.safeParse({
      ...validQuestion(),
      category: 'general',
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// InvestigationAnswerSchema
// =============================================================================

describe('InvestigationAnswerSchema', () => {
  it('should accept a valid answer', () => {
    const a = validAnswer();
    const result = InvestigationAnswerSchema.parse(a);
    expect(result.questionId).toBe('IQ-VIS-001');
    expect(result.answer).toBe('Build a task management app');
    expect(result.answeredAt).toBeDefined();
  });

  it('should accept an answer with selectedOptions', () => {
    const a = validAnswer({
      selectedOptions: ['Option A', 'Option C'],
    });
    const result = InvestigationAnswerSchema.parse(a);
    expect(result.selectedOptions).toEqual(['Option A', 'Option C']);
  });

  it('should accept an answer with scaleValue', () => {
    const a = validAnswer({ scaleValue: 7 });
    const result = InvestigationAnswerSchema.parse(a);
    expect(result.scaleValue).toBe(7);
  });

  it('should accept an answer with rankings', () => {
    const a = validAnswer({
      rankings: ['Security', 'Performance', 'Usability'],
    });
    const result = InvestigationAnswerSchema.parse(a);
    expect(result.rankings).toEqual(['Security', 'Performance', 'Usability']);
  });

  it('should accept an answer with all optional fields', () => {
    const a = validAnswer({
      selectedOptions: ['A'],
      scaleValue: 5,
      rankings: ['X', 'Y'],
    });
    const result = InvestigationAnswerSchema.parse(a);
    expect(result.selectedOptions).toEqual(['A']);
    expect(result.scaleValue).toBe(5);
    expect(result.rankings).toEqual(['X', 'Y']);
  });

  it('should reject missing questionId', () => {
    const result = InvestigationAnswerSchema.safeParse({
      answer: 'Some answer',
      answeredAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty questionId', () => {
    const result = InvestigationAnswerSchema.safeParse(validAnswer({ questionId: '' }));
    expect(result.success).toBe(false);
  });

  it('should reject missing answer text', () => {
    const result = InvestigationAnswerSchema.safeParse({
      questionId: 'IQ-001',
      answeredAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });

  it('should reject missing answeredAt', () => {
    const result = InvestigationAnswerSchema.safeParse({
      questionId: 'IQ-001',
      answer: 'Some answer',
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// InvestigationRoundSchema
// =============================================================================

describe('InvestigationRoundSchema', () => {
  it('should accept a valid round with questions and answers', () => {
    const r = validRound();
    const result = InvestigationRoundSchema.parse(r);
    expect(result.roundNumber).toBe(1);
    expect(result.phase).toBe('project_vision');
    expect(result.questions).toHaveLength(1);
    expect(result.answers).toHaveLength(1);
    expect(result.confidenceBefore).toBe(0.3);
  });

  it('should accept a completed round with confidenceAfter', () => {
    const r = validRound({
      completedAt: new Date().toISOString(),
      confidenceAfter: 0.65,
    });
    const result = InvestigationRoundSchema.parse(r);
    expect(result.completedAt).toBeDefined();
    expect(result.confidenceAfter).toBe(0.65);
  });

  it('should accept a round with multiple questions and answers', () => {
    const q1 = validQuestion({ id: 'IQ-001' });
    const q2 = validQuestion({ id: 'IQ-002', question: 'Who are the target users?' });
    const a1 = validAnswer({ questionId: 'IQ-001' });
    const a2 = validAnswer({ questionId: 'IQ-002', answer: 'Developers' });

    const r = validRound({ questions: [q1, q2], answers: [a1, a2] });
    const result = InvestigationRoundSchema.parse(r);
    expect(result.questions).toHaveLength(2);
    expect(result.answers).toHaveLength(2);
  });

  it('should accept a round with empty answers (not yet answered)', () => {
    const r = validRound({ answers: [] });
    const result = InvestigationRoundSchema.parse(r);
    expect(result.answers).toHaveLength(0);
  });

  it('should reject roundNumber less than 1', () => {
    const result = InvestigationRoundSchema.safeParse(validRound({ roundNumber: 0 }));
    expect(result.success).toBe(false);
  });

  it('should reject confidenceBefore outside 0-1 range', () => {
    const result = InvestigationRoundSchema.safeParse(validRound({ confidenceBefore: 1.5 }));
    expect(result.success).toBe(false);
  });

  it('should reject confidenceAfter outside 0-1 range', () => {
    const result = InvestigationRoundSchema.safeParse(validRound({ confidenceAfter: -0.1 }));
    expect(result.success).toBe(false);
  });

  it('should reject missing startedAt', () => {
    const { startedAt, ...rest } = validRound();
    const result = InvestigationRoundSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// InvestigationStateSchema
// =============================================================================

describe('InvestigationStateSchema', () => {
  function validState(depth: InvestigationDepth): InvestigationState {
    const phaseMap: Record<InvestigationDepth, string[]> = {
      thorough: [
        'project_vision',
        'user_analysis',
        'functional_deep_dive',
        'nonfunctional_analysis',
        'constraints_risks',
        'validation_synthesis',
      ],
      standard: ['core_discovery', 'requirements_analysis', 'constraints_validation'],
      quick: ['basic_clarification'],
    };
    const maxRoundsMap: Record<InvestigationDepth, number> = {
      thorough: 6,
      standard: 3,
      quick: 1,
    };

    return {
      depth,
      currentRound: 0,
      maxRounds: maxRoundsMap[depth],
      phases: phaseMap[depth] as InvestigationState['phases'],
      rounds: [],
      status: 'pending',
    };
  }

  it('should accept a valid thorough state', () => {
    const state = validState('thorough');
    const result = InvestigationStateSchema.parse(state);
    expect(result.depth).toBe('thorough');
    expect(result.phases).toHaveLength(6);
    expect(result.maxRounds).toBe(6);
    expect(result.status).toBe('pending');
  });

  it('should accept a valid standard state', () => {
    const state = validState('standard');
    const result = InvestigationStateSchema.parse(state);
    expect(result.depth).toBe('standard');
    expect(result.phases).toHaveLength(3);
  });

  it('should accept a valid quick state', () => {
    const state = validState('quick');
    const result = InvestigationStateSchema.parse(state);
    expect(result.depth).toBe('quick');
    expect(result.phases).toHaveLength(1);
  });

  it('should accept a state with startedAt and completedAt', () => {
    const state = {
      ...validState('standard'),
      status: 'completed' as const,
      startedAt: '2026-03-26T10:00:00Z',
      completedAt: '2026-03-26T10:15:00Z',
    };
    const result = InvestigationStateSchema.parse(state);
    expect(result.startedAt).toBe('2026-03-26T10:00:00Z');
    expect(result.completedAt).toBe('2026-03-26T10:15:00Z');
  });

  it('should accept a state with in_progress status and rounds', () => {
    const state: InvestigationState = {
      ...validState('standard'),
      currentRound: 1,
      status: 'in_progress',
      startedAt: '2026-03-26T10:00:00Z',
      rounds: [
        validRound({
          phase: 'core_discovery',
          confidenceBefore: 0.2,
          confidenceAfter: 0.5,
          completedAt: new Date().toISOString(),
        }),
      ],
    };
    const result = InvestigationStateSchema.parse(state);
    expect(result.currentRound).toBe(1);
    expect(result.rounds).toHaveLength(1);
    expect(result.status).toBe('in_progress');
  });

  it('should reject invalid depth in state', () => {
    const result = InvestigationStateSchema.safeParse({
      ...validState('standard'),
      depth: 'extreme',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid status', () => {
    const result = InvestigationStateSchema.safeParse({
      ...validState('standard'),
      status: 'cancelled',
    });
    expect(result.success).toBe(false);
  });

  it('should reject negative currentRound', () => {
    const result = InvestigationStateSchema.safeParse({
      ...validState('standard'),
      currentRound: -1,
    });
    expect(result.success).toBe(false);
  });

  it('should reject maxRounds less than 1', () => {
    const result = InvestigationStateSchema.safeParse({
      ...validState('standard'),
      maxRounds: 0,
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// InvestigationEngineConfigSchema
// =============================================================================

describe('InvestigationEngineConfigSchema', () => {
  it('should apply defaults when given an empty object', () => {
    const result = InvestigationEngineConfigSchema.parse({});
    expect(result.depth).toBe('standard');
    expect(result.maxQuestionsPerRound).toBe(5);
    expect(result.confidenceTarget).toBe(0.85);
    expect(result.earlyExitOnHighConfidence).toBe(true);
    expect(result.enableLLMQuestions).toBe(true);
  });

  it('should accept custom values', () => {
    const config = {
      depth: 'thorough' as const,
      maxQuestionsPerRound: 8,
      confidenceTarget: 0.95,
      earlyExitOnHighConfidence: false,
      enableLLMQuestions: false,
    };
    const result = InvestigationEngineConfigSchema.parse(config);
    expect(result.depth).toBe('thorough');
    expect(result.maxQuestionsPerRound).toBe(8);
    expect(result.confidenceTarget).toBe(0.95);
    expect(result.earlyExitOnHighConfidence).toBe(false);
    expect(result.enableLLMQuestions).toBe(false);
  });

  it('should accept partial overrides with defaults for the rest', () => {
    const result = InvestigationEngineConfigSchema.parse({ depth: 'quick' });
    expect(result.depth).toBe('quick');
    expect(result.maxQuestionsPerRound).toBe(5); // default
    expect(result.confidenceTarget).toBe(0.85); // default
  });

  it('should reject maxQuestionsPerRound less than 1', () => {
    const result = InvestigationEngineConfigSchema.safeParse({ maxQuestionsPerRound: 0 });
    expect(result.success).toBe(false);
  });

  it('should reject maxQuestionsPerRound greater than 10', () => {
    const result = InvestigationEngineConfigSchema.safeParse({ maxQuestionsPerRound: 11 });
    expect(result.success).toBe(false);
  });

  it('should reject confidenceTarget less than 0', () => {
    const result = InvestigationEngineConfigSchema.safeParse({ confidenceTarget: -0.1 });
    expect(result.success).toBe(false);
  });

  it('should reject confidenceTarget greater than 1', () => {
    const result = InvestigationEngineConfigSchema.safeParse({ confidenceTarget: 1.5 });
    expect(result.success).toBe(false);
  });

  it('should reject invalid depth', () => {
    const result = InvestigationEngineConfigSchema.safeParse({ depth: 'extreme' });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// InvestigationMetadataSchema
// =============================================================================

describe('InvestigationMetadataSchema', () => {
  it('should accept valid metadata', () => {
    const metadata = {
      depth: 'standard' as const,
      roundsCompleted: 3,
      totalQuestions: 15,
      totalAnswers: 14,
      confidenceGain: 0.45,
      phasesCompleted: [
        'core_discovery',
        'requirements_analysis',
        'constraints_validation',
      ] as const,
    };
    const result = InvestigationMetadataSchema.parse(metadata);
    expect(result.depth).toBe('standard');
    expect(result.roundsCompleted).toBe(3);
    expect(result.totalQuestions).toBe(15);
    expect(result.totalAnswers).toBe(14);
    expect(result.confidenceGain).toBe(0.45);
    expect(result.phasesCompleted).toHaveLength(3);
  });

  it('should accept metadata with zero rounds (not started)', () => {
    const metadata = {
      depth: 'quick' as const,
      roundsCompleted: 0,
      totalQuestions: 0,
      totalAnswers: 0,
      confidenceGain: 0,
      phasesCompleted: [],
    };
    const result = InvestigationMetadataSchema.parse(metadata);
    expect(result.roundsCompleted).toBe(0);
    expect(result.phasesCompleted).toHaveLength(0);
  });

  it('should reject negative roundsCompleted', () => {
    const result = InvestigationMetadataSchema.safeParse({
      depth: 'standard',
      roundsCompleted: -1,
      totalQuestions: 0,
      totalAnswers: 0,
      confidenceGain: 0,
      phasesCompleted: [],
    });
    expect(result.success).toBe(false);
  });

  it('should reject confidenceGain greater than 1', () => {
    const result = InvestigationMetadataSchema.safeParse({
      depth: 'thorough',
      roundsCompleted: 1,
      totalQuestions: 5,
      totalAnswers: 5,
      confidenceGain: 1.2,
      phasesCompleted: ['project_vision'],
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid phase in phasesCompleted', () => {
    const result = InvestigationMetadataSchema.safeParse({
      depth: 'standard',
      roundsCompleted: 1,
      totalQuestions: 5,
      totalAnswers: 5,
      confidenceGain: 0.2,
      phasesCompleted: ['nonexistent_phase'],
    });
    expect(result.success).toBe(false);
  });
});

// =============================================================================
// getPhasesForDepth()
// =============================================================================

describe('getPhasesForDepth', () => {
  it('should return THOROUGH_PHASES for "thorough"', () => {
    const phases = getPhasesForDepth('thorough');
    expect(phases).toBe(THOROUGH_PHASES);
    expect(phases).toHaveLength(6);
    expect(phases[0].phase).toBe('project_vision');
    expect(phases[5].phase).toBe('validation_synthesis');
  });

  it('should return STANDARD_PHASES for "standard"', () => {
    const phases = getPhasesForDepth('standard');
    expect(phases).toBe(STANDARD_PHASES);
    expect(phases).toHaveLength(3);
    expect(phases[0].phase).toBe('core_discovery');
    expect(phases[2].phase).toBe('constraints_validation');
  });

  it('should return QUICK_PHASES for "quick"', () => {
    const phases = getPhasesForDepth('quick');
    expect(phases).toBe(QUICK_PHASES);
    expect(phases).toHaveLength(1);
    expect(phases[0].phase).toBe('basic_clarification');
  });

  it('should return phases in correct order', () => {
    for (const depth of ['thorough', 'standard', 'quick'] as const) {
      const phases = getPhasesForDepth(depth);
      for (let i = 0; i < phases.length; i++) {
        expect(phases[i].order).toBe(i + 1);
      }
    }
  });
});

// =============================================================================
// getMaxTotalQuestions()
// =============================================================================

describe('getMaxTotalQuestions', () => {
  it('should return 40 for "thorough"', () => {
    expect(getMaxTotalQuestions('thorough')).toBe(40);
  });

  it('should return 20 for "standard"', () => {
    expect(getMaxTotalQuestions('standard')).toBe(20);
  });

  it('should return 5 for "quick"', () => {
    expect(getMaxTotalQuestions('quick')).toBe(5);
  });
});

// =============================================================================
// isEarlyExitAllowed()
// =============================================================================

describe('isEarlyExitAllowed', () => {
  it('should return false for "thorough"', () => {
    expect(isEarlyExitAllowed('thorough')).toBe(false);
  });

  it('should return true for "standard"', () => {
    expect(isEarlyExitAllowed('standard')).toBe(true);
  });

  it('should return true for "quick"', () => {
    expect(isEarlyExitAllowed('quick')).toBe(true);
  });
});
