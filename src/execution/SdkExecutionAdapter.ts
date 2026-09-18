/**
 * SDK execution with an explicitly selected target-project agent and cwd.
 * Runtime loading stays lazy; production query input and messages use the
 * installed SDK types. Tests inject query() and its supported lifecycle,
 * without unrelated Query APIs.
 * @packageDocumentation
 */

import type {
  Options,
  Query,
  SDKMessage,
  SDKResultMessage,
  query,
} from '@anthropic-ai/claude-agent-sdk';
import {
  DEFAULT_CLEANUP_GRACE_MS,
  ExecutionCleanupError,
  isExecutionCleanupError,
  withinCleanupGrace,
} from './cleanup.js';
import { resolveProjectAgent } from './resolveProjectAgent.js';
import { AppError } from '../errors/AppError.js';
import { ErrorSeverity } from '../errors/types.js';
import { buildHookPipeline, type HookPipeline } from './hooks.js';
import { ManifestStore } from './artifacts/ManifestStore.js';
import { ArtifactAttempt, manifestArtifacts } from './artifacts/ArtifactAttempt.js';
import {
  ARTIFACT_OUTPUT_FORMAT,
  artifactError,
  type ManifestReference,
} from './artifacts/schemas.js';
import { normalizeArtifactPath, inspectArtifact } from './artifacts/paths.js';
import type {
  ArtifactRef,
  ExecutionAdapter,
  StageExecutionRequest,
  StageExecutionResult,
  TokenUsage,
} from './types.js';

/** Official query input, retained under the existing exported name. */
export type SdkQueryOptions = Parameters<typeof query>[0];

/** Official SDK messages; adapters narrow discriminated variants explicitly. */
export type SdkMessage = SDKMessage;

/** Only the supported lifecycle and message iteration surface is required of doubles. */
export type SdkQuery = AsyncIterable<SDKMessage> & Pick<Query, 'close' | 'return'>;

/** Injectable query boundary using official lifecycle method types. */
export interface SdkLike {
  query(opts: SdkQueryOptions): SdkQuery;
}

/** Lazy runtime loader, replaceable by an offline query double. */
export type SdkLoader = () => Promise<SdkLike>;

const defaultLoader: SdkLoader = async () => import('@anthropic-ai/claude-agent-sdk');

export interface SdkExecutionAdapterOptions {
  /** Explicit compatibility only: validated path annotations from older agents. */
  readonly legacyTextArtifacts?: boolean;
  /** Offline storage seam; production uses the configured Scratchpad backend. */
  readonly openManifestStore?: typeof ManifestStore.open;
  /** Finite cleanup budget, independent of stage execution time (default: 5000ms). */
  readonly cleanupGraceMs?: number;
  /** Override target-project resolution for controlled setup tests. */
  readonly resolveAgent?: typeof resolveProjectAgent;
  /** Override the SDK loader for tests / alternative endpoints. */
  readonly loader?: SdkLoader;
  /**
   * Optional hook pipeline forwarded to the SDK as `options.hooks`. When
   * omitted, the adapter does not set the `hooks` key on the SDK options at
   * all (so the SDK sees no hooks key, not `hooks: undefined`).
   */
  readonly hooks?: HookPipeline;
}

interface OwnedExecution {
  artifactSettled: boolean;
  artifactStore?: ManifestStore;
  artifactAttempt?: ArtifactAttempt;
  artifactWork?: Promise<void>;
  artifacts?: StageExecutionResult['artifacts'];
  manifest?: ManifestReference;
  structuredOutput?: unknown;
  readonly controller: AbortController;
  readonly cancelled: Promise<void>;
  cancel(reason: unknown): void;
  work: Promise<void>;
  readonly completion: Promise<void>;
  query?: SdkQuery;
  cleanup?: Promise<AppError | undefined>;
  cleanupSettled: boolean;
  executionSettled: boolean;
  outcome: 'running' | 'success' | 'failed' | 'aborted';
  reason?: unknown;
  sessionId: string;
  toolCallCount: number;
  tokenUsage: TokenUsage;
  resultText?: string;
}

