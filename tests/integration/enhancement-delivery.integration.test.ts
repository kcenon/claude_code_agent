/**
 * Orchestrator integration: every Enhancement stage on the production path (#957).
 *
 * A paid run should not be the first time the 15 stages run together. A scripted
 * SDK writes exactly what each agent definition documents, in the project of the
 * Enhancement live fixture, and reports each file through the production capture
 * hooks. The real AdsdlcOrchestratorAgent, SdkExecutionAdapter, manifests, and
 * StageVerifierAgent do the rest, with the real agent definitions installed.
 *
 * This proves that the pipeline accepts what the definitions say. It does not
 * prove that a model writes it: only the live lane measures that.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';

import { AdsdlcOrchestratorAgent } from '../../src/ad-sdlc-orchestrator/AdsdlcOrchestratorAgent.js';
import { PipelineFailedError } from '../../src/ad-sdlc-orchestrator/errors.js';
import {
  ENHANCEMENT_STAGES,
  type OrchestratorConfig,
  type PipelineResult,
  type StageName,
} from '../../src/ad-sdlc-orchestrator/types.js';
import { SdkExecutionAdapter } from '../../src/execution/SdkExecutionAdapter.js';
import type { ExecutionAdapter } from '../../src/execution/types.js';
import { ASSET_PACKAGE_ROOT } from '../../src/project-initializer/AgentAssets.js';
import { pipelineExitCode } from '../../src/vnv/policy.js';
import { sdkResult, withQueryLifecycle } from '../execution/fixtures/sdk.js';
import { init } from '../execution/fixtures/usageStreams.js';
import {
  COMPARISON_STAGE,
  ENHANCEMENT_AGENTS,
  ENHANCEMENT_FIXTURE,
  ENHANCEMENT_SCENARIOS,
  driftEvidence,
  judgeEnhancementScenario,
  loadEnhancementExpectation,
  materializeEnhancementTarget,
  runSummary,
  stageArtifactPaths,
  type EnhancementObservation,
  type EnhancementScenario,
} from '../live/enhancementScenario.js';
import { invocationEvidence } from '../live/scenarioSupport.js';

const S = '.ad-sdlc/scratchpad';
const P = 'task-ledger';

/** Files each agent writes, keyed by agent type, then project-relative path. */
type StageOutputs = Record<string, Record<string, string>>;

const reference = (path: string): string =>
  readFileSync(join(ENHANCEMENT_FIXTURE.reference, path), 'utf8').replaceAll('\r\n', '\n');

const PRD = 'docs/prd/PRD-001-task-ledger';
const SRS = 'docs/srs/SRS-001-task-ledger';
const SDS = 'docs/sds/SDS-001-task-ledger';

/**
 * The outputs each definition documents for a correct run, in the fixture's
 * project. Each updater writes the English and Korean documents, the scratchpad
 * copy, its changelog, and its update result.
 * @returns Outputs per agent
 */
