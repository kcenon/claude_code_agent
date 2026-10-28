/**
 * Requirements traceability at the final validation boundary.
 *
 * When the final validation stage completes, the stage verifier builds the
 * run's requirements traceability matrix with the existing RTM builder, reading
 * the artifacts located through the run's stage manifests. The resulting record
 * names every requirement, issue, and acceptance criterion that is not
 * implemented and tested, is persisted on the stage result (session and
 * checkpoint state), and is summarized on the pipeline result.
 *
 * Roots by mode: Greenfield and Enhancement trace PRD requirements (FR-XXX)
 * through issues to the criteria those issues state; Import, which has no PRD,
 * SRS, or SDS, traces the acceptance criteria of the imported issues.
 *
 * See docs/guides/verification-policy.md.
 *
 * @module vnv/traceability
 */

import { z } from 'zod';

import type {
  PipelineMode,
  PipelineStageStatus,
  StageName,
} from '../ad-sdlc-orchestrator/types.js';
import { RtmBuilderAgent } from '../rtm-builder/RtmBuilderAgent.js';
import { RequirementsTraceabilityMatrixSchema } from '../rtm-builder/schemas.js';
import type { RequirementsTraceabilityMatrix, RtmSourceLocations } from '../rtm-builder/types.js';
import {
  IMPLEMENTATION_RESULTS,
  ISSUE_LIST,
  REVIEW_RESULTS,
  WORK_ORDERS,
} from '../stage-verifier/deliveryRules.js';
import { findArtifacts, normalizeArtifact } from '../stage-verifier/ruleSupport.js';
import type { DocumentType, VerificationOptions } from './types.js';

/** Stage whose verification builds the traceability record (all modes). */
export const TRACEABILITY_BOUNDARY_STAGE = 'validation-agent' satisfies StageName;

/** What the record's requirement roots are. */
export type TraceabilityRoots = 'prd_requirements' | 'issue_acceptance_criteria';

/**
 * Traceability of one run, persisted on the final validation stage result.
 */
export interface TraceabilityRecord {
  readonly schemaVersion: 1;
  readonly roots: TraceabilityRoots;
  /**
   * Requirements that reach no issue (`FR-001`), issues that state no
   * criteria (`ISS-002`), and criteria that are not implemented and tested
   * (`ISS-001/AC-002`), in matrix order.
   */
  readonly uncovered: readonly string[];
  /** Issues that trace back to no requirement (Greenfield and Enhancement). */
  readonly untraced: readonly string[];
  /** Artifact locations the matrix was built from */
  readonly sources: readonly string[];
  /** The matrix, including per-criterion work orders, changed files, and tests */
  readonly rtm: RequirementsTraceabilityMatrix;
}

/** Inputs for building a record. */
export interface TraceabilityInput {
  readonly projectDir: string;
  readonly projectId: string;
  readonly mode: PipelineMode;
  /** Artifact locations of every stage of the run that has completed */
  readonly artifacts: readonly string[];
}

/**
 * Locations of each document type: the scratchpad copy
 * (`documents/<project>/prd.md`) first, then a published copy
 * (`docs/prd/PRD-<project>.md`, `docs/PRD.md`). Localized `.kr.md` copies
 * are ignored.
 */
const DOCUMENT_PATTERNS: Readonly<Record<DocumentType, readonly RegExp[]>> = {
  prd: [/(?:^|\/)documents\/[^/]+\/prd\.md$/u, /(?:^|\/)PRD(?:[-_][^/]*)?\.md$/u],
  srs: [/(?:^|\/)documents\/[^/]+\/srs\.md$/u, /(?:^|\/)SRS(?:[-_][^/]*)?\.md$/u],
  sds: [/(?:^|\/)documents\/[^/]+\/sds\.md$/u, /(?:^|\/)SDS(?:[-_][^/]*)?\.md$/u],
};

/**
 * Locate the PRD, SRS, and SDS among artifact locations.
 * @param artifacts - Artifact locations
 * @returns The location of each document type found
 */