/** Each registered execution owns setup, consumption, and one shared cleanup operation. */
export class SdkExecutionAdapter implements ExecutionAdapter {
  readonly cleanupGraceMs: number;
  private readonly loader: SdkLoader;
  private readonly resolveAgent: typeof resolveProjectAgent;
  private readonly hooks: HookPipeline | undefined;
  private readonly openManifestStore: typeof ManifestStore.open;
  private readonly legacyTextArtifacts: boolean;
  private sdkPromise: Promise<SdkLike> | null = null;
  private disposed = false;
  private disposal: Promise<void> | undefined;
  private readonly active = new Set<OwnedExecution>();
  private readonly cleanupFailures = new Map<OwnedExecution, AppError>();

  constructor(options: SdkExecutionAdapterOptions = {}) {
    this.loader = options.loader ?? defaultLoader;
    this.resolveAgent = options.resolveAgent ?? resolveProjectAgent;
    this.hooks = options.hooks;
    this.openManifestStore =
      options.openManifestStore ??
      ((...args): Promise<ManifestStore> => ManifestStore.open(...args));
    this.legacyTextArtifacts = options.legacyTextArtifacts ?? false;
    this.cleanupGraceMs = options.cleanupGraceMs ?? DEFAULT_CLEANUP_GRACE_MS;
    if (!Number.isFinite(this.cleanupGraceMs) || this.cleanupGraceMs <= 0) {
      throw new RangeError('cleanupGraceMs must be finite and greater than zero');
    }
  }

  /** Register before any asynchronous setup and retain unresolved work until it settles.
   * @param req - Target project, prompt and optional caller cancellation
   * @returns Outcome after cleanup, or an explicit fatal cleanup diagnostic
   */
  async execute(req: StageExecutionRequest): Promise<StageExecutionResult> {
    if (this.disposed) {
      throw new AppError('EXEC-002', 'SdkExecutionAdapter: execute called after dispose', {
        severity: ErrorSeverity.HIGH,
        category: 'fatal',
      });
    }
    const priorCleanupFailure = this.cleanupFailures.values().next().value;
    if (priorCleanupFailure !== undefined) throw priorCleanupFailure;

    const controller = new AbortController();
    let notifyCancellation!: () => void;
    const cancelled = new Promise<void>((resolve) => {
      notifyCancellation = resolve;
    });
    let notifyCompletion!: () => void;
    const completion = new Promise<void>((resolve) => {
      notifyCompletion = resolve;
    });
    const forwardAbort = (): void => {
      execution.cancel(req.signal?.reason);
    };
    const execution: OwnedExecution = {
      artifactSettled: true,
      controller,
      cancelled,
      cancel: (reason): void => {
        // Mechanical abort for failure cleanup must not change the causal outcome.
        if (execution.outcome === 'running' || execution.outcome === 'success') {
          execution.outcome = 'aborted';
          execution.reason = reason;
        }
        controller.abort(reason);
        notifyCancellation();
      },
      work: Promise.resolve(),
      completion,
      cleanupSettled: false,
      executionSettled: false,
      outcome: 'running',
      sessionId: req.resume ?? 'unknown',
      toolCallCount: 0,
      tokenUsage: { input: 0, output: 0, cache: 0 },
    };
    this.active.add(execution);
    req.signal?.addEventListener('abort', forwardAbort, { once: true });
    if (req.signal?.aborted === true) forwardAbort();

    // Deferring setup also makes synchronous loader/query throws observed failures.
    execution.work = Promise.resolve().then(async () => {
      try {
        await this.consume(req, execution);
      } catch (error) {
        if (execution.outcome === 'running' || execution.outcome === 'success') {
          execution.outcome = 'failed';
          execution.reason = error;
        }
      }
    });
    try {
      return await this.complete(req, execution);
    } finally {
      req.signal?.removeEventListener('abort', forwardAbort);
      execution.executionSettled = true;
      notifyCompletion();
      this.release(execution);
    }
  }

