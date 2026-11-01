/**
 * Offline validation of the Enhancement live acceptance fixture and judge (#957).
 * Runs in the ordinary offline lanes without credentials, GitHub, or SDK calls, and
 * proves that:
 * - the target's own tests pass, and the regression switch fails them;
 * - its documents pass the verifier's check sets and the traceability audit, and
 *   their sync points are compared, not skipped;
 * - exactly one drift is planted, and an existing offline check finds it;
 * - the independent tests fail where they must and pass on the reference;
 * - the judge accepts the reference and rejects each wrong variant;
 * - the live invocation is valid for the production CLI;
 * - the report and the suite selection reject what they exist to catch.
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { basename, join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import * as yaml from 'js-yaml';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LIVE_FILES,
  liveSuiteFiles,
  resolveLiveSettings,
  runLiveLane,
  LIVE_EXIT,
  type LiveLaneMetadata,
} from '../../scripts/live-lane.js';
import { ENHANCEMENT_STAGES } from '../../src/ad-sdlc-orchestrator/types.js';
import {
  TraceabilityCheck,
  buildTraceabilityIndex,
} from '../../src/doc-audit/checks/TraceabilityCheck.js';
import type { DocumentKind, LoadedDocument } from '../../src/doc-audit/types.js';
import { DocCodeComparatorAgent } from '../../src/doc-code-comparator/DocCodeComparatorAgent.js';
import type { GapItem } from '../../src/doc-code-comparator/types.js';
import { resolveProjectAgent } from '../../src/execution/resolveProjectAgent.js';
import { ASSET_PACKAGE_ROOT } from '../../src/project-initializer/AgentAssets.js';
import { checkCrossDocumentConsistency } from '../../src/stage-verifier/consistency.js';
import { VERIFICATION_CHECK_SETS, shouldRunRule } from '../../src/stage-verifier/rules.js';
import type { VerificationRuleContext } from '../../src/stage-verifier/types.js';
import { DeliveryReviewInputSchema } from '../../src/telemetry/deliveryMetricsReport.js';
import { locateDocuments } from '../../src/vnv/traceability.js';
import {
  COMPARISON_STAGE,
  ENHANCEMENT_AGENTS,
  ENHANCEMENT_FIXTURE,
  ENHANCEMENT_SCENARIOS,
  EnhancementExpectationSchema,
  NO_DOCUMENT_DELTA,
  REGRESSION_ENV,
  REGRESSION_MARKER,
  applyOverlay,
  applyTurnBudget,
  classifyPath,
  deliveryReviewTemplate,
  deltaProblems,
  documentDelta,
  documentIndex,
  driftEvidence,
  enhancementReportProblems,
  enhancementRequirements,
  enhancementRunArguments,
  evaluateEnhancementScenario,
  judgeEnhancementScenario,
  judgePullRequestHead,
  loadEnhancementExpectation,
  materializeEnhancementTarget,
  parseDocumentIds,
  redactValues,
  regressionSwitchSeen,
  renderDocumentDiffs,
  renderEnhancementReport,
  runSummary,
  stageArtifactPaths,
  type EnhancementObservation,
  type EnhancementPullRequest,
  type EnhancementScenario,
  type EnhancementScenarioResult,
  type ProjectFiles,
  type PullRequestJudgement,
} from '../live/enhancementScenario.js';
import { githubEnv, resetCheckoutToFixture, type TargetFixture } from '../live/githubTarget.js';
import {
  LIVE_PERMISSIONS,
  liveAuthArguments,
  liveChildEnv,
  parseCliJson,
  runSourceCli,
} from '../live/harness.js';
import {
  exec,
  invocationEvidence,
  ownedIssues,
  pipelineResumeArguments,
  runAcceptanceTests,
  type InvocationEvidence,
} from '../live/scenarioSupport.js';

const require = createRequire(import.meta.url);
const tsxLoader = pathToFileURL(require.resolve('tsx')).href;

const budget = { maxTurns: 4, stageTimeoutMs: 60_000 };
/** These tests start many Git and Node.js processes, which is slow on Windows runners. */
const SPAWNING = { timeout: 120_000 };
const expectation = loadEnhancementExpectation();
const scenario = (id: EnhancementScenario['id']): EnhancementScenario => {
  const found = ENHANCEMENT_SCENARIOS.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(id);
  return found;
};

/** Environment without credentials or live-lane settings. */
function offlineEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: '1' };
  for (const key of Object.keys(env))
    if (
      /^(ANTHROPIC_|CLAUDE_API_KEY$|AD_SDLC_|GH_TOKEN$|GITHUB_TOKEN$|VITEST|NODE_TEST|GITHUB_STEP_SUMMARY$|GITHUB_ACTIONS$)/.test(
        key
      )
    )
      delete env[key];
  return env;
}

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'enhancement-fixture-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const WRONG = {
  retainedBroken: join(ENHANCEMENT_FIXTURE.wrong, 'retained-broken'),
  unrelatedId: join(ENHANCEMENT_FIXTURE.wrong, 'unrelated-id-changed'),
  driftFixed: join(ENHANCEMENT_FIXTURE.wrong, 'drift-fixed'),
};

/** A checkout of the target with the given solutions laid over it. */
function project(name: string, ...overlays: readonly string[]): string {
  const checkout = join(dir, name);
  materializeEnhancementTarget(checkout);
  for (const overlay of overlays) applyOverlay(checkout, overlay);
  return checkout;
}

/** The files of a checkout, excluding Git metadata. */
function filesOf(root: string, current: string = root): ProjectFiles {
  const files: Record<string, string> = {};
  for (const entry of readdirSync(current)) {
    if (entry === '.git') continue;
    const path = join(current, entry);
    if (statSync(path).isDirectory()) Object.assign(files, filesOf(root, path));
    else
      files[relative(root, path).split(sep).join('/')] = readFileSync(path, 'utf8').replaceAll(
        '\r\n',
        '\n'
      );
  }
  return files;
}

/**
 * Run the target repository's own tests through its real `npm test` script, the
 * command the worker runs, as tests/ci/import-fixture.test.ts does. A list of test
 * files here would not show a script that cannot run.
 */
function targetTests(target: string, extra: NodeJS.ProcessEnv = {}): number | null {
  const windows = process.platform === 'win32';
  return spawnSync(windows ? 'npm.cmd' : 'npm', ['test'], {
    cwd: target,
    env: { ...offlineEnv(), ...extra },
    encoding: 'utf8',
    shell: windows,
    timeout: 60_000,
  }).status;
}

const acceptance = (checkout: string, key: 'retained' | 'feature') =>
  runAcceptanceTests(checkout, {
    sourceDir: ENHANCEMENT_FIXTURE.acceptance,
    keys: [key],
    clearedEnv: [REGRESSION_ENV],
  });

const PRD = 'docs/prd/PRD-001-task-ledger.md';
const SRS = 'docs/srs/SRS-001-task-ledger.md';
const SDS = 'docs/sds/SDS-001-task-ledger.md';

