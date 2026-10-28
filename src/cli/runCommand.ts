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
import {
  PIPELINE_EXIT_CODES,
  pipelineExitCode,
  type PipelineExitCode,
  type PipelineVerificationSummary,
} from '../vnv/policy.js';
import type { PipelineTraceabilitySummary } from '../vnv/traceability.js';
import {
  stageApprovalBoundaries,
  stageApprovalEffects,
  type PipelineApprovalSummary,
} from '../ad-sdlc-orchestrator/approvalPolicy.js';
import type { ExecutionAdapter } from '../execution/types.js';
import {
  loadResolvedRuntimeConfig,
  resolveRuntimeConfig,
  RUNTIME_CLI_MAPPING,
} from '../config/runtime.js';
import { readSavedPipelineRun } from '../config/runtimeSnapshot.js';
import { RuntimeConfigError, type EffectiveExecutionPlan } from '../config/runtimeTypes.js';
import { configFilesExist, loadAgentsConfig } from '../config/loader.js';
import { getTelemetry } from '../telemetry/Telemetry.js';
import {
  jsonlDeliveryMetricsSink,
  type DeliveryMetricsConsent,
  type DeliveryMetricsSummary,
} from '../telemetry/deliveryMetricsExport.js';
import type { PipelineMetricsRecord } from '../telemetry/deliveryMetrics.js';

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
    .option(
      '--approval-mode <mode>',
      'auto (built-in default): no decision is requested, every gate is approved and recorded | manual: decide at every review and delivery gate | critical: decide before external effects and after failed required checks'
    )
    .option(
      '--non-interactive',
      'Never prompt: a requested approval decision pauses the run (exit status 3) for --resume'
    )
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
  /**
   * Replaces terminal detection for approval prompts. `--non-interactive`
   * still wins. Tests use it to reach the prompt without a real terminal.
   */
  readonly interactive?: boolean;
  /**
   * Replaces the telemetry consent lookup (`~/.ad-sdlc/telemetry-consent.json`)
   * that decides the delivery metrics export. Tests use it to stay independent
   * of the machine's consent.
   */
  readonly deliveryMetricsConsent?: () => DeliveryMetricsConsent;
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
  // Interaction belongs to this invocation, not to the saved policy: a run
  // paused in CI can resume in a terminal.
  const interactive = options['nonInteractive'] === true ? false : dependencies.interactive;
  const createAgent = (): AdsdlcOrchestratorAgent => {
    // Delivery metrics follow the telemetry consent; records always stay on the result.
    const consent = (
      dependencies.deliveryMetricsConsent ??
      ((): DeliveryMetricsConsent => getTelemetry().getDeliveryMetricsConsent())
    )();
    const config: OrchestratorConfig = {
      ...plan.config,
      featureFlagsBaseDir: projectDir,
      featureFlagsCli: plan.featureFlags,
      ...(interactive !== undefined ? { interactive } : {}),
      deliveryMetrics: {
        consent: consent.status,
        ...(consent.export ? { sink: jsonlDeliveryMetricsSink } : {}),
      },
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
 * Short text summary of a run's requirements traceability.
 * @param traceability - Pipeline traceability summary
 * @returns Output lines
 */
export function formatTraceabilitySummary(traceability: PipelineTraceabilitySummary): string[] {
  const { counts } = traceability;
  const detail =
    counts === undefined
      ? (traceability.reason ?? '')
      : `${String(counts.roots)} ${traceability.roots === 'issue_acceptance_criteria' ? 'imported issue(s)' : 'requirement(s)'}, ${String(counts.validatedCriteria)} of ${String(counts.criteria)} acceptance criteria implemented and tested${traceability.reason === undefined ? '' : `; ${traceability.reason}`}`;
  const lines = [`Traceability: ${traceability.status} (${detail})`];
  if (traceability.uncovered.length > 0)
    lines.push(`  uncovered: ${traceability.uncovered.join(', ')}`);
  if (traceability.untraced.length > 0)
    lines.push(`  issues not traced to a requirement: ${traceability.untraced.join(', ')}`);
  if (traceability.rtm !== undefined) lines.push(`  RTM: ${traceability.rtm.markdown}`);
  return lines;
}

/**
 * Short text summary of a run's approval decisions.
 * @param approval - Pipeline approval summary
 * @returns Output lines
 */
export function formatApprovalSummary(approval: PipelineApprovalSummary): string[] {
  const { policy, counts } = approval;
  const lines = [
    `Approval: ${approval.status} (mode ${policy.mode} from ${policy.source.kind}; ${policy.interactive ? 'interactive' : 'not interactive, a requested decision pauses the run'})`,
    `  decisions: ${String(counts.approved)} approved, ${String(counts.rejected)} rejected, ${String(counts.pending)} pending; ${String(approval.requested)} requested, ${String(approval.decisions.length - approval.requested)} by policy`,
  ];
  for (const record of approval.decisions) {
    if (record.basis === 'policy') continue;
    const by =
      record.outcome === 'pending'
        ? 'awaiting a decision'
        : `${record.outcome} by ${record.basis === 'callback' ? 'custom strategy' : record.decidedBy}${record.reused === true ? ' (reused on resume)' : ''}`;
    lines.push(`  ${record.stage}: ${by} [${record.boundaries.join(', ')}]: ${record.reason}`);
    if (record.outcome === 'pending')
      lines.push(
        `    proposed action: ${record.proposedAction}`,
        `    effects: ${record.effects.length === 0 ? 'none' : record.effects.join(', ')}; findings: ${String(record.scope.findings.length)}; scope ${record.scope.fingerprint.slice(0, 16)}`
      );
  }
  return lines;
}

/**
 * Short text summary of a run's delivery metrics: attempt outcomes, usage
 * (`unknown` where the SDK reported none), and where the records went.
 * @param metrics - Records of the run and their export state
 * @returns Output lines
 */
export function formatMetricsSummary(metrics: DeliveryMetricsSummary): string[] {
  const lines: string[] = [];
  const pipeline = metrics.records.find(
    (record): record is PipelineMetricsRecord => record.kind === 'pipeline'
  );
  if (pipeline !== undefined) {
    const known = (value: number | null): string => (value === null ? 'unknown' : String(value));
    const { attempts, usage } = pipeline;
    const tokens =
      usage === null
        ? 'tokens: no attempt'
        : `tokens (${usage.source}): input ${known(usage.inputTokens)}, output ${known(usage.outputTokens)}, cache read ${known(usage.cacheReadInputTokens)}, cache creation ${known(usage.cacheCreationInputTokens)}`;
    lines.push(
      `Usage: ${String(attempts.total)} attempts (${String(attempts.byOutcome.succeeded)} succeeded, ${String(attempts.byOutcome.failed)} failed, ${String(attempts.byOutcome.timed_out)} timed out, ${String(attempts.byOutcome.cancelled)} cancelled, ${String(attempts.retries)} retries); ${tokens}; tool uses ${known(pipeline.toolUseCount)}; turns ${known(pipeline.turnCount)}`
    );
  }
  const exported = metrics.export;
  if (exported.enabled)
    lines.push(
      `Metrics: ${String(exported.written)} records appended to ${exported.location ?? 'the configured sink'}${exported.failed > 0 ? `; ${String(exported.failed)} not written` : ''}`
    );
  else
    lines.push(
      `Metrics: not exported${exported.consent === null ? '' : ` (telemetry consent ${exported.consent}; 'ad-sdlc telemetry enable --yes' exports them)`}`
    );
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
      }${
        stage.approval === undefined || stage.approval.basis === 'policy'
          ? ''
          : `, approval ${stage.approval.outcome}`
      }${stage.error === null ? '' : ` — ${stage.error}`}`
    );
  if (result.verification !== undefined)
    lines.push(...formatVerificationSummary(result.verification));
  if (result.traceability !== undefined)
    lines.push(...formatTraceabilitySummary(result.traceability));
  if (result.approval !== undefined) lines.push(...formatApprovalSummary(result.approval));
  if (result.metrics !== undefined) lines.push(...formatMetricsSummary(result.metrics));
  return lines;
}

/**
 * Dry-run description of a stage's approval gate. A failed-verification
 * boundary depends on the run, so only the static boundaries are shown.
 * @param stage - Planned stage
 * @returns Text such as `gate review, delivery (create_issues)`, or `no gate`
 */
function describeStageGate(stage: EffectiveExecutionPlan['stages'][number]): string {
  const boundaries = stageApprovalBoundaries(stage);
  const effects = stageApprovalEffects(stage);
  if (boundaries.length === 0) return 'no gate';
  return `gate ${boundaries.join(', ')}${effects.length === 0 ? '' : ` (${effects.join(', ')})`}`;
}

/**
 * Run (or dry-run) the canonical pipeline and report the outcome. This is
 * the body of `ad-sdlc run`; the CLI supplies its output and signal handling.
 * @param requirements - User request
 * @param options - Commander options (absence preserved)
 * @param execution - Output, environment probe, and optional adapter injection
 * @returns Process exit status ({@link PIPELINE_EXIT_CODES}): 1 for
 *   configuration errors, failed runs, and failed required checks under a
 *   blocking profile; 2 for a rejected stage; 3 for a run paused at an
 *   approval decision
 */
export async function executeRunCommand(
  requirements: string,
  options: Readonly<Record<string, unknown>>,
  execution: RunCommandExecution
): Promise<PipelineExitCode> {
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
        output.info(
          `Approval mode: ${plan.config.approvalMode} (${plan.sources['global.approval_mode']?.source ?? 'default'}); a requested decision without an interactive terminal pauses the run (exit status 3)`
        );
        for (const stage of plan.stages)
          output.info(
            `  ${stage.name}: ${stage.agentType}, depends on [${stage.dependsOn.join(', ')}], budget ${String(stage.timeoutMs)} ms, ${describeStageGate(stage)}`
          );
        if (plan.stopAfterStage !== undefined)
          output.info(`Stop after: ${plan.stopAfterStage}. ${plan.stopBehavior}`);
        for (const diagnostic of plan.diagnostics)
          output.warn(
            `${diagnostic.source}: ${diagnostic.path}: ${diagnostic.reason} ${diagnostic.action}`
          );
        output.info('Configuration valid. Pipeline is ready to execute.');
      }
      return PIPELINE_EXIT_CODES.completed;
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
    return PIPELINE_EXIT_CODES.failed;
  }
}