  private async consume(req: StageExecutionRequest, execution: OwnedExecution): Promise<void> {
    const stopped = (): boolean => {
      if (execution.controller.signal.aborted || this.disposed) return true;
      const failure = this.cleanupFailures.values().next().value;
      if (failure !== undefined) throw failure;
      return false;
    };
    if (stopped()) return;
    const definition = await this.resolveAgent(req.projectDir, req.agentType);
    if (stopped()) return;
    const sdk = await this.getSdk();
    if (stopped()) return;
    let hooks = this.hooks;
    if (req.artifactContext !== undefined) {
      execution.artifactStore = await this.openManifestStore(
        req.projectDir,
        req.artifactContext.scratchpadDir
      );
      if (stopped()) {
        await execution.artifactStore.close();
        delete execution.artifactStore;
        return;
      }
      execution.artifactAttempt = new ArtifactAttempt(
        execution.artifactStore,
        req.artifactContext,
        req.agentType,
        execution.controller.signal
      );
      const capture = buildHookPipeline(execution.artifactAttempt);
      hooks = {
        ...hooks,
        PostToolUse: [...(hooks?.PostToolUse ?? []), ...(capture.PostToolUse ?? [])],
      };
    }
    const sdkOptions: Options = {
      cwd: req.projectDir,
      agent: req.agentType,
      agents: { [req.agentType]: definition },
      settingSources: ['user', 'project', 'local'],
      abortController: execution.controller,
      ...(req.skills !== undefined && { skills: [...req.skills] }),
      ...(req.mcpServers !== undefined && { mcpServers: copyMcpServers(req.mcpServers) }),
      ...(req.maxTurns !== undefined && { maxTurns: req.maxTurns }),
      ...(req.permissionMode !== undefined && { permissionMode: req.permissionMode }),
      ...(req.resume !== undefined && { resume: req.resume }),
      ...(hooks !== undefined && { hooks }),
      ...(req.artifactContext !== undefined ? { outputFormat: ARTIFACT_OUTPUT_FORMAT } : {}),
    };
    execution.query = sdk.query({ prompt: renderPrompt(req), options: sdkOptions });
    const assistantUsage = new Map<string, TokenUsage>();
    let hasResultUsage = false;
    for await (const message of execution.query) {
      if ('session_id' in message && message.session_id !== '')
        execution.sessionId = message.session_id;
      if (message.type === 'assistant') {
        const previous = assistantUsage.get(message.message.id) ?? {
          input: 0,
          output: 0,
          cache: 0,
        };
        const usage = mapUsage(message.message.usage);
        assistantUsage.set(message.message.id, usage);
        execution.toolCallCount = Math.max(execution.toolCallCount, assistantUsage.size);
        if (!hasResultUsage) {
          execution.tokenUsage = {
            input: execution.tokenUsage.input + usage.input - previous.input,
            output: execution.tokenUsage.output + usage.output - previous.output,
            cache: execution.tokenUsage.cache + usage.cache - previous.cache,
          };
        }
      }
      if (message.type === 'result') {
        if (message.subtype === 'success') execution.structuredOutput = message.structured_output;
        execution.resultText =
          message.subtype === 'success' ? message.result : message.errors.join('\n');
        const isError = message.is_error || message.subtype !== 'success';
        execution.toolCallCount = Math.max(execution.toolCallCount, message.num_turns);
        execution.tokenUsage = mapUsage(message.usage);
        hasResultUsage = true;
        if (isError && execution.outcome === 'running') {
          execution.outcome = 'failed';
          execution.reason = new Error(execution.resultText);
        }
      }
    }
    if (execution.outcome === 'aborted' || execution.outcome === 'failed') return;
    if (execution.resultText === undefined) {
      throw new Error('SDK returned no result');
    }
    execution.outcome = 'success';
  }

