/**
 * InvestigationTemplates — Predefined question templates for investigation phases
 *
 * Provides the template fallback system when LLM-based question generation
 * is unavailable. Templates are parameterized with extraction state data.
 *
 * @module collector/InvestigationTemplates
 */

import type {
  InvestigationPhase,
  InvestigationQuestionFormat,
  InvestigationQuestion,
  InvestigationCategory,
} from './investigation-types.js';
import type { ExtractionResult } from './types.js';

// =============================================================================
// Question Template Interface
// =============================================================================

/**
 * Predefined question template with trigger conditions.
 */
export interface QuestionTemplate {
  /** Template ID (e.g., IQ-VIS-001) */
  readonly id: string;
  /** Phase this template belongs to */
  readonly phase: InvestigationPhase;
  /** Question format */
  readonly format: InvestigationQuestionFormat;
  /** Question text with {placeholders} */
  readonly question: string;
  /** Context explaining why this question matters */
  readonly context: string;
  /** Question category */
  readonly category: InvestigationCategory;
  /** Whether this question is required */
  readonly required: boolean;
  /** Priority (1-10, higher = ask first) */
  readonly priority: number;
  /** Predefined options for select/ranking */
  readonly options?: readonly string[];
  /** Scale range for scale_rating */
  readonly scaleRange?: {
    readonly min: number;
    readonly max: number;
    readonly labels?: { readonly min: string; readonly max: string };
  };
  /** Trigger condition name (key in TRIGGER_CONDITIONS) */
  readonly condition: string;
  /** Tags for deduplication across phases */
  readonly tags: readonly string[];
}

// =============================================================================
// Trigger Conditions Registry
// =============================================================================

/**
 * Named trigger conditions evaluated against ExtractionResult.
 * Returns true when the question should be included.
 */
export const TRIGGER_CONDITIONS: Readonly<
  Record<string, (extraction: ExtractionResult) => boolean>
> = {
  always: () => true,
  'missing.projectName': (e) => e.projectName === undefined || e.projectName === '',
  'missing.projectDescription': (e) =>
    e.projectDescription === undefined || e.projectDescription === '',
  'missing.nfr.performance': (e) =>
    !e.nonFunctionalRequirements.some((r) => r.nfrCategory === 'performance'),
  'missing.nfr.security': (e) =>
    !e.nonFunctionalRequirements.some((r) => r.nfrCategory === 'security'),
  'missing.nfr.reliability': (e) =>
    !e.nonFunctionalRequirements.some((r) => r.nfrCategory === 'reliability'),
  'missing.nfr.usability': (e) =>
    !e.nonFunctionalRequirements.some((r) => r.nfrCategory === 'usability'),
  'missing.constraints': (e) => e.constraints.length === 0,
  'missing.constraints.business': (e) => !e.constraints.some((c) => c.type === 'business'),
  'missing.constraints.regulatory': (e) => !e.constraints.some((c) => c.type === 'regulatory'),
  'missing.dependencies': (e) => e.dependencies.length === 0,
  'has.assumptions': (e) => e.assumptions.length > 0,
  'has.lowConfidenceRequirements': (e) => e.functionalRequirements.some((r) => r.confidence < 0.7),
  'has.multipleRequirements': (e) => e.functionalRequirements.length >= 3,
  'has.functionalRequirements': (e) => e.functionalRequirements.length > 0,
  'has.missingAcceptanceCriteria': (e) =>
    e.functionalRequirements.some(
      (r) => r.acceptanceCriteria === undefined || r.acceptanceCriteria.length === 0
    ),
};

// =============================================================================
// Phase Templates
// =============================================================================