export function locateDocuments(
  artifacts: readonly string[]
): Partial<Record<DocumentType, string>> {
  const candidates = artifacts.filter(
    (artifact) => !normalizeArtifact(artifact).endsWith('.kr.md')
  );
  const documents: Partial<Record<DocumentType, string>> = {};
  for (const type of Object.keys(DOCUMENT_PATTERNS) as DocumentType[])
    for (const pattern of DOCUMENT_PATTERNS[type]) {
      const found = findArtifacts(candidates, [pattern])[0];
      if (found !== undefined) {
        documents[type] = found;
        break;
      }
    }
  return documents;
}

/**
 * Classify artifact locations into the RTM builder's source categories.
 * @param artifacts - Artifact locations of the run's completed stages
 * @returns Explicit source locations; categories with no match are empty
 */
export function traceabilitySources(artifacts: readonly string[]): RtmSourceLocations {
  const unique = [...new Set(artifacts)];
  return {
    documents: locateDocuments(unique),
    issueLists: findArtifacts(unique, ISSUE_LIST),
    workOrders: findArtifacts(unique, WORK_ORDERS),
    implementationResults: findArtifacts(unique, IMPLEMENTATION_RESULTS),
    reviews: findArtifacts(unique, REVIEW_RESULTS),
  };
}

/**
 * Requirements, issues, and criteria of a matrix that are not implemented and tested.
 * @param rtm - Requirements traceability matrix
 * @returns Uncovered identifiers in matrix order, without duplicates
 */
export function uncoveredTraceIds(rtm: RequirementsTraceabilityMatrix): string[] {
  const ids: string[] = [];
  const add = (id: string): void => {
    if (!ids.includes(id)) ids.push(id);
  };
  for (const entry of rtm.entries) {
    const issueCriteria = entry.acceptanceCriteria.filter(
      (criterion) => criterion.issueId !== undefined
    );
    if (rtm.pipelineMode !== 'import' && entry.issues.length === 0) add(entry.requirementId);
    for (const issueId of entry.issues)
      if (!issueCriteria.some((criterion) => criterion.issueId === issueId)) add(issueId);
    for (const criterion of issueCriteria)
      if (!criterion.validated) add(`${criterion.issueId ?? entry.requirementId}/${criterion.id}`);
  }
  return ids;
}

/**
 * Build the traceability record of a run from its artifacts.
 * @param input - Project, mode, and artifact locations
 * @returns Traceability record
 */
export async function buildTraceabilityRecord(
  input: TraceabilityInput
): Promise<TraceabilityRecord> {
  const sources = traceabilitySources(input.artifacts);
  const rtm = await new RtmBuilderAgent().buildRTM({
    projectDir: input.projectDir,
    projectId: input.projectId,
    pipelineMode: input.mode,
    sources,
  });
  return {
    schemaVersion: 1,
    roots: input.mode === 'import' ? 'issue_acceptance_criteria' : 'prd_requirements',
    uncovered: uncoveredTraceIds(rtm),
    untraced: rtm.gaps
      .filter((gap) => gap.type === 'orphan_issue')
      .flatMap((gap) => gap.affectedIds),
    sources: [
      ...Object.values(sources.documents ?? {}),
      ...(sources.issueLists ?? []),
      ...(sources.workOrders ?? []),
      ...(sources.implementationResults ?? []),
      ...(sources.reviews ?? []),
    ],
    rtm,
  };
}

/** Runtime schema for a persisted traceability record. */
export const TraceabilityRecordSchema = z.object({
  schemaVersion: z.literal(1),
  roots: z.enum(['prd_requirements', 'issue_acceptance_criteria']),
  uncovered: z.array(z.string()),
  untraced: z.array(z.string()),
  sources: z.array(z.string()),
  rtm: RequirementsTraceabilityMatrixSchema,
});

/**
 * Validate a persisted record. Invalid data is dropped, so the run reports
 * traceability as not evaluated rather than trusting it.
 * @param value - Persisted value
 * @returns Record, or undefined when absent or invalid
 */
export function parseTraceabilityRecord(value: unknown): TraceabilityRecord | undefined {
  const parsed = TraceabilityRecordSchema.safeParse(value);
  return parsed.success ? (parsed.data as TraceabilityRecord) : undefined;
}

/**
 * Pipeline-level traceability status.
 *
 * - `covered`: every root reaches implemented and tested acceptance criteria.
 * - `uncovered`: at least one requirement, issue, or criterion is uncovered,
 *   or the run produced nothing to trace.
 * - `not_evaluated`: the final validation stage did not complete, so no
 *   record exists.
 */