function correctOutputs(): StageOutputs {
  return {
    // document-reader.md: current_state.yaml
    'document-reader': {
      [`${S}/state/${P}/current_state.yaml`]: [
        'current_state:',
        '  project:',
        '    name: Task Ledger',
        '    version: 1.0.0',
        '  requirements:',
        '    functional:',
        '      - { id: FR-001, title: Track tasks, priority: P0, status: active }',
        '      - { id: FR-002, title: Report progress, priority: P1, status: active }',
        '      - { id: FR-003, title: Archive completed tasks, priority: P2, status: active }',
        '    non_functional: []',
        '  documents:',
        `    prd: { path: ${PRD}.md, version: 1.0.0, requirements_count: 3 }`,
        `    srs: { path: ${SRS}.md, version: 1.0.0, features_count: 3 }`,
        `    sds: { path: ${SDS}.md, version: 1.0.0, components_count: 3 }`,
        '  features:',
        '    - { id: SF-001, name: Task tracking, source_requirements: [FR-001], status: active }',
        '    - { id: SF-002, name: Progress reporting, source_requirements: [FR-002], status: active }',
        '    - { id: SF-003, name: Task archiving, source_requirements: [FR-003], status: active }',
        '  components:',
        '    - { id: CMP-001, name: Tasks, source_features: [SF-001] }',
        '    - { id: CMP-002, name: Report, source_features: [SF-002] }',
        '    - { id: CMP-003, name: Archive, source_features: [SF-003] }',
        '  traceability:',
        '    prd_to_srs:',
        '      - { prd_id: FR-001, srs_ids: [SF-001] }',
        '      - { prd_id: FR-002, srs_ids: [SF-002] }',
        '      - { prd_id: FR-003, srs_ids: [SF-003] }',
        '    srs_to_sds:',
        '      - { srs_id: SF-001, sds_ids: [CMP-001] }',
        '      - { srs_id: SF-002, sds_ids: [CMP-002] }',
        '      - { srs_id: SF-003, sds_ids: [CMP-003] }',
        '  statistics: { total_requirements: 3, total_features: 3, total_components: 3 }',
        '',
      ].join('\n'),
    },
    // codebase-analyzer.md: architecture_overview.yaml and dependency_graph.json
    'codebase-analyzer': {
      [`${S}/analysis/${P}/architecture_overview.yaml`]:
        'architecture:\n  type: modular\n  confidence: 0.9\n  structure:\n    source_dirs:\n      - { path: src, purpose: library }\n    test_dirs:\n      - { path: test, framework: node:test }\n',
      [`${S}/analysis/${P}/dependency_graph.json`]: JSON.stringify({
        nodes: [
          { id: 'tasks', type: 'internal', path: 'src/tasks.mjs' },
          { id: 'report', type: 'internal', path: 'src/report.mjs' },
        ],
        edges: [],
        external_dependencies: [],
      }),
    },
    // code-reader.md: code_inventory.yaml
    'code-reader': {
      [`${S}/analysis/${P}/code_inventory.yaml`]: [
        'code_inventory:',
        '  project: { name: task-ledger, root_path: . }',
        '  modules:',
        '    - name: tasks',
        '      path: src/tasks.mjs',
        '      functions: [{ name: addTask, exported: true }, { name: completeTask, exported: true }]',
        '    - name: report',
        '      path: src/report.mjs',
        '      functions: [{ name: progress, exported: true }, { name: formatProgress, exported: true }]',
        '',
      ].join('\n'),
    },
    // doc-code-comparator.md: comparison_result.yaml and gap_issues.json
    'doc-code-comparator': {
      [`${S}/analysis/${P}/comparison_result.yaml`]: [
        'comparison_result:',
        `  project: { name: ${P} }`,
        '  gaps:',
        '    - id: GAP-001',
        '      type: documented_not_implemented',
        '      priority: P1',
        '      title: Archive not implemented',
        '      documentReference: CMP-003',
        '      codeReference: src/archive.mjs',
        '      relatedIds: [FR-003, SF-003, CMP-003]',
        '  gap_summary: { total_gaps: 1 }',
        '',
      ].join('\n'),
      [`${S}/analysis/${P}/gap_issues.json`]: JSON.stringify({ total_issues: 1, issues: [] }),
    },
    // impact-analyzer.md: impact_report.yaml
    'impact-analyzer': {
      [`${S}/impact/${P}/impact_report.yaml`]: [
        'impact_analysis:',
        '  request_summary: Report overdue tasks',
        '  change_scope: { type: feature_add, estimated_size: small, confidence: 0.9 }',
        '  affected_components:',
        '    - { component_id: CMP-002, type: direct, impact_level: medium }',
        '  affected_requirements:',
        '    - { requirement_id: FR-002, type: functional, impact: modify }',
        '  risk_assessment: { overall_risk: low, confidence: 0.9 }',
        '',
      ].join('\n'),
    },
    // prd-updater.md: the five files of its Output Files table
    'prd-updater': {
      [`${PRD}.md`]: reference(`${PRD}.md`),
      [`${PRD}.kr.md`]: reference(`${PRD}.kr.md`),
      [`${S}/documents/${P}/prd.md`]: reference(`${PRD}.md`),
      [`${S}/documents/${P}/prd_changelog.md`]: '## [1.1.0]\n\n### Added\n\n- FR-004\n',
      [`${S}/documents/${P}/prd_update_result.yaml`]: [
        'update_result:',
        '  document: PRD-001',
        "  version_before: '1.0.0'",
        "  version_after: '1.1.0'",
        '  changes:',
        '    added:',
        '      - { id: FR-004, title: Report overdue tasks, section: Functional Requirements }',
        '    modified: []',
        '    deprecated: []',
        '  consistency_check: { passed: true, issues: [] }',
        '  changelog_entry: Added FR-004',
        '  traceability_impact: { affected_srs_ids: [SF-004], affected_sds_ids: [CMP-002] }',
        '',
      ].join('\n'),
    },
    // srs-updater.md
    'srs-updater': {
      [`${SRS}.md`]: reference(`${SRS}.md`),
      [`${SRS}.kr.md`]: reference(`${SRS}.kr.md`),
      [`${S}/documents/${P}/srs.md`]: reference(`${SRS}.md`),
      [`${S}/documents/${P}/srs_changelog.md`]: '## [1.1.0]\n\n### Added\n\n- SF-004\n',
      [`${S}/documents/${P}/srs_update_result.yaml`]:
        "update_result:\n  document: SRS-001\n  version_before: '1.0.0'\n  version_after: '1.1.0'\n  changes:\n    features_added:\n      - { id: SF-004, title: Overdue report, linked_prd: FR-004 }\n",
    },
    // sds-updater.md
    'sds-updater': {
      [`${SDS}.md`]: reference(`${SDS}.md`),
      [`${SDS}.kr.md`]: reference(`${SDS}.kr.md`),
      [`${S}/documents/${P}/sds.md`]: reference(`${SDS}.md`),
      [`${S}/documents/${P}/sds_changelog.md`]: '## [1.1.0]\n\n### Changed\n\n- CMP-002\n',
      [`${S}/documents/${P}/sds_update_result.yaml`]:
        "update_result:\n  document: SDS-001\n  version_before: '1.0.0'\n  version_after: '1.1.0'\n  changes:\n    components_modified:\n      - { id: CMP-002, field: exports, new_value: overdueTasks }\n",
    },
    // issue-generator.md: issue_list.json with the issue template, and dependency_graph.json
    'issue-generator': {
      [`${S}/issues/${P}/issue_list.json`]: JSON.stringify({
        issues: [
          {
            id: 'ISS-001',
            github_number: 11,
            title: 'ISS-001: Report overdue tasks',
            body: ISSUE_BODY,
            state: 'open',
            labels: { type: 'feature', priority: 'P1', component: 'report', size: 'S' },
            milestone: 'Phase 1',
            assignees: [],
            dependencies: { blocked_by: [], blocks: [] },
            traceability: {
              sds_component: 'CMP-002',
              srs_feature: 'SF-004',
              prd_requirement: 'FR-004',
            },
            technical: { related_files: ['src/report.mjs'] },
            estimation: { size: 'S', hours: 3 },
          },
        ],
      }),
      [`${S}/issues/${P}/dependency_graph.json`]: JSON.stringify({
        nodes: [{ id: 'ISS-001' }],
        edges: [],
      }),
    },
    // controller.md: the three outputs of its File Locations block
    controller: {
      [`${S}/progress/${P}/controller_state.yaml`]: `project_id: ${P}\nphase: executing\n`,
      [`${S}/progress/${P}/work_orders/WO-001.yaml`]:
        "work_order:\n  id: WO-001\n  status: pending\n  issue:\n    id: ISS-001\n    github_number: 11\n    title: 'ISS-001: Report overdue tasks'\n  priority:\n    level: 1\n    reason: Only issue\n  context:\n    related_files: [src/report.mjs]\n",
      [`${S}/progress/${P}/progress_report.md`]: '# Progress Report\n',
    },
    // worker.md: the result, the source change, and the new test file
    worker: {
      'src/report.mjs': reference('src/report.mjs'),
      'test/overdue.test.mjs': reference('test/overdue.test.mjs'),
      [`${S}/progress/${P}/results/WO-001-result.yaml`]: [
        'implementation_result:',
        '  work_order_id: WO-001',
        '  issue_id: ISS-001',
        '  github_issue: 11',
        '  status: completed',
        '  changes:',
        '    - { file_path: src/report.mjs, change_type: modify, description: Add overdueTasks }',
        '    - { file_path: test/overdue.test.mjs, change_type: create, description: Unit tests }',
        '  tests:',
        '    files_created: [test/overdue.test.mjs]',
        '    total_tests: 3',
        '    coverage_percentage: 100',
        '  verification:',
        '    tests_passed: true',
        '    tests_output: 9 passed',
        '    lint_passed: true',
        '    build_passed: true',
        '  branch:',
        '    name: feature/ISS-001-overdue-report',
        "    commits: [{ hash: abc1234, message: 'feat(report): add overdueTasks' }]",
        '  acceptance_criteria:',
        '    - { id: AC-001, status: met, tests: [test/overdue.test.mjs] }',
        '    - { id: AC-002, status: met, tests: [test/overdue.test.mjs] }',
        '    - { id: AC-003, status: met, tests: [test/overdue.test.mjs] }',
        '',
      ].join('\n'),
    },
    // regression-tester.md: regression_report.yaml
    'regression-tester': { [`${S}/regression/${P}/regression_report.yaml`]: regressionReport(0) },
    // validation-agent.md: validation-report.yaml
    'validation-agent': {
      [`${S}/vnv/${P}/validation-report.yaml`]: [
        'validation_report:',
        `  metadata: { project_id: ${P} }`,
        '  overall_status: pass',
        '  summary: { total_requirements: 1, verified: 1, partially_verified: 0, unverified: 0, not_applicable: 0, coverage_percent: 100 }',
        '  quality_gates:',
        '    - { name: overall_coverage, threshold: 80, actual: 100, status: pass }',
        '    - { name: critical_requirements, threshold: 100, actual: 100, status: pass }',
        '    - { name: no_blocking_defects, threshold: 0, actual: 0, status: pass }',
        '    - { name: test_coverage, threshold: 80, actual: 100, status: pass }',
        '  per_requirement:',
        '    - requirement_id: SF-004',
        '      priority: high',
        '      status: verified',
        '      test_files: [test/overdue.test.mjs]',
        '      impl_files: [src/report.mjs]',
        '  regressions: []',
        '  recommendations: []',
        '',
      ].join('\n'),
    },
    // pr-reviewer.md: the review result and the updated progress report
    'pr-reviewer': {
      [`${S}/progress/${P}/reviews/PR-012-review.yaml`]: [
        'pr_review_result:',
        '  work_order_id: WO-001',
        '  issue_id: ISS-001',
        '  pull_request:',
        '    number: 12',
        '    url: https://github.com/example/task-ledger/pull/12',
        '    title: Report overdue tasks',
        '    branch: feature/ISS-001-overdue-report',
        '    base: main',
        '  review: { status: approved, revision_round: 1, comments: [], summary: Looks right }',
        '  quality_metrics: { code_coverage: 100, test_count: 3, style_violations: 0 }',
        '  checks: { ci_passed: true, tests_passed: true, lint_passed: true, security_scan_passed: true }',
        '  decision: { action: merge, reason: All gates pass; left open for human review }',
        '  feedback_for_worker: { improvements: [], positive_notes: [] }',
        '',
      ].join('\n'),
      [`${S}/progress/${P}/progress_report.md`]: '# Progress Report\n\nReview complete.\n',
    },
    // doc-index-generator.md: the four index files
    'doc-index-generator': {
      'docs/.index/manifest.yaml': `documents:\n  - { path: ${PRD}.md }\n`,
      'docs/.index/bundles.yaml': 'bundles: []\n',
      'docs/.index/graph.yaml': 'edges: []\n',
      'docs/.index/router.yaml': 'routes: []\n',
    },
  };
}

