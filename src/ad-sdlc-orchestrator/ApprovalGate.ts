/**
 * Approval gate logic for the AD-SDLC orchestrator.
 *
 * Encapsulates the four `ApprovalMode` strategies (`auto`, `manual`,
 * `critical`, `custom`) so the orchestrator class stays focused on
 * pipeline coordination. Extracted from `AdsdlcOrchestratorAgent` in
 * issue #799 to keep that file at or below the 950 LoC budget.
 */

import type {
  ApprovalDecision,
  ApprovalMode,
  PipelineStageDefinition,
  StageResult,
} from './types.js';

/**
 * Custom approval callback contract used when {@link ApprovalMode} is
 * `custom`. Returning `approved: false` causes the orchestrator to skip
 * the stage with the supplied reason.
 */
export type CustomApprovalFn = (
  stage: PipelineStageDefinition,
  priorResults: readonly StageResult[]
) => Promise<ApprovalDecision>;

/**
 * Default `custom` approval callback — always approves. Mirrors the
 * orchestrator's pre-#799 behaviour so existing tests that exercise
 * `approvalMode: 'custom'` without overriding {@link approveStage}
 * continue to pass.
 * @param _stage
 * @param _priorResults
 */
export const defaultCustomApproval: CustomApprovalFn = (_stage, _priorResults) => {
  return Promise.resolve({
    approved: true,
    reason: 'Custom approval (default: approved)',
    decidedBy: 'system',
    decidedAt: new Date().toISOString(),
  });
};

/**
 * Evaluate the approval gate for a stage based on the configured mode.
 *
 * - `auto`: always approves.
 * - `manual`: prompts the operator via inquirer (or denies if no TTY).
 * - `critical`: approves unless any prior stage failed.
 * - `custom`: delegates to the supplied {@link CustomApprovalFn}.
 *
 * Pure function — no orchestrator state is mutated.
 *
 * @param mode The configured approval mode.
 * @param stage The stage awaiting approval.
 * @param priorResults Results from previously executed stages.
 * @param customApproval Callback invoked when `mode === 'custom'`.
 * @returns The approval decision indicating whether the stage may proceed.
 */
export async function checkApprovalGate(
  mode: ApprovalMode,
  stage: PipelineStageDefinition,
  priorResults: readonly StageResult[],
  customApproval: CustomApprovalFn
): Promise<ApprovalDecision> {
  const now = new Date().toISOString();

  switch (mode) {
    case 'auto':
      return { approved: true, reason: 'Auto-approved', decidedBy: 'system', decidedAt: now };

    case 'manual': {
      if (!process.stdout.isTTY) {
        return {
          approved: false,
          reason:
            'Manual approval required but no interactive terminal available. ' +
            'Use --approval-mode auto or run in an interactive terminal.',
          decidedBy: 'system',
          decidedAt: now,
        };
      }
      return promptManualApproval(stage, priorResults);
    }

    case 'critical': {
      const hasPriorFailures = priorResults.some((r) => r.status === 'failed');
      if (hasPriorFailures) {
        return {
          approved: false,
          reason: 'Prior stage failures detected in critical approval mode',
          decidedBy: 'system',
          decidedAt: now,
        };
      }
      return {
        approved: true,
        reason: 'No prior failures in critical mode',
        decidedBy: 'system',
        decidedAt: now,
      };
    }

    case 'custom':
      return customApproval(stage, priorResults);
  }
}

/**
 * Prompt the user for manual approval via the interactive terminal.
 *
 * Loaded dynamically so the inquirer dependency is only imported when
 * the manual approval path actually runs — keeps cold-start cost low
 * for non-interactive (CI) pipelines.
 *
 * @param stage The stage awaiting approval.
 * @param priorResults Results from previously executed stages.
 * @returns The approval decision based on user input.
 */
async function promptManualApproval(
  stage: PipelineStageDefinition,
  priorResults: readonly StageResult[]
): Promise<ApprovalDecision> {
  const now = new Date().toISOString();
  const completedCount = priorResults.filter((r) => r.status === 'completed').length;
  const failedCount = priorResults.filter((r) => r.status === 'failed').length;

  const { default: inquirer } = await import('inquirer');
  const { confirm } = await inquirer.prompt<{ confirm: boolean }>([
    {
      type: 'confirm',
      name: 'confirm',
      message: `Approve stage "${stage.name}" (${stage.agentType})? [${String(completedCount)} completed, ${String(failedCount)} failed]`,
      default: true,
    },
  ]);

  return {
    approved: confirm,
    reason: confirm ? 'Manually approved by user' : 'Manually rejected by user',
    decidedBy: 'user',
    decidedAt: now,
  };
}