  private async complete(
    req: StageExecutionRequest,
    execution: OwnedExecution
  ): Promise<StageExecutionResult> {
    await Promise.race([execution.work, execution.cancelled]);
    const cleanupStartedAt = Date.now();
    let cleanupError = await this.finalize(execution);
    if (execution.artifactStore !== undefined) {
      const store = execution.artifactStore;
      execution.artifactSettled = false;
      execution.artifactWork = (async (): Promise<void> => {
        try {
          // Join late setup/captures even when SDK cleanup already timed out.
          await execution.work;
          if (execution.artifactAttempt !== undefined) {
            const outcome =
              cleanupError === undefined && execution.outcome === 'success'
                ? 'success'
                : execution.outcome === 'aborted'
                  ? 'aborted'
                  : 'failed';
            const finished = await execution.artifactAttempt.finish(
              {
                status: outcome,
                artifacts: [],
                sessionId: execution.sessionId,
                toolCallCount: execution.toolCallCount,
                tokenUsage: execution.tokenUsage,
              },
              execution.structuredOutput
            );
            execution.manifest = finished.reference;
            execution.artifacts =
              finished.manifest.status === 'complete' ? manifestArtifacts(finished.manifest) : [];
          }
        } catch (error) {
          if (execution.outcome !== 'aborted') execution.outcome = 'failed';
          execution.reason = artifactError(
            `Artifact ${req.artifactContext?.stageName ?? req.agentType}/${req.artifactContext?.attemptId ?? 'standalone'}: ${error instanceof Error ? error.message : String(error)}`
          );
          if (execution.artifactAttempt !== undefined)
            execution.manifest = await execution.artifactAttempt.fail(
              {
                status: execution.outcome === 'aborted' ? 'aborted' : 'failed',
                artifacts: [],
                sessionId: execution.sessionId,
                toolCallCount: execution.toolCallCount,
                tokenUsage: execution.tokenUsage,
              },
              (execution.reason as Error).message
            );
        } finally {
          await store.close();
          execution.artifactSettled = true;
          this.release(execution);
        }
      })();
      try {
        const remainingGraceMs = Math.max(1, this.cleanupGraceMs - (Date.now() - cleanupStartedAt));
        await withinCleanupGrace(
          execution.artifactWork,
          remainingGraceMs,
          () =>
            new ExecutionCleanupError(
              'Artifact persistence cleanup grace period exceeded',
              execution.reason,
              { phase: 'artifacts', unresolved: true }
            )
        );
      } catch (error) {
        cleanupError =
          error instanceof AppError
            ? error
            : new ExecutionCleanupError('Artifact store cleanup failed', error);
        this.cleanupFailures.set(execution, cleanupError);
        execution.controller.abort(cleanupError);
      }
    } else if (execution.outcome === 'success' && this.legacyTextArtifacts) {
      execution.artifacts = await extractLegacyArtifacts(
        req.projectDir,
        execution.resultText ?? ''
      );
    }
    const status =
      execution.outcome === 'aborted'
        ? 'aborted'
        : execution.outcome === 'success' && cleanupError === undefined
          ? 'success'
          : 'failed';
    const reason = execution.reason;
    const cause = reason instanceof Error ? reason : new Error(String(reason));
    const error =
      cleanupError ??
      (isExecutionCleanupError(reason) ? reason : undefined) ??
      (status === 'success'
        ? undefined
        : new AppError(
            status === 'aborted' ? 'EXEC-005' : 'EXEC-003',
            `SdkExecutionAdapter execute ${status}: ${cause.message}`,
            {
              severity: ErrorSeverity.HIGH,
              category:
                status === 'aborted'
                  ? 'fatal'
                  : execution.reason instanceof AppError
                    ? execution.reason.category
                    : 'transient',
              context: {
                reason:
                  execution.reason instanceof Error ? execution.reason.message : execution.reason,
              },
              ...(reason !== undefined ? { cause } : {}),
            }
          ));
    return {
      status,
      artifacts: status === 'success' ? (execution.artifacts ?? []) : [],
      ...(execution.manifest !== undefined ? { manifest: execution.manifest } : {}),
      sessionId: execution.sessionId,
      toolCallCount: execution.toolCallCount,
      tokenUsage: execution.tokenUsage,
      ...(error !== undefined ? { error: error.toJSON() } : {}),
    };
  }

