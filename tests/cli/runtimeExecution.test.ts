/** Offline production path: Commander -> project YAML -> resolver -> orchestrator -> scheduler -> RetryExecutor. */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dump } from 'js-yaml';
import { Command } from 'commander';
import { configureRunCommand, prepareRunCommand } from '../../src/cli/runCommand.js';
import type {
  ExecutionAdapter,
  StageExecutionRequest,
  StageExecutionResult,
} from '../../src/execution/types.js';
import { SdkExecutionAdapter } from '../../src/execution/SdkExecutionAdapter.js';
import { AdsdlcOrchestratorAgent } from '../../src/ad-sdlc-orchestrator/AdsdlcOrchestratorAgent.js';
import { buildCanonicalPlan } from '../../src/ad-sdlc-orchestrator/plan.js';
import { ProjectInitializer } from '../../src/project-initializer/ProjectInitializer.js';
import { StatusService } from '../../src/status/StatusService.js';
import { readSavedPipelineRun } from '../../src/config/runtimeSnapshot.js';
import { ControlledQuery, deferred } from '../execution/fixtures/controlledSdk.js';
import { installAgent, sdkResult } from '../execution/fixtures/sdk.js';

const success: StageExecutionResult = {
  status: 'success',
  artifacts: [],
  sessionId: 'offline',
  toolCallCount: 0,
  tokenUsage: { input: 0, output: 0, cache: 0 },
};
class ObservedAdapter implements ExecutionAdapter {
  active = 0;
  maximum = 0;
  disposed = false;
  calls: StageExecutionRequest[] = [];
  times: number[] = [];
  events: string[] = [];
  arrivals = Array.from({ length: 80 }, () => deferred<StageExecutionRequest>());
  constructor(
    readonly behavior: (
      req: StageExecutionRequest,
      index: number
    ) => Promise<StageExecutionResult> = async () => success
  ) {}
  async execute(req: StageExecutionRequest) {
    const index = this.calls.length;
    this.calls.push(req);
    this.times.push(Date.now());
    this.active++;
    this.maximum = Math.max(this.maximum, this.active);
    this.events.push(`start:${req.agentType}`);
    this.arrivals[index]!.resolve(req);
    try {
      return await this.behavior(req, index);
    } finally {
      this.active--;
      this.events.push(`clean:${req.agentType}`);
    }
  }
  async dispose() {
    this.disposed = true;
  }
}
let root: string;
let project: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'cli-runtime-execution-'));
  project = join(root, 'project');
  await mkdir(join(project, '.ad-sdlc/config'), { recursive: true });
});
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  await rm(root, { recursive: true, force: true });
});
async function workflow(value: object = {}) {
  await writeFile(
    join(project, '.ad-sdlc/config/workflow.yaml'),
    dump({ version: '1.0.0', pipeline: { default_mode: 'import' }, ...value })
  );
}
function opts(args: string[] = []) {
  return configureRunCommand(new Command())
    .exitOverride()
    .parse(['offline', '--project-dir', project, ...args], { from: 'user' })
    .opts();
}
async function prepared(adapter: ExecutionAdapter, args: string[] = []) {
  return prepareRunCommand('offline', opts(args), { env: {}, createAdapter: () => adapter });
}

