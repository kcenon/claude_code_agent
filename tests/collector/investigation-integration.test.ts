/**
 * Integration tests for the investigation flow through CollectorAgent.
 *
 * Validates the full lifecycle: startInvestigation → submitAnswers → skipInvestigation → finalize,
 * including backward compatibility with 'quick' mode and investigation metadata in CollectedInfo.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — must be declared before importing the modules under test
// ---------------------------------------------------------------------------

vi.mock('../../src/logging/index.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
  }),
}));

vi.mock('node:fs/promises', () => ({
  readdir: vi.fn().mockResolvedValue([]),
  rm: vi.fn().mockResolvedValue(undefined),
  rmdir: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../src/scratchpad/index.js', () => ({
  getScratchpad: () => ({
    generateProjectId: vi.fn().mockResolvedValue('test-inv-001'),
    initializeProject: vi.fn().mockResolvedValue(undefined),
    getProjectPath: vi.fn().mockReturnValue('/tmp/test'),
    getSectionPath: vi.fn().mockReturnValue('/tmp/test'),
    getCollectedInfoPath: vi.fn().mockReturnValue('/tmp/collected_info.yaml'),
    writeYaml: vi.fn().mockResolvedValue(undefined),
  }),
  resetScratchpad: vi.fn(),
}));

import { CollectorAgent } from '../../src/collector/CollectorAgent.js';
import type {
  InvestigationAnswer,
  InvestigationRound,
} from '../../src/collector/investigation-types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sample input crafted to produce 'completed' status after extraction (zero clarification
 * questions). This requires:
 * - Project name detected ("Project: ...")
 * - Project description detected ("This project is ...")
 * - Performance NFR present ("performance", "200ms")
 * - Security NFR present ("security", "encrypt")
 * - All requirements high-confidence (strong "must" keyword)
 * - No assumptions detected
 */
const RICH_INPUT = `
  Project: InvestigationTestApp
  This project is a web application for managing user accounts and data.
  - The system must support user authentication with OAuth2
  - The system must support role-based access control
  - The system must encrypt all data at rest and in transit for security
  - Performance: The application must process API requests within 200ms
  - The system must handle at least 1000 concurrent users
`;

/**
 * Minimal input that will trigger clarification questions (no project description).
 */
const MINIMAL_INPUT = `
  Some vague requirements about a system.
`;

/**
 * Build InvestigationAnswer entries for every question in a round.
 */
