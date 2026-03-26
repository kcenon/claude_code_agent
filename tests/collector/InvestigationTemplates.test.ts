import { describe, it, expect } from 'vitest';
import {
  InvestigationTemplates,
  TRIGGER_CONDITIONS,
} from '../../src/collector/InvestigationTemplates.js';
import type { QuestionTemplate } from '../../src/collector/InvestigationTemplates.js';
import type { ExtractionResult } from '../../src/collector/types.js';
import type { InvestigationPhase } from '../../src/collector/investigation-types.js';

// =============================================================================
// Helper: minimal mock ExtractionResult
// =============================================================================

function createMockExtraction(overrides: Partial<ExtractionResult> = {}): ExtractionResult {
  return {
    projectName: 'TestProject',
    projectDescription: 'A test project description',
    functionalRequirements: [],
    nonFunctionalRequirements: [],
    constraints: [],
    assumptions: [],
    dependencies: [],
    clarificationQuestions: [],
    overallConfidence: 0.5,
    warnings: [],
    ...overrides,
  };
}

// =============================================================================
// 1. TRIGGER_CONDITIONS
// =============================================================================

describe('TRIGGER_CONDITIONS', () => {
  describe("'always'", () => {
    it('returns true regardless of extraction state', () => {
      const fn = TRIGGER_CONDITIONS['always']!;
      expect(fn(createMockExtraction())).toBe(true);
      expect(fn(createMockExtraction({ projectName: undefined }))).toBe(true);
    });
  });

  describe("'missing.projectName'", () => {
    it('returns true when projectName is undefined', () => {
      const fn = TRIGGER_CONDITIONS['missing.projectName']!;
      expect(fn(createMockExtraction({ projectName: undefined }))).toBe(true);
    });

    it('returns true when projectName is empty string', () => {
      const fn = TRIGGER_CONDITIONS['missing.projectName']!;
      expect(fn(createMockExtraction({ projectName: '' }))).toBe(true);
    });

    it('returns false when projectName is present', () => {
      const fn = TRIGGER_CONDITIONS['missing.projectName']!;
      expect(fn(createMockExtraction({ projectName: 'MyApp' }))).toBe(false);
    });
  });

  describe("'missing.nfr.security'", () => {
    it('returns true when no security NFR exists', () => {
      const fn = TRIGGER_CONDITIONS['missing.nfr.security']!;
      expect(fn(createMockExtraction({ nonFunctionalRequirements: [] }))).toBe(true);
    });

    it('returns true when NFRs exist but none is security', () => {
      const fn = TRIGGER_CONDITIONS['missing.nfr.security']!;
      const extraction = createMockExtraction({
        nonFunctionalRequirements: [
          {
            id: 'NFR-001',
            title: 'Performance',
            description: 'Fast response',
            priority: 'P1',
            source: 'input',
            confidence: 0.8,
            isFunctional: false,
            nfrCategory: 'performance',
          },
        ],
      });
      expect(fn(extraction)).toBe(true);
    });

    it('returns false when a security NFR exists', () => {
      const fn = TRIGGER_CONDITIONS['missing.nfr.security']!;
      const extraction = createMockExtraction({
        nonFunctionalRequirements: [
          {
            id: 'NFR-002',
            title: 'Security',
            description: 'Auth required',
            priority: 'P0',
            source: 'input',
            confidence: 0.9,
            isFunctional: false,
            nfrCategory: 'security',
          },
        ],
      });
      expect(fn(extraction)).toBe(false);
    });
  });

  describe("'missing.constraints'", () => {
    it('returns true when constraints array is empty', () => {
      const fn = TRIGGER_CONDITIONS['missing.constraints']!;
      expect(fn(createMockExtraction({ constraints: [] }))).toBe(true);
    });

    it('returns false when constraints exist', () => {
      const fn = TRIGGER_CONDITIONS['missing.constraints']!;
      const extraction = createMockExtraction({
        constraints: [
          {
            id: 'CON-001',
            description: 'Must use PostgreSQL',
            type: 'technical',
            source: 'input',
            confidence: 0.9,
          },
        ],
      });
      expect(fn(extraction)).toBe(false);
    });
  });

  describe("'has.assumptions'", () => {
    it('returns true when assumptions exist', () => {
      const fn = TRIGGER_CONDITIONS['has.assumptions']!;
      const extraction = createMockExtraction({
        assumptions: [
          {
            id: 'ASM-001',
            description: 'Users have modern browsers',
            source: 'input',
            confidence: 0.7,
          },
        ],
      });
      expect(fn(extraction)).toBe(true);
    });

    it('returns false when assumptions array is empty', () => {
      const fn = TRIGGER_CONDITIONS['has.assumptions']!;
      expect(fn(createMockExtraction({ assumptions: [] }))).toBe(false);
    });
  });

  describe("'has.lowConfidenceRequirements'", () => {
    it('returns true when a FR has confidence < 0.7', () => {
      const fn = TRIGGER_CONDITIONS['has.lowConfidenceRequirements']!;
      const extraction = createMockExtraction({
        functionalRequirements: [
          {
            id: 'FR-001',
            title: 'Login',
            description: 'User login',
            priority: 'P1',
            source: 'input',
            confidence: 0.5,
            isFunctional: true,
          },
        ],
      });
      expect(fn(extraction)).toBe(true);
    });

    it('returns false when all FRs have confidence >= 0.7', () => {
      const fn = TRIGGER_CONDITIONS['has.lowConfidenceRequirements']!;
      const extraction = createMockExtraction({
        functionalRequirements: [
          {
            id: 'FR-001',
            title: 'Login',
            description: 'User login',
            priority: 'P1',
            source: 'input',
            confidence: 0.9,
            isFunctional: true,
          },
        ],
      });
      expect(fn(extraction)).toBe(false);
    });

    it('returns false when there are no FRs', () => {
      const fn = TRIGGER_CONDITIONS['has.lowConfidenceRequirements']!;
      expect(fn(createMockExtraction())).toBe(false);
    });
  });

  describe("'has.multipleRequirements'", () => {
    it('returns true when >= 3 functional requirements', () => {
      const fn = TRIGGER_CONDITIONS['has.multipleRequirements']!;
      const makeFR = (n: number) => ({
        id: `FR-00${n}`,
        title: `Req ${n}`,
        description: `Desc ${n}`,
        priority: 'P1' as const,
        source: 'input',
        confidence: 0.8,
        isFunctional: true,
      });
      const extraction = createMockExtraction({
        functionalRequirements: [makeFR(1), makeFR(2), makeFR(3)],
      });
      expect(fn(extraction)).toBe(true);
    });

    it('returns false when fewer than 3 FRs', () => {
      const fn = TRIGGER_CONDITIONS['has.multipleRequirements']!;
      const extraction = createMockExtraction({
        functionalRequirements: [
          {
            id: 'FR-001',
            title: 'Login',
            description: 'desc',
            priority: 'P1',
            source: 'input',
            confidence: 0.8,
            isFunctional: true,
          },
        ],
      });
      expect(fn(extraction)).toBe(false);
    });
  });

  describe("'has.missingAcceptanceCriteria'", () => {
    it('returns true when a FR has no acceptanceCriteria', () => {
      const fn = TRIGGER_CONDITIONS['has.missingAcceptanceCriteria']!;
      const extraction = createMockExtraction({
        functionalRequirements: [
          {
            id: 'FR-001',
            title: 'Login',
            description: 'desc',
            priority: 'P1',
            source: 'input',
            confidence: 0.8,
            isFunctional: true,
          },
        ],
      });
      expect(fn(extraction)).toBe(true);
    });

    it('returns true when a FR has empty acceptanceCriteria array', () => {
      const fn = TRIGGER_CONDITIONS['has.missingAcceptanceCriteria']!;
      const extraction = createMockExtraction({
        functionalRequirements: [
          {
            id: 'FR-001',
            title: 'Login',
            description: 'desc',
            priority: 'P1',
            source: 'input',
            confidence: 0.8,
            isFunctional: true,
            acceptanceCriteria: [],
          },
        ],
      });
      expect(fn(extraction)).toBe(true);
    });

    it('returns false when all FRs have acceptance criteria', () => {
      const fn = TRIGGER_CONDITIONS['has.missingAcceptanceCriteria']!;
      const extraction = createMockExtraction({
        functionalRequirements: [
          {
            id: 'FR-001',
            title: 'Login',
            description: 'desc',
            priority: 'P1',
            source: 'input',
            confidence: 0.8,
            isFunctional: true,
            acceptanceCriteria: ['User can log in with email/password'],
          },
        ],
      });
      expect(fn(extraction)).toBe(false);
    });
  });
});