describe('Enhancement target repository', SPAWNING, () => {
  it('passes its own tests, and the regression switch fails them and leaves its marker', () => {
    const target = project('target');
    expect(readFileSync(join(target, '.gitignore'), 'utf8')).toContain('.ad-sdlc/');
    expect(readFileSync(join(target, PRD), 'utf8')).not.toContain('\r');
    expect(existsSync(join(target, '.ad-sdlc'))).toBe(false);
    expect(existsSync(join(target, '.claude'))).toBe(false);
    expect(targetTests(target)).toBe(0);
    expect(regressionSwitchSeen(target)).toBe(false);
    expect(targetTests(target, { [REGRESSION_ENV]: '1' })).not.toBe(0);
    expect(regressionSwitchSeen(target)).toBe(true);
    expect(existsSync(join(target, REGRESSION_MARKER))).toBe(true);
  });

  it('keeps the switch in the retained test of the module the feature changes', () => {
    const test = readFileSync(join(ENHANCEMENT_FIXTURE.target, 'test', 'report.test.mjs'), 'utf8');
    expect(test).toContain(REGRESSION_ENV);
    expect(expectation.feature.request).toContain('src/report.mjs');
    expect(expectation.paths.forbidden).toContain('test/report.test.mjs');
  });

  it('does not collect the fixture tests into any offline Vitest lane', () => {
    const names = (root: string): string[] =>
      Object.keys(filesOf(root)).filter((path) => path.includes('.test.'));
    for (const root of [
      ENHANCEMENT_FIXTURE.target,
      ENHANCEMENT_FIXTURE.acceptance,
      ENHANCEMENT_FIXTURE.reference,
    ])
      for (const name of names(root)) expect(name.endsWith('.test.mjs'), name).toBe(true);
  });

  it('leaves the tree alone on init except for .gitignore, which the judge allows', () => {
    const target = project('init-target');
    const before = filesOf(target);
    const init = runSourceCli(
      ['init', target, '--quick', '--skip-validation'],
      liveChildEnv(offlineEnv(), join(dir, 'claude-config')),
      120_000
    );
    expect(init.status, init.stdout + init.stderr).toBe(0);
    const after = filesOf(target);
    const changed = Object.keys(before).filter((path) => before[path] !== after[path]);
    expect(changed).toEqual(['.gitignore']);
    expect(after['.gitignore']).toContain('.ad-sdlc/');
    // A delta of .gitignore alone is still an empty document delta, not a path problem.
    const onlyIgnore = { ...before, '.gitignore': after['.gitignore'] ?? '' };
    expect(deltaProblems(expectation, documentDelta(before, onlyIgnore))).toEqual([
      NO_DOCUMENT_DELTA,
    ]);
  }, 120_000);
});

describe('Enhancement documents', () => {
  const ALL_ON = {
    generateRtm: true,
    crossDocumentConsistency: true,
    acceptanceCriteriaValidation: true,
  };

  it.each([
    ['prd-document', [PRD]],
    ['srs-document', [PRD, SRS]],
    ['sds-document', [PRD, SRS, SDS]],
  ] as const)('pass the %s check set', async (set, artifacts) => {
    const target = project('checks');
    const context: VerificationRuleContext = {
      stageName: 'sds_update',
      agentType: 'sds-updater',
      pipelineMode: 'enhancement',
      options: ALL_ON,
      documents: locateDocuments([PRD, SRS, SDS]),
    };
    const rules = VERIFICATION_CHECK_SETS[set].filter((rule) =>
      shouldRunRule(rule.minRigor, 'standard')
    );
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      const check = await rule.check(artifacts, target, context);
      expect(check, rule.checkId).toMatchObject({ passed: true });
      expect(check.skipReason, rule.checkId).toBeUndefined();
    }
  });

  describe('section headings', () => {
    // Compact documents keep only some sections of a writer's template, under the headings
    // a generated document has, so these runs cover a project AD-SDLC could have generated.
    const SECTIONS = [
      {
        path: PRD,
        writer: 'prd-writer',
        english: [
          '## 1. Executive Summary',
          '## 5. Functional Requirements',
          '## 6. Non-Functional Requirements',
        ],
        korean: ['## 1. 요약', '## 5. 기능 요구사항', '## 6. 비기능 요구사항'],
      },
      {
        path: SRS,
        writer: 'srs-writer',
        english: ['## 1. Introduction', '## 3. System Features'],
        korean: ['## 1. 소개', '## 3. 시스템 기능'],
      },
      {
        path: SDS,
        writer: 'sds-writer',
        english: ['## 1. Introduction', '## 2. System Architecture', '## 3. Component Design'],
        korean: ['## 1. 소개', '## 2. 시스템 아키텍처', '## 3. 컴포넌트 설계'],
      },
    ];
    const headings = (file: string): string[] =>
      readFileSync(file, 'utf8')
        .split(/\r?\n/u)
        .filter((line) => line.startsWith('## '));

    it.each(SECTIONS)(
      '$path uses the headings of the $writer template in every variant',
      ({ path, writer, english }) => {
        const template = readFileSync(
          join(ASSET_PACKAGE_ROOT, '.claude', 'agents', `${writer}.md`),
          'utf8'
        ).split(/\r?\n/u);
        for (const heading of english) expect(template).toContain(heading);
        const variants = [
          ENHANCEMENT_FIXTURE.target,
          ENHANCEMENT_FIXTURE.reference,
          ...Object.values(WRONG),
        ]
          .map((root) => join(root, path))
          .filter((file) => existsSync(file));
        expect(variants.length).toBeGreaterThanOrEqual(2);
        for (const file of variants) expect(headings(file), file).toEqual(english);
      }
    );

    it.each(SECTIONS)(
      'the Korean copy of $path translates the same sections',
      ({ path, korean }) => {
        const copy = path.replace(/\.md$/u, '.kr.md');
        expect(headings(join(ENHANCEMENT_FIXTURE.reference, copy))).toEqual(korean);
      }
    );
  });

  it('have every sync point compared, and in agreement', async () => {
    const target = project('sync');
    const result = await checkCrossDocumentConsistency(target, { prd: PRD, srs: SRS, sds: SDS });
    expect(result.violations).toEqual([]);
    expect(result.syncPointsChecked).toBeGreaterThan(0);
    expect(result.syncPointsEvaluated).toBe(result.syncPointsChecked);
  });

  it('have identifiers the audit recognizes and no traceability finding', () => {
    const findings = new TraceabilityCheck().run(loaded(filesOf(project('audit')))).findings;
    expect(findings).toEqual([]);
  });

  it.each([
    ['the target', [] as readonly string[]],
    ['the reference', [ENHANCEMENT_FIXTURE.reference]],
    ['a variant with a changed link', [ENHANCEMENT_FIXTURE.reference, WRONG.unrelatedId]],
  ])('parse the same identifiers and links as TraceabilityCheck for %s', (_name, overlays) => {
    const files = filesOf(project('cross-check', ...overlays));
    const index = documentIndex(files);
    const audit = buildTraceabilityIndex(loaded(files));
    expect(index.defined.requirements).toEqual([...audit.definedFR].sort());
    expect(index.defined.features).toEqual([...audit.definedSF].sort());
    expect(index.defined.components).toEqual([...audit.definedCMP].sort());
    const links = (prefix: string): Record<string, readonly string[]> =>
      Object.fromEntries(Object.entries(index.links).filter(([id]) => id.startsWith(prefix)));
    expect(links('CMP-')).toEqual(
      Object.fromEntries(
        [...audit.referencedSFPerCMP.entries()].map(([id, refs]) => [id, [...refs].sort()])
      )
    );
    expect([...new Set(Object.values(links('SF-')).flat())].sort()).toEqual(
      [...audit.referencedFRFromSRS].sort()
    );
    expect([...new Set(Object.values(links('CMP-')).flat())].sort()).toEqual(
      [...audit.referencedSFFromSDS].sort()
    );
  });

  it('parses block ends, sub-headings, and identifiers that only look alike', () => {
    expect(
      parseDocumentIds([
        '## Features\r\n### SF-001: One\r\n#### Details\r\nSource: FR-001\r\n### SF-002: Two (FR-002)\r\n## Notes\r\nFR-009 and NFR-003\r\n',
      ])
    ).toEqual({
      defined: { requirements: [], features: ['SF-001', 'SF-002'], components: [] },
      links: { 'SF-001': ['FR-001'], 'SF-002': ['FR-002'] },
    });
  });
});

/** Documents in the shape the audit reads, by directory. */
function loaded(files: ProjectFiles): LoadedDocument[] {
  const kinds: Readonly<Record<string, DocumentKind>> = {
    'docs/prd/': 'PRD',
    'docs/srs/': 'SRS',
    'docs/sds/': 'SDS',
  };
  return Object.entries(files).flatMap(([path, content]) => {
    const kind = Object.entries(kinds).find(([prefix]) => path.startsWith(prefix))?.[1];
    if (kind === undefined || classifyPath(path) !== 'document') return [];
    return [{ relativePath: path, absolutePath: path, kind, content, lines: content.split('\n') }];
  });
}

