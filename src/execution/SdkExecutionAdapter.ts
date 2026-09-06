/**
 * SDK execution with an explicitly selected target-project agent and cwd.
 * Runtime loading stays lazy; production query input and messages use the
 * installed SDK types. Tests inject only query(), without unrelated Query APIs.
 * @packageDocumentation
 */

import type { Options, SDKMessage, SDKResultMessage, query } from '@anthropic-ai/claude-agent-sdk';
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

/** Injectable query boundary: offline doubles only implement async iteration. */
export interface SdkLike {
  query(opts: SdkQueryOptions): AsyncIterable<SdkMessage>;
}

/** Lazy runtime loader, replaceable by an offline query double. */
export type SdkLoader = () => Promise<SdkLike>;

const defaultLoader: SdkLoader = async () => import('@anthropic-ai/claude-agent-sdk');

export interface SdkExecutionAdapterOptions {
  /** Override the SDK loader for tests / alternative endpoints. */
  readonly loader?: SdkLoader;
  /**
   * Optional hook pipeline forwarded to the SDK as `options.hooks`. When
   * omitted, the adapter does not set the `hooks` key on the SDK options at
   * all (so the SDK sees no hooks key, not `hooks: undefined`).
   */
  readonly hooks?: HookPipeline;
}

/**
 *
 */
export class SdkExecutionAdapter implements ExecutionAdapter {
  private readonly loader: SdkLoader;
  private readonly hooks: HookPipeline | undefined;
  private sdkPromise: Promise<SdkLike> | null = null;
  private disposed = false;

  constructor(options: SdkExecutionAdapterOptions = {}) {
    this.loader = options.loader ?? defaultLoader;
    this.hooks = options.hooks;
  }

  /**
   *
   * @param req
   */
  async execute(req: StageExecutionRequest): Promise<StageExecutionResult> {
    if (this.disposed) {
      throw new AppError('EXEC-002', 'SdkExecutionAdapter: execute called after dispose', {
        severity: ErrorSeverity.HIGH,
      });
    }
    if (req.signal?.aborted === true) {
      return abortedResult(req.resume);
    }

    const abortController = new AbortController();
    const forwardAbort = (): void => {
      abortController.abort(req.signal?.reason);
    };
    // Read through a function because abort state can change across awaited SDK work.
    const isAborted = (): boolean => abortController.signal.aborted;
    req.signal?.addEventListener('abort', forwardAbort, { once: true });

    let sessionId = req.resume ?? 'unknown';
    let toolCallCount = 0;
    let tokenUsage: TokenUsage = { input: 0, output: 0, cache: 0 };
    let resultText: string | undefined;
    let isError = false;

    try {
      const definition = await resolveProjectAgent(req.projectDir, req.agentType);
      const sdk = await this.getSdk();
      // Cancellation may have arrived while resolving the definition or loader.
      if (isAborted()) return abortedResult(sessionId);
      const prompt = renderPrompt(req);
      const sdkOptions: Options = {
        cwd: req.projectDir,
        agent: req.agentType,
        agents: { [req.agentType]: definition },
        settingSources: ['user', 'project', 'local'],
        ...(req.skills !== undefined && { skills: [...req.skills] }),
        ...(req.mcpServers !== undefined && {
          mcpServers: copyMcpServers(req.mcpServers),
        }),
        ...(req.maxTurns !== undefined && { maxTurns: req.maxTurns }),
        ...(req.permissionMode !== undefined && { permissionMode: req.permissionMode }),
        ...(req.resume !== undefined && { resume: req.resume }),
        ...(req.signal !== undefined && { abortController }),
        ...(this.hooks !== undefined && { hooks: this.hooks }),
      };
      for await (const message of sdk.query({ prompt, options: sdkOptions })) {
        if ('session_id' in message && message.session_id !== '') {
          sessionId = message.session_id;
        }
        if (message.type === 'assistant') toolCallCount += 1;
        if (message.type === 'result') {
          resultText = message.subtype === 'success' ? message.result : message.errors.join('\n');
          isError = message.is_error || message.subtype !== 'success';
          toolCallCount = Math.max(toolCallCount, message.num_turns);
          tokenUsage = mapUsage(message.usage);
        }
      }
    } catch (err) {
      if (isAborted()) return abortedResult(sessionId);
      return failedResult(sessionId, err);
    } finally {
      req.signal?.removeEventListener('abort', forwardAbort);
    }

    if (isAborted()) return abortedResult(sessionId);

    if (isError || resultText === undefined) {
      return failedResult(sessionId, new Error(resultText ?? 'SDK returned no result'));
    }

    return {
      status: 'success',
      artifacts: extractArtifacts(resultText),
      sessionId,
      toolCallCount,
      tokenUsage,
    };
  }

  /**
   *
   */
  async dispose(): Promise<void> {
    this.disposed = true;
    this.sdkPromise = null;
    await Promise.resolve();
  }

  private getSdk(): Promise<SdkLike> {
    if (!this.sdkPromise) this.sdkPromise = this.loader();
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

function mapUsage(usage: SDKResultMessage['usage']): TokenUsage {
  const cache = usage.cache_read_input_tokens + usage.cache_creation_input_tokens;
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

function abortedResult(sessionId: string | undefined): StageExecutionResult {
  return {
    status: 'aborted',
    artifacts: [],
    sessionId: sessionId ?? 'unknown',
    toolCallCount: 0,
    tokenUsage: { input: 0, output: 0, cache: 0 },
  };
}

function failedResult(sessionId: string, err: unknown): StageExecutionResult {
  const cause = err instanceof Error ? err : new Error(String(err));
  const error = new AppError('EXEC-003', `SdkExecutionAdapter execute failed: ${cause.message}`, {
    severity: ErrorSeverity.HIGH,
    cause,
  });
  return {
    status: 'failed',
    artifacts: [],
    sessionId,
    toolCallCount: 0,
    tokenUsage: { input: 0, output: 0, cache: 0 },
    error: error.toJSON(),
  };
}
