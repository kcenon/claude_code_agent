/** One runtime resolution boundary, independent of SDK/session construction. */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as yaml from 'js-yaml';
import { z } from 'zod';
import {
  DEFAULT_ORCHESTRATOR_CONFIG,
  type PipelineMode,
  type StageName,
} from '../ad-sdlc-orchestrator/types.js';
import {
  buildCanonicalPlan,
  CANONICAL_STAGE_NAMES,
  TIMEOUT_PHASE_STAGES,
} from '../ad-sdlc-orchestrator/plan.js';
import { WorkflowConfigSchema } from './schemas.js';
import {
  FeatureFlagsResolver,
  loadFeatureFlagsFile,
  getFeatureFlagsFilePath,
} from './featureFlags.js';
import { getConfigFilePath, getEnvConfigFilePath } from './loader.js';
import {
  auditRuntimeLayer,
  getRuntimeValue,
  isRecord,
  RUNTIME_ENV_MAPPING,
  runtimeSettingSchema,
} from './runtimeSupport.js';
import {
  RuntimeConfigError,
  type EffectiveExecutionPlan,
  type ResolvedRuntimeConfig,
  type RuntimeConfigLayer,
  type RuntimeDiagnostic,
  type RuntimeValueSource,
} from './runtimeTypes.js';

/** Commander option keys mapped explicitly to workflow properties. No option defaults here. */
export const RUNTIME_CLI_MAPPING = {
  mode: 'pipeline.default_mode',
  approvalMode: 'global.approval_mode',
  local: 'execution.local_mode',
  maxParallelStages: 'execution.max_parallel_stages',
  maxAttempts: 'global.retry_policy.max_attempts',
  retryBackoff: 'global.retry_policy.backoff',
  retryBaseDelaySeconds: 'global.retry_policy.base_delay_seconds',
  retryMaxDelaySeconds: 'global.retry_policy.max_delay_seconds',
  stageTimeoutMs: 'execution.stage_timeout_ms',
  vnvRigor: 'global.vnv.rigor',
  haltOnVerificationFailure: 'global.vnv.halt_on_verification_failure',
} as const;

/** Parse strict external spellings without coalescing malformed values to defaults.
 * @param value - Untrusted scalar
 * @param path - Runtime property
 * @returns Scalar ready for schema validation
 */
function externalScalar(value: unknown, path: string): unknown {
  if (typeof value !== 'string') return value;
  const schema = runtimeSettingSchema(path);
  if (schema instanceof z.ZodNumber && /^\d+$/u.test(value.trim())) return Number(value.trim());
  if (schema instanceof z.ZodBoolean) {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }
  return value;
}

/** Set a mapped property in a newly constructed external layer.
 * @param target - New layer
 * @param path - Property path
 * @param value - Parsed external scalar
 */
function setValue(target: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  const last = keys.pop();
  let current = target;
  for (const key of keys) {
    current[key] ??= {};
    current = current[key] as Record<string, unknown>;
  }
  if (last !== undefined) current[last] = value;
}

/** Pure resolution inputs; only explicitly supplied CLI values participate. */
export interface ResolveRuntimeOptions {
  readonly layers?: readonly RuntimeConfigLayer[];
  readonly env?: NodeJS.ProcessEnv;
  readonly cli?: Readonly<Record<string, unknown>>;
  readonly featureFlags?: EffectiveExecutionPlan['featureFlags'];
  readonly featureFlagSource?: RuntimeValueSource;
}

/** Resolve every layer per concrete stage: source priority precedes timeout specificity.
 * @param options - Ordered project layers and external overrides
 * @returns Serializable plan for both dry-run and production execution
 * @throws RuntimeConfigError with actionable findings
 */