describe('planted drift', () => {
  /**
   * Inventories derived from a checkout, in the shape the comparator reads, and its
   * gaps. Its built-in table adds an unmatched row per AD-SDLC agent, which describe
   * AD-SDLC itself and not a target project, so only rows about the fixture count.
   */
  async function comparatorGaps(name: string, checkout: string): Promise<GapItem[]> {
    const files = filesOf(checkout);
    const headings = (prefix: string): { id: string; name: string }[] =>
      Object.entries(files)
        .filter(([path]) => classifyPath(path) === 'document')
        .flatMap(([, content]) => [
          ...content.matchAll(
            new RegExp(`^#{2,5} (${prefix}-\\d{3}): (.+?)(?: \\[\\w+\\])?$`, 'gm')
          ),
        ])
        .map((match) => ({ id: match[1] ?? '', name: match[2] ?? '' }));
    const documents = join(dir, `${name}-current_state.yaml`);
    writeFileSync(
      documents,
      yaml.dump({
        current_state: {
          requirements: {
            functional: headings('FR').map((item) => ({ id: item.id, title: item.name })),
          },
          features: headings('SF'),
          components: headings('CMP'),
        },
      })
    );
    const code = join(dir, `${name}-code_inventory.yaml`);
    writeFileSync(
      code,
      yaml.dump({
        code_inventory: {
          modules: Object.entries(files)
            .filter(([path]) => path.startsWith('src/'))
            .map(([path, content]) => ({
              name: basename(path, '.mjs'),
              path,
              functions: [...content.matchAll(/^export function (\w+)/gm)].map((match) => ({
                name: match[1],
              })),
            })),
        },
      })
    );
    const agent = new DocCodeComparatorAgent({
      scratchpadBasePath: join(dir, `${name}-scratchpad`),
      generateIssues: false,
    });
    await agent.startSession('task-ledger');
    const { result } = await agent.compare(documents, code);
    await agent.dispose();
    const known = new Set(Object.values(documentIndex(files).defined).flat());
    return result.gaps.filter(
      (gap) => gap.documentReference === undefined || known.has(gap.documentReference)
    );
  }

  it('is the one gap DocCodeComparatorAgent finds, with the expected kind and reference', async () => {
    const gaps = await comparatorGaps('target', project('drift-target'));
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({
      type: 'documented_not_implemented',
      documentReference: 'CMP-003',
    });
    expect(expectation.drift.acceptedKinds).toContain(gaps[0]?.type);
    expect(expectation.drift.ids).toContain(gaps[0]?.documentReference);
  });

  it('stays the one gap on the reference, and disappears when the drift is fixed', async () => {
    const reference = project('drift-reference', ENHANCEMENT_FIXTURE.reference);
    expect(
      (await comparatorGaps('reference', reference)).map((gap) => gap.documentReference)
    ).toEqual(['CMP-003']);
    const fixed = project('drift-fixed', ENHANCEMENT_FIXTURE.reference, WRONG.driftFixed);
    expect(await comparatorGaps('fixed', fixed)).toEqual([]);
  });

  it('is the only source file the documents name that does not exist', () => {
    const files = filesOf(project('source-files'));
    const named = [...(files[SDS] ?? '').matchAll(/\*\*Source file\*\*: `([^`]+)`/g)].map(
      (match) => match[1] ?? ''
    );
    expect(named.length).toBe(documentIndex(files).defined.components.length);
    expect(named.filter((path) => files[path] === undefined)).toEqual([
      expectation.drift.sourceFile,
    ]);
  });
});

describe('expectation file', () => {
  it('names what the target defines, and keeps the drift apart from the feature', () => {
    const { defined } = documentIndex(filesOf(project('expectation')));
    expect(expectation.preserved).toEqual(defined);
    for (const kind of ['requirements', 'features', 'components'] as const)
      for (const id of expectation.impacted[kind]) expect(defined[kind]).toContain(id);
    const impacted = Object.values(expectation.impacted).flat();
    for (const id of expectation.drift.ids) {
      expect(impacted).not.toContain(id);
      expect(Object.values(defined).flat()).toContain(id);
    }
    expect(expectation.drift.outcome).toBe('reported-not-fixed');
    for (const path of [
      expectation.drift.sourceFile,
      'test/tasks.test.mjs',
      'test/report.test.mjs',
    ])
      expect(expectation.paths.forbidden).toContain(path);
  });

  it('is rejected when its shape is wrong', () => {
    const parse = (change: Record<string, unknown>): boolean =>
      EnhancementExpectationSchema.safeParse({ ...expectation, ...change }).success;
    expect(parse({})).toBe(true);
    expect(parse({ schemaVersion: 2 })).toBe(false);
    expect(parse({ extra: true })).toBe(false);
    expect(parse({ preserved: { ...expectation.preserved, requirements: ['REQ-1'] } })).toBe(false);
    expect(parse({ drift: { ...expectation.drift, outcome: 'fixed' } })).toBe(false);
    expect(parse({ drift: { ...expectation.drift, acceptedKinds: ['typo'] } })).toBe(false);
  });

  it('states the criteria the feature test names, in requirements that never name the drift', () => {
    const test = readFileSync(join(ENHANCEMENT_FIXTURE.acceptance, 'feature.test.mjs'), 'utf8');
    const named = [...new Set([...test.matchAll(/AC-\d{3}/g)].map((match) => match[0]))];
    expect(named).toEqual(
      expectation.feature.acceptanceCriteria.map((criterion) => criterion.slice(0, 6))
    );
    const requirements = enhancementRequirements(expectation);
    for (const secret of [...expectation.drift.ids, expectation.drift.sourceFile, 'archive'])
      expect(requirements).not.toContain(secret);
    expect(requirements).toContain(expectation.feature.request);
    expect(requirements).toMatch(/do not merge or close it/);
    expect(requirements).toMatch(/updated documents/);
  });
});

describe('independent acceptance tests', SPAWNING, () => {
  it('fail the feature and pass the retained behavior on the target', () => {
    const target = project('acceptance-target');
    expect(acceptance(target, 'feature').passed).toBe(false);
    const retained = acceptance(target, 'retained');
    expect(retained.passed, retained.output).toBe(true);
  });

  it('pass both on the reference, whose own tests pass too', () => {
    const reference = project('acceptance-reference', ENHANCEMENT_FIXTURE.reference);
    for (const key of ['retained', 'feature'] as const) {
      const result = acceptance(reference, key);
      expect(result.passed, result.output).toBe(true);
      expect(result.pass).toBe(result.tests);
    }
    expect(targetTests(reference)).toBe(0);
  });

  it('fail the retained behavior on the variant that breaks it', () => {
    const wrong = project('acceptance-wrong', ENHANCEMENT_FIXTURE.reference, WRONG.retainedBroken);
    expect(acceptance(wrong, 'retained').passed).toBe(false);
    expect(acceptance(wrong, 'feature').passed).toBe(true);
  });
});

const attempt = (stage: string, overrides: Record<string, unknown> = {}) => ({
  kind: 'attempt',
  stage,
  outcome: 'succeeded',
  execution: 'sdk',
  sdkSessionId: `s-${stage}`,
  modelId: 'claude-model',
  sdkVersion: '1.0.0',
  usage: { inputTokens: 10, outputTokens: 5 },
  durationMs: 100,
  errorType: null,
  ...overrides,
});
const stageRecord = (stage: string, status = 'completed', restored = false) => ({
  kind: 'stage',
  stage,
  status,
  restored,
  attempts: { total: restored ? 0 : 1 },
  verification: { state: status === 'failed' ? 'failed' : 'verified_pass' },
});
const NAMES = ENHANCEMENT_STAGES.map((stage) => stage.name);
const COMPARISON = '.ad-sdlc/scratchpad/analysis/task-ledger/comparison_result.yaml';

/** The CLI's JSON output for a run. */
function runOutput(
  status: string,
  stages: readonly Record<string, unknown>[],
  attempts: readonly Record<string, unknown>[],
  options: {
    readonly resumed?: boolean;
    readonly traceability?: string;
    readonly stageResults?: readonly Record<string, unknown>[];
    readonly pipeline?: Record<string, unknown>;
  } = {}
): string {
  return `${JSON.stringify({
    pipelineId: 'session-1',
    overallStatus: status,
    verification: { status: status === 'completed' ? 'verified' : 'failed' },
    traceability: { status: options.traceability ?? 'covered', uncovered: [] },
    stages: options.stageResults ?? [{ name: COMPARISON_STAGE, artifacts: [COMPARISON] }],
    metrics: {
      records: [
        ...attempts,
        ...stages,
        {
          kind: 'pipeline',
          status,
          durationMs: 1234,
          usage: {
            inputTokens: 150,
            outputTokens: 75,
            cacheReadInputTokens: null,
            cacheCreationInputTokens: 3,
          },
          turnCount: 30,
          toolUseCount: 44,
          attempts: { total: attempts.length },
          resume: { resumed: options.resumed ?? false },
          ...options.pipeline,
        },
      ],
    },
  })}\n`;
}

const invocationOf = (name: string, exitCode: number, stdout: string): InvocationEvidence =>
  invocationEvidence(name, { status: exitCode, signal: null, stdout }, 1000);

const COMPARISON_YAML = [
  'comparison_result:',
  '  project: { name: task-ledger }',
  '  mappings:',
  '    - { documentId: CMP-001, codeModulePath: src/tasks.mjs, status: matched }',
  '  gaps:',
  '    - id: GAP-001',
  '      type: documented_not_implemented',
  '      documentReference: CMP-003',
  '      codeReference: src/archive.mjs',
  '      relatedIds: [FR-003, SF-003, CMP-003]',
  '  gap_summary: { by_type: { documented_not_implemented: 1 }, total_gaps: 1 }',
  '',
].join('\n');
const detected = driftEvidence(expectation, [{ path: COMPARISON, content: COMPARISON_YAML }]);

describe('drift evidence', () => {
  const judged = (content: string, path = COMPARISON) =>
    driftEvidence(expectation, [{ path, content }]);

  it('finds the entry that names the planted identifier, source file, and kind', () => {
    expect(detected).toMatchObject({
      detected: true,
      artifact: COMPARISON,
      kind: 'documented_not_implemented',
      artifacts: [COMPARISON],
    });
    expect(detected.unresolved).toHaveLength(1);
    expect(detected.unresolved[0]?.text).toContain('GAP-001');
  });

  it('accepts other shapes a model may write: grouped by kind, keyed by gap, and JSON', () => {
    const grouped = yaml.dump({
      gaps: {
        documented_not_implemented: [{ ref: 'SF-003', source: 'src/archive.mjs' }],
      },
    });
    expect(judged(grouped).detected).toBe(true);
    const keyed = yaml.dump({
      gaps: {
        'GAP-001': { kind: 'documentation_code_mismatch', ref: 'FR-003', file: 'src/archive.mjs' },
      },
    });
    expect(judged(keyed)).toMatchObject({ detected: true, kind: 'documentation_code_mismatch' });
    expect(
      judged(
        JSON.stringify({
          gaps: [{ type: 'documented_not_implemented', ids: ['CMP-003'], file: 'src/archive.mjs' }],
        }),
        '.ad-sdlc/x/gap_issues.json'
      ).artifact
    ).toBe('.ad-sdlc/x/gap_issues.json');
  });

  it('still lists the drift as unresolved when the artifact does not call its list gaps', () => {
    const findings = yaml.dump({
      findings: [{ type: 'documented_not_implemented', ref: 'CMP-003', file: 'src/archive.mjs' }],
    });
    expect(judged(findings)).toMatchObject({ detected: true, artifact: COMPARISON });
    expect(judged(findings).unresolved).toHaveLength(1);
  });

  it('does not combine a kind, an identifier, and a file from unrelated parts of the file', () => {
    const scattered = [
      'comparison_result:',
      '  mappings:',
      '    - { documentId: CMP-003, codeModulePath: src/archive.mjs, status: matched }',
      '  gaps: []',
      '  gap_summary: { by_type: { documented_not_implemented: 0 } }',
      '',
    ].join('\n');
    expect(judged(scattered).detected).toBe(false);
  });

  it.each([
    ['no source file', 'gaps:\n  - { type: documented_not_implemented, ref: CMP-003 }\n'],
    [
      'no planted identifier',
      'gaps:\n  - { type: documented_not_implemented, file: src/archive.mjs }\n',
    ],
    [
      'no accepted kind',
      'gaps:\n  - { type: implemented_not_documented, ref: CMP-003, file: src/archive.mjs }\n',
    ],
    ['text that is not structured', ': : not yaml {'],
  ])('rejects an artifact with %s', (_name, content) => {
    expect(judged(content).detected).toBe(false);
  });

  it('locates the artifacts through the run result, not a hard-coded name', () => {
    const stdout = runOutput('completed', [], [], {
      stageResults: [
        { name: COMPARISON_STAGE, artifacts: ['.ad-sdlc\\scratchpad\\x\\any-name.yaml'] },
        { name: 'review', artifacts: ['other.yaml'] },
      ],
    });
    expect(stageArtifactPaths(stdout, COMPARISON_STAGE)).toEqual([
      '.ad-sdlc/scratchpad/x/any-name.yaml',
    ]);
    expect(stageArtifactPaths(stdout, 'code_reading')).toEqual([]);
    expect(stageArtifactPaths('no json', COMPARISON_STAGE)).toEqual([]);
  });
});

describe('delta judge', () => {
  const base = (): ProjectFiles => filesOf(project('delta-base'));
  const solved = (): ProjectFiles =>
    filesOf(project('delta-solved', ENHANCEMENT_FIXTURE.reference));
  const delta = (change: (files: Record<string, string>) => void) => {
    const after = { ...solved() };
    change(after);
    return deltaProblems(expectation, documentDelta(base(), after));
  };

  it('accepts the reference, and classifies the localized copies instead of judging them', () => {
    const result = documentDelta(base(), solved());
    expect(deltaProblems(expectation, result)).toEqual([]);
    expect(result.newIds).toEqual({
      requirements: ['FR-004'],
      features: ['SF-004'],
      components: [],
    });
    expect(result.changedDocuments).toEqual([PRD, SDS, SRS]);
    expect(result.localizedCopies).toEqual([
      'docs/prd/PRD-001-task-ledger.kr.md',
      'docs/sds/SDS-001-task-ledger.kr.md',
      'docs/srs/SRS-001-task-ledger.kr.md',
    ]);
    expect(classifyPath('docs/.index/manifest.yaml')).toBe('document-index');
    expect(classifyPath('src/report.mjs')).toBe('other');
  });

  it('accepts what init and the index stage add', () => {
    expect(
      delta((files) => {
        files['.gitignore'] = `${files['.gitignore'] ?? ''}# AD-SDLC\n`;
        files['docs/.index/manifest.yaml'] = 'documents: []\n';
        files['README.md'] = `${files['README.md'] ?? ''}\nOverdue report added.\n`;
      })
    ).toEqual([]);
  });

  it('gives an empty document delta its own message', () => {
    expect(deltaProblems(expectation, documentDelta(base(), base()))).toEqual([NO_DOCUMENT_DELTA]);
    const codeOnly = { ...base(), 'src/report.mjs': solved()['src/report.mjs'] ?? '' };
    expect(deltaProblems(expectation, documentDelta(base(), codeOnly))).toEqual([
      NO_DOCUMENT_DELTA,
    ]);
  });

  it('asks for a delta in each document of the chain', () => {
    expect(
      delta((files) => {
        files[SDS] = base()[SDS] ?? '';
      })
    ).toContain('The pull request changes no document under docs/sds/');
  });

  it('rejects a dropped identifier, a changed link, and a lost link', () => {
    expect(
      delta((files) => {
        files[SDS] = (files[SDS] ?? '').replace(/### CMP-003[\s\S]*$/, '');
      })
    ).toContain('Prior identifier CMP-003 is no longer defined');
    expect(
      delta((files) => {
        files[SRS] = (files[SRS] ?? '').replace('**Source**: FR-001', '**Source**: FR-002');
      })
    ).toContain('Links of unimpacted SF-001 changed from [FR-001] to [FR-002]');
    expect(
      delta((files) => {
        files[SDS] = (files[SDS] ?? '').replace(
          '**Implements**: SF-002, SF-004',
          '**Implements**: SF-004'
        );
      })
    ).toContain('Impacted CMP-002 lost its link to SF-002');
  });

  it('rejects new identifiers over the allowance, linked elsewhere, or ending the chain', () => {
    const newComponents = (body: string): string =>
      `\n### CMP-004: Extra\n\n- **Implements**: ${body}\n\n### CMP-005: More\n\n- **Implements**: SF-004\n`;
    expect(
      delta((files) => {
        files[SDS] = `${files[SDS] ?? ''}${newComponents('SF-004')}`;
      })
    ).toContain('2 new components (CMP-004, CMP-005) exceed the allowance of 1');
    expect(
      delta((files) => {
        files[SDS] = `${files[SDS] ?? ''}\n### CMP-004: Extra\n\n- **Implements**: SF-001\n`;
      })
    ).toContain('New CMP-004 links to SF-001, which the feature does not impact');
    expect(
      delta((files) => {
        files[SRS] = `${files[SRS] ?? ''}\n### SF-005: Extra\n\n- **Source**: FR-001\n`;
      })
    ).toEqual(
      expect.arrayContaining([
        'New SF-005 links to FR-001, which the feature does not impact',
        'New SF-005 is not linked from the next document, so the chain stops there',
      ])
    );
    expect(
      delta((files) => {
        files[PRD] = `${files[PRD] ?? ''}\n### FR-005: Unlinked\n\nMore.\n`;
      })
    ).toContain('New FR-005 is not linked from the next document, so the chain stops there');
  });

  it('rejects forbidden paths and paths outside the allowed ones', () => {
    expect(
      delta((files) => {
        files['test/report.test.mjs'] = 'changed\n';
        files['src/archive.mjs'] = 'export {};\n';
        files['package.json'] = '{}\n';
        files['scripts/tool.mjs'] = 'export {};\n';
      })
    ).toEqual(
      expect.arrayContaining([
        'The pull request changes forbidden path test/report.test.mjs',
        'The pull request changes forbidden path src/archive.mjs',
        'The pull request changes forbidden path package.json',
        'The pull request changes scripts/tool.mjs, which is outside the allowed paths',
      ])
    );
  });
});