  private finalize(execution: OwnedExecution): Promise<AppError | undefined> {
    execution.cleanup ??= this.cleanup(execution);
    return execution.cleanup;
  }

  private async cleanup(execution: OwnedExecution): Promise<AppError | undefined> {
    if (execution.outcome !== 'success') execution.controller.abort(execution.reason);
    const errors: string[] = [];
    const failure = (unresolved: boolean): AppError =>
      new ExecutionCleanupError('SDK cleanup failed', execution.reason, {
        phase: 'adapter',
        unresolved,
        cleanupErrors: [...errors],
      });
    const recordFailure = (error: unknown): void => {
      errors.push(error instanceof Error ? error.message : String(error));
      // Stop admission immediately, including while sibling stages are completing.
      this.cleanupFailures.set(execution, failure(!execution.cleanupSettled));
    };
    const query = execution.query;
    // Keep the outer Query: its iterator is a different object in SDK 0.3.258.
    try {
      query?.close();
    } catch (error) {
      recordFailure(error);
    }
    const returned = Promise.resolve().then(async () => {
      try {
        await query?.return(undefined);
      } catch (error) {
        recordFailure(error);
      }
    });
    const settled = Promise.allSettled([execution.work, returned]).then((results) => {
      for (const result of results) if (result.status === 'rejected') recordFailure(result.reason);
      execution.cleanupSettled = true;
      delete execution.query;
      this.release(execution);
    });
    try {
      await withinCleanupGrace(
        settled,
        this.cleanupGraceMs,
        () =>
          new ExecutionCleanupError(
            'SDK cleanup grace period exceeded; execution may still be active',
            execution.reason,
            {
              cleanupGraceMs: this.cleanupGraceMs,
              phase: 'adapter',
              unresolved: true,
              cleanupErrors: [...errors],
            }
          )
      );
      if (errors.length > 0) throw failure(false);
    } catch (error) {
      const diagnostic =
        error instanceof AppError
          ? error
          : new ExecutionCleanupError('SDK cleanup failed', execution.reason);
      this.cleanupFailures.set(execution, diagnostic);
      return diagnostic;
    }
    return undefined;
  }

  private release(execution: OwnedExecution): void {
    if (execution.cleanupSettled && execution.artifactSettled && execution.executionSettled)
      this.active.delete(execution);
  }

  /** Stop admission synchronously; every caller joins the same disposal and its failures.
   * @returns Completion after all owned executions reached their bounded cleanup boundary
   */
  dispose(): Promise<void> {
    if (this.disposal !== undefined) return this.disposal;
    this.disposed = true;
    const executions = [...this.active];
    this.disposal = Promise.resolve().then(async (): Promise<void> => {
      await Promise.allSettled(executions.map((execution) => execution.completion));
      this.sdkPromise = null;
      if (this.cleanupFailures.size > 0)
        throw new ExecutionCleanupError(
          'SdkExecutionAdapter disposal failed',
          this.cleanupFailures.values().next().value,
          {
            unresolvedExecutions: this.active.size,
            cleanupErrors: [...this.cleanupFailures.values()].map((error) => error.toJSON()),
          }
        );
    });
    for (const execution of executions) execution.cancel(new Error('SdkExecutionAdapter disposed'));
    return this.disposal;
  }

  private getSdk(): Promise<SdkLike> {
    this.sdkPromise ??= this.loader();
    return this.sdkPromise;
  }
}

/**
 * Render a prompt that includes the work order and every prior output verbatim.
 * The format is intentionally simple — downstream agents parse the section
 * headers to retrieve specific upstream outputs.
 * @param req - Invocation with work order, prior summaries, and artifact contracts.
 * @returns Complete prompt with verbatim summaries and hydrated manifest metadata.
 */
