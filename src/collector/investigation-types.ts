/**
 * Investigation Engine Type Definitions and Zod Schemas
 *
 * Types for the multi-round investigation system that conducts structured
 * requirements elicitation before PRD generation.
 *
 * @module collector/investigation-types
 */

import { z } from 'zod';

// =============================================================================
// Investigation Depth
// =============================================================================

/**
 * Investigation depth controlling the number of rounds and phases.
 *
 * - `thorough`: 6 phases, up to 40 questions. Full deep-dive investigation.
 * - `standard`: 3 phases, up to 20 questions. Balanced investigation.
 * - `quick`:    1 phase, up to 5 questions. Basic clarification (legacy behavior).
 */
export const InvestigationDepthSchema = z.enum(['thorough', 'standard', 'quick']);
export type InvestigationDepth = z.infer<typeof InvestigationDepthSchema>;

// =============================================================================
// Question Format
// =============================================================================

/**
 * Supported question formats for investigation.
 *
 * - `free_text`:         Open-ended text answer
 * - `single_select`:     Choose one from options
 * - `multi_select`:      Choose multiple from options
 * - `yes_no`:            Binary yes/no
 * - `priority_ranking`:  Rank items by priority
 * - `confirmation`:      Verify extracted data (agree/disagree/modify)
 * - `scale_rating`:      Rate on a numeric scale
 */
export const InvestigationQuestionFormatSchema = z.enum([
  'free_text',
  'single_select',
  'multi_select',
  'yes_no',
  'priority_ranking',
  'confirmation',
  'scale_rating',
]);
export type InvestigationQuestionFormat = z.infer<typeof InvestigationQuestionFormatSchema>;

// =============================================================================
// Investigation Phase
// =============================================================================

/**
 * Investigation phases. Different depth levels use different phase sets.
 *
 * Thorough (6): project_vision → user_analysis → functional_deep_dive →
 *               nonfunctional_analysis → constraints_risks → validation_synthesis
 * Standard (3): core_discovery → requirements_analysis → constraints_validation
 * Quick (1):    basic_clarification
 */
export const InvestigationPhaseSchema = z.enum([
  // Thorough phases
  'project_vision',
  'user_analysis',
  'functional_deep_dive',
  'nonfunctional_analysis',
  'constraints_risks',
  'validation_synthesis',
  // Standard phases
  'core_discovery',
  'requirements_analysis',
  'constraints_validation',
  // Quick phase
  'basic_clarification',
]);
export type InvestigationPhase = z.infer<typeof InvestigationPhaseSchema>;

// =============================================================================
// Scale Range
// =============================================================================

export const ScaleRangeSchema = z.object({
  min: z.number().int(),
  max: z.number().int(),
  labels: z
    .object({
      min: z.string(),
      max: z.string(),
    })
    .optional(),
});
export type ScaleRange = z.infer<typeof ScaleRangeSchema>;

// =============================================================================
// Investigation Question Category
// =============================================================================

export const InvestigationCategorySchema = z.enum([
  'requirement',
  'constraint',
  'assumption',
  'priority',
  'scope',
  'architecture',
  'stakeholder',
  'timeline',
  'quality',
  'risk',
]);
export type InvestigationCategory = z.infer<typeof InvestigationCategorySchema>;

// =============================================================================
// Investigation Question
// =============================================================================

export const InvestigationQuestionSchema = z.object({
  /** Unique question ID (e.g., IQ-VIS-001) */
  id: z.string().min(1),
  /** Investigation phase this question belongs to */
  phase: InvestigationPhaseSchema,
  /** Round number within the investigation */
  round: z.number().int().min(1),
  /** Question format determining answer type */
  format: InvestigationQuestionFormatSchema,
  /** The question text */
  question: z.string().min(1),
  /** Context explaining why this question matters */
  context: z.string(),
  /** Predefined options for select/ranking formats */
  options: z.array(z.string()).optional(),
  /** Scale range for scale_rating format */
  scaleRange: ScaleRangeSchema.optional(),
  /** Whether this question must be answered */
  required: z.boolean(),
  /** Related artifact ID (e.g., FR-001, CON-002) */
  relatedTo: z.string().optional(),
  /** Question category */
  category: InvestigationCategorySchema,
});
export type InvestigationQuestion = z.infer<typeof InvestigationQuestionSchema>;

// =============================================================================
// Investigation Answer
// =============================================================================

export const InvestigationAnswerSchema = z.object({
  /** ID of the question being answered */
  questionId: z.string().min(1),
  /** Primary text answer (serialized for complex formats) */
  answer: z.string(),
  /** Selected options for multi_select format */
  selectedOptions: z.array(z.string()).optional(),
  /** Numeric value for scale_rating format */
  scaleValue: z.number().optional(),
  /** Ordered items for priority_ranking format */
  rankings: z.array(z.string()).optional(),
  /** When the answer was provided */
  answeredAt: z.string(),
});
export type InvestigationAnswer = z.infer<typeof InvestigationAnswerSchema>;

