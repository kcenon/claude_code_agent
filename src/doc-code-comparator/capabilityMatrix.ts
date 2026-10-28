/**
 * Capability matrix: what each pipeline mode delivers and which policies
 * apply, derived from the stage graphs, the approval and verification policy
 * definitions, the CLI definitions, and the canonical asset files. Rendered
 * into docs/architecture/capability-matrix.md and checked by
 * `npm run docs:check-inventory`.
 *
 * @module doc-code-comparator/capabilityMatrix
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { APPROVAL_MODES, stageApprovalEffects } from '../ad-sdlc-orchestrator/approvalPolicy.js';
import { buildCanonicalPlan } from '../ad-sdlc-orchestrator/plan.js';
import { DEFAULT_ORCHESTRATOR_CONFIG, type PipelineMode } from '../ad-sdlc-orchestrator/types.js';
import { CLI_COMMANDS } from '../completion/CompletionGenerator.js';
import { VERIFICATION_PROFILES, resolveVerificationProfile } from '../vnv/policy.js';

export const CAPABILITY_MATRIX_START = '<!-- generated-capability-matrix:start -->';
export const CAPABILITY_MATRIX_END = '<!-- generated-capability-matrix:end -->';

const PIPELINE_MODES: readonly PipelineMode[] = ['greenfield', 'enhancement', 'import'];

/** Canonical assets that `ad-sdlc init` installs in every project. */
export interface InstalledAssetCounts {
  readonly agentPrompts: number;
  readonly projectCommands: number;
}

type PlannedStage = ReturnType<typeof buildCanonicalPlan>[number];

const code = (items: readonly string[]): string =>
  items.length === 0 ? 'none' : items.map((item) => `\`${item}\``).join(', ');

/**
 * Count the canonical agent prompts and project commands of a checkout.
 * @param projectRoot - Repository root
 * @returns Markdown files in `.claude/agents` and `.claude/commands`
 */
export function countInstalledAssets(projectRoot: string): InstalledAssetCounts {
  const count = (kind: string): number => {
    const directory = join(projectRoot, '.claude', kind);
    return existsSync(directory)
      ? readdirSync(directory).filter((file) => !file.startsWith('.') && file.endsWith('.md'))
          .length
      : 0;
  };
  return { agentPrompts: count('agents'), projectCommands: count('commands') };
}

/**
 * Stages no other stage depends on: where a run of the mode ends.
 * @param plan - Planned stages
 * @returns Stage names in graph order
 */
function finalStages(plan: readonly PlannedStage[]): string[] {
  const dependedOn = new Set(plan.flatMap((stage) => stage.dependsOn));
  return plan.filter((stage) => !dependedOn.has(stage.name)).map((stage) => stage.name);
}

/**
 * Stages that open or merge a pull request, with their agent and effects.
 * @param plan - Planned stages
 * @returns Cell text, `none` without such a stage
 */
function deliveryCell(plan: readonly PlannedStage[]): string {
  const stages = plan.filter((stage) =>
    stageApprovalEffects(stage).some(
      (effect) => effect === 'open_pull_request' || effect === 'merge'
    )
  );
  if (stages.length === 0) return 'none';
  return stages
    .map((stage) => `\`${stage.name}\` (${stage.agentType}: ${code(stageApprovalEffects(stage))})`)
    .join(', ');
}

/**
 * One row of the per-mode table.
 * @param label - Row label
 * @param cell - Cell text of one mode's GitHub and local plans
 * @returns Markdown table row
 */
function modeRow(
  label: string,
  cell: (github: readonly PlannedStage[], local: readonly PlannedStage[]) => string
): string {
  const cells = PIPELINE_MODES.map((mode) =>
    cell(buildCanonicalPlan(mode, false), buildCanonicalPlan(mode, true))
  );
  return `| ${label} | ${cells.join(' | ')} |`;
}

/**
 * Render the generated block embedded in docs/architecture/capability-matrix.md.
 * @param assets - Canonical asset counts of the checkout
 * @returns Markdown block with the per-mode and the policy tables
 */