const PROJECT_VISION_TEMPLATES: readonly QuestionTemplate[] = [
  {
    id: 'IQ-VIS-001',
    phase: 'project_vision',
    format: 'free_text',
    question:
      'What is the primary business problem or opportunity that this project aims to address?',
    context: 'Understanding the core problem helps prioritize requirements correctly.',
    category: 'scope',
    required: true,
    priority: 10,
    condition: 'always',
    tags: ['project_purpose'],
  },
  {
    id: 'IQ-VIS-002',
    phase: 'project_vision',
    format: 'free_text',
    question:
      'Who are the key stakeholders for this project? Please list their roles and primary interests.',
    context: 'Stakeholder identification ensures all perspectives are captured in the PRD.',
    category: 'stakeholder',
    required: true,
    priority: 9,
    condition: 'always',
    tags: ['stakeholders'],
  },
  {
    id: 'IQ-VIS-003',
    phase: 'project_vision',
    format: 'multi_select',
    question: 'Which of the following best describes the project type?',
    context: 'Project type determines applicable architectural patterns and NFR priorities.',
    category: 'scope',
    required: false,
    priority: 8,
    options: [
      'Web application',
      'Mobile application',
      'API/Backend service',
      'Desktop application',
      'CLI tool',
      'Library/SDK',
      'Data pipeline',
      'Infrastructure/DevOps',
    ],
    condition: 'always',
    tags: ['project_type'],
  },
  {
    id: 'IQ-VIS-004',
    phase: 'project_vision',
    format: 'free_text',
    question: 'What does success look like for this project? Describe 2-3 measurable outcomes.',
    context: 'Success criteria become the basis for acceptance criteria validation.',
    category: 'scope',
    required: true,
    priority: 8,
    condition: 'always',
    tags: ['success_criteria'],
  },
  {
    id: 'IQ-VIS-005',
    phase: 'project_vision',
    format: 'single_select',
    question: 'What is the expected timeline for the initial release?',
    context: 'Timeline affects scope decisions and priority trade-offs.',
    category: 'timeline',
    required: false,
    priority: 7,
    options: ['1-2 weeks', '1 month', '2-3 months', '3-6 months', '6+ months', 'Not determined'],
    condition: 'always',
    tags: ['timeline'],
  },
  {
    id: 'IQ-VIS-006',
    phase: 'project_vision',
    format: 'scale_rating',
    question: "How critical is this project to the organization's strategy?",
    context: 'Strategic importance drives default priority levels for requirements.',
    category: 'scope',
    required: false,
    priority: 6,
    scaleRange: { min: 1, max: 5, labels: { min: 'Exploratory', max: 'Mission-critical' } },
    condition: 'always',
    tags: ['criticality'],
  },
  {
    id: 'IQ-VIS-007',
    phase: 'project_vision',
    format: 'free_text',
    question:
      'Are there any existing systems or products that this project will replace, integrate with, or extend?',
    context: 'Existing system landscape affects architecture and migration requirements.',
    category: 'scope',
    required: false,
    priority: 6,
    condition: 'always',
    tags: ['existing_systems'],
  },
];

