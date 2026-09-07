/** Small extension of the existing pipeline YAML persistence, shared with status/resume. */
import { readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import * as yaml from 'js-yaml';
import { z } from 'zod';
import { DEFAULT_ORCHESTRATOR_CONFIG, type StageResult } from '../ad-sdlc-orchestrator/types.js';
import { CANONICAL_STAGE_NAMES } from '../ad-sdlc-orchestrator/plan.js';
import { isRecord } from './runtimeSupport.js';
import { RuntimeConfigError, type EffectiveExecutionPlan } from './runtimeTypes.js';

const integer = z.number().int().min(0).max(2147483647);
const positive = integer.min(1);
const stageName = z.enum(CANONICAL_STAGE_NAMES as [string, ...string[]]);
const snapshotSchema = z.object({
  version: z.literal(1),
  config: z.object({
    mode: z.enum(['greenfield', 'enhancement', 'import']),
    localMode: z.boolean(),
    approvalMode: z.enum(['auto', 'manual', 'critical']),
    maxParallelAgents: positive.max(100),
    maxRetries: integer.max(99),
    retryBackoff: z.object({
      backoffStrategy: z.enum(['fixed', 'linear', 'exponential', 'fibonacci']),
      baseDelayMs: integer,
      maxDelayMs: integer,
    }),
    timeouts: z.object({ default: positive, overrides: z.record(stageName, positive) }),
    vnv: z.object({
      rigor: z.enum(['minimal', 'standard', 'strict']),
      haltOnVerificationFailure: z.boolean(),
    }),
  }),
  retryPolicy: z.object({
    maxAttempts: positive.max(100),
    backoffStrategy: z.enum(['fixed', 'linear', 'exponential', 'fibonacci']),
    baseDelayMs: integer,
    maxDelayMs: integer,
  }),
  stages: z
    .array(
      z.object({
        name: stageName,
        agentType: z.string().min(1),
        description: z.string(),
        parallel: z.boolean(),
        approvalRequired: z.boolean(),
        dependsOn: z.array(stageName),
        timeoutMs: positive,
        skills: z.array(z.string()).optional(),
        maxTurns: positive.optional(),
        permissionMode: z.enum(['default', 'acceptEdits', 'plan']).optional(),
        mcpServers: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .min(1),
  stopAfterStage: stageName.optional(),
  stopBehavior: z.string(),
  sources: z.record(z.string(), z.object({ source: z.string(), path: z.string() })),
  diagnostics: z.array(
    z.object({
      severity: z.enum(['info', 'warning', 'error']),
      code: z.enum([
        'invalid',
        'unknown',
        'unsupported',
        'inactive',
        'deprecated',
        'conflict',
        'legacy-session',
      ]),
      source: z.string(),
      path: z.string(),
      reason: z.string(),
      action: z.string(),
    })
  ),
  featureFlags: z.object({ useSdkForWorker: z.boolean() }),
});

/** Validate saved data before it can control resumed work.
 * @param value - Persisted snapshot
 * @param source - Session file
 * @returns Validated snapshot, preserving the saved graph
 */
export function parseRuntimeSnapshot(value: unknown, source: string): EffectiveExecutionPlan {
  const parsed = snapshotSchema.safeParse(value);
  let reason = 'Invalid or incompatible saved runtime snapshot.';
  if (parsed.success) {
    const plan = parsed.data;
    const names = new Set(plan.stages.map((stage) => stage.name));
    const completed = new Set<string>();
    let changed = true;
    while (changed) {
      changed = false;
      for (const stage of plan.stages)
        if (!completed.has(stage.name) && stage.dependsOn.every((dep) => completed.has(dep))) {
          completed.add(stage.name);
          changed = true;
        }
    }
    if (
      names.size === plan.stages.length &&
      completed.size === names.size &&
      (plan.stopAfterStage === undefined || names.has(plan.stopAfterStage)) &&
      plan.config.retryBackoff.maxDelayMs >= plan.config.retryBackoff.baseDelayMs &&
      plan.retryPolicy.maxAttempts === plan.config.maxRetries + 1 &&
      plan.retryPolicy.baseDelayMs === plan.config.retryBackoff.baseDelayMs &&
      plan.retryPolicy.maxDelayMs === plan.config.retryBackoff.maxDelayMs &&
      plan.retryPolicy.backoffStrategy === plan.config.retryBackoff.backoffStrategy &&
      plan.stages.every((stage) => stage.timeoutMs === plan.config.timeouts.overrides[stage.name])
    ) {
      return plan as EffectiveExecutionPlan;
    }
    reason =
      'Saved graph has duplicate stages, invalid dependencies, stop condition, or inconsistent budgets.';
  }
  throw new RuntimeConfigError([
    {
      severity: 'error',
      code: 'invalid',
      source,
      path: 'runtimeSnapshot',
      reason,
      action:
        'Restore the original session file or start a fresh run; the CLI will not synthesize a replacement graph.',
    },
  ]);
}

/** Existing persisted session record, with optional runtime snapshot for old-session compatibility. */
export interface SavedPipelineRun {
  readonly source: string;
  readonly data: Record<string, unknown>;
  readonly runtimeSnapshot?: EffectiveExecutionPlan;
  readonly stages: readonly StageResult[];
}

/** Read an existing run without constructing an orchestrator or SDK adapter.
 * @param projectDir - Selected project
 * @param sessionId - Safe session filename component
 * @returns Saved run, or null when absent
 */
export async function readSavedPipelineRun(
  projectDir: string,
  sessionId: string
): Promise<SavedPipelineRun | null> {
  if (!/^[a-zA-Z0-9_-]+$/u.test(sessionId))
    throw new RuntimeConfigError([
      {
        severity: 'error',
        code: 'invalid',
        source: 'CLI',
        path: '--resume',
        reason: 'Invalid session identifier.',
        action: 'Use the session ID printed by run or status.',
      },
    ]);
  const source = resolve(
    projectDir,
    DEFAULT_ORCHESTRATOR_CONFIG.scratchpadDir,
    'pipeline',
    `${sessionId}.yaml`
  );
  let raw: string;
  try {
    raw = await readFile(source, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  let data: unknown;
  try {
    data = yaml.load(raw);
  } catch {
    data = undefined;
  }
  if (!isRecord(data))
    throw new RuntimeConfigError([
      {
        severity: 'error',
        code: 'invalid',
        source,
        path: '(file)',
        reason: 'Malformed saved session.',
        action: 'Restore the session file or start a fresh run.',
      },
    ]);
  const runtimeSnapshot =
    data['runtimeSnapshot'] === undefined
      ? undefined
      : parseRuntimeSnapshot(data['runtimeSnapshot'], source);
  return {
    source,
    data,
    ...(runtimeSnapshot !== undefined ? { runtimeSnapshot } : {}),
    stages: Array.isArray(data['stages']) ? (data['stages'] as StageResult[]) : [],
  };
}

/** List saved runs from the existing session directory, newest first.
 * @param projectDir - Selected project
 * @returns Saved session records, including legacy records
 */
export async function listSavedPipelineRuns(projectDir: string): Promise<SavedPipelineRun[]> {
  const dir = join(projectDir, DEFAULT_ORCHESTRATOR_CONFIG.scratchpadDir, 'pipeline');
  let files: string[];
  try {
    files = await readdir(dir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const runs: SavedPipelineRun[] = [];
  for (const file of files.filter((name) => name.endsWith('.yaml'))) {
    const run = await readSavedPipelineRun(projectDir, file.slice(0, -5));
    if (run !== null) runs.push(run);
  }
  return runs.sort((a, b) =>
    String(b.data['startedAt']).localeCompare(String(a.data['startedAt']))
  );
}