export function resolveRuntimeConfig(options: ResolveRuntimeOptions = {}): EffectiveExecutionPlan {
  const layers = [...(options.layers ?? [])];
  for (const [name, path] of Object.entries(RUNTIME_ENV_MAPPING)) {
    const raw = options.env?.[name];
    if (raw !== undefined) {
      const value = {};
      setValue(value, path, externalScalar(raw, path));
      layers.push({ source: `environment:${name}`, value });
    }
  }
  const cliValue = {};
  for (const [key, path] of Object.entries(RUNTIME_CLI_MAPPING)) {
    const raw = options.cli?.[key];
    if (raw !== undefined) setValue(cliValue, path, externalScalar(raw, path));
  }
  layers.push({ source: 'CLI', value: cliValue });
  const diagnostics = layers.flatMap((layer) => auditRuntimeLayer(layer.value, layer.source));
  if (diagnostics.some((d) => d.severity === 'error')) throw new RuntimeConfigError(diagnostics);
  const defaults = DEFAULT_ORCHESTRATOR_CONFIG;
  const sources: Record<string, RuntimeValueSource> = {
    'featureFlags.useSdkForWorker': options.featureFlagSource ?? {
      source: 'default',
      path: 'flags.useSdkForWorker',
    },
  };
  const read = <T>(
    path: string,
    fallback: T,
    aliases: readonly [string, (value: unknown) => T][] = []
  ): T => {
    let value = fallback;
    sources[path] = { source: 'default', path };
    for (const layer of layers) {
      const raw = getRuntimeValue(layer.value, path);
      if (raw !== undefined) {
        value = raw as T;
        sources[path] = { source: layer.source, path };
      }
      for (const [alias, convert] of aliases) {
        const legacy = getRuntimeValue(layer.value, alias);
        if (legacy !== undefined) {
          value = convert(legacy);
          sources[path] = { source: layer.source, path: alias };
        }
      }
    }
    return value;
  };
  const mode = read<PipelineMode>('pipeline.default_mode', defaults.defaultMode);
  const localMode = read('execution.local_mode', defaults.localMode);
  const maxAttempts = read('global.retry_policy.max_attempts', defaults.maxRetries + 1, [
    ['execution.retry_attempts', (v): number => Number(v) + 1],
  ]);
  const baseDelayMs =
    read('global.retry_policy.base_delay_seconds', defaults.retryBackoff.baseDelayMs / 1000, [
      ['execution.retry_delay_ms', (v): number => Number(v) / 1000],
    ]) * 1000;
  const maxDelayMs =
    read('global.retry_policy.max_delay_seconds', defaults.retryBackoff.maxDelayMs / 1000) * 1000;
  if (maxDelayMs < baseDelayMs) {
    const source = sources['global.retry_policy.max_delay_seconds'];
    diagnostics.push({
      severity: 'error',
      code: 'invalid',
      source: source?.source ?? 'default',
      path: 'global.retry_policy.max_delay_seconds',
      reason: 'Maximum retry delay must be at least the effective base delay.',
      action: 'Increase the cap or reduce the base delay (including higher-priority overrides).',
    });
    throw new RuntimeConfigError(diagnostics);
  }
  const defaultBudget = read('execution.stage_timeout_ms', defaults.timeouts.default);
  const budgets: Partial<Record<StageName, number>> = {};
  for (const stage of CANONICAL_STAGE_NAMES) {
    let budget = defaults.timeouts.overrides?.[stage] ?? defaults.timeouts.default;
    const path = `execution.stage_timeouts_ms.${stage}`;
    sources[path] = { source: 'default', path: 'execution.stage_timeout_ms' };
    for (const layer of layers) {
      // Within one source only: blanket < phase < canonical stage.
      const candidates = [
        'execution.stage_timeout_ms',
        ...Object.entries(TIMEOUT_PHASE_STAGES)
          .filter(([, names]) => (names as readonly string[]).includes(stage))
          .map(([phase]) => `global.timeouts.${phase}`),
        path,
      ];
      for (const candidate of candidates) {
        const raw = getRuntimeValue(layer.value, candidate);
        if (raw !== undefined) {
          budget = Number(raw) * (candidate.startsWith('global.timeouts.') ? 1000 : 1);
          sources[path] = { source: layer.source, path: candidate };
        }
      }
    }
    budgets[stage] = budget;
  }
  const config: ResolvedRuntimeConfig = {
    mode,
    localMode,
    approvalMode: read('global.approval_mode', defaults.approvalMode),
    maxParallelAgents: read('execution.max_parallel_stages', defaults.maxParallelAgents),
    maxRetries: maxAttempts - 1,
    retryBackoff: {
      baseDelayMs,
      maxDelayMs,
      backoffStrategy: read('global.retry_policy.backoff', defaults.retryBackoff.backoffStrategy),
    },
    timeouts: { default: defaultBudget, overrides: budgets },
    vnv: {
      rigor: read('global.vnv.rigor', defaults.vnv.rigor),
      haltOnVerificationFailure: read(
        'global.vnv.halt_on_verification_failure',
        defaults.vnv.haltOnVerificationFailure
      ),
    },
  };
  const stages = buildCanonicalPlan(mode, localMode).map((stage) => ({
    ...stage,
    timeoutMs: budgets[stage.name] ?? defaultBudget,
  }));
  const stopAfterStage = options.cli?.['stopAfter'];
  if (stopAfterStage !== undefined && !stages.some((stage) => stage.name === stopAfterStage)) {
    throw new RuntimeConfigError([
      {
        severity: 'error',
        code: 'invalid',
        source: 'CLI',
        path: '--stop-after',
        reason: 'Stage is not in the selected effective graph.',
        action: `Use one of: ${stages.map((s) => s.name).join(', ')}.`,
      },
    ]);
  }
  if (stopAfterStage !== undefined)
    sources['stopAfterStage'] = { source: 'CLI', path: '--stop-after' };
  return {
    version: 1,
    config,
    retryPolicy: { maxAttempts, ...config.retryBackoff },
    stages,
    sources,
    diagnostics,
    ...(stopAfterStage !== undefined ? { stopAfterStage: stopAfterStage as StageName } : {}),
    stopBehavior:
      'Stop after the named stage or its entire ready parallel group completes; peers in that group can run even with concurrency 1. Later groups are skipped.',
    featureFlags: options.featureFlags ?? { useSdkForWorker: false },
  };
}

