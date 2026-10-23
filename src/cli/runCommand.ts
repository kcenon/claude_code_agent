/** Testable production run boundary. Adapter creation occurs only after resolution/validation. */
import { resolve } from 'node:path';
import { Command } from 'commander';
import { AdsdlcOrchestratorAgent } from '../ad-sdlc-orchestrator/AdsdlcOrchestratorAgent.js';
import { PipelineFailedError } from '../ad-sdlc-orchestrator/errors.js';
import type {
  OrchestratorConfig,
  OrchestratorSession,
  PipelineResult,
} from '../ad-sdlc-orchestrator/types.js';
import { pipelineExitCode, type PipelineVerificationSummary } from '../vnv/policy.js';
import type { ExecutionAdapter } from '../execution/types.js';
import {
  loadResolvedRuntimeConfig,
  resolveRuntimeConfig,
  RUNTIME_CLI_MAPPING,
} from '../config/runtime.js';
import { readSavedPipelineRun } from '../config/runtimeSnapshot.js';
import { RuntimeConfigError, type EffectiveExecutionPlan } from '../config/runtimeTypes.js';
import { configFilesExist, loadAgentsConfig } from '../config/loader.js';

/** The same Commander declarations are used by actual CLI process and injectable offline tests.
 * @param command - Command to configure
 * @returns Configured run command
 */
export function configureRunCommand(command: Command): Command {
  return command
    .description('Execute the AD-SDLC canonical pipeline')
    .argument('<requirements>', 'Project requirements or description text')
    .option('-m, --mode <mode>', 'Canonical mode: greenfield | enhancement | import')
    .option('--project-dir <dir>', 'Target project directory', process.cwd())
    .option('--stop-after <stage>', 'Stop after stage/ready parallel group; peers can run too')
    .option('--dry-run', 'Resolve and validate without creating an SDK adapter')
    .option('--format <format>', 'Output format: text | json', 'text')
    .option('--allow-stub', 'Allow execution without detected SDK credentials')
    .option(
      '--resume <session-id>',
      'Use saved graph and policy; current workflow/env overrides are ignored'
    )
    .option('-L, --local', 'Run with local agents and remove GitHub setup')
    .option('--no-local', 'Explicitly disable local mode')
    .option('--approval-mode <mode>', 'Existing approval policy: auto | manual | critical')
    .option(
      '--max-parallel-stages <count>',
      'Maximum concurrent runnable DAG stages (not worker-pool size)'
    )
    .option('--max-attempts <count>', 'Total stage attempts, including the first')
    .option('--retry-backoff <strategy>', 'fixed | linear | exponential | fibonacci')
    .option('--retry-base-delay-seconds <seconds>', 'Nonnegative integer retry base delay')
    .option('--retry-max-delay-seconds <seconds>', 'Nonnegative integer retry delay cap')
    .option('--stage-timeout-ms <ms>', 'Positive total budget per stage, across all attempts')
    .option('--vnv-rigor <rigor>', 'minimal | standard | strict')
    .option(
      '--vnv-profile <profile>',
      'advisory | delivery (delivery fails the run on a failed required check)'
    )
    .option(
      '--halt-on-verification-failure <boolean>',
      'Legacy: without a profile, strict rigor plus true selects delivery'
    )
    .option(
      '--use-sdk-for-worker',
      'Deprecated compatibility flag; stages already use the SDK adapter'
    );
}

/** Optional adapter factory replaces only the external execution boundary. */
export interface RunCommandDependencies {
  readonly env?: NodeJS.ProcessEnv;
  readonly createAdapter?: (session: OrchestratorSession) => ExecutionAdapter;
}

/** Prepared run has no SDK side effects; execution uses this exact snapshot. */
export interface PreparedRun {
  readonly projectDir: string;
  readonly plan: EffectiveExecutionPlan;
  createAgent(): AdsdlcOrchestratorAgent;
  execute(agent?: AdsdlcOrchestratorAgent): Promise<PipelineResult>;
}

