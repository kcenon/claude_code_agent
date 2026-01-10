/**
 * State Machine - State transition logic and validation
 *
 * Handles state transition rules, validation, and pipeline stage definitions.
 * This module is responsible for the state machine logic without persistence concerns.
 *
 * @module state-manager/StateMachine
 */

import type { ProjectState, EnhancedTransitionRule } from './types.js';

/**
 * Valid state transitions map
 *
 * Defines which state transitions are allowed in the project lifecycle.
 */
export const VALID_TRANSITIONS: ReadonlyMap<ProjectState, readonly ProjectState[]> = new Map([
  ['collecting', ['clarifying', 'prd_drafting', 'cancelled']],
  ['clarifying', ['collecting', 'prd_drafting', 'cancelled']],
  ['prd_drafting', ['prd_approved', 'collecting', 'cancelled']],
  ['prd_approved', ['srs_drafting', 'prd_drafting', 'cancelled']],
  ['srs_drafting', ['srs_approved', 'prd_approved', 'cancelled']],
  ['srs_approved', ['sds_drafting', 'srs_drafting', 'cancelled']],
  ['sds_drafting', ['sds_approved', 'srs_approved', 'cancelled']],
  ['sds_approved', ['issues_creating', 'sds_drafting', 'cancelled']],
  ['issues_creating', ['issues_created', 'sds_approved', 'cancelled']],
  ['issues_created', ['implementing', 'issues_creating', 'cancelled']],
  ['implementing', ['pr_review', 'issues_created', 'cancelled']],
  ['pr_review', ['merged', 'implementing', 'cancelled']],
  ['merged', []],
  ['cancelled', []],
]);

/**
 * Enhanced transition rules with recovery paths, skip capability, and stage requirements
 *
 * Defines extended transition rules that include:
 * - Normal flow: standard forward transitions
 * - Recovery flow: allowed backward transitions for error recovery
 * - Skip-to: states that can be skipped to (for optional stages)
 * - Required flag: whether the stage is mandatory
 * - Min completion: minimum % to proceed from partial state
 */
export const ENHANCED_TRANSITIONS: ReadonlyMap<ProjectState, EnhancedTransitionRule> = new Map([
  [
    'collecting',
    {
      normal: ['clarifying', 'prd_drafting'],
      recovery: [],
      skipTo: ['prd_drafting'],
      required: true,
    },
  ],
  [
    'clarifying',
    {
      normal: ['prd_drafting'],
      recovery: ['collecting'],
      skipTo: [],
      required: false,
    },
  ],
  [
    'prd_drafting',
    {
      normal: ['prd_approved'],
      recovery: ['collecting', 'clarifying'],
      skipTo: [],
      required: true,
    },
  ],
  [
    'prd_approved',
    {
      normal: ['srs_drafting'],
      recovery: ['prd_drafting', 'clarifying'],
      skipTo: ['sds_drafting'],
      required: true,
    },
  ],
  [
    'srs_drafting',
    {
      normal: ['srs_approved'],
      recovery: ['prd_approved', 'prd_drafting'],
      skipTo: ['sds_drafting'],
      required: false,
      minCompletion: 50,
    },
  ],
  [
    'srs_approved',
    {
      normal: ['sds_drafting'],
      recovery: ['srs_drafting', 'prd_approved'],
      skipTo: ['issues_creating'],
      required: false,
    },
  ],
  [
    'sds_drafting',
    {
      normal: ['sds_approved'],
      recovery: ['srs_approved', 'srs_drafting'],
      skipTo: ['issues_creating'],
      required: false,
      minCompletion: 50,
    },
  ],
  [
    'sds_approved',
    {
      normal: ['issues_creating'],
      recovery: ['sds_drafting', 'srs_approved'],
      skipTo: [],
      required: false,
    },
  ],
  [
    'issues_creating',
    {
      normal: ['issues_created'],
      recovery: ['sds_approved', 'srs_approved'],
      skipTo: [],
      required: true,
    },
  ],
  [
    'issues_created',
    {
      normal: ['implementing'],
      recovery: ['issues_creating', 'sds_approved'],
      skipTo: [],
      required: true,
    },
  ],
  [
    'implementing',
    {
      normal: ['pr_review'],
      recovery: ['issues_created', 'issues_creating'],
      skipTo: [],
      required: true,
      minCompletion: 25,
    },
  ],
  [
    'pr_review',
    {
      normal: ['merged'],
      recovery: ['implementing', 'issues_created'],
      skipTo: [],
      required: true,
    },
  ],
  [
    'merged',
    {
      normal: [],
      recovery: [],
      skipTo: [],
      required: true,
    },
  ],
  [
    'cancelled',
    {
      normal: [],
      recovery: [],
      skipTo: [],
      required: false,
    },
  ],
]);