export function renderCapabilityMatrixBlock(assets: InstalledAssetCounts): string {
  const runOptions = CLI_COMMANDS.find((command) => command.name === 'run')?.options ?? [];
  const runOption = (long: string): (typeof runOptions)[number] | undefined =>
    runOptions.find((option) => option.long === long);
  const cliApprovalModes = runOption('--approval-mode')?.values ?? [];
  const supported = (long: string): string =>
    runOption(long) === undefined ? 'not supported' : `\`${long}\``;
  return [
    CAPABILITY_MATRIX_START,
    '',
    '### Pipeline modes',
    '',
    `| Capability | ${PIPELINE_MODES.join(' | ')} |`,
    `| --- | ${PIPELINE_MODES.map(() => '---').join(' | ')} |`,
    modeRow(
      'Stage slots',
      (github, local) =>
        `${String(github.length)}${local.length === github.length ? '' : ` (local: ${String(local.length)})`}`
    ),
    modeRow('Run ends after', (github) => code(finalStages(github))),
    modeRow('Verification stage', (github) =>
      code(github.filter((stage) => stage.agentType === 'validation-agent').map((s) => s.name))
    ),
    modeRow('Pull request', (github) => deliveryCell(github)),
    modeRow('Pull request in local mode', (_github, local) => deliveryCell(local)),
    modeRow('Stages removed in local mode', (github, local) =>
      code(
        github
          .filter((stage) => !local.some((entry) => entry.name === stage.name))
          .map((stage) => stage.name)
      )
    ),
    modeRow('Deployment stage', (github) =>
      code(github.filter((stage) => /deploy|release/u.test(stage.name)).map((s) => s.name))
    ),
    '',
    '### Policies and operation',
    '',
    '| Capability | Values | Default | Set with |',
    '| --- | --- | --- | --- |',
    `| Approval mode | ${APPROVAL_MODES.map((mode) =>
      cliApprovalModes.includes(mode) ? `\`${mode}\`` : `\`${mode}\` (programmatic API only)`
    ).join(
      ', '
    )} | \`${DEFAULT_ORCHESTRATOR_CONFIG.approvalMode}\` | \`--approval-mode\`, \`global.approval_mode\` |`,
    `| Verification profile | ${code(VERIFICATION_PROFILES)} | \`${resolveVerificationProfile(DEFAULT_ORCHESTRATOR_CONFIG.vnv)}\` | \`--vnv-profile\`, \`global.vnv.profile\` |`,
    `| Resume a saved session | ${supported('--resume')} | every run is saved per session | \`ad-sdlc run "<requirements>" --resume <session-id>\` |`,
    `| Stop after a stage | ${supported('--stop-after')} | run to the end | \`--stop-after <stage>\` |`,
    `| Local operation (no GitHub) | ${supported('--local')} | \`${String(DEFAULT_ORCHESTRATOR_CONFIG.localMode)}\` | \`--local\`, \`execution.local_mode\`, \`AD_SDLC_LOCAL\` |`,
    `| Installed assets | ${String(assets.agentPrompts)} agent prompts, ${String(assets.projectCommands)} project commands | same for every template | \`ad-sdlc init\`, \`ad-sdlc assets update\` |`,
    '',
    CAPABILITY_MATRIX_END,
  ].join('\n');
}

/**
 * Replace the generated block of a document with the current rendering.
 * @param document - Document text containing the generated markers
 * @param assets - Canonical asset counts of the checkout
 * @returns Updated document text
 * @throws Error when the markers are missing
 */
export function replaceCapabilityMatrixBlock(
  document: string,
  assets: InstalledAssetCounts
): string {
  const start = document.indexOf(CAPABILITY_MATRIX_START);
  const end = document.indexOf(CAPABILITY_MATRIX_END);
  if (start === -1 || end === -1 || end < start)
    throw new Error('Document has no generated capability matrix markers');
  return (
    document.slice(0, start) +
    renderCapabilityMatrixBlock(assets) +
    document.slice(end + CAPABILITY_MATRIX_END.length)
  );
}