describe('scenario verdicts', SPAWNING, () => {
  /**
   * A local repository whose `head` commit lays the solutions over the target, and
   * the judgement of that head.
   */
  function judgeSolution(
    name: string,
    overlays: readonly string[],
    change: (checkout: string) => void = () => undefined
  ): PullRequestJudgement {
    const env = githubEnv(offlineEnv(), undefined, dir);
    const checkout = project(name);
    const git = (args: readonly string[]): string =>
      exec('git', args, { cwd: checkout, env }).trim();
    git(['init', '-b', 'main']);
    git(['add', '-A']);
    git(['commit', '-m', 'base']);
    const base = git(['rev-parse', 'HEAD']);
    git(['checkout', '-b', 'solution']);
    for (const overlay of overlays) applyOverlay(checkout, overlay);
    change(checkout);
    git(['add', '-A']);
    git(['commit', '--allow-empty', '-m', 'solution']);
    return judgePullRequestHead(checkout, base, git(['rev-parse', 'HEAD']), expectation, env);
  }

  const openPullRequest = (judgement: PullRequestJudgement | null): EnhancementPullRequest => ({
    number: 7,
    state: 'OPEN',
    merged: false,
    headRefName: 'feature/ISS-001-overdue',
    judgement,
  });
  const deliveredOutput = runOutput(
    'completed',
    NAMES.map((name) => stageRecord(name)),
    NAMES.map((name) => attempt(name))
  );
  const delivered = (judgement: PullRequestJudgement): EnhancementObservation => ({
    invocations: [invocationOf('run', 0, deliveredOutput)],
    runs: [runSummary('run', deliveredOutput)],
    pullRequests: [openPullRequest(judgement)],
    pullRequestsAtStop: 0,
    drift: detected,
    regressionSwitchSeen: false,
  });
  const evaluate = (observation: EnhancementObservation): string[] =>
    evaluateEnhancementScenario(scenario('delivery'), observation, expectation);

  describe('delivery', () => {
    it('accepts the reference, and the judgement holds a reviewable diff', () => {
      const judgement = judgeSolution('reference', [ENHANCEMENT_FIXTURE.reference]);
      expect(evaluate(delivered(judgement))).toEqual([]);
      expect(judgement.retained.passed).toBe(true);
      expect(judgement.feature.passed).toBe(true);
      expect(judgement.diff).toContain('+### FR-004: Report overdue tasks [NEW]');
      expect(judgement.diff).toContain('+### SF-004: Overdue report [NEW]');
      expect(judgement.diff).toContain('docs/sds/SDS-001-task-ledger.md');
      expect(judgement.diff).not.toContain('src/report.mjs b/src/report.mjs');
    });

    it('rejects a variant that changes an unrelated identifier', () => {
      const judgement = judgeSolution('unrelated', [
        ENHANCEMENT_FIXTURE.reference,
        WRONG.unrelatedId,
      ]);
      expect(evaluate(delivered(judgement))).toEqual(
        expect.arrayContaining([
          'Links of unimpacted CMP-001 changed from [SF-001] to [SF-002]',
          'Prior identifier CMP-003 is no longer defined',
        ])
      );
    });

    it('rejects a variant that breaks a retained behavior', () => {
      const judgement = judgeSolution('retained', [
        ENHANCEMENT_FIXTURE.reference,
        WRONG.retainedBroken,
      ]);
      expect(evaluate(delivered(judgement))).toEqual([
        'retained tests did not pass on pull request #7',
      ]);
    });

    it('rejects the feature with no document delta', () => {
      const judgement = judgeSolution(
        'no-documents',
        [ENHANCEMENT_FIXTURE.reference],
        (checkout) => {
          const target = filesOf(ENHANCEMENT_FIXTURE.target);
          for (const path of [PRD, SRS, SDS])
            writeFileSync(join(checkout, path), target[path] ?? '');
          for (const path of ['docs/prd', 'docs/srs', 'docs/sds'])
            for (const file of readdirSync(join(checkout, path)))
              if (file.endsWith('.kr.md')) rmSync(join(checkout, path, file));
        }
      );
      expect(judgement.feature.passed).toBe(true);
      expect(evaluate(delivered(judgement))).toEqual([NO_DOCUMENT_DELTA]);
    });

    it('rejects a variant that silently fixes the drift', () => {
      const judgement = judgeSolution('fixed', [ENHANCEMENT_FIXTURE.reference, WRONG.driftFixed]);
      expect(evaluate(delivered(judgement))).toEqual(
        expect.arrayContaining([
          'The pull request changes forbidden path src/archive.mjs',
          'pull request #7 adds src/archive.mjs: the drift was silently fixed instead of reported',
        ])
      );
    });

    it('rejects a merged pull request, no pull request, and two pull requests', () => {
      const judgement = judgeSolution('states', [ENHANCEMENT_FIXTURE.reference]);
      const observation = delivered(judgement);
      expect(
        evaluate({
          ...observation,
          pullRequests: [{ ...openPullRequest(judgement), merged: true, state: 'MERGED' }],
        })
      ).toEqual(['pull request #7 was merged', 'pull request #7 is MERGED']);
      expect(evaluate({ ...observation, pullRequests: [] })).toEqual([
        'no pull request was opened',
      ]);
      expect(
        evaluate({
          ...observation,
          pullRequests: [openPullRequest(judgement), { ...openPullRequest(judgement), number: 8 }],
        })
      ).toContain('2 pull requests were opened instead of one');
    });

    it('rejects a run that failed, is not traced, or has no comparison evidence', () => {
      const judgement = judgeSolution('runs', [ENHANCEMENT_FIXTURE.reference]);
      const observation = delivered(judgement);
      const uncovered = runOutput(
        'completed',
        NAMES.map((name) => stageRecord(name)),
        NAMES.map((name) => attempt(name)),
        { traceability: 'uncovered' }
      );
      expect(evaluate({ ...observation, runs: [runSummary('run', uncovered)] })).toEqual([
        'traceability is uncovered',
      ]);
      const failed = runOutput(
        'partial',
        [stageRecord('review', 'skipped'), stageRecord('doc_indexing', 'skipped')],
        [attempt('review', { sdkSessionId: null })]
      );
      expect(evaluate({ ...observation, invocations: [invocationOf('run', 1, failed)] })).toEqual(
        expect.arrayContaining([
          'run ended partial with exit 1',
          'review did not complete',
          'doc_indexing did not complete',
          'run review: no SDK session ID',
        ])
      );
      expect(evaluate({ ...observation, drift: null })).toEqual([
        'the comparison stage produced no artifact to judge',
      ]);
      expect(
        evaluate({
          ...observation,
          drift: driftEvidence(expectation, [{ path: COMPARISON, content: 'gaps: []\n' }]),
        })[0]
      ).toMatch(/no entry of .*comparison_result\.yaml names FR-003 or SF-003 or CMP-003/);
    });

    it('reports one row per criterion', () => {
      const rows = judgeEnhancementScenario(
        scenario('delivery'),
        delivered(judgeSolution('rows', [ENHANCEMENT_FIXTURE.reference])),
        expectation
      );
      expect(rows.map((row) => row.criterion)).toEqual([
        'Run completed and traced',
        'One open, unmerged pull request',
        'Seeded mismatch detected with a reference',
        'Only expected relationships changed',
        'Acceptance and retained tests pass',
        'Drift reported, not silently fixed',
      ]);
      expect(rows.every((row) => row.problems.length === 0)).toBe(true);
    });
  });

  describe('regression', () => {
    const before = NAMES.slice(0, NAMES.indexOf('implementation') + 1);
    const failedStageResult = {
      name: 'regression_testing',
      error: 'Verification failed',
      artifacts: [],
      verification: {
        checks: [{ checkId: 'VR-REG-002', outcome: 'fail', message: 'Regression tests failed' }],
      },
    };
    const stopped = runOutput(
      'completed',
      before.map((name) => stageRecord(name)),
      before.map((name) => attempt(name))
    );
    const blocked = runOutput(
      'partial',
      [
        ...before.map((name) => stageRecord(name, 'completed', true)),
        stageRecord('regression_testing', 'failed'),
        stageRecord('validation-agent', 'skipped'),
        stageRecord('review', 'skipped'),
        stageRecord('doc_indexing', 'skipped'),
      ],
      [attempt('regression_testing')],
      { resumed: true, stageResults: [failedStageResult] }
    );
    const observation: EnhancementObservation = {
      invocations: [invocationOf('run', 0, stopped), invocationOf('resume-1', 1, blocked)],
      runs: [runSummary('run', stopped), runSummary('resume-1', blocked)],
      pullRequests: [],
      pullRequestsAtStop: 0,
      drift: detected,
      regressionSwitchSeen: true,
    };
    const evaluateRegression = (changes: Partial<EnhancementObservation>): string[] =>
      evaluateEnhancementScenario(
        scenario('regression'),
        { ...observation, ...changes },
        expectation
      );

    it('accepts a blocked delivery with VR-REG-002 among the failed checks', () => {
      expect(evaluateRegression({})).toEqual([]);
      expect(scenario('regression')).toMatchObject({
        stopAfter: 'implementation',
        resumeEnv: { [REGRESSION_ENV]: '1' },
      });
      expect(NAMES).toContain(scenario('regression').stopAfter);
    });

    it('reports a switch that did not arrive instead of passing', () => {
      expect(evaluateRegression({ regressionSwitchSeen: false })).toEqual([
        expect.stringContaining(`${REGRESSION_ENV} did not reach a retained test`),
      ]);
    });

    it('rejects a run that delivers despite the failed test', () => {
      const delivers = runOutput(
        'completed',
        [
          ...before.map((name) => stageRecord(name, 'completed', true)),
          stageRecord('regression_testing'),
          stageRecord('validation-agent'),
          stageRecord('review'),
          stageRecord('doc_indexing'),
        ],
        [attempt('regression_testing'), attempt('review')],
        { resumed: true, stageResults: [] }
      );
      expect(
        evaluateRegression({
          invocations: [invocationOf('run', 0, stopped), invocationOf('resume-1', 0, delivers)],
          pullRequests: [openPullRequest(null)],
        })
      ).toEqual(
        expect.arrayContaining([
          'the resume exited 0 although a retained test failed',
          'the resume reported completed delivery',
          'regression_testing completed although a retained test failed',
          'VR-REG-002 is not among the failed checks of regression_testing',
          'validation-agent completed',
          'review completed',
          'doc_indexing completed',
          '1 pull request(s) were opened',
        ])
      );
    });

    it('rejects a failure from another check, a missing resume, and an early pull request', () => {
      const other = runOutput(
        'partial',
        [stageRecord('regression_testing', 'failed')],
        [attempt('regression_testing')],
        {
          resumed: true,
          stageResults: [
            {
              name: 'regression_testing',
              verification: { checks: [{ checkId: 'VR-REG-001', outcome: 'fail', message: 'x' }] },
            },
          ],
        }
      );
      expect(
        evaluateRegression({
          invocations: [invocationOf('run', 0, stopped), invocationOf('resume-1', 1, other)],
        })
      ).toEqual(['VR-REG-002 is not among the failed checks of regression_testing']);
      expect(evaluateRegression({ invocations: [invocationOf('run', 0, stopped)] })).toEqual([
        'the run was not resumed',
      ]);
      expect(evaluateRegression({ pullRequestsAtStop: 1 })).toEqual([
        'a pull request was opened before the stop',
      ]);
      const failedStop = runOutput('partial', [stageRecord('implementation', 'failed')], []);
      expect(
        evaluateRegression({
          invocations: [invocationOf('run', 1, failedStop)],
        })
      ).toEqual(
        expect.arrayContaining([
          'the stopped run: run ended partial with exit 1',
          'implementation did not complete before the stop',
          'the run was not resumed',
        ])
      );
    });
  });
});