const USER_ANALYSIS_TEMPLATES: readonly QuestionTemplate[] = [
  {
    id: 'IQ-USER-001',
    phase: 'user_analysis',
    format: 'free_text',
    question:
      'Describe the primary end users. What are their technical skill levels and main goals?',
    context: 'User personas directly inform functional requirements and usability criteria.',
    category: 'stakeholder',
    required: true,
    priority: 10,
    condition: 'always',
    tags: ['user_personas'],
  },
  {
    id: 'IQ-USER-002',
    phase: 'user_analysis',
    format: 'free_text',
    question: 'Walk through the most critical user workflow or journey from start to finish.',
    context: 'Critical user journeys become the backbone of functional requirements.',
    category: 'requirement',
    required: true,
    priority: 9,
    condition: 'always',
    tags: ['user_workflow'],
  },
  {
    id: 'IQ-USER-003',
    phase: 'user_analysis',
    format: 'multi_select',
    question: 'Which user interaction patterns are relevant?',
    context: 'Interaction patterns help identify missing functional requirements.',
    category: 'requirement',
    required: false,
    priority: 8,
    options: [
      'CRUD operations',
      'Search/filter',
      'Real-time collaboration',
      'File upload/download',
      'Notifications/alerts',
      'Reporting/analytics',
      'Workflow automation',
      'Social/messaging',
    ],
    condition: 'always',
    tags: ['interaction_patterns'],
  },
  {
    id: 'IQ-USER-004',
    phase: 'user_analysis',
    format: 'yes_no',
    question: 'Will there be different user roles with different permission levels?',
    context:
      'Role-based access control significantly impacts architecture and security requirements.',
    category: 'requirement',
    required: true,
    priority: 8,
    condition: 'has.functionalRequirements',
    tags: ['user_roles'],
  },
  {
    id: 'IQ-USER-005',
    phase: 'user_analysis',
    format: 'free_text',
    question:
      'Are there accessibility requirements (WCAG compliance, screen reader support, keyboard navigation)?',
    context: 'Accessibility requirements are often overlooked but critical for compliance.',
    category: 'quality',
    required: false,
    priority: 7,
    condition: 'always',
    tags: ['accessibility'],
  },
  {
    id: 'IQ-USER-006',
    phase: 'user_analysis',
    format: 'scale_rating',
    question: 'How many concurrent users do you expect at peak?',
    context: 'User scale drives performance and scalability requirements.',
    category: 'quality',
    required: false,
    priority: 6,
    scaleRange: { min: 1, max: 5, labels: { min: '< 10 users', max: '10,000+ users' } },
    condition: 'always',
    tags: ['user_scale'],
  },
];

const FUNCTIONAL_DEEP_DIVE_TEMPLATES: readonly QuestionTemplate[] = [
  {
    id: 'IQ-FUNC-001',
    phase: 'functional_deep_dive',
    format: 'free_text',
    question: 'What are the specific acceptance criteria for the highest-priority requirement?',
    context: 'Acceptance criteria are essential for verification and validation downstream.',
    category: 'requirement',
    required: true,
    priority: 10,
    condition: 'has.missingAcceptanceCriteria',
    tags: ['acceptance_criteria'],
  },
  {
    id: 'IQ-FUNC-002',
    phase: 'functional_deep_dive',
    format: 'free_text',
    question: 'What edge cases or error scenarios should be handled for the core features?',
    context: 'Edge case identification prevents gaps in implementation.',
    category: 'requirement',
    required: false,
    priority: 9,
    condition: 'has.lowConfidenceRequirements',
    tags: ['edge_cases'],
  },
  {
    id: 'IQ-FUNC-003',
    phase: 'functional_deep_dive',
    format: 'priority_ranking',
    question: 'Please rank the following functional requirements by business value:',
    context: 'Priority ranking ensures the most important features are implemented first.',
    category: 'priority',
    required: true,
    priority: 8,
    condition: 'has.multipleRequirements',
    tags: ['priority_ranking'],
  },
  {
    id: 'IQ-FUNC-004',
    phase: 'functional_deep_dive',
    format: 'yes_no',
    question:
      'Do any of the identified requirements depend on other requirements being implemented first?',
    context: 'Dependency mapping is critical for implementation ordering.',
    category: 'requirement',
    required: false,
    priority: 7,
    condition: 'has.multipleRequirements',
    tags: ['requirement_dependencies'],
  },
  {
    id: 'IQ-FUNC-005',
    phase: 'functional_deep_dive',
    format: 'free_text',
    question: "Are there any features you've been considering but are unsure about including?",
    context: 'Scope boundary discussion prevents feature creep and sets clear expectations.',
    category: 'scope',
    required: false,
    priority: 7,
    condition: 'always',
    tags: ['scope_boundary'],
  },
  {
    id: 'IQ-FUNC-006',
    phase: 'functional_deep_dive',
    format: 'single_select',
    question: 'What should happen when data created by a core feature is deleted?',
    context: 'Data lifecycle decisions affect architecture and compliance requirements.',
    category: 'requirement',
    required: false,
    priority: 6,
    options: ['Hard delete (permanent)', 'Soft delete (recoverable)', 'Archive', 'Not applicable'],
    condition: 'has.functionalRequirements',
    tags: ['data_lifecycle'],
  },
  {
    id: 'IQ-FUNC-007',
    phase: 'functional_deep_dive',
    format: 'confirmation',
    question: 'We extracted the following core requirement. Is this interpretation accurate?',
    context: 'Confirming extracted requirements prevents misunderstandings early.',
    category: 'requirement',
    required: true,
    priority: 9,
    condition: 'has.lowConfidenceRequirements',
    tags: ['requirement_confirmation'],
  },
];

