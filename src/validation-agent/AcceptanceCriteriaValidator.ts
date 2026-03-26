/**
 * Acceptance Criteria Validator
 *
 * Validates acceptance criteria from RTM entries against implementation
 * evidence. Determines pass/fail/untested status for each criterion
 * based on work order completion and test results.
 *
 * @module validation-agent/AcceptanceCriteriaValidator
 */

import type { RtmEntry, RtmAcceptanceCriterion } from '../rtm-builder/types.js';
import type { AcceptanceCriteriaValidationSummary, AcceptanceCriterionResult } from './types.js';

/**
 * Validates acceptance criteria from RTM entries against available evidence.
 *
 * Evidence is derived from implementation results (tests passed, build status)
 * and work order completion status attached to each RTM entry.
 */
export class AcceptanceCriteriaValidator {
  /**
   * Validate acceptance criteria from RTM entries against implementation evidence.
   *
   * For each RtmEntry, iterates over its acceptanceCriteria and determines
   * the result based on implementation status:
   * 1. If implementations exist with testsPassed=true, mark criterion as 'pass'
   * 2. If implementations exist but testsPassed=false, mark as 'fail'
   * 3. If no implementations exist, mark as 'untested'
   *
   * @param entries - RTM entries containing requirements and their acceptance criteria
   * @returns Summary of acceptance criteria validation results
   */
  validate(entries: readonly RtmEntry[]): AcceptanceCriteriaValidationSummary {
    const allResults: AcceptanceCriterionResult[] = [];
    const failedCriteria: AcceptanceCriterionResult[] = [];
    const untestedCriteria: string[] = [];

    for (const entry of entries) {
      for (const ac of entry.acceptanceCriteria) {
        const result = this.evaluateCriterion(entry, ac);
        allResults.push(result);

        if (result.result === 'fail') {
          failedCriteria.push(result);
        } else if (result.result === 'untested') {
          untestedCriteria.push(result.criterionId);
        }
      }
    }

    const totalCriteria = allResults.length;
    const validatedCriteria = allResults.filter((r) => r.result === 'pass').length;
    const passRate = totalCriteria > 0 ? (validatedCriteria / totalCriteria) * 100 : 100;

    return {
      totalCriteria,
      validatedCriteria,
      failedCriteria,
      untestedCriteria,
      passRate,
    };
  }

  /**
   * Evaluate a single acceptance criterion against implementation evidence.
   *
   * @param entry - The RTM entry containing the criterion
   * @param criterion - The acceptance criterion to evaluate
   * @returns Criterion result with pass/fail/untested determination
   */
  private evaluateCriterion(
    entry: RtmEntry,
    criterion: RtmAcceptanceCriterion
  ): AcceptanceCriterionResult {
    const { implementations } = entry;

    // No implementations => untested
    if (implementations.length === 0) {
      return {
        criterionId: criterion.id,
        requirementId: entry.requirementId,
        description: criterion.description,
        result: 'untested',
      };
    }

    // Check if any implementation has tests passed
    const anyTestsPassed = implementations.some((impl) => impl.testsPassed);
    const anyFailed = implementations.some((impl) => impl.status === 'failed' || !impl.testsPassed);

    if (anyTestsPassed && !anyFailed) {
      return {
        criterionId: criterion.id,
        requirementId: entry.requirementId,
        description: criterion.description,
        result: 'pass',
        evidence: `All ${String(implementations.length)} implementation(s) passed tests`,
      };
    }

    if (anyTestsPassed && anyFailed) {
      // Mixed results: some passed, some failed — report as fail
      const failedCount = implementations.filter(
        (impl) => impl.status === 'failed' || !impl.testsPassed
      ).length;
      return {
        criterionId: criterion.id,
        requirementId: entry.requirementId,
        description: criterion.description,
        result: 'fail',
        evidence: `${String(failedCount)} of ${String(implementations.length)} implementation(s) failed tests`,
      };
    }

    // All implementations failed
    return {
      criterionId: criterion.id,
      requirementId: entry.requirementId,
      description: criterion.description,
      result: 'fail',
      evidence: `All ${String(implementations.length)} implementation(s) failed tests`,
    };
  }
}