/** The issue template of issue-generator.md, filled in. */
const ISSUE_BODY = [
  '## Description',
  'List the overdue tasks in the report module.',
  '',
  '## Context',
  'This issue implements part of the AD-SDLC automated pipeline.',
  '',
  '### Source References',
  '| Document | Reference |',
  '|----------|-----------|',
  '| SDS Component | CMP-002 |',
  '| SRS Feature | SF-004 |',
  '| PRD Requirement | FR-004 |',
  '',
  '## Acceptance Criteria',
  '- [ ] overdueTasks returns the open tasks due before the given day',
  '- [ ] The oldest due date comes first, then the lowest identifier',
  '- [ ] Unit tests written with >80% coverage',
  '',
  '## Technical Notes',
  'Extend src/report.mjs.',
  '',
  '### Related Files',
  '- `src/report.mjs` - the report module',
  '',
  '## Dependencies',
  '- **Blocked by**: none',
  '',
  '## Labels',
  '- `type:feature`',
  '',
  '---',
  '_Traceability: CMP-002 → SF-004 → FR-004_',
].join('\n');

/**
 * A `regression_report.yaml` as regression-tester.md documents it.
 * @param failed - Failed tests
 * @returns Report YAML
 */
function regressionReport(failed: number): string {
  return [
    'regression_report:',
    `  project_id: ${P}`,
    '  changes_analyzed: { files_modified: 1, files_added: 1, files_deleted: 0, components_affected: 1 }',
    '  test_mapping: { total_test_files: 3, total_test_cases: 9, mapping_coverage: 1.0, unmapped_source_files: [] }',
    '  affected_tests:',
    '    - { test_file: test/report.test.mjs, test_name: report, priority: high, reason: Direct test }',
    '  test_execution:',
    '    total_tests_run: 6',
    `    passed: ${String(6 - failed)}`,
    `    failed: ${String(failed)}`,
    '    skipped: 0',
    '  compatibility_issues: []',
    '  recommendations: []',
    '  summary:',
    `    status: ${failed > 0 ? 'failed' : 'passed'}`,
    '    total_issues: 0',
    '    blocking_issues: 0',
    '',
  ].join('\n');
}