describe('issue ownership', () => {
  it('identifies the issues a run generated', () => {
    expect(ownedIssues([1, 2, 3], [4, 3, 2, 1, 40])).toEqual([4, 40]);
  });
});

describe('run summary and report', () => {
  const judgement: PullRequestJudgement = {
    delta: documentDelta(
      { [PRD]: '### FR-001: One\n' },
      { [PRD]: '### FR-001: One\n### FR-004: New\n', 'docs/prd/PRD-001.kr.md': 'x\n' }
    ),
    diff: 'diff --git a/docs/prd/PRD-001.md b/docs/prd/PRD-001.md\n+### FR-004: New\n',
    retained: { passed: true, tests: 5, pass: 5, fail: 0 },
    feature: { passed: true, tests: 5, pass: 5, fail: 0 },
    driftSourcePresent: false,
  };
  const pr: EnhancementPullRequest = {
    number: 7,
    state: 'OPEN',
    merged: false,
    headRefName: 'feature/x',
    judgement,
  };
  const failing = runOutput(
    'partial',
    [stageRecord('regression_testing', 'failed'), stageRecord('review', 'skipped')],
    [attempt('regression_testing', { outcome: 'succeeded', sdkSessionId: 's-failed' })],
    {
      resumed: true,
      stageResults: [
        {
          name: 'regression_testing',
          verification: {
            checks: [{ checkId: 'VR-REG-002', outcome: 'fail', message: 'Regression | failed' }],
          },
        },
      ],
    }
  );
  const passing = runOutput('completed', [stageRecord('review')], [attempt('review')]);
  const result = (
    id: EnhancementScenario['id'],
    output: string,
    extra: Partial<EnhancementScenarioResult> = {}
  ): EnhancementScenarioResult => ({
    id,
    description: scenario(id).description,
    outcome: 'passed',
    reason: null,
    rows: [{ criterion: 'Row', problems: [] }],
    invocations: [invocationOf('run', 0, output)],
    runs: [runSummary('run', output)],
    issues: [11],
    pullRequests: [],
    drift: detected,
    requiredHumanCorrections: null,
    cleanup: ['closed issue #11'],
    ...extra,
  });
  const results = [
    result('delivery', passing, { pullRequests: [pr] }),
    result('regression', failing),
  ];
  const meta = {
    runId: 'r1',
    repository: 'owner/target',
    packageVersion: '0.1.0',
    sdkVersion: '1.0.0',
    budget,
    auth: 'secrets',
    permissions: LIVE_PERMISSIONS,
    startedAt: '2026-11-01T00:00:00.000Z',
    finishedAt: '2026-11-01T01:00:00.000Z',
  };

  it('reads usage and duration from the records, and unknown stays null, never 0', () => {
    expect(runSummary('run', failing)).toMatchObject({
      invocation: 'run',
      completed: false,
      status: 'partial',
      durationMs: 1234,
      usage: {
        inputTokens: 150,
        outputTokens: 75,
        cacheReadInputTokens: null,
        cacheCreationInputTokens: 3,
      },
      turnCount: 30,
      toolUseCount: 44,
      attempts: 1,
      verification: 'failed',
      traceability: 'covered',
      uncovered: [],
    });
    const unknown = runOutput('partial', [], [], {
      pipeline: { usage: null, durationMs: undefined, turnCount: null, toolUseCount: null },
    });
    expect(runSummary('run', unknown)).toMatchObject({
      usage: null,
      durationMs: null,
      turnCount: null,
      toolUseCount: null,
    });
    expect(runSummary('run', 'not json')).toMatchObject({
      completed: false,
      status: null,
      usage: null,
      durationMs: null,
      traceability: null,
    });
    const markdown = renderEnhancementReport(meta, [
      result('delivery', unknown),
      result('regression', 'not json'),
    ]);
    expect(markdown).toContain(
      '| run | false | partial | — | — | — | — | — | — | — | 0 | failed |'
    );
    expect(markdown).toContain('| run | false | — | — | — | — | — | — | — | — | — | — | — |');
  });

  it('holds every scenario, invocation, attempt, the drift, corrections, and the diff', () => {
    const markdown = renderEnhancementReport(meta, results);
    expect(enhancementReportProblems(results, markdown)).toEqual([]);
    expect(markdown).toContain('| regression_testing | failed | false |');
    expect(markdown).toContain('s-failed');
    expect(markdown).toContain('VR-REG-002: Regression \\| failed');
    expect(markdown).toContain('| run | false | partial | 1234 | 150 | 75 | — | 3 | 30 | 44 | 1 |');
    expect(markdown).toContain('Planted drift detected in');
    expect(markdown).toContain('Required human corrections: not assessed (—)');
    expect(markdown).toContain('ad-sdlc telemetry report --supplied');
    expect(markdown).toContain('+### FR-004: New');
    expect(markdown).toContain('| #7 | OPEN | false | 5/5 passed | 5/5 passed | FR-004 |');
    expect(markdown).toContain('docs/prd/PRD-001.kr.md');
    expect(markdown).toContain('Cleanup: closed issue #11.');
    expect(markdown).toContain('`Bash(gh pr merge:*)`');
  });

  it('rejects a report without the unsuccessful stages, a scenario, or a section', () => {
    const successful = [result('delivery', passing), result('regression', passing)];
    expect(
      enhancementReportProblems(successful, renderEnhancementReport(meta, successful))
    ).toContain('the report shows no unsuccessful or skipped stage');
    const partial = results.slice(0, 1);
    expect(enhancementReportProblems(partial, renderEnhancementReport(meta, partial))).toEqual(
      expect.arrayContaining(['scenario regression is missing'])
    );
    expect(enhancementReportProblems(results, '')).toEqual(
      expect.arrayContaining([
        'no section for delivery',
        'delivery: invocation run is missing',
        'regression: attempt s-failed is missing',
        'delivery: no usage row for run',
        'delivery: no document diff for pull request #7',
        'no unresolved drift section',
        'no statement that human corrections are not assessed',
      ])
    );
  });

  it('saves the document diff by itself, because cleanup closes the pull request', () => {
    expect(renderDocumentDiffs(results)).toContain('# delivery: pull request #7');
    expect(renderDocumentDiffs(results)).toContain('+### FR-004: New');
    expect(renderDocumentDiffs([results[1]!])).toMatch(/No pull request was judged/);
  });

  it('writes a delivery_review template the telemetry report accepts, with every judgement null', () => {
    const template = deliveryReviewTemplate(meta, results);
    expect(DeliveryReviewInputSchema.parse(template)).toEqual({
      schemaVersion: 1,
      kind: 'delivery_review',
      collectedAt: '2026-11-01',
      pullRequests: [
        { id: 'owner/target#7', sessionId: 'session-1', accepted: null, reworkMinutes: null },
      ],
      requirements: [{ id: 'FR-004', evidence: null }],
    });
  });

  it('removes credential values from report text', () => {
    expect(redactValues('token abc in abc', ['abc', undefined, ''])).toBe(
      'token [redacted] in [redacted]'
    );
  });
});