export function renderPrompt(req: StageExecutionRequest): string {
  const blocks: string[] = [`# Stage: ${req.agentType}`, '', '## Work order', '', req.workOrder];
  const entries = Object.entries(req.priorOutputs);
  if (entries.length > 0) {
    blocks.push('', '## Prior outputs');
    for (const [key, value] of entries) {
      blocks.push('', `### ${key}`, '', value);
    }
  }
  if (req.artifactContext !== undefined) {
    blocks.push(
      '',
      '## Artifact output contract',
      'Return structured output {"schemaVersion":1,"artifacts":[{"path":"project/relative/path","kind":"file","operation":"written"}]}.',
      'Declare files/directories produced by Bash, MCP, or other tools as well as deletions. Kinds: file, directory, external-file, external-uri. Operations: created, modified, written, deleted, reused.',
      'Edit/Write captures are persisted independently. Use written when creation versus modification is unknown. Reused project artifacts require upstream provenance. External references require explicit caller permission.',
      `Required output contracts: ${JSON.stringify(req.artifactContext.requiredOutputs)}`,
      `Permitted external references: ${JSON.stringify(req.artifactContext.externalReferences ?? [])}`,
      `Upstream manifest references: ${JSON.stringify(req.artifactContext.upstream)}`
    );
    const legacyStages = Object.keys(req.priorOutputs).filter(
      (stage) => req.artifactContext?.upstream.some((ref) => ref.stageName === stage) !== true
    );
    if (legacyStages.length > 0)
      blocks.push(
        `Legacy upstream summaries (unverified artifact lineage): ${JSON.stringify(legacyStages)}`
      );
  }
  if (req.priorManifests !== undefined)
    blocks.push('', '## Persisted upstream manifests', JSON.stringify(req.priorManifests));
  return blocks.join('\n');
}

function copyMcpServers(
  servers: NonNullable<StageExecutionRequest['mcpServers']>
): NonNullable<Options['mcpServers']> {
  const copied: NonNullable<Options['mcpServers']> = {};
  for (const [name, server] of Object.entries(servers)) {
    if (server.type === 'stdio') {
      const { args, ...config } = server;
      copied[name] = { ...config, ...(args !== undefined ? { args: [...args] } : {}) };
    } else {
      copied[name] = { ...server };
    }
  }
  return copied;
}

function mapUsage(
  usage: Pick<SDKResultMessage['usage'], 'input_tokens' | 'output_tokens'> & {
    cache_read_input_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
  }
): TokenUsage {
  const cache = (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
  return {
    input: usage.input_tokens,
    output: usage.output_tokens,
    cache,
  };
}

/**
 * Lift any `path:` annotations the agent emitted into ArtifactRefs. The agent
 * convention is one per line as `<path>: <description>`. Lines without that
 * shape are ignored.
 * @param projectDir - Explicit absolute project root used to validate legacy paths.
 * @param resultText - Legacy final-response text containing optional path annotations.
 * @returns Deduplicated references to verified existing project files.
 */
async function extractLegacyArtifacts(
  projectDir: string,
  resultText: string
): Promise<ArtifactRef[]> {
  const out: ArtifactRef[] = [];
  for (const raw of resultText.split('\n')) {
    const match = raw.match(/^(.+?):\s+(.+)$/u);
    if (match === null) continue;
    const path = match[1];
    const description = match[2];
    if (path === undefined || description === undefined) continue;
    // Explicit path syntax plus real filesystem evidence excludes generic status lines.
    if (!/[./\\]/.test(path)) continue;
    try {
      const normalized = normalizeArtifactPath(projectDir, path);
      const observed = await inspectArtifact(projectDir, {
        path: normalized,
        kind: 'file',
        operation: 'written',
      });
      if (observed.availability === 'present' && !out.some((entry) => entry.path === normalized))
        out.push({
          path: normalized,
          description: description.trim(),
          ...(observed.checksum !== undefined ? { checksum: observed.checksum } : {}),
        });
    } catch {
      /* Invalid legacy annotations do not declare artifacts. */
    }
  }
  return out;
}