// =============================================================================
// 2. InvestigationTemplates.getTemplatesForPhase()
// =============================================================================

describe('InvestigationTemplates.getTemplatesForPhase()', () => {
  const templates = new InvestigationTemplates();
  const extraction = createMockExtraction();

  it('returns templates for project_vision phase', () => {
    const result = templates.getTemplatesForPhase('project_vision', extraction, [], 10);
    expect(result.length).toBeGreaterThan(0);
    expect(result.every((t) => t.phase === 'project_vision')).toBe(true);
  });

  it('filters out templates whose trigger condition is not met', () => {
    // functional_deep_dive has templates with condition 'has.missingAcceptanceCriteria',
    // 'has.lowConfidenceRequirements', 'has.multipleRequirements' — none met with empty FRs.
    const emptyExtraction = createMockExtraction({
      functionalRequirements: [],
    });
    const result = templates.getTemplatesForPhase('functional_deep_dive', emptyExtraction, [], 10);
    // Only templates with condition 'always' or 'has.functionalRequirements' (false) should pass.
    // 'always' templates should still be included.
    for (const t of result) {
      const condFn = TRIGGER_CONDITIONS[t.condition];
      expect(condFn).toBeDefined();
      expect(condFn!(emptyExtraction)).toBe(true);
    }
  });

  it('excludes templates with already-asked tags', () => {
    const result = templates.getTemplatesForPhase(
      'project_vision',
      extraction,
      ['project_purpose', 'stakeholders'],
      10
    );
    for (const t of result) {
      const hasOverlap = t.tags.some((tag) => ['project_purpose', 'stakeholders'].includes(tag));
      expect(hasOverlap).toBe(false);
    }
  });

  it('limits results by maxQuestions', () => {
    const result = templates.getTemplatesForPhase('project_vision', extraction, [], 2);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('sorts by priority (highest first)', () => {
    const result = templates.getTemplatesForPhase('project_vision', extraction, [], 10);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1]!.priority).toBeGreaterThanOrEqual(result[i]!.priority);
    }
  });

  it('returns empty array for unknown phase', () => {
    const result = templates.getTemplatesForPhase(
      'nonexistent_phase' as InvestigationPhase,
      extraction,
      [],
      10
    );
    expect(result).toEqual([]);
  });
});