export type PipelineTraceabilityStatus = 'covered' | 'uncovered' | 'not_evaluated';

/** Traceability summary attached to `PipelineResult.traceability`. */
export interface PipelineTraceabilitySummary {
  readonly status: PipelineTraceabilityStatus;
  /** Stage whose verification built the record */
  readonly stage: StageName;
  /** Why the status is `not_evaluated`, or why a run without roots is `uncovered` */
  readonly reason?: string;
  readonly roots?: TraceabilityRoots;
  readonly uncovered: readonly string[];
  readonly untraced: readonly string[];
  readonly counts?: {
    readonly roots: number;
    readonly criteria: number;
    readonly validatedCriteria: number;
  };
  /** Project-relative RTM files written for this run (`generateRtm`) */
  readonly rtm?: { readonly json: string; readonly markdown: string };
}

/** Stage fields the summary reads. */
export interface TracedStageResult {
  readonly name: StageName;
  readonly status: PipelineStageStatus;
  readonly traceability?: TraceabilityRecord;
}

/**
 * The traceability record of a run: the one on its latest final validation result.
 * @param results - Stage results, including pre-completed results restored on resume
 * @returns Record, or undefined when none exists
 */
export function runTraceabilityRecord(
  results: readonly TracedStageResult[]
): TraceabilityRecord | undefined {
  return [...results].reverse().find((result) => result.name === TRACEABILITY_BOUNDARY_STAGE)
    ?.traceability;
}

/**
 * Summarize the run's traceability.
 * @param options - Effective V&V options
 * @param results - Stage results, including pre-completed results restored on resume
 * @param rtm - RTM files written for this run, when `generateRtm` is on
 * @returns Summary, or undefined when traceability and the RTM are both turned off
 */
export function summarizeTraceability(
  options: VerificationOptions,
  results: readonly TracedStageResult[],
  rtm?: PipelineTraceabilitySummary['rtm']
): PipelineTraceabilitySummary | undefined {
  if (!options.acceptanceCriteriaValidation && !options.generateRtm) return undefined;
  const stage = TRACEABILITY_BOUNDARY_STAGE;
  const record = runTraceabilityRecord(results);
  if (record === undefined) {
    const result = [...results].reverse().find((candidate) => candidate.name === stage);
    return {
      status: 'not_evaluated',
      stage,
      reason:
        result === undefined
          ? `Stage '${stage}' is not part of this run or was not reached`
          : `Stage '${stage}' did not complete (${result.status})`,
      uncovered: [],
      untraced: [],
    };
  }
  const criteria = record.rtm.entries.flatMap((entry) =>
    entry.acceptanceCriteria.filter((criterion) => criterion.issueId !== undefined)
  );
  const empty = record.rtm.entries.length === 0;
  return {
    status: empty || record.uncovered.length > 0 ? 'uncovered' : 'covered',
    stage,
    ...(empty ? { reason: 'No requirement or issue was found to trace' } : {}),
    roots: record.roots,
    uncovered: record.uncovered,
    untraced: record.untraced,
    counts: {
      roots: record.rtm.entries.length,
      criteria: criteria.length,
      validatedCriteria: criteria.filter((criterion) => criterion.validated).length,
    },
    ...(rtm !== undefined ? { rtm } : {}),
  };
}

/**
 * Render the RTM files of a record.
 * @param record - Traceability record
 * @returns JSON document and Markdown report
 */
export async function renderTraceabilityFiles(
  record: TraceabilityRecord
): Promise<{ readonly json: string; readonly markdown: string }> {
  const report = await new RtmBuilderAgent().generateReport(record.rtm);
  const lines = [report, '## Uncovered', ''];
  if (record.uncovered.length === 0) lines.push('None.');
  for (const id of record.uncovered) lines.push(`- ${id}`);
  if (record.untraced.length > 0) {
    lines.push('', '## Issues not traced to a requirement', '');
    for (const id of record.untraced) lines.push(`- ${id}`);
  }
  lines.push('');
  return { json: `${JSON.stringify(record, null, 2)}\n`, markdown: lines.join('\n') };
}
