/**
 * Verification applicability inventory.
 *
 * Every stage slot of every canonical mode graph resolves to exactly one
 * disposition: a named check set from `VERIFICATION_CHECK_SETS`, or an
 * explicit `not_applicable` record with a documented reason. The inventory
 * check fails when a mode graph gains a stage without a disposition, so a new
 * stage cannot silently pass verification by having no rules.
 *
 * The generated block in `docs/architecture/verification-coverage.md` is
 * rendered from this table and kept current by `npm run docs:check-inventory`.
 *
 * @module stage-verifier/applicability
 */

import {
  ENHANCEMENT_STAGES,
  GREENFIELD_STAGES,
  IMPORT_STAGES,
  type EnhancementStageName,
  type GreenfieldStageName,
  type ImportStageName,
  type PipelineMode,
  type StageName,
} from '../ad-sdlc-orchestrator/types.js';
import { VERIFICATION_CHECK_SETS, type VerificationCheckSetId } from './rules.js';
import type { VerificationRule } from './types.js';

/** A stage slot verified by a named check set. */
export interface CheckSetDisposition {
  readonly kind: 'checks';
  readonly checkSet: VerificationCheckSetId;
}

/** A stage slot that is explicitly not verified, with the reason. */
export interface NotApplicableDisposition {
  readonly kind: 'not_applicable';
  readonly reason: string;
}

/** Verification disposition of one stage slot. */
export type StageVerificationDisposition = CheckSetDisposition | NotApplicableDisposition;

const checks = (checkSet: VerificationCheckSetId): CheckSetDisposition => ({
  kind: 'checks',
  checkSet,
});
const notApplicable = (reason: string): NotApplicableDisposition => ({
  kind: 'not_applicable',
  reason,
});

const ANALYSIS_INPUT =
  'Analysis input for later stages. Its required output file is enforced by the artifact manifest contract, and no delivery claim rests on its content.';
const APPROVAL_DOCUMENT =
  'Planning document reviewed at its approval gate. It does not gate delivery, and no machine-checkable content contract is defined for it.';

/**
 * Disposition of every stage slot, per canonical mode. The mapped types make
 * a missing stage name a compile error; `checkVerificationInventory` also
 * checks the runtime graphs, including stages added without a type change.
 */
export const VERIFICATION_APPLICABILITY: {
  readonly greenfield: Readonly<Record<GreenfieldStageName, StageVerificationDisposition>>;
  readonly enhancement: Readonly<Record<EnhancementStageName, StageVerificationDisposition>>;
  readonly import: Readonly<Record<ImportStageName, StageVerificationDisposition>>;
} = {
  greenfield: {
    initialization: notApplicable(
      'Creates the scratchpad directory, which the artifact manifest contract already requires. It makes no delivery claim.'
    ),
    mode_detection: notApplicable(
      'Routing decision only. CLI runs select the mode before execution, and the stage delivers no artifact.'
    ),
    collection: checks('collected-info'),
    prd_generation: checks('prd-document'),
    srs_generation: checks('srs-document'),
    sdp_generation: notApplicable(APPROVAL_DOCUMENT),
    repo_detection: notApplicable(
      'Detection result used only to choose repository setup. The stage delivers no artifact.'
    ),
    github_repo_setup: notApplicable(
      'Creates an external GitHub repository. The stage verifier checks project files only; the repository is visible in GitHub. Removed in local mode.'
    ),
    sds_generation: checks('sds-document'),
    ui_spec_generation: notApplicable(
      'Conditional design document (skipped for CLI, API, and library projects) reviewed at its approval gate. It does not gate delivery.'
    ),
    threat_modeling: notApplicable(APPROVAL_DOCUMENT),
    tech_decisions: notApplicable(APPROVAL_DOCUMENT),
    issue_generation: checks('generated-issues'),
    svp_generation: notApplicable(
      'Verification plan document reviewed at its approval gate. Test evidence is checked at implementation, validation, and review.'
    ),
    orchestration: checks('work-orders'),
    implementation: checks('implementation-results'),
    'validation-agent': checks('validation-report'),
    review: checks('review-result'),
    doc_indexing: notApplicable(
      'Documentation index built after review. Its manifest output is enforced by the artifact contract, and it does not gate delivery.'
    ),
  },
  enhancement: {
    document_reading: notApplicable(ANALYSIS_INPUT),
    codebase_analysis: notApplicable(ANALYSIS_INPUT),
    code_reading: notApplicable(ANALYSIS_INPUT),
    doc_code_comparison: notApplicable(ANALYSIS_INPUT),
    impact_analysis: notApplicable(
      'Impact report reviewed at its approval gate. Its required output file is enforced by the artifact manifest contract.'
    ),
    prd_update: checks('prd-document'),
    srs_update: checks('srs-document'),
    sds_update: checks('sds-document'),
    issue_generation: checks('generated-issues'),
    orchestration: checks('work-orders'),
    implementation: checks('implementation-results'),
    regression_testing: checks('regression-report'),
    'validation-agent': checks('validation-report'),
    review: checks('review-result'),
    doc_indexing: notApplicable(
      'Documentation index built after review. Its manifest output is enforced by the artifact contract, and it does not gate delivery.'
    ),
  },
  import: {
    issue_reading: checks('imported-issues'),
    orchestration: checks('work-orders'),
    implementation: checks('implementation-results'),
    'validation-agent': checks('validation-report'),
    review: checks('review-result'),
  },
};