// =============================================================================
// Investigation Round
// =============================================================================

export const InvestigationRoundSchema = z.object({
  /** Round number (1-based) */
  roundNumber: z.number().int().min(1),
  /** Phase this round belongs to */
  phase: InvestigationPhaseSchema,
  /** Questions generated for this round */
  questions: z.array(InvestigationQuestionSchema),
  /** Answers collected for this round */
  answers: z.array(InvestigationAnswerSchema),
  /** When this round started */
  startedAt: z.string(),
  /** When this round completed */
  completedAt: z.string().optional(),
  /** Extraction confidence before this round */
  confidenceBefore: z.number().min(0).max(1),
  /** Extraction confidence after this round */
  confidenceAfter: z.number().min(0).max(1).optional(),
});
export type InvestigationRound = z.infer<typeof InvestigationRoundSchema>;

// =============================================================================
// Investigation Status
// =============================================================================

export const InvestigationStatusSchema = z.enum(['pending', 'in_progress', 'completed', 'skipped']);
export type InvestigationStatus = z.infer<typeof InvestigationStatusSchema>;

// =============================================================================
// Investigation State
// =============================================================================

export const InvestigationStateSchema = z.object({
  /** Depth level for this investigation */
  depth: InvestigationDepthSchema,
  /** Current round number (0 = not started) */
  currentRound: z.number().int().min(0),
  /** Maximum rounds allowed */
  maxRounds: z.number().int().min(1),
  /** Ordered list of phases for this depth */
  phases: z.array(InvestigationPhaseSchema),
  /** Completed and in-progress rounds */
  rounds: z.array(InvestigationRoundSchema),
  /** Current investigation status */
  status: InvestigationStatusSchema,
  /** When investigation started */
  startedAt: z.string().optional(),
  /** When investigation completed */
  completedAt: z.string().optional(),
});
export type InvestigationState = z.infer<typeof InvestigationStateSchema>;

// =============================================================================
// Investigation Engine Config
// =============================================================================

export const InvestigationEngineConfigSchema = z.object({
  /** Investigation depth level */
  depth: InvestigationDepthSchema.default('standard'),
  /** Maximum questions per round */
  maxQuestionsPerRound: z.number().int().min(1).max(10).default(5),
  /** Target confidence to stop investigation (if earlyExit enabled) */
  confidenceTarget: z.number().min(0).max(1).default(0.85),
  /** Allow early termination when confidence target is met */
  earlyExitOnHighConfidence: z.boolean().default(true),
  /** Enable LLM-based question generation (falls back to templates if false) */
  enableLLMQuestions: z.boolean().default(true),
});
export type InvestigationEngineConfig = z.infer<typeof InvestigationEngineConfigSchema>;

// =============================================================================
// Investigation Phase Config
// =============================================================================

export const InvestigationPhaseConfigSchema = z.object({
  /** Phase identifier */
  phase: InvestigationPhaseSchema,
  /** Human-readable display name */
  displayName: z.string(),
  /** Description of what this phase investigates */
  description: z.string(),
  /** Order within the investigation (1-based) */
  order: z.number().int().min(1),
  /** Maximum questions for this phase */
  maxQuestions: z.number().int().min(1).max(10),
  /** Focus areas for this phase */
  focusAreas: z.array(z.string()),
});
export type InvestigationPhaseConfig = z.infer<typeof InvestigationPhaseConfigSchema>;

// =============================================================================
// Investigation Metadata (stored in CollectedInfo)
// =============================================================================

export const InvestigationMetadataSchema = z.object({
  /** Depth level used */
  depth: InvestigationDepthSchema,
  /** Number of rounds completed */
  roundsCompleted: z.number().int().min(0),
  /** Total questions asked across all rounds */
  totalQuestions: z.number().int().min(0),
  /** Total answers received */
  totalAnswers: z.number().int().min(0),
  /** Confidence gain from investigation (after - before) */
  confidenceGain: z.number().min(0).max(1),
  /** Phases that were executed */
  phasesCompleted: z.array(InvestigationPhaseSchema),
});
export type InvestigationMetadata = z.infer<typeof InvestigationMetadataSchema>;

// =============================================================================
// Phase Registry - Maps depth to phases
// =============================================================================