const NONFUNCTIONAL_ANALYSIS_TEMPLATES: readonly QuestionTemplate[] = [
  {
    id: 'IQ-NFR-001',
    phase: 'nonfunctional_analysis',
    format: 'free_text',
    question:
      'What are the target response times for key operations? (e.g., page load < 2s, API response < 500ms)',
    context: 'Measurable performance targets become testable NFR acceptance criteria.',
    category: 'quality',
    required: true,
    priority: 10,
    condition: 'missing.nfr.performance',
    tags: ['performance'],
  },
  {
    id: 'IQ-NFR-002',
    phase: 'nonfunctional_analysis',
    format: 'multi_select',
    question: 'Which security measures are required?',
    context: 'Security requirements must be identified early to influence architecture decisions.',
    category: 'quality',
    required: true,
    priority: 10,
    options: [
      'Authentication (login)',
      'Authorization (role-based access)',
      'Data encryption at rest',
      'Data encryption in transit',
      'Audit logging',
      'OWASP Top 10 compliance',
      'SOC 2 compliance',
      'GDPR compliance',
      'Input validation/sanitization',
    ],
    condition: 'missing.nfr.security',
    tags: ['security'],
  },
  {
    id: 'IQ-NFR-003',
    phase: 'nonfunctional_analysis',
    format: 'scale_rating',
    question: 'What is the required availability level?',
    context: 'Availability targets drive infrastructure and redundancy decisions.',
    category: 'quality',
    required: false,
    priority: 8,
    scaleRange: { min: 1, max: 5, labels: { min: 'Best effort', max: '99.99%+ uptime' } },
    condition: 'missing.nfr.reliability',
    tags: ['availability'],
  },
  {
    id: 'IQ-NFR-004',
    phase: 'nonfunctional_analysis',
    format: 'single_select',
    question: 'What is the expected data volume?',
    context: 'Data volume affects database choices, indexing strategies, and scalability needs.',
    category: 'quality',
    required: false,
    priority: 7,
    options: ['Small (< 1 GB)', 'Medium (1-100 GB)', 'Large (100 GB - 1 TB)', 'Very large (1+ TB)'],
    condition: 'always',
    tags: ['data_volume'],
  },
  {
    id: 'IQ-NFR-005',
    phase: 'nonfunctional_analysis',
    format: 'yes_no',
    question: 'Is internationalization (i18n) or localization (l10n) required?',
    context: 'i18n requirements must be designed in from the start, not retrofitted.',
    category: 'quality',
    required: false,
    priority: 6,
    condition: 'missing.nfr.usability',
    tags: ['i18n'],
  },
  {
    id: 'IQ-NFR-006',
    phase: 'nonfunctional_analysis',
    format: 'free_text',
    question: 'What monitoring, logging, or observability requirements exist?',
    context: 'Observability requirements affect application architecture and operations.',
    category: 'quality',
    required: false,
    priority: 6,
    condition: 'always',
    tags: ['observability'],
  },
];