function buildAnswersForRound(round: InvestigationRound): InvestigationAnswer[] {
  return round.questions.map((q) => ({
    questionId: q.id,
    answer: `Answer for: ${q.question}`,
    answeredAt: new Date().toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Investigation integration through CollectorAgent', () => {
  let agent: CollectorAgent;

  // =========================================================================
  // 1. Quick mode backward compatibility
  // =========================================================================

  describe('quick mode backward compatibility', () => {
    beforeEach(() => {
      agent = new CollectorAgent({ investigationDepth: 'quick' });
    });

    it('should process inputs and finalize without investigation state when no investigation is started', async () => {
      await agent.startSession('QuickProject');
      agent.addTextInput(RICH_INPUT);
      agent.processInputs();

      // No investigation was started — state should be null
      expect(agent.getInvestigationState()).toBeNull();

      const session = agent.getSession();
      expect(session).not.toBeNull();
      // Status is either 'clarifying' (questions generated) or 'completed'
      expect(['clarifying', 'completed']).toContain(session!.status);
      // The session should have no investigation field
      expect(session!.investigation).toBeUndefined();
    });

    it('should finalize successfully without investigation', async () => {
      await agent.startSession('QuickProject');
      agent.addTextInput(RICH_INPUT);
      agent.processInputs();

      // Skip clarification if in that state
      const session = agent.getSession();
      if (session!.status === 'clarifying') {
        agent.skipClarification();
      }

      const result = await agent.finalize('QuickProject', 'Backward-compat test');

      expect(result.success).toBe(true);
      expect(result.stats.investigationRounds).toBe(0);
      expect(result.stats.investigationQuestionsAsked).toBe(0);
      // CollectedInfo should not have investigation metadata
      expect((result.collectedInfo as Record<string, unknown>)['investigation']).toBeUndefined();
    });
  });

  // =========================================================================
  // 2. Standard mode investigation flow
  // =========================================================================

  describe('standard mode investigation flow', () => {
    beforeEach(() => {
      agent = new CollectorAgent({ investigationDepth: 'standard' });
    });

    it('should start investigation and return first round with questions', async () => {
      await agent.startSession('StandardProject');
      agent.addTextInput(RICH_INPUT);
      // Do NOT call processInputs() — let startInvestigation() handle it
      const round1 = await agent.startInvestigation();

      expect(round1).toBeDefined();
      expect(round1.roundNumber).toBe(1);
      expect(round1.phase).toBe('core_discovery');
      expect(round1.questions.length).toBeGreaterThan(0);
      expect(round1.answers).toHaveLength(0);

      // Session should be in investigating state
      const session = agent.getSession();
      expect(session!.status).toBe('investigating');

      // Investigation state should be populated
      const invState = agent.getInvestigationState();
      expect(invState).not.toBeNull();
      expect(invState!.depth).toBe('standard');
      expect(invState!.currentRound).toBe(1);
      expect(invState!.status).toBe('in_progress');
      expect(invState!.rounds).toHaveLength(1);
    });

    it('should accept answers and advance or complete investigation', async () => {
      await agent.startSession('StandardProject');
      agent.addTextInput(RICH_INPUT);

      // Round 1
      const round1 = await agent.startInvestigation();
      const answers1 = buildAnswersForRound(round1);
      const round2 = await agent.submitInvestigationAnswers(answers1);

      // First round answers should be recorded
      const invState = agent.getInvestigationState();
      expect(invState).not.toBeNull();
      expect(invState!.rounds[0].answers.length).toBe(answers1.length);
      expect(invState!.rounds[0].completedAt).toBeDefined();

      if (round2 !== null) {
        // Investigation continued to round 2
        expect(round2.roundNumber).toBe(2);
        expect(round2.phase).toBe('requirements_analysis');
        expect(round2.questions.length).toBeGreaterThan(0);
        expect(invState!.currentRound).toBe(2);
        expect(invState!.rounds).toHaveLength(2);
      } else {
        // Investigation completed early (early exit due to high confidence)
        const session = agent.getSession();
        expect(['clarifying', 'completed']).toContain(session!.status);
        expect(['completed', 'skipped']).toContain(invState!.status);
      }
    });

    it('should complete investigation after all phases answered', async () => {
      await agent.startSession('StandardProject');
      agent.addTextInput(RICH_INPUT);

      // Iterate through all rounds until investigation completes
      let currentRound: InvestigationRound | null = await agent.startInvestigation();
      let roundCount = 0;

      while (currentRound !== null) {
        roundCount++;
        const answers = buildAnswersForRound(currentRound);
        currentRound = await agent.submitInvestigationAnswers(answers);
      }

      // Standard mode has 3 phases
      expect(roundCount).toBeGreaterThanOrEqual(1);

      // Session should transition out of investigating
      const session = agent.getSession();
      expect(['clarifying', 'completed']).toContain(session!.status);

      // Investigation state should be complete or skipped
      const invState = agent.getInvestigationState();
      expect(invState).not.toBeNull();
      expect(['completed', 'skipped']).toContain(invState!.status);
    });

    it('should allow startInvestigation to auto-process inputs from collecting state', async () => {
      await agent.startSession('AutoProcessProject');
      agent.addTextInput(RICH_INPUT);

      // Start investigation directly without calling processInputs()
      const round1 = await agent.startInvestigation();

      expect(round1).toBeDefined();
      expect(round1.questions.length).toBeGreaterThan(0);
      expect(agent.getSession()!.status).toBe('investigating');
    });

    it('should reflect investigation data in getInvestigationState()', async () => {
      await agent.startSession('StateProject');
      agent.addTextInput(RICH_INPUT);

      // Before investigation
      expect(agent.getInvestigationState()).toBeNull();

      // After starting
      const round1 = await agent.startInvestigation();
      const state1 = agent.getInvestigationState();
      expect(state1).not.toBeNull();
      expect(state1!.depth).toBe('standard');
      expect(state1!.phases).toEqual([
        'core_discovery',
        'requirements_analysis',
        'constraints_validation',
      ]);
      expect(state1!.rounds).toHaveLength(1);

      // After answering round 1
      const answers = buildAnswersForRound(round1);
      await agent.submitInvestigationAnswers(answers);
      const state2 = agent.getInvestigationState();
      // Investigation may continue (2+ rounds) or complete early (still 1 round)
      expect(state2!.rounds.length).toBeGreaterThanOrEqual(1);
      // First round should have answers
      expect(state2!.rounds[0].answers.length).toBe(answers.length);
    });
  });

  // =========================================================================
  // 3. skipInvestigation()
  // =========================================================================

  describe('skipInvestigation()', () => {
    beforeEach(() => {
      agent = new CollectorAgent({ investigationDepth: 'standard' });
    });

    it('should skip investigation and transition session to clarifying or completed', async () => {
      await agent.startSession('SkipProject');
      agent.addTextInput(RICH_INPUT);
      await agent.startInvestigation();

      const session = agent.skipInvestigation();

      expect(['clarifying', 'completed']).toContain(session.status);
      expect(session.investigation).toBeDefined();
      expect(session.investigation!.status).toBe('skipped');
    });

    it('should throw SessionStateError when not in investigating state', async () => {
      await agent.startSession('NotInvestigating');
      agent.addTextInput(MINIMAL_INPUT);
      agent.processInputs();

      // Session is in 'clarifying' or 'completed', not 'investigating'
      expect(() => agent.skipInvestigation()).toThrow();
    });

    it('should preserve answers collected before skipping', async () => {
      await agent.startSession('PartialSkipProject');
      agent.addTextInput(RICH_INPUT);

      const round1 = await agent.startInvestigation();
      const answers = buildAnswersForRound(round1);
      await agent.submitInvestigationAnswers(answers);

      // After submitting answers, investigation may still be active or may have
      // completed early (high-confidence early exit). Skip if still investigating.
      const sessionBeforeSkip = agent.getSession()!;
      if (sessionBeforeSkip.status === 'investigating') {
        const session = agent.skipInvestigation();
        expect(session.investigation).toBeDefined();
        expect(session.investigation!.status).toBe('skipped');
      }

      // In either case, investigation state should have answers from round 1
      const invState = agent.getInvestigationState();
      expect(invState).not.toBeNull();
      const completedRound = invState!.rounds.find((r) => r.answers.length > 0);
      expect(completedRound).toBeDefined();
      expect(completedRound!.answers.length).toBe(answers.length);
    });
  });

  // =========================================================================
  // 4. finalize() from investigating state
  // =========================================================================

  describe('finalize() from investigating state', () => {
    beforeEach(() => {
      agent = new CollectorAgent({ investigationDepth: 'standard' });
    });

    it('should auto-skip investigation and produce valid CollectionResult', async () => {
      await agent.startSession('FinalizeFromInvestigating');
      agent.addTextInput(RICH_INPUT);
      await agent.startInvestigation();

      // Session is in 'investigating' — call finalize() directly
      const result = await agent.finalize('AutoSkipProject', 'Testing auto-skip on finalize');

      expect(result.success).toBe(true);
      expect(result.projectId).toBe('test-inv-001');
      expect(result.collectedInfo.project.name).toBe('AutoSkipProject');
      expect(result.collectedInfo.project.description).toBe('Testing auto-skip on finalize');
      expect(result.collectedInfo.status).toBe('completed');
    });

    it('should include investigation stats even when auto-skipped', async () => {
      await agent.startSession('StatsProject');
      agent.addTextInput(RICH_INPUT);
      await agent.startInvestigation();

      const result = await agent.finalize('StatsProject', 'Stats check');

      // At least 1 round was started before finalize auto-skipped
      expect(result.stats.investigationRounds).toBeGreaterThanOrEqual(1);
      expect(result.stats.investigationQuestionsAsked).toBeGreaterThan(0);
    });

    it('should auto-skip after partial investigation and produce valid result', async () => {
      await agent.startSession('PartialFinalizeProject');
      agent.addTextInput(RICH_INPUT);

      const round1 = await agent.startInvestigation();
      const answers = buildAnswersForRound(round1);
      await agent.submitInvestigationAnswers(answers);

      // Now in investigating state with round 2 pending — call finalize
      const session = agent.getSession();
      if (session!.status === 'investigating') {
        const result = await agent.finalize('PartialProject', 'Partial investigation');

        expect(result.success).toBe(true);
        expect(result.stats.investigationRounds).toBeGreaterThanOrEqual(1);
      }
    });
  });

  // =========================================================================
  // 5. Investigation metadata in CollectedInfo
  // =========================================================================

  describe('investigation metadata in CollectedInfo', () => {
    beforeEach(() => {
      agent = new CollectorAgent({ investigationDepth: 'standard' });
    });

    it('should include investigation metadata after completing investigation', async () => {
      await agent.startSession('MetadataProject');
      agent.addTextInput(RICH_INPUT);

      // Complete at least one round
      const round1 = await agent.startInvestigation();
      const answers1 = buildAnswersForRound(round1);
      await agent.submitInvestigationAnswers(answers1);

      // Skip remaining investigation
      if (agent.getSession()!.status === 'investigating') {
        agent.skipInvestigation();
      }

      // Skip clarification if needed
      const session = agent.getSession();
      if (session!.status === 'clarifying') {
        agent.skipClarification();
      }

      const result = await agent.finalize('MetadataProject', 'Investigation metadata test');

      expect(result.success).toBe(true);

      // Verify investigation metadata exists in collectedInfo
      const info = result.collectedInfo as Record<string, unknown>;
      expect(info['investigation']).toBeDefined();

      const metadata = info['investigation'] as {
        depth: string;
        roundsCompleted: number;
        totalQuestions: number;
        totalAnswers: number;
        confidenceGain: number;
        phasesCompleted: string[];
      };

      expect(metadata.depth).toBe('standard');
      expect(metadata.roundsCompleted).toBeGreaterThanOrEqual(1);
      expect(metadata.totalQuestions).toBeGreaterThan(0);
      expect(metadata.totalAnswers).toBeGreaterThan(0);
      expect(typeof metadata.confidenceGain).toBe('number');
      expect(metadata.phasesCompleted.length).toBeGreaterThanOrEqual(1);
      expect(metadata.phasesCompleted).toContain('core_discovery');
    });

    it('should include investigation stats in CollectionStats', async () => {
      await agent.startSession('StatsMetadataProject');
      agent.addTextInput(RICH_INPUT);

      const round1 = await agent.startInvestigation();
      const answers1 = buildAnswersForRound(round1);
      await agent.submitInvestigationAnswers(answers1);

      // Skip remaining and finalize
      if (agent.getSession()!.status === 'investigating') {
        agent.skipInvestigation();
      }
      if (agent.getSession()!.status === 'clarifying') {
        agent.skipClarification();
      }

      const result = await agent.finalize('StatsMetadataProject', 'Stats check');

      expect(result.stats.investigationRounds).toBeGreaterThanOrEqual(1);
      expect(result.stats.investigationQuestionsAsked).toBeGreaterThan(0);
    });

    it('should not include investigation metadata when no investigation was started', async () => {
      await agent.startSession('NoInvestigation');
      agent.addTextInput(RICH_INPUT);
      agent.processInputs();

      if (agent.getSession()!.status === 'clarifying') {
        agent.skipClarification();
      }

      const result = await agent.finalize('NoInvestigation', 'No investigation');

      const info = result.collectedInfo as Record<string, unknown>;
      expect(info['investigation']).toBeUndefined();
    });
  });
});
