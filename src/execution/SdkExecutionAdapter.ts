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
import type { HookPipeline } from './hooks.js';
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
  private sdkPromise: Promise<SdkLike> | null = null;
  private disposed = false;
  private disposal: Promise<void> | undefined;
  private readonly active = new Set<OwnedExecution>();
  private readonly cleanupFailures = new Map<OwnedExecution, AppError>();

  constructor(options: SdkExecutionAdapterOptions = {}) {
    this.loader = options.loader ?? defaultLoader;
    this.resolveAgent = options.resolveAgent ?? resolveProjectAgent;
    this.hooks = options.hooks;
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
      return await this.complete(execution);
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
      ...(this.hooks !== undefined && { hooks: this.hooks }),
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

  private async complete(execution: OwnedExecution): Promise<StageExecutionResult> {
    await Promise.race([execution.work, execution.cancelled]);
    const cleanupError = await this.finalize(execution);
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
      artifacts: status === 'success' ? extractArtifacts(execution.resultText ?? '') : [],
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
    if (execution.cleanupSettled && execution.executionSettled) this.active.delete(execution);
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
 * @param req
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
 * @param resultText
 */
function extractArtifacts(resultText: string): ArtifactRef[] {
  const out: ArtifactRef[] = [];
  for (const raw of resultText.split('\n')) {
    const match = raw.match(/^\s*([\w./\-_]+):\s*(.+)$/);
    if (match === null) continue;
    const path = match[1];
    const description = match[2];
    if (path === undefined || description === undefined) continue;
    out.push({ path, description: description.trim() });
  }
  return out;
}