describe('live Enhancement invocation (offline)', () => {
  it('is accepted by the production CLI with the turn budget on all 15 agents', async () => {
    const claudeConfigDir = join(dir, 'claude-config');
    mkdirSync(claudeConfigDir);
    const env = liveChildEnv(offlineEnv(), claudeConfigDir);
    const target = project('enhancement project');
    const init = runSourceCli(['init', target, '--quick', '--skip-validation'], env, 120_000);
    expect(init.status, init.stdout + init.stderr).toBe(0);
    expect(new Set(ENHANCEMENT_AGENTS).size).toBe(15);
    applyTurnBudget(target, budget);
    for (const agent of ENHANCEMENT_AGENTS)
      expect((await resolveProjectAgent(target, agent)).maxTurns, agent).toBe(budget.maxTurns);

    const requirements = enhancementRequirements(expectation);
    const dryRun = runSourceCli(
      enhancementRunArguments(target, budget, requirements, ['--dry-run']),
      env,
      60_000
    );
    expect(dryRun.status, dryRun.stdout + dryRun.stderr).toBe(0);
    const plan = parseCliJson(dryRun.stdout) as {
      ready: boolean;
      config: { mode: string; localMode: boolean; approvalMode: string; vnv: { profile?: string } };
      retryPolicy: { maxAttempts: number };
      stages: { name: string; timeoutMs: number }[];
      diagnostics: unknown[];
    };
    expect(plan).toMatchObject({
      ready: true,
      config: {
        mode: 'enhancement',
        localMode: false,
        approvalMode: 'auto',
        vnv: { profile: 'delivery' },
      },
      retryPolicy: { maxAttempts: 1 },
      diagnostics: [],
    });
    expect(plan.stages.map((stage) => stage.name)).toEqual(NAMES);
    expect(plan.stages).toHaveLength(15);
    for (const stage of plan.stages) expect(stage.timeoutMs).toBe(budget.stageTimeoutMs);

    const stopped = runSourceCli(
      enhancementRunArguments(target, budget, requirements, [
        '--dry-run',
        '--stop-after',
        'implementation',
      ]),
      env,
      60_000
    );
    expect(stopped.status, stopped.stdout + stopped.stderr).toBe(0);
    expect(parseCliJson(stopped.stdout)).toMatchObject({ stopAfterStage: 'implementation' });

    // The resume invocation, with the local-login flag, passes only flags resume
    // accepts (a runtime override would be rejected first); a missing session is reported.
    const resume = runSourceCli(
      [
        ...pipelineResumeArguments(
          target,
          requirements,
          'offline-session',
          liveAuthArguments({ auth: 'local-login' })
        ),
        '--dry-run',
      ],
      env,
      60_000
    );
    expect(resume.status).toBe(1);
    const diagnostics = (parseCliJson(resume.stdout) as { diagnostics: { reason: string }[] })
      .diagnostics;
    expect(diagnostics.map((entry) => entry.reason).join(' ')).toMatch(/Session not found/);
  }, 240_000);
});