const CONSTRAINTS_RISKS_TEMPLATES: readonly QuestionTemplate[] = [
  {
    id: 'IQ-CON-001',
    phase: 'constraints_risks',
    format: 'multi_select',
    question: 'Are there technology stack constraints?',
    context: 'Technology constraints directly limit architectural options.',
    category: 'constraint',
    required: true,
    priority: 10,
    options: [
      'Specific programming language required',
      'Specific framework required',
      'Must use existing infrastructure',
      'Cloud provider locked',
      'Database technology specified',
      'No constraints',
    ],
    condition: 'missing.constraints',
    tags: ['tech_constraints'],
  },
  {
    id: 'IQ-CON-002',
    phase: 'constraints_risks',
    format: 'free_text',
    question: 'What are the budget or resource constraints for this project?',
    context: 'Resource constraints affect scope and timeline decisions.',
    category: 'constraint',
    required: false,
    priority: 9,
    condition: 'missing.constraints.business',
    tags: ['budget_constraints'],
  },
  {
    id: 'IQ-CON-003',
    phase: 'constraints_risks',
    format: 'confirmation',
    question:
      'We identified an assumption from the input. Is this correct, and what is the risk if it proves wrong?',
    context: 'Unvalidated assumptions are a major source of project risk.',
    category: 'assumption',
    required: true,
    priority: 9,
    condition: 'has.assumptions',
    tags: ['assumption_validation'],
  },
  {
    id: 'IQ-CON-004',
    phase: 'constraints_risks',
    format: 'free_text',
    question: 'What are the top 3 risks that could derail this project?',
    context: 'Early risk identification enables proactive mitigation planning.',
    category: 'risk',
    required: false,
    priority: 8,
    condition: 'always',
    tags: ['risks'],
  },
  {
    id: 'IQ-CON-005',
    phase: 'constraints_risks',
    format: 'yes_no',
    question: 'Are there regulatory or compliance requirements (GDPR, HIPAA, PCI-DSS, SOX, etc.)?',
    context: 'Regulatory requirements create hard constraints on architecture and data handling.',
    category: 'constraint',
    required: true,
    priority: 8,
    condition: 'missing.constraints.regulatory',
    tags: ['regulatory'],
  },
  {
    id: 'IQ-CON-006',
    phase: 'constraints_risks',
    format: 'free_text',
    question:
      'List any third-party services, APIs, or systems that this project must integrate with.',
    context: 'External dependencies affect architecture, testing, and deployment strategies.',
    category: 'constraint',
    required: false,
    priority: 7,
    condition: 'missing.dependencies',
    tags: ['external_dependencies'],
  },
];

const VALIDATION_SYNTHESIS_TEMPLATES: readonly QuestionTemplate[] = [
  {
    id: 'IQ-VAL-001',
    phase: 'validation_synthesis',
    format: 'priority_ranking',
    question: 'Please confirm the priority order for the collected functional requirements:',
    context: 'Final priority confirmation ensures alignment before PRD generation.',
    category: 'priority',
    required: true,
    priority: 10,
    condition: 'has.multipleRequirements',
    tags: ['final_priority'],
  },
  {
    id: 'IQ-VAL-002',
    phase: 'validation_synthesis',
    format: 'multi_select',
    question: 'Which of the following are explicitly OUT of scope for the initial release?',
    context: 'Explicit scope exclusions prevent scope creep during implementation.',
    category: 'scope',
    required: false,
    priority: 9,
    options: [
      'Admin dashboard',
      'Analytics/reporting',
      'Mobile support',
      'Offline mode',
      'Multi-language support',
      'Third-party integrations',
      'Advanced search',
      'Real-time features',
    ],
    condition: 'always',
    tags: ['out_of_scope'],
  },
  {
    id: 'IQ-VAL-003',
    phase: 'validation_synthesis',
    format: 'confirmation',
    question:
      'Based on our investigation, the core purpose of this project has been captured. Does this accurately represent the project?',
    context: 'Final confirmation of the project description ensures PRD alignment.',
    category: 'scope',
    required: true,
    priority: 9,
    condition: 'always',
    tags: ['project_confirmation'],
  },
  {
    id: 'IQ-VAL-004',
    phase: 'validation_synthesis',
    format: 'free_text',
    question:
      "Is there anything important we haven't discussed that should be part of the requirements?",
    context: 'Open-ended catch-all prevents critical omissions.',
    category: 'requirement',
    required: false,
    priority: 8,
    condition: 'always',
    tags: ['final_gaps'],
  },
  {
    id: 'IQ-VAL-005',
    phase: 'validation_synthesis',
    format: 'yes_no',
    question:
      "Are you satisfied that we've captured enough detail to begin writing the Product Requirements Document?",
    context: 'Final approval gate ensures stakeholder buy-in before PRD generation.',
    category: 'scope',
    required: true,
    priority: 10,
    condition: 'always',
    tags: ['final_approval'],
  },
];