/** The canonical stage graphs the inventory must cover. */
export const CANONICAL_STAGE_GRAPHS: Readonly<
  Record<PipelineMode, readonly { readonly name: StageName }[]>
> = {
  greenfield: GREENFIELD_STAGES,
  enhancement: ENHANCEMENT_STAGES,
  import: IMPORT_STAGES,
};

/** Loosely typed inventory shape, so tests can inject graphs and tables. */
export type VerificationApplicabilityTable = Readonly<
  Record<PipelineMode, Readonly<Record<string, StageVerificationDisposition>>>
>;

/**
 * Look up the disposition of a stage slot.
 * @param mode - Pipeline mode
 * @param stage - Stage name
 * @param table - Applicability table (defaults to the canonical inventory)
 * @returns The disposition, or undefined when the slot is unclassified
 */
export function verificationDisposition(
  mode: PipelineMode,
  stage: string,
  table: VerificationApplicabilityTable = VERIFICATION_APPLICABILITY
): StageVerificationDisposition | undefined {
  const modeTable = table[mode];
  return Object.hasOwn(modeTable, stage) ? modeTable[stage] : undefined;
}

/**
 * Rules of a named check set.
 * @param checkSet - Check set identifier
 * @returns Rules in declaration order, or undefined for an unknown identifier
 */
export function verificationCheckSet(checkSet: string): readonly VerificationRule[] | undefined {
  return Object.hasOwn(VERIFICATION_CHECK_SETS, checkSet)
    ? VERIFICATION_CHECK_SETS[checkSet as VerificationCheckSetId]
    : undefined;
}

/** One failed inventory invariant. */
export interface VerificationInventoryViolation {
  readonly code:
    'missing_disposition' | 'unknown_check_set' | 'missing_reason' | 'stale_disposition';
  readonly mode: PipelineMode;
  readonly stage: string;
  readonly message: string;
}

/**
 * Check that every stage slot has a valid disposition and that the table has
 * no entries for stages absent from the graphs.
 * @param graphs - Mode graphs to cover
 * @param table - Applicability table
 * @returns Violations; empty when the inventory is complete
 */
export function checkVerificationInventory(
  graphs: Readonly<
    Record<PipelineMode, readonly { readonly name: string }[]>
  > = CANONICAL_STAGE_GRAPHS,
  table: VerificationApplicabilityTable = VERIFICATION_APPLICABILITY
): VerificationInventoryViolation[] {
  const violations: VerificationInventoryViolation[] = [];
  for (const mode of Object.keys(graphs) as PipelineMode[]) {
    const names = new Set(graphs[mode].map((stage) => stage.name));
    for (const stage of names) {
      const disposition = verificationDisposition(mode, stage, table);
      if (disposition === undefined)
        violations.push({
          code: 'missing_disposition',
          mode,
          stage,
          message: `Stage '${stage}' in ${mode} mode has no verification disposition; add a check set or a not_applicable reason to VERIFICATION_APPLICABILITY`,
        });
      else if (
        disposition.kind === 'checks' &&
        verificationCheckSet(disposition.checkSet) === undefined
      )
        violations.push({
          code: 'unknown_check_set',
          mode,
          stage,
          message: `Stage '${stage}' in ${mode} mode refers to unknown check set '${disposition.checkSet}'`,
        });
      else if (disposition.kind === 'not_applicable' && disposition.reason.trim() === '')
        violations.push({
          code: 'missing_reason',
          mode,
          stage,
          message: `Stage '${stage}' in ${mode} mode is not_applicable without a documented reason`,
        });
    }
    for (const stage of Object.keys(table[mode]))
      if (!names.has(stage))
        violations.push({
          code: 'stale_disposition',
          mode,
          stage,
          message: `VERIFICATION_APPLICABILITY lists '${stage}' for ${mode} mode, but the ${mode} graph has no such stage`,
        });
  }
  return violations;
}

