/**
 * Approval policy matrix: every approval mode against every stage slot of
 * every pipeline mode, derived from the stage graphs, the agent effect table,
 * and the mode definitions. Rendered into docs/guides/approval-policy.md and
 * checked by `npm run docs:check-inventory`.
 *
 * @module ad-sdlc-orchestrator/approvalMatrix
 */

import {
  AGENT_APPROVAL_EFFECTS,
  APPROVAL_BOUNDARY_DESCRIPTIONS,
  APPROVAL_EFFECT_DESCRIPTIONS,
  APPROVAL_EFFECTS,
  APPROVAL_MODE_DEFINITIONS,
  APPROVAL_MODES,
  approvalRequirement,
  stageApprovalBoundaries,
  stageApprovalEffects,
  type ApprovalBoundary,
  type ApprovalEffect,
  type ApprovalRequirement,
} from './approvalPolicy.js';
import { buildCanonicalPlan } from './plan.js';
import type { ApprovalMode, PipelineMode, StageName } from './types.js';

const PIPELINE_MODES: readonly PipelineMode[] = ['greenfield', 'enhancement', 'import'];

/** Gate of one stage slot in one of the two plan variants. */
export interface ApprovalMatrixGate {
  readonly agentType: string;
  readonly boundaries: readonly ApprovalBoundary[];
  readonly effects: readonly ApprovalEffect[];
  /** Decision per approval mode; undefined when the stage has no boundary */
  readonly decisions: Readonly<Record<ApprovalMode, ApprovalRequirement | undefined>>;
}

/** One stage slot of the matrix. */
export interface ApprovalMatrixRow {
  readonly pipelineMode: PipelineMode;
  readonly stage: StageName;
  /** Gate with GitHub integration; undefined when the stage exists only in local mode */
  readonly github?: ApprovalMatrixGate;
  /** Gate in local mode; undefined when local mode removes the stage */
  readonly local?: ApprovalMatrixGate;
}

/**
 * Gate of a planned stage. The failed-verification boundary depends on the
 * run, so the matrix lists it separately.
 * @param stage - Planned stage
 * @returns Gate description
 */
function gateOf(stage: ReturnType<typeof buildCanonicalPlan>[number]): ApprovalMatrixGate {
  const boundaries = stageApprovalBoundaries(stage);
  return {
    agentType: stage.agentType,
    boundaries,
    effects: stageApprovalEffects(stage),
    decisions: Object.fromEntries(
      APPROVAL_MODES.map((mode) => [mode, approvalRequirement(mode, boundaries)])
    ) as Record<ApprovalMode, ApprovalRequirement | undefined>,
  };
}

/**
 * Build the matrix for every pipeline mode, with and without local mode.
 * @returns Rows in pipeline mode and graph order
 */
export function approvalPolicyMatrix(): ApprovalMatrixRow[] {
  return PIPELINE_MODES.flatMap((pipelineMode) => {
    const github = buildCanonicalPlan(pipelineMode, false);
    const local = buildCanonicalPlan(pipelineMode, true);
    const names: StageName[] = [...new Set([...github, ...local].map((stage) => stage.name))];
    return names.map((stage): ApprovalMatrixRow => {
      const githubStage = github.find((entry) => entry.name === stage);
      const localStage = local.find((entry) => entry.name === stage);
      return {
        pipelineMode,
        stage,
        ...(githubStage !== undefined ? { github: gateOf(githubStage) } : {}),
        ...(localStage !== undefined ? { local: gateOf(localStage) } : {}),
      };
    });
  });
}

/**
 * Cell text of one mode's decision.
 * @param mode - Approval mode
 * @param requirement - Decision of the mode at the stage
 * @returns `decide`, `callback`, `policy`, or `no gate`
 */
function decisionCell(mode: ApprovalMode, requirement: ApprovalRequirement | undefined): string {
  if (requirement === undefined) return 'no gate';
  if (requirement === 'policy') return 'policy';
  return APPROVAL_MODE_DEFINITIONS[mode].decider === 'callback' ? 'callback' : 'decide';
}

/**
 * Text of a matrix cell that may differ between GitHub and local mode.
 * @param row - Matrix row
 * @param pick - Cell value of one variant
 * @returns Cell text, `x (local: y)` when the variants differ
 */