/**
 * SDK double: writes the agent's files and reports each through the production
 * PostToolUse capture hooks, like a real Write tool call.
 * @param outputs - Files per agent type
 * @param calls - Receives the agent types in invocation order
 * @returns Production adapter over the scripted SDK
 */
function scriptedSdk(outputs: StageOutputs, calls: string[]): ExecutionAdapter {
  return new SdkExecutionAdapter({
    loader: async () =>
      withQueryLifecycle({
        async *query(input): AsyncGenerator<SDKMessage, void> {
          const agent = input.options?.agent ?? 'unknown';
          const root = input.options?.cwd ?? '';
          calls.push(agent);
          yield init(`sdk-${agent}`);
          let index = 0;
          for (const [path, content] of Object.entries(outputs[agent] ?? {})) {
            await mkdir(dirname(join(root, path)), { recursive: true });
            await writeFile(join(root, path), content);
            const toolUseId = `write-${agent}-${String(index++)}`;
            for (const entry of input.options?.hooks?.PostToolUse ?? [])
              for (const callback of entry.hooks)
                await callback(
                  {
                    hook_event_name: 'PostToolUse',
                    session_id: `sdk-${agent}`,
                    tool_use_id: toolUseId,
                    tool_name: 'Write',
                    tool_input: { file_path: path },
                    tool_response: {},
                    cwd: root,
                    transcript_path: join(root, 'transcript'),
                  },
                  toolUseId,
                  { signal: input.options!.abortController!.signal }
                );
          }
          yield sdkResult({
            session_id: `sdk-${agent}`,
            result: 'status: success',
            usage: { input_tokens: 100, output_tokens: 40 },
          });
        },
      }),
  });
}