/**
 * Ordered list of pipeline stages for calculating skip ranges
 */
export const PIPELINE_STAGES: readonly ProjectState[] = [
  'collecting',
  'clarifying',
  'prd_drafting',
  'prd_approved',
  'srs_drafting',
  'srs_approved',
  'sds_drafting',
  'sds_approved',
  'issues_creating',
  'issues_created',
  'implementing',
  'pr_review',
  'merged',
];

/**
 * Interface for state machine operations
 */
export interface IStateMachine {
  isValidTransition(from: ProjectState, to: ProjectState): boolean;
  getValidTransitions(from: ProjectState): readonly ProjectState[];
  getEnhancedTransitionRule(state: ProjectState): EnhancedTransitionRule | undefined;
  isStageRequired(state: ProjectState): boolean;
  getSkipOptions(from: ProjectState): readonly ProjectState[];
  getRecoveryOptions(from: ProjectState): readonly ProjectState[];
  getStagesBetween(from: ProjectState, to: ProjectState): ProjectState[];
}

/**
 * StateMachine class for managing state transition logic
 *
 * This class encapsulates all state transition validation and rules
 * without any persistence or I/O concerns.
 */
export class StateMachine implements IStateMachine {
  /**
   * Check if a state transition is valid
   *
   * @param from - Source state
   * @param to - Target state
   * @returns True if transition is valid
   */
  isValidTransition(from: ProjectState, to: ProjectState): boolean {
    const validTargets = VALID_TRANSITIONS.get(from);
    return validTargets !== undefined && validTargets.includes(to);
  }

  /**
   * Get allowed transitions from a state
   *
   * @param from - Source state
   * @returns Array of valid target states
   */
  getValidTransitions(from: ProjectState): readonly ProjectState[] {
    return VALID_TRANSITIONS.get(from) ?? [];
  }

  /**
   * Get the enhanced transition rule for a state
   *
   * @param state - State to get rule for
   * @returns Enhanced transition rule or undefined
   */
  getEnhancedTransitionRule(state: ProjectState): EnhancedTransitionRule | undefined {
    return ENHANCED_TRANSITIONS.get(state);
  }

  /**
   * Check if a stage is required
   *
   * @param state - State to check
   * @returns True if the stage is required
   */
  isStageRequired(state: ProjectState): boolean {
    const rule = ENHANCED_TRANSITIONS.get(state);
    return rule?.required === true;
  }

  /**
   * Get skip-to options for a state
   *
   * @param from - Current state
   * @returns Array of states that can be skipped to
   */
  getSkipOptions(from: ProjectState): readonly ProjectState[] {
    const rule = ENHANCED_TRANSITIONS.get(from);
    return rule?.skipTo ?? [];
  }

  /**
   * Get recovery options for current state
   *
   * @param from - Current state
   * @returns Array of valid recovery states
   */
  getRecoveryOptions(from: ProjectState): readonly ProjectState[] {
    const rule = ENHANCED_TRANSITIONS.get(from);
    return rule?.recovery ?? [];
  }

  /**
   * Get the stages between two states in the pipeline
   *
   * @param from - Starting state
   * @param to - Target state
   * @returns Array of states between from and to (exclusive)
   */
  getStagesBetween(from: ProjectState, to: ProjectState): ProjectState[] {
    const fromIdx = PIPELINE_STAGES.indexOf(from);
    const toIdx = PIPELINE_STAGES.indexOf(to);

    if (fromIdx === -1 || toIdx === -1 || fromIdx >= toIdx) {
      return [];
    }

    return [...PIPELINE_STAGES.slice(fromIdx + 1, toIdx)];
  }

  /**
   * Check if skip is allowed from one state to another
   *
   * @param from - Current state
   * @param to - Target state to skip to
   * @returns True if skip is allowed
   */
  canSkipTo(from: ProjectState, to: ProjectState): boolean {
    const rule = ENHANCED_TRANSITIONS.get(from);
    return rule !== undefined && rule.skipTo.includes(to);
  }

  /**
   * Check if recovery transition is allowed
   *
   * @param from - Current state
   * @param to - Target recovery state
   * @returns True if recovery is allowed
   */
  canRecoverTo(from: ProjectState, to: ProjectState): boolean {
    const rule = ENHANCED_TRANSITIONS.get(from);
    return rule !== undefined && rule.recovery.includes(to);
  }
}