/** Substitute recursively using the selected project's PWD, keeping non-substituted types strict.
 * @param value - Raw input
 * @param env - Explicit environment
 * @param projectDir - Selected project
 * @param path - Current property
 * @returns Substituted raw input (absence preserved)
 */
function substitute(
  value: unknown,
  env: NodeJS.ProcessEnv,
  projectDir: string,
  path = ''
): unknown {
  if (typeof value === 'string') {
    const replaced = value.replace(/\$\{(\w+)\}/gu, (match, key: string) =>
      key === 'PWD' ? projectDir : (env[key] ?? match)
    );
    return replaced === value ? value : externalScalar(replaced, path);
  }
  if (Array.isArray(value))
    return value.map((item: unknown) => substitute(item, env, projectDir, path));
  if (isRecord(value))
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        substitute(item, env, projectDir, path === '' ? key : `${path}.${key}`),
      ])
    );
  return value;
}

/** Read and validate the exact base and active overlay before merging can hide malformed requests.
 * @param projectDir - Target project, never an unrelated cwd
 * @param env - Environment selection and substitution
 * @returns Raw validated project layers
 */
export async function loadRuntimeLayers(
  projectDir: string,
  env: NodeJS.ProcessEnv = process.env
): Promise<RuntimeConfigLayer[]> {
  const basePath = getConfigFilePath('workflow', resolve(projectDir));
  const environment = env['AD_SDLC_ENV'] ?? env['NODE_ENV'];
  if (environment !== undefined && !/^[a-zA-Z0-9_-]+$/u.test(environment))
    throw new RuntimeConfigError([
      {
        severity: 'error',
        code: 'invalid',
        source: 'environment',
        path: 'AD_SDLC_ENV/NODE_ENV',
        reason: 'Invalid overlay name.',
        action: 'Use letters, digits, underscores or hyphens.',
      },
    ]);
  const paths = [
    basePath,
    ...(environment === undefined ? [] : [getEnvConfigFilePath(basePath, environment)]),
  ];
  const layers: RuntimeConfigLayer[] = [];
  for (const [index, source] of paths.entries()) {
    let raw: string;
    try {
      raw = await readFile(source, 'utf8');
    } catch (error) {
      if (index > 0 && (error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw new RuntimeConfigError([
        {
          severity: 'error',
          code: 'invalid',
          source,
          path: '(file)',
          reason: 'Cannot read workflow configuration.',
          action:
            'Initialize the selected project or restore its workflow.yaml and check file permissions.',
        },
      ]);
    }
    let value: unknown;
    try {
      value = substitute(yaml.load(raw), env, resolve(projectDir));
    } catch {
      throw new RuntimeConfigError([
        {
          severity: 'error',
          code: 'invalid',
          source,
          path: '(file)',
          reason: 'Malformed YAML in active configuration.',
          action: 'Fix YAML syntax, indentation, and duplicate keys in this file.',
        },
      ]);
    }
    const findings = auditRuntimeLayer(value, source);
    const validation = (
      index === 0 ? WorkflowConfigSchema : WorkflowConfigSchema.partial()
    ).safeParse(value);
    if (!validation.success)
      findings.push(
        ...validation.error.issues.map((issue): RuntimeDiagnostic => ({
          severity: 'error',
          code: 'invalid',
          source,
          path: issue.path.join('.') || '(root)',
          reason: issue.message,
          action: 'Correct this value using the workflow schema.',
        }))
      );
    if (findings.some((d) => d.severity === 'error')) throw new RuntimeConfigError(findings);
    layers.push({ source, value });
  }
  return layers;
}

/** Load the production project boundary without creating an adapter or session.
 * @param projectDir - Target project
 * @param cli - Explicit Commander options
 * @param env - Direct overrides, overlay selection, and substitution
 * @returns Effective plan
 */
export async function loadResolvedRuntimeConfig(
  projectDir: string,
  cli: Readonly<Record<string, unknown>> = {},
  env: NodeJS.ProcessEnv = process.env
): Promise<EffectiveExecutionPlan> {
  const layers = await loadRuntimeLayers(projectDir, env);
  const flagPath = getFeatureFlagsFilePath(projectDir);
  let flags: ReturnType<typeof loadFeatureFlagsFile>;
  try {
    flags = loadFeatureFlagsFile(flagPath);
  } catch {
    throw new RuntimeConfigError([
      {
        severity: 'error',
        code: 'invalid',
        source: flagPath,
        path: 'flags',
        reason: 'Invalid feature flag file.',
        action: 'Use the feature-flags schema; flags.useSdkForWorker must be a boolean.',
      },
    ]);
  }
  const flagConfig = flags?.flags ?? {};
  const featureFlags = FeatureFlagsResolver.fromSources({
    baseDir: projectDir,
    env,
    config:
      flagConfig.useSdkForWorker === undefined
        ? {}
        : { useSdkForWorker: flagConfig.useSdkForWorker },
    cli:
      cli['useSdkForWorker'] === undefined
        ? {}
        : { useSdkForWorker: cli['useSdkForWorker'] === true },
  });
  const featureFlagSource =
    env['AD_SDLC_USE_SDK_FOR_WORKER'] !== undefined
      ? { source: 'environment:AD_SDLC_USE_SDK_FOR_WORKER', path: 'AD_SDLC_USE_SDK_FOR_WORKER' }
      : cli['useSdkForWorker'] !== undefined
        ? { source: 'CLI', path: '--use-sdk-for-worker' }
        : flagConfig.useSdkForWorker !== undefined
          ? { source: flagPath, path: 'flags.useSdkForWorker' }
          : { source: 'default', path: 'flags.useSdkForWorker' };
  let useSdkForWorker: boolean;
  try {
    useSdkForWorker = featureFlags.useSdkForWorker();
  } catch {
    throw new RuntimeConfigError([
      {
        severity: 'error',
        code: 'invalid',
        source: 'environment:AD_SDLC_USE_SDK_FOR_WORKER',
        path: 'AD_SDLC_USE_SDK_FOR_WORKER',
        reason: 'Invalid feature flag boolean.',
        action:
          'Use the existing feature-flag boolean spellings: 1/0, true/false, yes/no, on/off, or empty for false.',
      },
    ]);
  }
  return resolveRuntimeConfig({
    layers,
    cli,
    env,
    featureFlags: { useSdkForWorker },
    featureFlagSource,
  });
}