class ScriptedOrchestrator extends AdsdlcOrchestratorAgent {
  constructor(
    private readonly adapter: ExecutionAdapter,
    config: OrchestratorConfig
  ) {
    super({ maxRetries: 0, ...config });
  }
  protected override createExecutionAdapter(): ExecutionAdapter {
    return this.adapter;
  }
}

let root: string;
let project: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'enhancement-delivery-'));
  project = join(root, P);
  materializeEnhancementTarget(project);
  for (const agent of ENHANCEMENT_AGENTS)
    cpSync(
      join(ASSET_PACKAGE_ROOT, '.claude', 'agents', `${agent}.md`),
      join(project, '.claude', 'agents', `${agent}.md`)
    );
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

interface RunOutcome {
  readonly result: PipelineResult;
  readonly failed: boolean;
  readonly calls: readonly string[];
}

/**
 * One orchestrated run under `--vnv-profile delivery` semantics.
 * @param outputs - Files per agent type
 * @param options - Stop and resume options
 * @param options.stopAfterStage - Last stage to run
 * @param options.resumeSessionId - Session to resume
 * @returns Result, whether the run failed, and the agents called
 */
async function runPipeline(
  outputs: StageOutputs,
  options: { stopAfterStage?: StageName; resumeSessionId?: string } = {}
): Promise<RunOutcome> {
  const calls: string[] = [];
  const orchestrator = new ScriptedOrchestrator(scriptedSdk(outputs, calls), {
    vnv: { rigor: 'standard', haltOnVerificationFailure: false, profile: 'delivery' },
  });
  await orchestrator.startSession({
    projectDir: project,
    userRequest: 'Report overdue tasks',
    overrideMode: 'enhancement',
    ...(options.stopAfterStage === undefined ? {} : { stopAfterStage: options.stopAfterStage }),
    ...(options.resumeSessionId === undefined
      ? {}
      : { resumeSessionId: options.resumeSessionId, resumeMode: 'resume' as const }),
  });
  try {
    const result = await orchestrator.executePipeline(project, 'Report overdue tasks');
    return { result, failed: false, calls };
  } catch (error) {
    if (!(error instanceof PipelineFailedError) || error.result === undefined) throw error;
    return { result: error.result, failed: true, calls };
  } finally {
    await orchestrator.dispose();
  }
}