// All handlers return synthetic observations. No paid SDK or GitHub resources are used.
describe('observable configuration ownership through the CLI', () => {
  it.each([1, 2])(
    'enforces %i simultaneous runnable analysis stages and dependencies',
    async (limit) => {
      await workflow({
        pipeline: { default_mode: 'enhancement' },
        execution: { max_parallel_stages: limit },
      });
      const gates = Array.from({ length: 3 }, () => deferred<StageExecutionResult>());
      const adapter = new ObservedAdapter(async (_req, index) =>
        index < 3 ? gates[index]!.promise : success
      );
      const run = await prepared(adapter);
      const execution = run.execute();
      await adapter.arrivals[limit - 1]!.promise;
      expect(adapter.active).toBe(limit);
      expect(adapter.calls).toHaveLength(limit);
      gates[0]!.resolve(success);
      await adapter.arrivals[limit]!.promise;
      if (limit === 1) {
        expect(adapter.active).toBe(1);
        gates[1]!.resolve(success);
        await adapter.arrivals[2]!.promise;
      } else gates[1]!.resolve(success);
      gates[2]!.resolve(success);
      const result = await execution;
      expect(adapter.maximum).toBe(limit);
      const comparison = adapter.calls.findIndex((req) => req.agentType === 'doc-code-comparator');
      expect(comparison).toBe(3);
      expect(Object.keys(adapter.calls[comparison]!.priorOutputs)).toEqual(
        expect.arrayContaining(['document_reading', 'codebase_analysis', 'code_reading'])
      );
      expect(adapter.calls.filter((req) => req.agentType === 'worker')).toHaveLength(1);
      expect(result.runtimeSnapshot).toEqual(run.plan);
    }
  );

  it.each([1, 3])('executes exactly %i attempts including the first', async (attempts) => {
    await workflow({
      global: {
        retry_policy: {
          max_attempts: attempts,
          base_delay_seconds: 1,
          max_delay_seconds: 1,
          backoff: 'fixed',
        },
      },
    });
    const adapter = new ObservedAdapter(async () => {
      throw new Error('controlled transient failure');
    });
    const run = await prepared(adapter, ['--stop-after', 'issue_reading']);
    vi.useFakeTimers();
    const execution = run.execute().catch((error: unknown) => error);
    await adapter.arrivals[0]!.promise;
    for (let index = 1; index < attempts; index++) {
      await vi.advanceTimersByTimeAsync(1000);
      await adapter.arrivals[index]!.promise;
    }
    await execution;
    expect(adapter.calls).toHaveLength(attempts);
    expect(adapter.times.map((time) => time - adapter.times[0]!)).toEqual(
      Array.from({ length: attempts }, (_, index) => index * 1000)
    );
  });

  it.each([
    ['fixed', 1, 2, [0, 1000, 2000, 3000]],
    ['linear', 1, 2, [0, 1000, 3000, 5000]],
    ['exponential', 1, 3, [0, 1000, 3000, 6000]],
    ['fibonacci', 2, 3, [0, 2000, 4000, 7000]],
  ] as const)(
    'uses %s backoff, base %i seconds and cap %i seconds',
    async (backoff, base, cap, expected) => {
      await workflow({
        global: {
          retry_policy: {
            max_attempts: 4,
            backoff,
            base_delay_seconds: base,
            max_delay_seconds: cap,
          },
        },
      });
      const adapter = new ObservedAdapter(async (_req, index) => {
        if (index < 3) throw new Error('retry');
        return success;
      });
      const run = await prepared(adapter, ['--stop-after', 'issue_reading']);
      vi.useFakeTimers();
      const execution = run.execute();
      await adapter.arrivals[0]!.promise;
      for (let index = 1; index < expected.length; index++) {
        await vi.advanceTimersByTimeAsync(expected[index]! - expected[index - 1]!);
        await adapter.arrivals[index]!.promise;
      }
      await execution;
      expect(adapter.times.map((time) => time - adapter.times[0]!)).toEqual(expected);
    }
  );

  it('retains the programmatic zero-retry API', async () => {
    await workflow();
    const adapter = new ObservedAdapter(async () => {
      throw new Error('failure');
    });
    const agent = new (class extends AdsdlcOrchestratorAgent {
      protected override createExecutionAdapter() {
        return adapter;
      }
    })({ maxRetries: 0 });
    await agent.startSession({
      projectDir: project,
      userRequest: 'offline',
      overrideMode: 'import',
      stopAfterStage: 'issue_reading',
    });
    await expect(agent.executePipeline(project, 'offline')).rejects.toThrow('failed');
    expect(adapter.calls).toHaveLength(1);
  });

  it.each([20, 100])('a total budget of %i ms changes the same 50 ms operation', async (budget) => {
    await workflow({
      execution: { stage_timeout_ms: budget },
      global: { retry_policy: { max_attempts: 1 } },
    });
    const adapter = new ObservedAdapter(
      (req) =>
        new Promise((yes, no) => {
          const timer = setTimeout(() => yes(success), 50);
          req.signal?.addEventListener(
            'abort',
            () => {
              clearTimeout(timer);
              no(new Error('cancelled after budget'));
            },
            { once: true }
          );
        })
    );
    const run = await prepared(adapter, ['--stop-after', 'issue_reading']);
    const agent = run.createAgent();
    vi.useFakeTimers();
    const execution = run.execute(agent).catch((error: unknown) => error);
    await adapter.arrivals[0]!.promise;
    await vi.advanceTimersByTimeAsync(50);
    await execution;
    expect(agent.getStatus().stages[0]!.status).toBe(budget === 20 ? 'failed' : 'completed');
    expect(adapter.active).toBe(0);
    expect(adapter.disposed).toBe(true);
  });

  it('spends one total budget across failed attempts and backoff', async () => {
    await workflow({
      execution: { stage_timeout_ms: 1500 },
      global: { retry_policy: { max_attempts: 3, backoff: 'fixed', base_delay_seconds: 1 } },
    });
    const adapter = new ObservedAdapter(async () => {
      throw new Error('retry');
    });
    const run = await prepared(adapter, ['--stop-after', 'issue_reading']);
    vi.useFakeTimers();
    const execution = run.execute().catch((error: unknown) => error);
    await adapter.arrivals[0]!.promise;
    await vi.advanceTimersByTimeAsync(1500);
    await execution;
    expect(adapter.times.map((time) => time - adapter.times[0]!)).toEqual([0, 1000]);
  });

  it('cancels during configured backoff without starting replacement work', async () => {
    await workflow({ global: { retry_policy: { max_attempts: 3, base_delay_seconds: 2 } } });
    const adapter = new ObservedAdapter(async () => {
      throw new Error('retry');
    });
    const run = await prepared(adapter);
    const agent = run.createAgent();
    vi.useFakeTimers();
    const execution = run.execute(agent).catch((error: unknown) => error);
    await adapter.arrivals[0]!.promise;
    await vi.advanceTimersByTimeAsync(500);
    await agent.dispose();
    await vi.advanceTimersByTimeAsync(5000);
    await execution;
    expect(adapter.calls).toHaveLength(1);
    expect(adapter.active).toBe(0);
  });

  it('waits for real SDK adapter cleanup before the configured retry delay and replacement', async () => {
    await workflow({
      execution: { stage_timeout_ms: 10000 },
      global: { retry_policy: { max_attempts: 2, base_delay_seconds: 1 } },
    });
    await installAgent(project, 'issue-reader');
    const queries: ControlledQuery[] = [];
    const arrivals = [deferred<ControlledQuery>(), deferred<ControlledQuery>()];
    const adapter = new SdkExecutionAdapter({
      cleanupGraceMs: 100,
      loader: async () => ({
        query(input) {
          expect(queries.every((query) => !query.writerActive)).toBe(true);
          const query = new ControlledQuery(input);
          queries.push(query);
          arrivals[queries.length - 1]!.resolve(query);
          return query;
        },
      }),
    });
    const run = await prepared(adapter, ['--stop-after', 'issue_reading']);
    vi.useFakeTimers();
    const execution = run.execute();
    const first = await arrivals[0]!.promise;
    await first.reading.promise;
    first.finish(sdkResult({ is_error: true }));
    await first.returning.promise;
    await vi.advanceTimersByTimeAsync(50);
    expect(queries).toHaveLength(1);
    expect(first.writerActive).toBe(true);
    first.cleanupGate.resolve();
    await first.cleaned.promise;
    await vi.advanceTimersByTimeAsync(999);
    expect(queries).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    const second = await arrivals[1]!.promise;
    second.finish();
    second.cleanupGate.resolve();
    await execution;
    expect(queries).toHaveLength(2);
    expect(queries.every((query) => !query.writerActive)).toBe(true);
  });

  it.each([
    ['strict', true, false],
    ['strict', false, true],
    ['standard', true, true],
  ] as const)(
    'preserves V&V rigor=%s halt=%s blocking semantics',
    async (rigor, halt, proceeds) => {
      await workflow({
        pipeline: { default_mode: 'greenfield' },
        global: { vnv: { rigor, halt_on_verification_failure: halt } },
      });
      // Real verifier finds missing collection artifacts; no verifier/scheduler mock.
      const adapter = new ObservedAdapter();
      const run = await prepared(adapter, ['--stop-after', 'prd_generation']);
      const agent = run.createAgent();
      await run.execute(agent).catch(() => undefined);
      expect(adapter.calls.some((call) => call.agentType === 'prd-writer')).toBe(proceeds);
      const collection = agent.getStatus().stages.find((stage) => stage.name === 'collection')!;
      if (proceeds) expect(collection.warnings?.join(' ')).toContain('Verification advisory');
      else expect(collection.error).toContain('Verification failed');
    }
  );

  it.each(['minimal', 'standard', 'enterprise'] as const)(
    'initializes %s and resolves/executes every canonical and local graph',
    async (template) => {
      await rm(project, { recursive: true, force: true });
      await new ProjectInitializer({
        projectName: 'project',
        targetDir: root,
        techStack: 'typescript',
        template,
        skipValidation: true,
      }).initialize();
      for (const mode of ['greenfield', 'enhancement', 'import'] as const)
        for (const local of [false, true]) {
          const adapter = new ObservedAdapter();
          const run = await prepared(adapter, [
            '--mode',
            mode,
            ...(local ? ['--local'] : ['--no-local']),
          ]);
          expect(run.plan.diagnostics).toEqual([]);
          expect(run.plan.stages.map(({ timeoutMs, ...stage }) => stage)).toEqual(
            buildCanonicalPlan(mode, local)
          );
          expect(run.plan.stages).toHaveLength(
            { greenfield: local ? 18 : 19, enhancement: 15, import: 5 }[mode]
          );
          const result = await run.execute();
          expect(adapter.calls.map((call) => call.agentType).sort()).toEqual(
            run.plan.stages.map((stage) => stage.agentType).sort()
          );
          expect(result.runtimeSnapshot).toEqual(run.plan);
          if (local) {
            expect(adapter.calls.some((call) => call.agentType === 'local-reviewer')).toBe(true);
            expect(run.plan.stages.some((stage) => stage.name === 'github_repo_setup')).toBe(false);
          }
        }
    }
  );

  it('stop-after waits for its whole ready group, including peers queued at concurrency one', async () => {
    await workflow({
      pipeline: { default_mode: 'enhancement' },
      execution: { max_parallel_stages: 1 },
    });
    const adapter = new ObservedAdapter();
    const run = await prepared(adapter, ['--stop-after', 'document_reading']);
    const result = await run.execute();
    expect(adapter.calls).toHaveLength(3);
    expect(result.stages.find((stage) => stage.name === 'doc_code_comparison')?.status).toBe(
      'skipped'
    );
    expect(result.runtimeSnapshot).toEqual(run.plan);
  });

  it('saves the runtime snapshot for monitoring/status and resumes it after malformed YAML changes', async () => {
    await workflow({ execution: { max_parallel_stages: 1, stage_timeout_ms: 9000 } });
    const adapter = new ObservedAdapter();
    const run = await prepared(adapter, ['--stop-after', 'issue_reading']);
    const agent = run.createAgent();
    const result = await run.execute(agent);
    expect(agent.getStatus().runtimeSnapshot).toEqual(run.plan);
    expect(agent.monitorPipeline().runtimeSnapshot).toEqual(run.plan);
    const saved = await readSavedPipelineRun(project, result.pipelineId);
    expect(saved?.runtimeSnapshot).toEqual(run.plan);
    await writeFile(join(project, '.ad-sdlc/config/workflow.yaml'), 'execution: [invalid');
    const status = await new StatusService({ projectDir: project }).getStatus();
    expect(status.runs?.[0]?.runtimeSnapshot).toEqual(run.plan);
    const resumed = await prepareRunCommand(
      'offline',
      opts(['--resume', result.pipelineId, '--stop-after', 'orchestration']),
      {
        env: { AD_SDLC_MODE: 'greenfield', AD_SDLC_MAX_ATTEMPTS: 'invalid' },
        createAdapter: () => new ObservedAdapter(),
      }
    );
    expect(resumed.plan.config).toEqual(run.plan.config);
    expect(resumed.plan.stages).toEqual(run.plan.stages);
    const again = await resumed.execute();
    expect(again.runtimeSnapshot).toEqual(resumed.plan);
    await expect(
      prepareRunCommand('offline', opts(['--resume', result.pipelineId, '--mode', 'enhancement']), {
        env: {},
      })
    ).rejects.toThrow('Resume retains');
  });

  it('reports an old session without synthesizing a saved snapshot, and explicitly migrates legacy resume', async () => {
    await workflow();
    await mkdir(join(project, '.ad-sdlc/scratchpad/pipeline'), { recursive: true });
    await writeFile(
      join(project, '.ad-sdlc/scratchpad/pipeline/old.yaml'),
      dump({
        pipelineId: 'old',
        projectId: 'project',
        mode: 'import',
        overallStatus: 'partial',
        startedAt: new Date().toISOString(),
        stages: [],
      })
    );
    const status = await new StatusService({ projectDir: project }).getStatus();
    expect(status.runs?.[0]).toMatchObject({
      runtimeSnapshotStatus: 'unavailable',
      message: expect.stringContaining('No saved runtime snapshot'),
    });
    const run = await prepared(new ObservedAdapter(), [
      '--resume',
      'old',
      '--stop-after',
      'issue_reading',
    ]);
    expect(run.plan.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'legacy-session' })
    );
    expect(run.plan.config.mode).toBe('import');
    await run.execute();
    expect((await readSavedPipelineRun(project, 'old'))?.runtimeSnapshot).toEqual(run.plan);
  });
  it('persists the plan before the first invocation finishes', async () => {
    await workflow();
    const gate = deferred<StageExecutionResult>();
    const adapter = new ObservedAdapter(async () => gate.promise);
    const run = await prepared(adapter, ['--stop-after', 'issue_reading']);
    const agent = run.createAgent();
    const execution = run.execute(agent);
    await adapter.arrivals[0]!.promise;
    const saved = await readSavedPipelineRun(project, agent.getSession()!.sessionId);
    expect(saved?.runtimeSnapshot).toEqual(run.plan);
    expect(saved?.data['overallStatus']).toBe('running');
    gate.resolve(success);
    await execution;
  });

  it('keeps cancellation and non-retryable cleanup failures across the CLI boundary', async () => {
    await workflow({
      pipeline: { default_mode: 'enhancement' },
      execution: { max_parallel_stages: 1, stage_timeout_ms: 1000 },
      global: { retry_policy: { max_attempts: 3, base_delay_seconds: 0 } },
    });
    await installAgent(project, 'document-reader');
    const arrived = deferred<ControlledQuery>();
    const queries: ControlledQuery[] = [];
    const adapter = new SdkExecutionAdapter({
      cleanupGraceMs: 20,
      loader: async () => ({
        query(input) {
          const query = new ControlledQuery(input);
          queries.push(query);
          arrived.resolve(query);
          return query;
        },
      }),
    });
    const run = await prepared(adapter);
    const agent = run.createAgent();
    vi.useFakeTimers();
    const execution = run.execute(agent).catch((error: unknown) => error);
    const first = await arrived.promise;
    await first.reading.promise;
    const disposal = agent.dispose().catch((error: unknown) => error);
    await first.returning.promise;
    await vi.advanceTimersByTimeAsync(25);
    first.cleanupGate.resolve();
    await first.cleaned.promise;
    await disposal;
    await execution;
    expect(queries).toHaveLength(1);
    expect(first.writerActive).toBe(false);
  });
});