// =============================================================================
// 3. InvestigationTemplates.parameterizeQuestion()
// =============================================================================

describe('InvestigationTemplates.parameterizeQuestion()', () => {
  const templates = new InvestigationTemplates();

  it('replaces {projectName} with extraction projectName', () => {
    const template: QuestionTemplate = {
      id: 'TEST-001',
      phase: 'project_vision',
      format: 'free_text',
      question: 'What is the goal of {projectName}?',
      context: 'test',
      category: 'scope',
      required: false,
      priority: 5,
      condition: 'always',
      tags: ['test'],
    };
    const extraction = createMockExtraction({ projectName: 'SuperApp' });
    const result = templates.parameterizeQuestion(template, extraction);
    expect(result).toBe('What is the goal of SuperApp?');
  });

  it('handles missing projectName gracefully (defaults to "the project")', () => {
    const template: QuestionTemplate = {
      id: 'TEST-002',
      phase: 'project_vision',
      format: 'free_text',
      question: 'Describe {projectName} in one sentence.',
      context: 'test',
      category: 'scope',
      required: false,
      priority: 5,
      condition: 'always',
      tags: ['test'],
    };
    const extraction = createMockExtraction({ projectName: undefined });
    const result = templates.parameterizeQuestion(template, extraction);
    expect(result).toBe('Describe the project in one sentence.');
  });

  it('replaces {requirement.title} and {requirement.id}', () => {
    const template: QuestionTemplate = {
      id: 'TEST-003',
      phase: 'functional_deep_dive',
      format: 'confirmation',
      question: 'Is {requirement.id}: {requirement.title} correctly captured?',
      context: 'test',
      category: 'requirement',
      required: true,
      priority: 9,
      condition: 'has.lowConfidenceRequirements',
      tags: ['test'],
    };
    const extraction = createMockExtraction({
      functionalRequirements: [
        {
          id: 'FR-001',
          title: 'User Authentication',
          description: 'Login and registration',
          priority: 'P0',
          source: 'input',
          confidence: 0.5,
          isFunctional: true,
        },
      ],
    });
    const result = templates.parameterizeQuestion(template, extraction);
    expect(result).toBe('Is FR-001: User Authentication correctly captured?');
  });

  it('replaces {assumption.description}', () => {
    const template: QuestionTemplate = {
      id: 'TEST-004',
      phase: 'constraints_risks',
      format: 'confirmation',
      question: 'You assumed: {assumption.description}. Is this correct?',
      context: 'test',
      category: 'assumption',
      required: true,
      priority: 9,
      condition: 'has.assumptions',
      tags: ['test'],
    };
    const extraction = createMockExtraction({
      assumptions: [
        {
          id: 'ASM-001',
          description: 'Users have internet access',
          source: 'input',
          confidence: 0.8,
        },
      ],
    });
    const result = templates.parameterizeQuestion(template, extraction);
    expect(result).toBe('You assumed: Users have internet access. Is this correct?');
  });
});

// =============================================================================
// 4. InvestigationTemplates.templateToQuestion()
// =============================================================================