// =============================================================================
// Helper for safe template derivation
// =============================================================================

function deriveTemplate(
  source: readonly QuestionTemplate[],
  index: number,
  overrides: Partial<QuestionTemplate>
): QuestionTemplate {
  const base = source[index];
  if (base === undefined) {
    throw new Error(`Template index ${String(index)} out of range`);
  }
  return { ...base, ...overrides };
}

// =============================================================================
// Standard Mode Templates (condensed phases)
// =============================================================================

const CORE_DISCOVERY_TEMPLATES: readonly QuestionTemplate[] = [
  deriveTemplate(PROJECT_VISION_TEMPLATES, 0, { phase: 'core_discovery', id: 'IQ-CD-001' }),
  deriveTemplate(PROJECT_VISION_TEMPLATES, 1, { phase: 'core_discovery', id: 'IQ-CD-002' }),
  deriveTemplate(PROJECT_VISION_TEMPLATES, 2, { phase: 'core_discovery', id: 'IQ-CD-003' }),
  deriveTemplate(PROJECT_VISION_TEMPLATES, 3, { phase: 'core_discovery', id: 'IQ-CD-004' }),
  deriveTemplate(USER_ANALYSIS_TEMPLATES, 0, { phase: 'core_discovery', id: 'IQ-CD-005' }),
  deriveTemplate(USER_ANALYSIS_TEMPLATES, 1, { phase: 'core_discovery', id: 'IQ-CD-006' }),
  deriveTemplate(USER_ANALYSIS_TEMPLATES, 3, { phase: 'core_discovery', id: 'IQ-CD-007' }),
];

const REQUIREMENTS_ANALYSIS_TEMPLATES: readonly QuestionTemplate[] = [
  deriveTemplate(FUNCTIONAL_DEEP_DIVE_TEMPLATES, 0, {
    phase: 'requirements_analysis',
    id: 'IQ-RA-001',
  }),
  deriveTemplate(FUNCTIONAL_DEEP_DIVE_TEMPLATES, 2, {
    phase: 'requirements_analysis',
    id: 'IQ-RA-002',
  }),
  deriveTemplate(FUNCTIONAL_DEEP_DIVE_TEMPLATES, 6, {
    phase: 'requirements_analysis',
    id: 'IQ-RA-003',
  }),
  deriveTemplate(NONFUNCTIONAL_ANALYSIS_TEMPLATES, 0, {
    phase: 'requirements_analysis',
    id: 'IQ-RA-004',
  }),
  deriveTemplate(NONFUNCTIONAL_ANALYSIS_TEMPLATES, 1, {
    phase: 'requirements_analysis',
    id: 'IQ-RA-005',
  }),
  deriveTemplate(NONFUNCTIONAL_ANALYSIS_TEMPLATES, 2, {
    phase: 'requirements_analysis',
    id: 'IQ-RA-006',
  }),
  deriveTemplate(NONFUNCTIONAL_ANALYSIS_TEMPLATES, 3, {
    phase: 'requirements_analysis',
    id: 'IQ-RA-007',
  }),
];