/** Resolve project/CLI input and validate before any agent or SDK adapter can be created.
 * @param requirements - User request
 * @param options - Commander options (absence preserved)
 * @param dependencies - Offline execution boundary and environment injection
 * @returns Prepared run usable by dry-run or live execution
 */
export async function prepareRunCommand(
  requirements: string,
  options: Readonly<Record<string, unknown>>,
  dependencies: RunCommandDependencies = {}
): Promise<PreparedRun> {
  const projectDir = resolve(
    typeof options['projectDir'] === 'string' ? options['projectDir'] : process.cwd()
  );
  const env = dependencies.env ?? process.env;
  if (
    options['format'] !== undefined &&
    options['format'] !== 'json' &&
    options['format'] !== 'text'
  )
    throw new RuntimeConfigError([
      {
        severity: 'error',
        code: 'invalid',
        source: 'CLI',
        path: '--format',
        reason: 'Invalid output format.',
        action: 'Use text or json.',
      },
    ]);
  const resume = typeof options['resume'] === 'string' ? options['resume'] : undefined;
  let plan: EffectiveExecutionPlan;
  if (resume === undefined) plan = await loadResolvedRuntimeConfig(projectDir, options, env);
  else {
    const overrides = Object.keys(RUNTIME_CLI_MAPPING).filter((key) => options[key] !== undefined);
    if (options['useSdkForWorker'] !== undefined) overrides.push('useSdkForWorker');
    if (overrides.length > 0)
      throw new RuntimeConfigError(
        overrides.map((key) => ({
          severity: 'error',
          code: 'conflict',
          source: 'CLI',
          path: key,
          reason: 'Resume retains the saved graph and runtime policy.',
          action:
            'Remove this override or start a fresh run. Only --stop-after may change on resume.',
        }))
      );
    const saved = await readSavedPipelineRun(projectDir, resume);
    if (saved === null)
      throw new RuntimeConfigError([
        {
          severity: 'error',
          code: 'invalid',
          source: 'CLI',
          path: '--resume',
          reason: 'Session not found in selected project.',
          action: 'Use a saved session ID from status or start a fresh run.',
        },
      ]);
    plan =
      saved.runtimeSnapshot ??
      resolveRuntimeConfig({
        layers: [
          {
            source: saved.source,
            value: {
              pipeline: { default_mode: saved.data['mode'] },
              execution: { local_mode: saved.data['localMode'] ?? false },
            },
          },
        ],
      });
    if (saved.runtimeSnapshot === undefined)
      plan = {
        ...plan,
        diagnostics: [
          ...plan.diagnostics,
          {
            severity: 'warning',
            code: 'legacy-session',
            source: saved.source,
            path: 'runtimeSnapshot',
            reason:
              'No saved runtime snapshot exists. Using saved mode/local flag and built-in policy, ignoring current workflow and direct environment overrides.',
            action:
              'This resolved snapshot will be saved on resume. Start fresh to use current project configuration.',
          },
        ],
      };
    const stop = options['stopAfter'] ?? plan.stopAfterStage ?? saved.data['stopAfterStage'];
    if (stop !== undefined && !plan.stages.some((stage) => stage.name === stop))
      throw new RuntimeConfigError([
        {
          severity: 'error',
          code: 'invalid',
          source: 'CLI',
          path: '--stop-after',
          reason: 'Stage is absent from the saved graph.',
          action: 'Select a stage shown in the saved runtime snapshot.',
        },
      ]);
    if (stop !== undefined)
      plan = {
        ...plan,
        stopAfterStage: stop as NonNullable<EffectiveExecutionPlan['stopAfterStage']>,
        sources: {
          ...plan.sources,
          ...(options['stopAfter'] === undefined
            ? {}
            : { stopAfterStage: { source: 'CLI', path: '--stop-after' } }),
        },
      };
  }
  // Retain the existing full agent schemas and active-overlay validation (#945/#947).
  const environment = env['AD_SDLC_ENV'] ?? env['NODE_ENV'] ?? false;
  if (configFilesExist(projectDir).agents)
    await loadAgentsConfig({ baseDir: projectDir, environment });
  const createAgent = (): AdsdlcOrchestratorAgent => {
    const config: OrchestratorConfig = {
      ...plan.config,
      featureFlagsBaseDir: projectDir,
      featureFlagsCli: plan.featureFlags,
    };
    const factory = dependencies.createAdapter;
    if (factory === undefined) return new AdsdlcOrchestratorAgent(config);
    return new (class extends AdsdlcOrchestratorAgent {
      protected override createExecutionAdapter(session: OrchestratorSession): ExecutionAdapter {
        return factory(session);
      }
    })(config);
  };
  return {
    projectDir,
    plan,
    createAgent,
    async execute(agent = createAgent()): Promise<PipelineResult> {
      await agent.startSession({
        projectDir,
        userRequest: requirements,
        overrideMode: plan.config.mode,
        localMode: plan.config.localMode,
        runtimeSnapshot: plan,
        ...(resume === undefined ? {} : { resumeSessionId: resume, resumeMode: 'resume' }),
        ...(plan.stopAfterStage === undefined ? {} : { stopAfterStage: plan.stopAfterStage }),
      });
      return agent.executePipeline(projectDir, requirements);
    },
  };
}