/** Thorough mode phases (6 rounds) */
export const THOROUGH_PHASES: readonly InvestigationPhaseConfig[] = [
  {
    phase: 'project_vision',
    displayName: 'Project Vision',
    description: 'Establish project purpose, stakeholders, and success criteria',
    order: 1,
    maxQuestions: 7,
    focusAreas: ['purpose', 'stakeholders', 'project_type', 'success_metrics', 'timeline'],
  },
  {
    phase: 'user_analysis',
    displayName: 'User Analysis',
    description: 'Identify end users, personas, workflows, and interaction patterns',
    order: 2,
    maxQuestions: 6,
    focusAreas: ['user_personas', 'workflows', 'interaction_patterns', 'roles', 'accessibility'],
  },
  {
    phase: 'functional_deep_dive',
    displayName: 'Functional Deep-Dive',
    description:
      'Examine each requirement in detail: acceptance criteria, edge cases, dependencies',
    order: 3,
    maxQuestions: 7,
    focusAreas: ['acceptance_criteria', 'edge_cases', 'priority', 'dependencies', 'scope'],
  },
  {
    phase: 'nonfunctional_analysis',
    displayName: 'Non-Functional Analysis',
    description: 'Performance, security, scalability, usability, reliability requirements',
    order: 4,
    maxQuestions: 6,
    focusAreas: [
      'performance',
      'security',
      'scalability',
      'usability',
      'reliability',
      'maintainability',
    ],
  },
  {
    phase: 'constraints_risks',
    displayName: 'Constraints & Risks',
    description:
      'Technical, business, regulatory constraints; assumption validation; risk identification',
    order: 5,
    maxQuestions: 6,
    focusAreas: [
      'technical_constraints',
      'business_constraints',
      'regulatory',
      'assumptions',
      'risks',
      'dependencies',
    ],
  },
  {
    phase: 'validation_synthesis',
    displayName: 'Validation & Synthesis',
    description:
      'Final priority confirmation, scope boundaries, conflict resolution, completeness check',
    order: 6,
    maxQuestions: 5,
    focusAreas: [
      'priority_confirmation',
      'scope_boundary',
      'conflicts',
      'completeness',
      'final_approval',
    ],
  },
];

/** Standard mode phases (3 rounds) */
export const STANDARD_PHASES: readonly InvestigationPhaseConfig[] = [
  {
    phase: 'core_discovery',
    displayName: 'Core Discovery',
    description: 'Project vision, stakeholders, key users, and primary use cases',
    order: 1,
    maxQuestions: 7,
    focusAreas: ['purpose', 'stakeholders', 'users', 'use_cases', 'project_type'],
  },
  {
    phase: 'requirements_analysis',
    displayName: 'Requirements Analysis',
    description: 'Functional requirements detail, NFR coverage, acceptance criteria',
    order: 2,
    maxQuestions: 7,
    focusAreas: ['acceptance_criteria', 'priority', 'nfr_coverage', 'edge_cases'],
  },
  {
    phase: 'constraints_validation',
    displayName: 'Constraints & Validation',
    description: 'Key constraints, assumption validation, scope confirmation, final gap check',
    order: 3,
    maxQuestions: 5,
    focusAreas: ['constraints', 'assumptions', 'scope', 'completeness', 'final_approval'],
  },
];

/** Quick mode phases (1 round) */
export const QUICK_PHASES: readonly InvestigationPhaseConfig[] = [
  {
    phase: 'basic_clarification',
    displayName: 'Basic Clarification',
    description: 'Critical missing information and basic clarification only',
    order: 1,
    maxQuestions: 5,
    focusAreas: ['project_name', 'critical_gaps', 'basic_nfr'],
  },
];

/**
 * Get phases configuration for a given depth level.
 * @param depth
 */
export function getPhasesForDepth(depth: InvestigationDepth): readonly InvestigationPhaseConfig[] {
  switch (depth) {
    case 'thorough':
      return THOROUGH_PHASES;
    case 'standard':
      return STANDARD_PHASES;
    case 'quick':
      return QUICK_PHASES;
  }
}

/**
 * Get maximum total questions for a given depth level.
 * @param depth
 */
export function getMaxTotalQuestions(depth: InvestigationDepth): number {
  switch (depth) {
    case 'thorough':
      return 40;
    case 'standard':
      return 20;
    case 'quick':
      return 5;
  }
}

/**
 * Get confidence target for a given depth level.
 * @param depth
 */
export function getDefaultConfidenceTarget(depth: InvestigationDepth): number {
  switch (depth) {
    case 'thorough':
      return 0.9;
    case 'standard':
      return 0.8;
    case 'quick':
      return 0.7;
  }
}

/**
 * Whether early exit is allowed for a given depth level.
 * @param depth
 */
export function isEarlyExitAllowed(depth: InvestigationDepth): boolean {
  return depth !== 'thorough';
}