const CONSTRAINTS_VALIDATION_TEMPLATES: readonly QuestionTemplate[] = [
  deriveTemplate(CONSTRAINTS_RISKS_TEMPLATES, 0, {
    phase: 'constraints_validation',
    id: 'IQ-CV-001',
  }),
  deriveTemplate(CONSTRAINTS_RISKS_TEMPLATES, 2, {
    phase: 'constraints_validation',
    id: 'IQ-CV-002',
  }),
  deriveTemplate(CONSTRAINTS_RISKS_TEMPLATES, 4, {
    phase: 'constraints_validation',
    id: 'IQ-CV-003',
  }),
  deriveTemplate(VALIDATION_SYNTHESIS_TEMPLATES, 2, {
    phase: 'constraints_validation',
    id: 'IQ-CV-004',
  }),
  deriveTemplate(VALIDATION_SYNTHESIS_TEMPLATES, 4, {
    phase: 'constraints_validation',
    id: 'IQ-CV-005',
  }),
];

// =============================================================================
// Quick Mode Templates
// =============================================================================

const BASIC_CLARIFICATION_TEMPLATES: readonly QuestionTemplate[] = [
  deriveTemplate(PROJECT_VISION_TEMPLATES, 0, {
    phase: 'basic_clarification',
    id: 'IQ-BC-001',
    condition: 'missing.projectName',
  }),
  deriveTemplate(FUNCTIONAL_DEEP_DIVE_TEMPLATES, 6, {
    phase: 'basic_clarification',
    id: 'IQ-BC-002',
    condition: 'has.lowConfidenceRequirements',
  }),
  deriveTemplate(NONFUNCTIONAL_ANALYSIS_TEMPLATES, 1, {
    phase: 'basic_clarification',
    id: 'IQ-BC-003',
    condition: 'missing.nfr.security',
  }),
  deriveTemplate(VALIDATION_SYNTHESIS_TEMPLATES, 4, {
    phase: 'basic_clarification',
    id: 'IQ-BC-004',
  }),
];

// =============================================================================
// All Templates Registry
// =============================================================================

const ALL_TEMPLATES: ReadonlyMap<InvestigationPhase, readonly QuestionTemplate[]> = new Map([
  // Thorough phases
  ['project_vision', PROJECT_VISION_TEMPLATES],
  ['user_analysis', USER_ANALYSIS_TEMPLATES],
  ['functional_deep_dive', FUNCTIONAL_DEEP_DIVE_TEMPLATES],
  ['nonfunctional_analysis', NONFUNCTIONAL_ANALYSIS_TEMPLATES],
  ['constraints_risks', CONSTRAINTS_RISKS_TEMPLATES],
  ['validation_synthesis', VALIDATION_SYNTHESIS_TEMPLATES],
  // Standard phases
  ['core_discovery', CORE_DISCOVERY_TEMPLATES],
  ['requirements_analysis', REQUIREMENTS_ANALYSIS_TEMPLATES],
  ['constraints_validation', CONSTRAINTS_VALIDATION_TEMPLATES],
  // Quick phase
  ['basic_clarification', BASIC_CLARIFICATION_TEMPLATES],
]);

// =============================================================================
// InvestigationTemplates Class
// =============================================================================

/**
 * Manages predefined question templates for investigation phases.
 * Provides the fallback question generation when LLM is unavailable.
 */
export class InvestigationTemplates {
  private readonly templates: ReadonlyMap<InvestigationPhase, readonly QuestionTemplate[]>;

  constructor(templates?: ReadonlyMap<InvestigationPhase, readonly QuestionTemplate[]>) {
    this.templates = templates ?? ALL_TEMPLATES;
  }