/** Coverage counts for one mode. */
export interface VerificationCoverage {
  readonly mode: PipelineMode;
  readonly stageSlots: number;
  readonly checkSetSlots: number;
  readonly notApplicableSlots: number;
}

/**
 * Count dispositions per mode for the generated coverage document.
 * @returns Coverage in mode order (greenfield, enhancement, import)
 */
export function verificationCoverage(): VerificationCoverage[] {
  return (Object.keys(CANONICAL_STAGE_GRAPHS) as PipelineMode[]).map((mode) => {
    const dispositions = CANONICAL_STAGE_GRAPHS[mode].map((stage) =>
      verificationDisposition(mode, stage.name)
    );
    return {
      mode,
      stageSlots: dispositions.length,
      checkSetSlots: dispositions.filter((d) => d?.kind === 'checks').length,
      notApplicableSlots: dispositions.filter((d) => d?.kind === 'not_applicable').length,
    };
  });
}

export const VERIFICATION_COVERAGE_START = '<!-- generated-verification-coverage:start -->';
export const VERIFICATION_COVERAGE_END = '<!-- generated-verification-coverage:end -->';

/**
 * Render the generated block embedded in docs/architecture/verification-coverage.md.
 * @returns Markdown block with coverage counts, stage dispositions, and check sets
 */
export function renderVerificationCoverageBlock(): string {
  const lines = [
    VERIFICATION_COVERAGE_START,
    '',
    '### Coverage by mode',
    '',
    '| Mode | Stage slots | Named check sets | Not applicable |',
    '| --- | ---: | ---: | ---: |',
    ...verificationCoverage().map(
      (c) =>
        `| ${c.mode} | ${String(c.stageSlots)} | ${String(c.checkSetSlots)} | ${String(c.notApplicableSlots)} |`
    ),
    '',
    '### Stage dispositions',
    '',
    '| Mode | Stage | Disposition | Check set or reason |',
    '| --- | --- | --- | --- |',
  ];
  for (const mode of Object.keys(CANONICAL_STAGE_GRAPHS) as PipelineMode[])
    for (const stage of CANONICAL_STAGE_GRAPHS[mode]) {
      const disposition = verificationDisposition(mode, stage.name);
      const detail =
        disposition === undefined
          ? 'missing'
          : disposition.kind === 'checks'
            ? `\`${disposition.checkSet}\``
            : disposition.reason;
      lines.push(`| ${mode} | \`${stage.name}\` | ${disposition?.kind ?? 'missing'} | ${detail} |`);
    }
  lines.push(
    '',
    '### Check sets',
    '',
    'Required checks are the `error`-severity checks that run at the effective rigor.',
    '',
    '| Check set | Check | Name | Severity | Minimum rigor |',
    '| --- | --- | --- | --- | --- |'
  );
  for (const [checkSet, rules] of Object.entries(VERIFICATION_CHECK_SETS))
    for (const rule of rules as readonly VerificationRule[])
      lines.push(
        `| \`${checkSet}\` | ${rule.checkId} | ${rule.name} | ${rule.severity} | ${rule.minRigor} |`
      );
  lines.push('', VERIFICATION_COVERAGE_END);
  return lines.join('\n');
}

/**
 * Replace the generated coverage block of a document with the current rendering.
 * @param document - Document text containing the generated markers
 * @returns Updated document text
 * @throws Error when the markers are missing
 */
export function replaceVerificationCoverageBlock(document: string): string {
  const start = document.indexOf(VERIFICATION_COVERAGE_START);
  const end = document.indexOf(VERIFICATION_COVERAGE_END);
  if (start === -1 || end === -1 || end < start)
    throw new Error('Document has no generated verification coverage markers');
  return (
    document.slice(0, start) +
    renderVerificationCoverageBlock() +
    document.slice(end + VERIFICATION_COVERAGE_END.length)
  );
}