function variantCell(row: ApprovalMatrixRow, pick: (gate: ApprovalMatrixGate) => string): string {
  const github = row.github === undefined ? undefined : pick(row.github);
  const local = row.local === undefined ? undefined : pick(row.local);
  if (github === undefined || local === undefined) return github ?? local ?? '';
  return github === local ? github : `${github} (local: ${local})`;
}

/**
 * Stage cell, noting a stage that only one plan variant has.
 * @param row - Matrix row
 * @returns Stage name with its variant note
 */
function stageCell(row: ApprovalMatrixRow): string {
  if (row.local === undefined) return `\`${row.stage}\` (removed in local mode)`;
  if (row.github === undefined) return `\`${row.stage}\` (local mode only)`;
  return `\`${row.stage}\``;
}

const list = (items: readonly string[]): string =>
  items.length === 0 ? 'none' : items.map((item) => `\`${item}\``).join(', ');

export const APPROVAL_POLICY_START = '<!-- generated-approval-policy:start -->';
export const APPROVAL_POLICY_END = '<!-- generated-approval-policy:end -->';

/**
 * Render the generated block embedded in docs/guides/approval-policy.md.
 * @returns Markdown block with modes, boundaries, effects, and the stage matrix
 */
export function renderApprovalPolicyBlock(): string {
  const lines = [
    APPROVAL_POLICY_START,
    '',
    '### Modes',
    '',
    '| Mode | Requests a decision at | Decided by | Semantics |',
    '| --- | --- | --- | --- |',
    ...APPROVAL_MODES.map((mode) => {
      const definition = APPROVAL_MODE_DEFINITIONS[mode];
      return `| \`${mode}\` | ${list(definition.requests)} | ${definition.decider} | ${definition.description} |`;
    }),
    '',
    '### Boundaries',
    '',
    '| Boundary | Meaning |',
    '| --- | --- |',
    ...Object.entries(APPROVAL_BOUNDARY_DESCRIPTIONS).map(
      ([boundary, description]) => `| \`${boundary}\` | ${description} |`
    ),
    '',
    '### Effects',
    '',
    '| Effect | The stage... | Declared by agents |',
    '| --- | --- | --- |',
    ...APPROVAL_EFFECTS.map((effect) => {
      const agents = Object.entries(AGENT_APPROVAL_EFFECTS)
        .filter(([, effects]) => effects.includes(effect))
        .map(([agent]) => agent);
      return `| \`${effect}\` | ${APPROVAL_EFFECT_DESCRIPTIONS[effect]} | ${list(agents)} |`;
    }),
    '',
    '### Stage matrix',
    '',
    'Each cell says what the mode does before the stage runs: `decide` (a person decides),',
    '`callback` (the custom strategy decides), `policy` (approved by policy and recorded), or',
    '`no gate`. Any stage whose dependency failed a required check without blocking also gets',
    'a `failed_verification` boundary: `auto` approves it by policy, `manual` and `critical`',
    'request a decision, and `custom` calls the strategy.',
    '',
    `| Pipeline mode | Stage | Agent | Boundaries | Effects | ${APPROVAL_MODES.map((mode) => `\`${mode}\``).join(' | ')} |`,
    `| --- | --- | --- | --- | --- | ${APPROVAL_MODES.map(() => '---').join(' | ')} |`,
  ];
  for (const row of approvalPolicyMatrix())
    lines.push(
      `| ${row.pipelineMode} | ${stageCell(row)} | ${variantCell(row, (gate) => gate.agentType)} | ${variantCell(
        row,
        (gate) => list(gate.boundaries)
      )} | ${variantCell(row, (gate) => list(gate.effects))} | ${APPROVAL_MODES.map((mode) =>
        variantCell(row, (gate) => decisionCell(mode, gate.decisions[mode]))
      ).join(' | ')} |`
    );
  lines.push('', APPROVAL_POLICY_END);
  return lines.join('\n');
}

/**
 * Replace the generated block of a document with the current rendering.
 * @param document - Document text containing the generated markers
 * @returns Updated document text
 * @throws Error when the markers are missing
 */
export function replaceApprovalPolicyBlock(document: string): string {
  const start = document.indexOf(APPROVAL_POLICY_START);
  const end = document.indexOf(APPROVAL_POLICY_END);
  if (start === -1 || end === -1 || end < start)
    throw new Error('Document has no generated approval policy markers');
  return (
    document.slice(0, start) +
    renderApprovalPolicyBlock() +
    document.slice(end + APPROVAL_POLICY_END.length)
  );
}