/** Line sink for run output; the CLI passes its `CLIOutput`. */
export interface RunCommandOutput {
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/** Process-facing collaborators of {@link executeRunCommand}. */
export interface RunCommandExecution extends RunCommandDependencies {
  readonly output: RunCommandOutput;
  /** Whether SDK credentials or a Claude Code session are available. */
  readonly hasExecutionEnvironment: () => boolean;
  /**
   * Install cancellation handlers (SIGINT/SIGTERM in the CLI) for the active
   * agent; returns their removal.
   */
  readonly onCancel?: (cancel: () => void) => () => void;
}

/**
 * Short text summary of a run's verification.
 * @param verification - Pipeline verification summary
 * @returns Output lines
 */
export function formatVerificationSummary(verification: PipelineVerificationSummary): string[] {
  const { policy, counts, checkCounts } = verification;
  const lines = [
    `Verification: ${verification.status} (profile ${policy.profile} from ${policy.source.kind}, rigor ${policy.rigor})`,
    `  stages: ${String(counts.verified_pass)} verified_pass, ${String(counts.advisory_findings)} advisory_findings, ${String(counts.failed)} failed, ${String(counts.skipped)} skipped, ${String(counts.not_applicable)} not_applicable; checks: ${String(checkCounts.pass)} passed, ${String(checkCounts.fail)} failed, ${String(checkCounts.skipped)} skipped`,
  ];
  for (const stage of verification.stages) {
    if (stage.state !== 'failed' && stage.state !== 'advisory_findings') continue;
    const failed = stage.checks.filter((check) => check.outcome === 'fail');
    if (failed.length === 0 && stage.reason !== undefined)
      lines.push(`  ${stage.stage}: ${stage.state}: ${stage.reason}`);
    for (const check of failed)
      lines.push(
        `  ${stage.stage}: ${stage.state}: [${check.checkId}${check.required ? '' : ', optional'}] ${check.message}`
      );
  }
  return lines;
}

/**
 * Text output of a finished (or failed) run.
 * @param result - Pipeline result
 * @returns Output lines
 */
export function formatRunResult(result: PipelineResult): string[] {
  const lines = [`Pipeline ${result.pipelineId}: ${result.overallStatus} (${result.mode})`];
  for (const stage of result.stages)
    lines.push(
      `  ${stage.name}: ${stage.status} (${String(stage.durationMs)} ms)${
        stage.verification === undefined ? '' : `, verification ${stage.verification.state}`
      }${stage.error === null ? '' : ` — ${stage.error}`}`
    );
  if (result.verification !== undefined)
    lines.push(...formatVerificationSummary(result.verification));
  return lines;
}

/**
 * Run (or dry-run) the canonical pipeline and report the outcome. This is
 * the body of `ad-sdlc run`; the CLI supplies its output and signal handling.
 * @param requirements - User request
 * @param options - Commander options (absence preserved)
 * @param execution - Output, environment probe, and optional adapter injection
 * @returns Process exit status: 1 for configuration errors, failed runs, and
 *   failed required checks under a blocking profile
 */
export async function executeRunCommand(
  requirements: string,
  options: Readonly<Record<string, unknown>>,
  execution: RunCommandExecution
): Promise<0 | 1> {
  const { output } = execution;
  const json = options['format'] === 'json';
  let runtimeSnapshot: EffectiveExecutionPlan | undefined;
  try {
    const prepared = await prepareRunCommand(requirements, options, execution);
    runtimeSnapshot = prepared.plan;
    if (options['dryRun'] === true) {
      if (json) output.info(JSON.stringify({ ready: true, ...prepared.plan }, null, 2));
      else {
        const { plan } = prepared;
        output.info(`Mode: ${plan.config.mode}; local: ${String(plan.config.localMode)}`);
        output.info(
          `Stage concurrency: ${String(plan.config.maxParallelAgents)}; total attempts: ${String(plan.config.maxRetries + 1)}`
        );
        output.info(
          `Verification profile: ${plan.config.vnv.profile} (${plan.sources['global.vnv.profile']?.source ?? 'default'}); rigor ${plan.config.vnv.rigor}`
        );
        for (const stage of plan.stages)
          output.info(
            `  ${stage.name}: ${stage.agentType}, depends on [${stage.dependsOn.join(', ')}], budget ${String(stage.timeoutMs)} ms`
          );
        if (plan.stopAfterStage !== undefined)
          output.info(`Stop after: ${plan.stopAfterStage}. ${plan.stopBehavior}`);
        for (const diagnostic of plan.diagnostics)
          output.warn(
            `${diagnostic.source}: ${diagnostic.path}: ${diagnostic.reason} ${diagnostic.action}`
          );
        output.info('Configuration valid. Pipeline is ready to execute.');
      }
      return 0;
    }
    for (const diagnostic of prepared.plan.diagnostics)
      output.warn(
        `${diagnostic.source}: ${diagnostic.path}: ${diagnostic.reason} ${diagnostic.action}`
      );
    if (!execution.hasExecutionEnvironment() && options['allowStub'] !== true)
      throw new Error(
        'No AI bridge available. Set ANTHROPIC_API_KEY or run inside a Claude Code session. Use --allow-stub for offline testing.'
      );
    const agent = prepared.createAgent();
    const removeCancel = execution.onCancel?.(() => {
      // Final disposal below awaits and reports the same cleanup outcome.
      void agent.dispose().catch(() => undefined);
    });
    let result: PipelineResult;
    try {
      result = await prepared.execute(agent);
    } finally {
      removeCancel?.();
      await agent.dispose();
    }
    // Emit one terminal JSON object only after all cleanup has completed.
    if (json) output.info(JSON.stringify(result, null, 2));
    else for (const line of formatRunResult(result)) output.info(line);
    return pipelineExitCode(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failedRun = error instanceof PipelineFailedError ? error.result : undefined;
    if (json)
      output.info(
        JSON.stringify(
          {
            ready: false,
            error: message,
            diagnostics: error instanceof RuntimeConfigError ? error.diagnostics : [],
            ...(runtimeSnapshot === undefined ? {} : { runtimeSnapshot }),
            ...(failedRun === undefined ? {} : { result: failedRun }),
          },
          null,
          2
        )
      );
    else {
      if (failedRun !== undefined) for (const line of formatRunResult(failedRun)) output.info(line);
      output.error(message);
    }
    return 1;
  }
}