describe('live permissions for the Enhancement stages', () => {
  it('keeps the deny list and allows only what the definitions need beyond Import', () => {
    expect(LIVE_PERMISSIONS.deny).toEqual(
      expect.arrayContaining([
        'Bash(gh pr merge:*)',
        'Bash(gh pr close:*)',
        'Bash(gh api:*)',
        'Bash(gh repo delete:*)',
        'Bash(git push --force:*)',
      ])
    );
    const allow: readonly string[] = LIVE_PERMISSIONS.allow;
    expect(allow).toEqual(
      expect.arrayContaining(['Bash(gh label list:*)', 'Bash(gh label create:*)'])
    );
    expect(allow).not.toContain('Bash(gh label delete:*)');
    expect(allow).not.toContain('Bash(gh label:*)');
  });
});

describe('fixture reset', SPAWNING, () => {
  const fixture: TargetFixture = {
    materialize: materializeEnhancementTarget,
    commitMessage: 'test: reset the fixture',
  };

  /** A repository with one commit, and a clone of it. */
  function originAndClone(bare: boolean): {
    readonly clone: string;
    readonly env: NodeJS.ProcessEnv;
  } {
    const env = githubEnv(offlineEnv(), undefined, dir);
    const origin = join(dir, 'origin');
    mkdirSync(origin);
    if (bare) {
      exec('git', ['init', '--bare', '-b', 'main'], { cwd: origin, env });
      const seed = join(dir, 'seed');
      exec('git', ['clone', origin, seed], { env });
      writeFileSync(join(seed, 'old.txt'), 'old\n');
      exec('git', ['add', '-A'], { cwd: seed, env });
      exec('git', ['commit', '-m', 'old'], { cwd: seed, env });
      exec('git', ['push', 'origin', 'HEAD:main'], { cwd: seed, env });
    } else {
      exec('git', ['init', '-b', 'main'], { cwd: origin, env });
      writeFileSync(join(origin, 'old.txt'), 'old\n');
      exec('git', ['add', '-A'], { cwd: origin, env });
      exec('git', ['commit', '-m', 'old'], { cwd: origin, env });
    }
    const clone = join(dir, 'clone');
    exec('git', ['clone', origin, clone], { env });
    return { clone, env };
  }

  it('names the cause and the setting when the remote rejects the push', () => {
    // A non-bare origin rejects a push to its checked-out branch, like a branch rule.
    const { clone, env } = originAndClone(false);
    expect(() => resetCheckoutToFixture(clone, 'main', fixture, env)).toThrow(
      /was rejected, so no scenario ran and no SDK call was made[\s\S]*approving review[\s\S]*AD_SDLC_LIVE_ENHANCEMENT_GITHUB_REPO/
    );
  });

  it('pushes only when the tree differs, and keeps other failures as they are', () => {
    const { clone, env } = originAndClone(true);
    expect(resetCheckoutToFixture(clone, 'main', fixture, env)).toBe(true);
    expect(
      exec('git', ['log', '-1', '--format=%s', 'origin/main'], { cwd: clone, env }).trim()
    ).toBe(fixture.commitMessage);
    expect(resetCheckoutToFixture(clone, 'main', fixture, env)).toBe(false);

    exec('git', ['remote', 'set-url', 'origin', join(dir, 'missing')], { cwd: clone, env });
    const changed: TargetFixture = {
      ...fixture,
      materialize: (target) => {
        fixture.materialize(target);
        writeFileSync(join(target, 'extra.txt'), 'extra\n');
      },
    };
    let message = '';
    try {
      resetCheckoutToFixture(clone, 'main', changed, env);
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toContain('git push origin');
    expect(message).not.toContain('AD_SDLC_LIVE_ENHANCEMENT_GITHUB_REPO');
  });
});

describe('suite selection', () => {
  const required = {
    ANTHROPIC_API_KEY: 'placeholder-not-a-key',
    AD_SDLC_LIVE_GITHUB_REPO: 'owner/disposable-target',
    AD_SDLC_LIVE_GITHUB_TOKEN: 'placeholder-not-a-token',
  };

  it('defaults to import, accepts each suite, and rejects anything else', () => {
    expect(resolveLiveSettings(required, dir).suite).toBe('import');
    for (const suite of ['import', 'enhancement', 'all'])
      expect(resolveLiveSettings({ ...required, AD_SDLC_LIVE_SUITE: suite }, dir)).toMatchObject({
        ready: true,
        suite,
      });
    const invalid = resolveLiveSettings({ ...required, AD_SDLC_LIVE_SUITE: 'everything' }, dir);
    expect(invalid.ready).toBe(false);
    expect(invalid.reason).toMatch(/invalid AD_SDLC_LIVE_SUITE="everything"/);
  });

  it('selects the smoke and the scenarios of the suite', () => {
    const smoke = 'tests/live/sdk-cli-smoke.live.test.ts';
    const importFile = 'tests/live/import-acceptance.live.test.ts';
    const enhancementFile = 'tests/live/enhancement-acceptance.live.test.ts';
    expect(liveSuiteFiles('import')).toEqual([smoke, importFile]);
    expect(liveSuiteFiles('enhancement')).toEqual([smoke, enhancementFile]);
    expect(liveSuiteFiles('all')).toEqual([smoke, importFile, enhancementFile]);
    for (const file of liveSuiteFiles('all')) expect(existsSync(file), file).toBe(true);
  });

  it('falls back to the Import repository, and validates its own setting', () => {
    expect(resolveLiveSettings(required, dir).enhancementRepo).toBe('owner/disposable-target');
    expect(
      resolveLiveSettings(
        { ...required, AD_SDLC_LIVE_ENHANCEMENT_GITHUB_REPO: ' owner/other ' },
        dir
      ).enhancementRepo
    ).toBe('owner/other');
    expect(
      resolveLiveSettings({ ...required, AD_SDLC_LIVE_ENHANCEMENT_GITHUB_REPO: '' }, dir)
        .enhancementRepo
    ).toBe('owner/disposable-target');
    const invalid = resolveLiveSettings(
      { ...required, AD_SDLC_LIVE_ENHANCEMENT_GITHUB_REPO: 'not a repo' },
      dir
    );
    expect(invalid.ready).toBe(false);
    expect(invalid.reason).toMatch(/invalid AD_SDLC_LIVE_ENHANCEMENT_GITHUB_REPO="not a repo"/);
    expect(resolveLiveSettings({}, dir).enhancementRepo).toBeNull();
  });

  it('passes the selected files to Vitest and records the suite and scenario outcomes', () => {
    const root = join(dir, 'fake-root');
    mkdirSync(join(root, 'node_modules', 'vitest'), { recursive: true });
    writeFileSync(join(root, 'package.json'), JSON.stringify({ version: '0.0.0-test' }));
    writeFileSync(
      join(root, 'node_modules', 'vitest', 'vitest.mjs'),
      [
        "import { writeFileSync } from 'node:fs';",
        "import { join } from 'node:path';",
        "const out = process.argv.find((arg) => arg.startsWith('--outputFile.json=')).split('=').slice(1).join('=');",
        `writeFileSync(out, ${JSON.stringify(
          JSON.stringify({
            numTotalTests: 1,
            numPassedTests: 1,
            numFailedTests: 0,
            numPendingTests: 0,
            numTodoTests: 0,
          })
        )});`,
        "writeFileSync(join(process.env.AD_SDLC_LIVE_OUTPUT_DIR, 'vitest-args.json'), JSON.stringify(process.argv.slice(2)));",
        'writeFileSync(join(process.env.AD_SDLC_LIVE_OUTPUT_DIR, \'enhancement-acceptance-report.json\'), \'{"scenarios":[{"id":"regression","outcome":"failed"}]}\');',
      ].join('\n')
    );
    const result = runLiveLane({
      env: { ...offlineEnv(), ...required, AD_SDLC_LIVE_SUITE: 'enhancement' },
      root,
      log: () => undefined,
    });
    expect(result.exitCode).toBe(LIVE_EXIT.passed);
    expect(result.metadata).toMatchObject({
      suite: 'enhancement',
      enhancementScenarios: [{ id: 'regression', outcome: 'failed' }],
      importScenarios: [],
    });
    const args = JSON.parse(
      readFileSync(join(root, 'test-output', 'live', 'vitest-args.json'), 'utf8')
    ) as string[];
    expect(args).toEqual(expect.arrayContaining(liveSuiteFiles('enhancement')));
    expect(args).not.toContain('tests/live/import-acceptance.live.test.ts');
    expect(readFileSync(join(root, 'test-output', 'live', LIVE_FILES.summary), 'utf8')).toContain(
      'regression failed'
    );
  });

  it('still reports not-executed and exits 2 through npm run test:live with no settings', () => {
    const outputDir = join(dir, 'out');
    const run = spawnSync(process.execPath, ['--import', tsxLoader, 'scripts/live-lane.ts'], {
      cwd: process.cwd(),
      env: {
        ...offlineEnv(),
        AD_SDLC_LIVE_OUTPUT_DIR: outputDir,
        AD_SDLC_LIVE_SUITE: 'enhancement',
      },
      encoding: 'utf8',
      timeout: 60_000,
    });
    expect(run.status, run.stdout + run.stderr).toBe(LIVE_EXIT.notExecuted);
    const metadata = JSON.parse(
      readFileSync(join(outputDir, LIVE_FILES.metadata), 'utf8')
    ) as LiveLaneMetadata;
    expect(metadata).toMatchObject({
      status: 'not-executed',
      executed: false,
      suite: 'enhancement',
      enhancementScenarios: [],
    });
  }, 60_000);
});
