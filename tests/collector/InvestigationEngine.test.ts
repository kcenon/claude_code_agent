import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InvestigationEngine } from '../../src/collector/InvestigationEngine.js';
import { InvestigationTemplates } from '../../src/collector/InvestigationTemplates.js';
import { InvestigationError } from '../../src/collector/errors.js';
import type { ExtractionResult } from '../../src/collector/types.js';
import type {
  InvestigationAnswer,
  InvestigationState,
} from '../../src/collector/investigation-types.js';

vi.mock('../../src/logging/index.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

// =============================================================================
// Helpers
// =============================================================================

function createMockExtraction(overrides: Partial<ExtractionResult> = {}): ExtractionResult {
  return {
    projectName: 'TestProject',
    projectDescription: 'A test project for unit testing',
    functionalRequirements: [
      {
        id: 'FR-001',
        title: 'User login',
        description: 'Users can log in with email and password',
        priority: 'P1',
        source: 'test',
        confidence: 0.8,
        isFunctional: true,
      },
      {
        id: 'FR-002',
        title: 'User registration',
        description: 'Users can create an account',
        priority: 'P1',
        source: 'test',
        confidence: 0.7,
        isFunctional: true,
      },
      {
        id: 'FR-003',
        title: 'Password reset',
        description: 'Users can reset their password',
        priority: 'P2',
        source: 'test',
        confidence: 0.6,
        isFunctional: true,
      },
    ],
    nonFunctionalRequirements: [],
    constraints: [],
    assumptions: [],
    dependencies: [],
    clarificationQuestions: [],
    overallConfidence: 0.7,
    warnings: [],
    ...overrides,
  };
}

function createMockAnswer(
  questionId: string,
  answer: string,
  overrides: Partial<InvestigationAnswer> = {}
): InvestigationAnswer {
  return {
    questionId,
    answer,
    answeredAt: new Date().toISOString(),
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('InvestigationEngine', () => {
  let engine: InvestigationEngine;
  let templates: InvestigationTemplates;

  beforeEach(() => {
    templates = new InvestigationTemplates();
    engine = new InvestigationEngine(
      { depth: 'standard', enableLLMQuestions: false },
      null,
      templates
    );
  });

  // ===========================================================================
  // initialize()
  // ===========================================================================

  describe('initialize()', () => {
    it('should set up 6 phases for thorough depth', () => {
      const thoroughEngine = new InvestigationEngine(
        { depth: 'thorough', enableLLMQuestions: false },
        null,
        templates
      );
      const state = thoroughEngine.initialize();

      expect(state.depth).toBe('thorough');
      expect(state.phases).toHaveLength(6);
      expect(state.maxRounds).toBe(6);
      expect(state.phases).toEqual([
        'project_vision',
        'user_analysis',
        'functional_deep_dive',
        'nonfunctional_analysis',
        'constraints_risks',
        'validation_synthesis',
      ]);
      expect(state.status).toBe('pending');
      expect(state.currentRound).toBe(0);
      expect(state.rounds).toEqual([]);
      expect(state.startedAt).toBeDefined();
    });

    it('should set up 3 phases for standard depth', () => {
      const state = engine.initialize();

      expect(state.depth).toBe('standard');
      expect(state.phases).toHaveLength(3);
      expect(state.maxRounds).toBe(3);
      expect(state.phases).toEqual([
        'core_discovery',
        'requirements_analysis',
        'constraints_validation',
      ]);
      expect(state.status).toBe('pending');
    });

    it('should set up 1 phase for quick depth', () => {
      const quickEngine = new InvestigationEngine(
        { depth: 'quick', enableLLMQuestions: false },
        null,
        templates
      );
      const state = quickEngine.initialize();

      expect(state.depth).toBe('quick');
      expect(state.phases).toHaveLength(1);
      expect(state.maxRounds).toBe(1);
      expect(state.phases).toEqual(['basic_clarification']);
      expect(state.status).toBe('pending');
    });

    it('should accept an explicit depth override parameter', () => {
      const state = engine.initialize('thorough');

      expect(state.depth).toBe('thorough');
      expect(state.phases).toHaveLength(6);
    });

    it('should reset counters on re-initialization', () => {
      engine.initialize();
      const state = engine.initialize();

      expect(state.currentRound).toBe(0);
      expect(state.rounds).toEqual([]);
    });
  });

  // ===========================================================================
  // getState()
  // ===========================================================================

  describe('getState()', () => {
    it('should return the current state after initialize', () => {
      engine.initialize();
      const state = engine.getState();

      expect(state.depth).toBe('standard');
      expect(state.status).toBe('pending');
      expect(state.currentRound).toBe(0);
      expect(state.phases).toHaveLength(3);
    });

    it('should return default state before initialize', () => {
      const state = engine.getState();

      expect(state.status).toBe('pending');
      expect(state.currentRound).toBe(0);
      expect(state.phases).toEqual([]);
    });
  });

  // ===========================================================================
  // isComplete()
  // ===========================================================================

  describe('isComplete()', () => {
    it('should return false after initialize', () => {
      engine.initialize();

      expect(engine.isComplete()).toBe(false);
    });

    it('should return true after skipRemaining', () => {
      engine.initialize();
      engine.skipRemaining();

      expect(engine.isComplete()).toBe(true);
    });

    it('should return false when status is in_progress', async () => {
      engine.initialize();
      const extraction = createMockExtraction();
      await engine.generateNextRound(extraction, []);

      expect(engine.isComplete()).toBe(false);
    });
  });

  // ===========================================================================
  // generateNextRound()
  // ===========================================================================

  describe('generateNextRound()', () => {
    it('should generate questions for the first phase using templates', async () => {
      engine.initialize();
      const extraction = createMockExtraction();

      const round = await engine.generateNextRound(extraction, []);

      expect(round.roundNumber).toBe(1);
      expect(round.phase).toBe('core_discovery');
      expect(round.questions.length).toBeGreaterThan(0);
      expect(round.answers).toEqual([]);
      expect(round.startedAt).toBeDefined();
      expect(round.confidenceBefore).toBe(extraction.overallConfidence);
    });

    it('should assign template-based question IDs (IQ-TPL-XXX)', async () => {
      engine.initialize();
      const extraction = createMockExtraction();

      const round = await engine.generateNextRound(extraction, []);

      for (const q of round.questions) {
        expect(q.id).toMatch(/^IQ-TPL-\d{3}$/);
      }
    });

    it('should update state to in_progress after generating a round', async () => {
      engine.initialize();
      const extraction = createMockExtraction();

      await engine.generateNextRound(extraction, []);
      const state = engine.getState();

      expect(state.status).toBe('in_progress');
      expect(state.currentRound).toBe(1);
      expect(state.rounds).toHaveLength(1);
    });

    it('should throw InvestigationError when investigation is already complete', async () => {
      engine.initialize();
      engine.skipRemaining();

      const extraction = createMockExtraction();

      await expect(engine.generateNextRound(extraction, [])).rejects.toThrow(InvestigationError);
    });

    it('should generate subsequent rounds for different phases', async () => {
      engine.initialize();
      const extraction = createMockExtraction();

      const round1 = await engine.generateNextRound(extraction, []);
      expect(round1.phase).toBe('core_discovery');

      const round2 = await engine.generateNextRound(extraction, []);
      expect(round2.phase).toBe('requirements_analysis');
      expect(round2.roundNumber).toBe(2);
    });

    it('should throw when all phases are exhausted', async () => {
      engine.initialize();
      const extraction = createMockExtraction();

      // Exhaust all 3 standard phases
      await engine.generateNextRound(extraction, []);
      await engine.generateNextRound(extraction, []);
      await engine.generateNextRound(extraction, []);

      await expect(engine.generateNextRound(extraction, [])).rejects.toThrow(InvestigationError);
    });

    it('should include questions with correct phase property', async () => {
      engine.initialize();
      const extraction = createMockExtraction();

      const round = await engine.generateNextRound(extraction, []);

      for (const q of round.questions) {
        expect(q.phase).toBe('core_discovery');
        expect(q.round).toBe(1);
      }
    });
  });

  // ===========================================================================
  // submitRoundAnswers()
  // ===========================================================================

  describe('submitRoundAnswers()', () => {
    it('should submit answers and update the round', async () => {
      engine.initialize();
      const extraction = createMockExtraction();
      const round = await engine.generateNextRound(extraction, []);

      const answers = round.questions.map((q) => createMockAnswer(q.id, 'Test answer'));

      const state = engine.submitRoundAnswers(round.roundNumber, answers);

      expect(state.rounds[0]!.answers).toHaveLength(answers.length);
      expect(state.rounds[0]!.completedAt).toBeDefined();
    });

    it('should throw for a non-existent round number', () => {
      engine.initialize();

      expect(() => engine.submitRoundAnswers(999, [])).toThrow(InvestigationError);
    });

    it('should set status to completed when all phases are done', async () => {
      engine.initialize();
      const extraction = createMockExtraction();

      // Generate and submit all 3 standard rounds
      for (let i = 0; i < 3; i++) {
        const round = await engine.generateNextRound(extraction, []);
        const answers = round.questions.map((q) => createMockAnswer(q.id, 'Test answer'));
        engine.submitRoundAnswers(round.roundNumber, answers);
      }

      const state = engine.getState();
      expect(state.status).toBe('completed');
      expect(state.completedAt).toBeDefined();
    });

    it('should keep status as in_progress when phases remain', async () => {
      engine.initialize();
      const extraction = createMockExtraction();

      const round = await engine.generateNextRound(extraction, []);
      const answers = round.questions.map((q) => createMockAnswer(q.id, 'Test answer'));
      const state = engine.submitRoundAnswers(round.roundNumber, answers);

      expect(state.status).toBe('in_progress');
    });
  });

  // ===========================================================================
  // skipRemaining()
  // ===========================================================================

  describe('skipRemaining()', () => {
    it('should set status to skipped', () => {
      engine.initialize();
      const state = engine.skipRemaining();

      expect(state.status).toBe('skipped');
      expect(state.completedAt).toBeDefined();
    });

    it('should be reflected in isComplete', () => {
      engine.initialize();
      engine.skipRemaining();

      expect(engine.isComplete()).toBe(true);
    });

    it('should preserve existing rounds', async () => {
      engine.initialize();
      const extraction = createMockExtraction();
      await engine.generateNextRound(extraction, []);

      const state = engine.skipRemaining();

      expect(state.rounds).toHaveLength(1);
      expect(state.status).toBe('skipped');
    });
  });

  // ===========================================================================
  // shouldEarlyExit()
  // ===========================================================================

  describe('shouldEarlyExit()', () => {
    it('should return true when confidence meets target for standard depth', () => {
      engine.initialize();

      // Default confidenceTarget is 0.85
      expect(engine.shouldEarlyExit(0.9)).toBe(true);
      expect(engine.shouldEarlyExit(0.85)).toBe(true);
    });

    it('should return false when confidence is below target', () => {
      engine.initialize();

      expect(engine.shouldEarlyExit(0.5)).toBe(false);
      expect(engine.shouldEarlyExit(0.84)).toBe(false);
    });

    it('should return false for thorough depth even with high confidence', () => {
      const thoroughEngine = new InvestigationEngine(
        { depth: 'thorough', enableLLMQuestions: false },
        null,
        templates
      );
      thoroughEngine.initialize();

      // thorough depth does not allow early exit
      expect(thoroughEngine.shouldEarlyExit(0.99)).toBe(false);
    });

    it('should return true for quick depth when confidence is met', () => {
      const quickEngine = new InvestigationEngine(
        { depth: 'quick', enableLLMQuestions: false },
        null,
        templates
      );
      quickEngine.initialize();

      expect(quickEngine.shouldEarlyExit(0.9)).toBe(true);
    });

    it('should return false when earlyExitOnHighConfidence is disabled', () => {
      const noExitEngine = new InvestigationEngine(
        {
          depth: 'standard',
          enableLLMQuestions: false,
          earlyExitOnHighConfidence: false,
        },
        null,
        templates
      );
      noExitEngine.initialize();

      expect(noExitEngine.shouldEarlyExit(1.0)).toBe(false);
    });
  });

  // ===========================================================================
  // enrichExtraction()
  // ===========================================================================

  describe('enrichExtraction()', () => {
    /**
     * Helper: build a minimal InvestigationState with one round containing
     * a single question and its corresponding answer.
     */
    function buildStateWithAnswer(
      question: {
        id: string;
        format: string;
        question: string;
        category: string;
        relatedTo?: string;
      },
      answer: InvestigationAnswer
    ): InvestigationState {
      return {
        depth: 'standard',
        currentRound: 1,
        maxRounds: 3,
        phases: ['core_discovery', 'requirements_analysis', 'constraints_validation'],
        rounds: [
          {
            roundNumber: 1,
            phase: 'core_discovery',
            questions: [
              {
                id: question.id,
                phase: 'core_discovery',
                round: 1,
                format: question.format as any,
                question: question.question,
                context: 'Test context',
                required: true,
                category: question.category as any,
                relatedTo: question.relatedTo,
              },
            ],
            answers: [answer],
            startedAt: new Date().toISOString(),
            confidenceBefore: 0.7,
          },
        ],
        status: 'in_progress',
      };
    }

    it('should create NFRs from multi_select security measures', () => {
      const extraction = createMockExtraction();
      const state = buildStateWithAnswer(
        {
          id: 'IQ-001',
          format: 'multi_select',
          question: 'Which security measures are required?',
          category: 'quality',
        },
        createMockAnswer('IQ-001', 'Authentication, Encryption', {
          selectedOptions: ['Authentication (login)', 'Data encryption at rest'],
        })
      );

      const enriched = engine.enrichExtraction(extraction, state);

      expect(enriched.nonFunctionalRequirements.length).toBe(2);
      expect(enriched.nonFunctionalRequirements[0]!.id).toMatch(/^NFR-INV-/);
      expect(enriched.nonFunctionalRequirements[0]!.title).toBe('Authentication (login)');
      expect(enriched.nonFunctionalRequirements[0]!.description).toContain('Security requirement');
      expect(enriched.nonFunctionalRequirements[0]!.nfrCategory).toBe('security');
      expect(enriched.nonFunctionalRequirements[0]!.priority).toBe('P1');
      expect(enriched.nonFunctionalRequirements[1]!.title).toBe('Data encryption at rest');
    });

    it('should create a constraint from yes_no regulatory answer', () => {
      const extraction = createMockExtraction();
      const state = buildStateWithAnswer(
        {
          id: 'IQ-002',
          format: 'yes_no',
          question: 'Are there regulatory or compliance requirements?',
          category: 'constraint',
        },
        createMockAnswer('IQ-002', 'yes')
      );

      const enriched = engine.enrichExtraction(extraction, state);

      expect(enriched.constraints.length).toBe(1);
      expect(enriched.constraints[0]!.id).toMatch(/^CON-INV-/);
      expect(enriched.constraints[0]!.description).toContain('Regulatory');
      expect(enriched.constraints[0]!.type).toBe('regulatory');
    });

    it('should not create a constraint from yes_no regulatory answer when answer is no', () => {
      const extraction = createMockExtraction();
      const state = buildStateWithAnswer(
        {
          id: 'IQ-002',
          format: 'yes_no',
          question: 'Are there regulatory or compliance requirements?',
          category: 'constraint',
        },
        createMockAnswer('IQ-002', 'no')
      );

      const enriched = engine.enrichExtraction(extraction, state);

      expect(enriched.constraints.length).toBe(0);
    });

    it('should update FR priorities from priority_ranking answer', () => {
      const extraction = createMockExtraction();
      const state = buildStateWithAnswer(
        {
          id: 'IQ-003',
          format: 'priority_ranking',
          question: 'Please rank the functional requirements:',
          category: 'priority',
        },
        createMockAnswer('IQ-003', 'FR-003,FR-001,FR-002', {
          rankings: ['FR-003: Password reset', 'FR-001: User login', 'FR-002: User registration'],
        })
      );

      const enriched = engine.enrichExtraction(extraction, state);

      // FR-003 is first (position 0/3 = 0.0 < 0.25) → P0
      const fr3 = enriched.functionalRequirements.find((r) => r.id === 'FR-003');
      expect(fr3!.priority).toBe('P0');

      // FR-001 is second (position 1/3 ≈ 0.33 < 0.5) → P1
      const fr1 = enriched.functionalRequirements.find((r) => r.id === 'FR-001');
      expect(fr1!.priority).toBe('P1');

      // FR-002 is third (position 2/3 ≈ 0.67 < 0.75) → P2
      const fr2 = enriched.functionalRequirements.find((r) => r.id === 'FR-002');
      expect(fr2!.priority).toBe('P2');
    });

    it('should boost FR confidence from confirmation agree answer', () => {
      const extraction = createMockExtraction();
      const originalConfidences = extraction.functionalRequirements.map((r) => r.confidence);

      const state = buildStateWithAnswer(
        {
          id: 'IQ-004',
          format: 'confirmation',
          question: 'Is this interpretation accurate?',
          category: 'requirement',
        },
        createMockAnswer('IQ-004', 'agree')
      );

      const enriched = engine.enrichExtraction(extraction, state);

      for (let i = 0; i < enriched.functionalRequirements.length; i++) {
        const expected = Math.min(1.0, originalConfidences[i]! + 0.15);
        expect(enriched.functionalRequirements[i]!.confidence).toBeCloseTo(expected, 5);
      }
    });

    it('should create availability NFR from scale_rating answer', () => {
      const extraction = createMockExtraction();
      const state = buildStateWithAnswer(
        {
          id: 'IQ-005',
          format: 'scale_rating',
          question: 'What is the required availability level?',
          category: 'quality',
        },
        createMockAnswer('IQ-005', '4', {
          scaleValue: 4,
        })
      );

      const enriched = engine.enrichExtraction(extraction, state);

      expect(enriched.nonFunctionalRequirements.length).toBe(1);
      const nfr = enriched.nonFunctionalRequirements[0]!;
      expect(nfr.id).toMatch(/^NFR-INV-/);
      expect(nfr.title).toBe('Availability Requirement');
      expect(nfr.description).toContain('99.95%');
      expect(nfr.nfrCategory).toBe('reliability');
      expect(nfr.priority).toBe('P0'); // value >= 4 → P0
    });

    it('should assign P1 priority for lower availability scale values', () => {
      const extraction = createMockExtraction();
      const state = buildStateWithAnswer(
        {
          id: 'IQ-005',
          format: 'scale_rating',
          question: 'What is the required availability level?',
          category: 'quality',
        },
        createMockAnswer('IQ-005', '3', {
          scaleValue: 3,
        })
      );

      const enriched = engine.enrichExtraction(extraction, state);

      const nfr = enriched.nonFunctionalRequirements[0]!;
      expect(nfr.priority).toBe('P1'); // value < 4 → P1
      expect(nfr.description).toContain('99.9%');
    });

    it('should recalculate overall confidence after enrichment', () => {
      const extraction = createMockExtraction({
        nonFunctionalRequirements: [],
        overallConfidence: 0.5,
      });
      const state = buildStateWithAnswer(
        {
          id: 'IQ-004',
          format: 'confirmation',
          question: 'Is this interpretation accurate?',
          category: 'requirement',
        },
        createMockAnswer('IQ-004', 'agree')
      );

      const enriched = engine.enrichExtraction(extraction, state);

      // Confidence should change from the original
      expect(enriched.overallConfidence).not.toBe(0.5);
      expect(enriched.overallConfidence).toBeGreaterThan(0);
      expect(enriched.overallConfidence).toBeLessThanOrEqual(1.0);
    });

    it('should handle state with no answers gracefully', () => {
      const extraction = createMockExtraction();
      const state: InvestigationState = {
        depth: 'standard',
        currentRound: 1,
        maxRounds: 3,
        phases: ['core_discovery', 'requirements_analysis', 'constraints_validation'],
        rounds: [
          {
            roundNumber: 1,
            phase: 'core_discovery',
            questions: [],
            answers: [],
            startedAt: new Date().toISOString(),
            confidenceBefore: 0.7,
          },
        ],
        status: 'in_progress',
      };

      const enriched = engine.enrichExtraction(extraction, state);

      // Should return a result with recalculated confidence but no structural changes
      expect(enriched.functionalRequirements).toHaveLength(3);
      expect(enriched.nonFunctionalRequirements).toHaveLength(0);
      expect(enriched.constraints).toHaveLength(0);
    });

    it('should filter out "No constraints" from multi_select security options', () => {
      const extraction = createMockExtraction();
      const state = buildStateWithAnswer(
        {
          id: 'IQ-010',
          format: 'multi_select',
          question: 'Which security measures are required?',
          category: 'quality',
        },
        createMockAnswer('IQ-010', 'No constraints', {
          selectedOptions: ['No constraints'],
        })
      );

      const enriched = engine.enrichExtraction(extraction, state);

      // "No constraints" should be filtered out, resulting in 0 NFRs
      expect(enriched.nonFunctionalRequirements.length).toBe(0);
    });
  });
});