  /**
   * Get applicable templates for a phase given current extraction state.
   *
   * Filters by trigger condition, removes already-asked questions (by tag),
   * sorts by priority, and limits to maxQuestions.
   * @param phase
   * @param extraction
   * @param alreadyAskedTags
   * @param maxQuestions
   */
  public getTemplatesForPhase(
    phase: InvestigationPhase,
    extraction: ExtractionResult,
    alreadyAskedTags: readonly string[],
    maxQuestions: number
  ): QuestionTemplate[] {
    const phaseTemplates = this.templates.get(phase);
    if (phaseTemplates === undefined) {
      return [];
    }

    const tagSet = new Set(alreadyAskedTags);

    return phaseTemplates
      .filter((t) => {
        // Check trigger condition
        const conditionFn = TRIGGER_CONDITIONS[t.condition];
        if (conditionFn === undefined) {
          return false;
        }
        if (!conditionFn(extraction)) {
          return false;
        }
        // Check deduplication by tags
        return !t.tags.some((tag) => tagSet.has(tag));
      })
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxQuestions);
  }

  /**
   * Parameterize a question template with extraction data.
   * Replaces {placeholders} with actual values from the extraction.
   * @param template
   * @param extraction
   */
  public parameterizeQuestion(template: QuestionTemplate, extraction: ExtractionResult): string {
    let question = template.question;

    const projectName = extraction.projectName ?? 'the project';
    question = question.replace(/\{projectName\}/g, projectName);
    question = question.replace(
      /\{projectDescription\}/g,
      extraction.projectDescription ?? 'not yet described'
    );

    // For requirement-specific templates, use the first matching requirement
    if (question.includes('{requirement.')) {
      const targetReq =
        template.condition === 'has.lowConfidenceRequirements'
          ? extraction.functionalRequirements.find((r) => r.confidence < 0.7)
          : extraction.functionalRequirements[0];

      if (targetReq !== undefined) {
        question = question.replace(/\{requirement\.title\}/g, targetReq.title);
        question = question.replace(/\{requirement\.id\}/g, targetReq.id);
        question = question.replace(/\{requirement\.description\}/g, targetReq.description);
      }
    }

    // For assumption-specific templates
    if (question.includes('{assumption.')) {
      const firstAssumption = extraction.assumptions[0];
      if (firstAssumption !== undefined) {
        question = question.replace(/\{assumption\.description\}/g, firstAssumption.description);
      }
    }

    return question;
  }

  /**
   * Convert a template to a full InvestigationQuestion with generated ID and round.
   * @param template
   * @param extraction
   * @param questionId
   * @param round
   */
  public templateToQuestion(
    template: QuestionTemplate,
    extraction: ExtractionResult,
    questionId: string,
    round: number
  ): InvestigationQuestion {
    const parameterizedQuestion = this.parameterizeQuestion(template, extraction);

    // Build options for ranking templates from actual requirements
    let options = template.options !== undefined ? [...template.options] : undefined;
    if (template.format === 'priority_ranking' && extraction.functionalRequirements.length >= 3) {
      options = extraction.functionalRequirements.map((r) => `${r.id}: ${r.title}`);
    }

    return {
      id: questionId,
      phase: template.phase,
      round,
      format: template.format,
      question: parameterizedQuestion,
      context: template.context,
      options,
      scaleRange:
        template.scaleRange !== undefined
          ? {
              min: template.scaleRange.min,
              max: template.scaleRange.max,
              labels: template.scaleRange.labels,
            }
          : undefined,
      required: template.required,
      relatedTo: undefined,
      category: template.category,
    };
  }

  /**
   * Get all tags from templates that have been used for a given phase list.
   * @param phases
   */
  public getTagsForPhases(phases: readonly InvestigationPhase[]): string[] {
    const tags: string[] = [];
    for (const phase of phases) {
      const phaseTemplates = this.templates.get(phase);
      if (phaseTemplates !== undefined) {
        for (const t of phaseTemplates) {
          tags.push(...t.tags);
        }
      }
    }
    return tags;
  }
}