function stage(result: PipelineResult, name: StageName) {
  const found = result.stages.find((candidate) => candidate.name === name);
  if (found === undefined) throw new Error(`stage ${name} missing from result`);
  return found;
}

function check(result: PipelineResult, name: StageName, checkId: string) {
  return stage(result, name).verification?.checks.find((c) => c.checkId === checkId);
}

const scenario = (id: EnhancementScenario['id']): EnhancementScenario => {
  const found = ENHANCEMENT_SCENARIOS.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(id);
  return found;
};

describe('Enhancement stages on the production orchestrator path', () => {
  it('accepts what the definitions document: every stage completes, verified and covered', async () => {
    const { result, failed, calls } = await runPipeline(correctOutputs());

    const unsuccessful = result.stages
      .filter((entry) => entry.status !== 'completed')
      .map((entry) => `${entry.name}: ${entry.status}: ${String(entry.error)}`);
    expect(unsuccessful).toEqual([]);
    expect(failed).toBe(false);
    expect(new Set(calls)).toEqual(new Set(ENHANCEMENT_AGENTS));
    expect(result.overallStatus).toBe('completed');
    expect(result.stages.map((entry) => entry.name).sort()).toEqual(
      ENHANCEMENT_STAGES.map((entry) => entry.name).sort()
    );
    const findings = result.verification?.stages.flatMap((record) =>
      record.checks
        .filter((entry) => entry.outcome === 'fail')
        .map((entry) => `${record.stage} ${entry.checkId}: ${entry.message}`)
    );
    expect(findings).toEqual([]);
    expect(result.verification?.status).toBe('verified');
    expect(result.traceability).toMatchObject({ status: 'covered', uncovered: [] });
    expect(pipelineExitCode(result)).toBe(0);

    // The cross-document check compares from the second document on.
    expect(check(result, 'prd_update', 'VR-XDOC-001')?.outcome).toBe('skipped');
    for (const name of ['srs_update', 'sds_update'] as const)
      expect(check(result, name, 'VR-XDOC-001')?.outcome).toBe('pass');

    // A localized copy is an artifact, and the check still read the primary document.
    expect(stage(result, 'prd_update').artifacts).toContain(`${PRD}.kr.md`);
    expect(check(result, 'prd_update', 'VR-PRD-002')?.outcome).toBe('pass');
  });

  it('gives the live judge the run result it reads', async () => {
    const expectation = loadEnhancementExpectation();
    const { result } = await runPipeline(correctOutputs());
    // `ad-sdlc run --format json` prints a finished run as this object.
    const stdout = `${JSON.stringify(result, null, 2)}\n`;

    const artifacts = stageArtifactPaths(stdout, COMPARISON_STAGE);
    expect(artifacts).toContain(`${S}/analysis/${P}/comparison_result.yaml`);
    const drift = driftEvidence(
      expectation,
      artifacts.map((path) => ({ path, content: readFileSync(join(project, path), 'utf8') }))
    );
    expect(drift).toMatchObject({ detected: true, kind: 'documented_not_implemented' });
    expect(drift.unresolved.length).toBeGreaterThan(0);

    const run = runSummary('run', stdout);
    expect(run).toMatchObject({
      completed: true,
      status: 'completed',
      verification: 'verified',
      traceability: 'covered',
      attempts: 15,
      usage: { inputTokens: 1500, outputTokens: 600 },
    });
    expect(run.durationMs).toBeGreaterThanOrEqual(0);

    const observation: EnhancementObservation = {
      invocations: [invocationEvidence('run', { status: 0, signal: null, stdout }, 1000)],
      runs: [run],
      pullRequests: [],
      pullRequestsAtStop: 0,
      drift,
      regressionSwitchSeen: false,
    };
    const rows = judgeEnhancementScenario(scenario('delivery'), observation, expectation);
    const problemsOf = (criterion: string): readonly string[] | undefined =>
      rows.find((row) => row.criterion === criterion)?.problems;
    expect(problemsOf('Run completed and traced')).toEqual([]);
    expect(problemsOf('Seeded mismatch detected with a reference')).toEqual([]);
    expect(problemsOf('One open, unmerged pull request')).toEqual(['no pull request was opened']);
  });

  it('keeps the requirements the run did not change out of the uncovered list, and the new one in', async () => {
    const outputs = correctOutputs();
    const issueList = `${S}/issues/${P}/issue_list.json`;
    const untraced = JSON.parse(outputs['issue-generator']![issueList]!);
    untraced.issues[0].traceability = {
      sds_component: 'CMP-001',
      srs_feature: 'SF-001',
      prd_requirement: 'FR-001',
    };
    untraced.issues[0].body = untraced.issues[0].body.replaceAll('FR-004', 'FR-001');
    outputs['issue-generator']![issueList] = JSON.stringify(untraced);

    const { result, failed } = await runPipeline(outputs);

    expect(failed).toBe(true);
    expect(stage(result, 'validation-agent')).toMatchObject({ status: 'failed' });
    expect(result.traceability?.uncovered).toEqual(['FR-004']);
  });

  it('blocks delivery when the regression report has a failed test', async () => {
    const outputs = correctOutputs();
    outputs['regression-tester'] = {
      [`${S}/regression/${P}/regression_report.yaml`]: regressionReport(1),
    };

    const { result, failed, calls } = await runPipeline(outputs);

    expect(failed).toBe(true);
    expect(stage(result, 'regression_testing')).toMatchObject({
      status: 'failed',
      verification: { state: 'failed' },
    });
    expect(check(result, 'regression_testing', 'VR-REG-002')).toMatchObject({
      outcome: 'fail',
      message: 'Regression tests failed',
    });
    for (const name of ['validation-agent', 'review', 'doc_indexing'] as const)
      expect(stage(result, name).status).toBe('skipped');
    for (const agent of ['validation-agent', 'pr-reviewer', 'doc-index-generator'])
      expect(calls).not.toContain(agent);
    expect(pipelineExitCode(result)).toBe(1);
  });

  it('blocks delivery on the resume when the regression appears after implementation', async () => {
    const outputs = correctOutputs();
    const first = await runPipeline(outputs, { stopAfterStage: 'implementation' });
    expect(first.failed).toBe(false);
    expect(first.calls).not.toContain('regression-tester');

    outputs['regression-tester'] = {
      [`${S}/regression/${P}/regression_report.yaml`]: regressionReport(1),
    };
    const resumed = await runPipeline(outputs, { resumeSessionId: first.result.pipelineId });

    expect(resumed.failed).toBe(true);
    expect(resumed.calls).toEqual(['regression-tester']);
    expect(check(resumed.result, 'regression_testing', 'VR-REG-002')?.outcome).toBe('fail');
    expect(stage(resumed.result, 'review').status).not.toBe('completed');
    expect(pipelineExitCode(resumed.result)).toBe(1);

    // The live judge reads this run from the CLI's wrapper of a failed run.
    const stopped = `${JSON.stringify(first.result, null, 2)}\n`;
    const failure = `${JSON.stringify(
      { ready: false, error: 'Pipeline failed', result: resumed.result },
      null,
      2
    )}\n`;
    const observation: EnhancementObservation = {
      invocations: [
        invocationEvidence('run', { status: 0, signal: null, stdout: stopped }, 1000),
        invocationEvidence('resume-1', { status: 1, signal: null, stdout: failure }, 1000),
      ],
      runs: [runSummary('run', stopped), runSummary('resume-1', failure)],
      pullRequests: [],
      pullRequestsAtStop: 0,
      drift: null,
      regressionSwitchSeen: true,
    };
    expect(
      judgeEnhancementScenario(scenario('regression'), observation, loadEnhancementExpectation())
    ).toEqual([
      { criterion: 'Run stopped after implementation', problems: [] },
      { criterion: 'Regression blocks delivery', problems: [] },
      { criterion: 'Regression switch reached the tests', problems: [] },
    ]);
  });

  it.each([
    {
      name: 'a PRD that drops a prior requirement',
      agent: 'prd-updater',
      file: 'prd.md',
      from: /### FR-003[\s\S]*?(?=### FR-004)/,
      failing: 'srs_update' as const,
      syncPoint: 'requirement-fr-003',
    },
    {
      name: 'an SRS that drops a prior feature',
      agent: 'srs-updater',
      file: 'srs.md',
      from: /### SF-003[\s\S]*?(?=### SF-004)/,
      // The feature's block also holds its only link to FR-003, which fails first.
      failing: 'srs_update' as const,
      syncPoint: 'requirement-fr-003',
    },
    {
      name: 'an SDS that drops a prior component',
      agent: 'sds-updater',
      file: 'sds.md',
      from: /### CMP-003[\s\S]*$/,
      failing: 'sds_update' as const,
      syncPoint: 'component-cmp-003',
    },
    {
      name: 'an SDS that breaks a value sync point',
      agent: 'sds-updater',
      file: 'sds.md',
      from: /Task title limit: 120 characters/,
      failing: 'sds_update' as const,
      syncPoint: 'task-title-limit',
    },
  ])('fails VR-XDOC-001 for $name', async ({ agent, file, from, failing, syncPoint }) => {
    const outputs = correctOutputs();
    const path = `${S}/documents/${P}/${file}`;
    outputs[agent]![path] = outputs[agent]![path]!.replace(from, '');

    const { result, failed } = await runPipeline(outputs);

    expect(failed).toBe(true);
    expect(stage(result, failing).status).toBe('failed');
    expect(check(result, failing, 'VR-XDOC-001')).toMatchObject({
      outcome: 'fail',
      message: expect.stringContaining(`Sync point '${syncPoint}'`),
    });
    expect(stage(result, 'review').status).toBe('skipped');
  });
});