describe('InvestigationTemplates.templateToQuestion()', () => {
  const templates = new InvestigationTemplates();

  it('produces a valid InvestigationQuestion', () => {
    const template: QuestionTemplate = {
      id: 'IQ-VIS-001',
      phase: 'project_vision',
      format: 'free_text',
      question: 'What is the goal?',
      context: 'Understanding the goal is important.',
      category: 'scope',
      required: true,
      priority: 10,
      condition: 'always',
      tags: ['project_purpose'],
    };
    const extraction = createMockExtraction();
    const result = templates.templateToQuestion(template, extraction, 'Q-001', 1);

    expect(result).toBeDefined();
    expect(result.id).toBe('Q-001');
    expect(result.phase).toBe('project_vision');
    expect(result.round).toBe(1);
    expect(result.format).toBe('free_text');
    expect(result.question).toBe('What is the goal?');
    expect(result.context).toBe('Understanding the goal is important.');
    expect(result.required).toBe(true);
    expect(result.category).toBe('scope');
    expect(result.relatedTo).toBeUndefined();
  });

  it('sets correct ID, round, and phase from arguments', () => {
    const template: QuestionTemplate = {
      id: 'IQ-USER-001',
      phase: 'user_analysis',
      format: 'free_text',
      question: 'Who are the users?',
      context: 'context',
      category: 'stakeholder',
      required: true,
      priority: 10,
      condition: 'always',
      tags: ['user_personas'],
    };
    const extraction = createMockExtraction();
    const result = templates.templateToQuestion(template, extraction, 'Q-042', 3);

    expect(result.id).toBe('Q-042');
    expect(result.round).toBe(3);
    expect(result.phase).toBe('user_analysis');
  });

  it('generates dynamic options for priority_ranking format', () => {
    const makeFR = (n: number) => ({
      id: `FR-00${n}`,
      title: `Feature ${n}`,
      description: `Desc ${n}`,
      priority: 'P1' as const,
      source: 'input',
      confidence: 0.8,
      isFunctional: true,
    });
    const template: QuestionTemplate = {
      id: 'IQ-FUNC-003',
      phase: 'functional_deep_dive',
      format: 'priority_ranking',
      question: 'Rank the following requirements:',
      context: 'Priority ranking is important.',
      category: 'priority',
      required: true,
      priority: 8,
      options: ['placeholder'],
      condition: 'has.multipleRequirements',
      tags: ['priority_ranking'],
    };
    const extraction = createMockExtraction({
      functionalRequirements: [makeFR(1), makeFR(2), makeFR(3)],
    });
    const result = templates.templateToQuestion(template, extraction, 'Q-100', 2);

    expect(result.options).toEqual(['FR-001: Feature 1', 'FR-002: Feature 2', 'FR-003: Feature 3']);
  });

  it('preserves static options when format is not priority_ranking', () => {
    const template: QuestionTemplate = {
      id: 'IQ-VIS-003',
      phase: 'project_vision',
      format: 'multi_select',
      question: 'Which project type?',
      context: 'context',
      category: 'scope',
      required: false,
      priority: 8,
      options: ['Web app', 'Mobile app', 'CLI'],
      condition: 'always',
      tags: ['project_type'],
    };
    const extraction = createMockExtraction();
    const result = templates.templateToQuestion(template, extraction, 'Q-200', 1);

    expect(result.options).toEqual(['Web app', 'Mobile app', 'CLI']);
  });

  it('passes through scaleRange when present', () => {
    const template: QuestionTemplate = {
      id: 'IQ-VIS-006',
      phase: 'project_vision',
      format: 'scale_rating',
      question: 'How critical is this?',
      context: 'context',
      category: 'scope',
      required: false,
      priority: 6,
      scaleRange: { min: 1, max: 5, labels: { min: 'Low', max: 'High' } },
      condition: 'always',
      tags: ['criticality'],
    };
    const extraction = createMockExtraction();
    const result = templates.templateToQuestion(template, extraction, 'Q-300', 1);

    expect(result.scaleRange).toEqual({
      min: 1,
      max: 5,
      labels: { min: 'Low', max: 'High' },
    });
  });

  it('sets scaleRange to undefined when template has none', () => {
    const template: QuestionTemplate = {
      id: 'TEST-005',
      phase: 'project_vision',
      format: 'free_text',
      question: 'Describe the project.',
      context: 'context',
      category: 'scope',
      required: false,
      priority: 5,
      condition: 'always',
      tags: ['test'],
    };
    const extraction = createMockExtraction();
    const result = templates.templateToQuestion(template, extraction, 'Q-400', 1);

    expect(result.scaleRange).toBeUndefined();
  });
});
