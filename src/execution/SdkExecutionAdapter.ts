/**
 * SdkExecutionAdapter — real adapter that drives `@anthropic-ai/claude-agent-sdk`.
 *
 * Loads the SDK lazily via dynamic `import()` so this module compiles in
 * environments where the SDK is not yet installed. Tests inject a fake
 * `loader` to bypass the actual import.
 *
 * Maps {@link StageExecutionRequest} → SDK options as follows:
 *
 * | Request field   | SDK option       | Note                                           |
 * |-----------------|------------------|------------------------------------------------|
 * | `agentType`     | (prompt prefix)  | Identifies which `.claude/agents/*.md` to load |
 * | `workOrder`     | prompt body      |                                                |
 * | `priorOutputs`  | prompt context   | Verbatim, labeled by key                       |
 * | `skills`        | options.skills   |                                                |
 * | `mcpServers`    | options.mcpServers |                                              |
 * | `maxTurns`      | options.maxTurns |                                                |
 * | `resume`        | options.resume   | Continue an earlier session                    |
 * | `signal`        | options.signal   |                                                |
 *
 * @packageDocumentation
 */

import { AppError } from '../errors/AppError.js';
import { ErrorSeverity } from '../errors/types.js';
import type {
  ArtifactRef,
  ExecutionAdapter,
  McpServerConfig,
  StageExecutionRequest,
  StageExecutionResult,
  TokenUsage,
} from './types.js';

/**
 * Minimal subset of `@anthropic-ai/claude-agent-sdk` we depend on. We declare
 * it locally so tsc can compile this file without the package being installed.
 * Real SDK types are wider; we only consume what is documented here.
 */
export interface SdkQueryOptions {
  prompt: string;
  options?: {
    skills?: readonly string[];
    mcpServers?: Record<string, McpServerConfig>;
    maxTurns?: number;
    resume?: string;
    signal?: AbortSignal;
  };
}

/**
 * Shape of messages the SDK yields. We pattern-match on `type`.
 */
export interface SdkMessage {
  readonly type: 'system' | 'assistant' | 'user' | 'result';
  readonly subtype?: string;
  readonly session_id?: string;
  readonly result?: string;
  readonly is_error?: boolean;
  readonly num_turns?: number;
  readonly usage?: {
    readonly input_tokens?: number;
    readonly output_tokens?: number;
    readonly cache_read_input_tokens?: number;
    readonly cache_creation_input_tokens?: number;
  };
}

export interface SdkLike {
  query(opts: SdkQueryOptions): AsyncIterable<SdkMessage>;
}

/**
 * Loader function for the SDK module. Defaults to a dynamic import of
 * `@anthropic-ai/claude-agent-sdk`. Tests pass a fake.
 */
export type SdkLoader = () => Promise<SdkLike>;

const defaultLoader: SdkLoader = async () => {
  const moduleSpecifier = '@anthropic-ai/claude-agent-sdk';
  const mod = (await import(/* @vite-ignore */ moduleSpecifier)) as Partial<SdkLike>;
  if (typeof mod.query !== 'function') {
    throw new AppError(
      'EXEC-001',
      '@anthropic-ai/claude-agent-sdk did not export a `query` function',
      { severity: ErrorSeverity.CRITICAL }
    );
  }
  return mod as SdkLike;
};

export interface SdkExecutionAdapterOptions {
  /** Override the SDK loader for tests / alternative endpoints. */
  readonly loader?: SdkLoader;
}

export class SdkExecutionAdapter implements ExecutionAdapter {
  private readonly loader: SdkLoader;
  private sdkPromise: Promise<SdkLike> | null = null;
  private disposed = false;

  constructor(options: SdkExecutionAdapterOptions = {}) {
    this.loader = options.loader ?? defaultLoader;
  }

  async execute(req: StageExecutionRequest): Promise<StageExecutionResult> {
    if (this.disposed) {
      throw new AppError('EXEC-002', 'SdkExecutionAdapter: execute called after dispose', {
        severity: ErrorSeverity.HIGH,
      });
    }
    if (req.signal?.aborted === true) {
      return abortedResult(req.resume);
    }

    const sdk = await this.getSdk();
    const prompt = renderPrompt(req);
    const sdkOptions: SdkQueryOptions['options'] = {
      skills: req.skills,
      mcpServers: req.mcpServers,
      maxTurns: req.maxTurns,
      resume: req.resume,
      signal: req.signal,
    };

    let sessionId = req.resume ?? 'unknown';
    let toolCallCount = 0;
    let tokenUsage: TokenUsage = { input: 0, output: 0, cache: 0 };
    let resultText: string | undefined;
    let isError = false;

    try {
      for await (const message of sdk.query({ prompt, options: sdkOptions })) {
        if (message.session_id !== undefined && message.session_id !== '') {
          sessionId = message.session_id;
        }
        if (message.type === 'assistant') toolCallCount += 1;
        if (message.type === 'result') {
          resultText = message.result;
          isError = message.is_error === true;
          if (typeof message.num_turns === 'number') {
            toolCallCount = Math.max(toolCallCount, message.num_turns);
          }
          if (message.usage !== undefined) tokenUsage = mapUsage(message.usage);
        }
      }
    } catch (err) {
      if (req.signal?.aborted === true) return abortedResult(sessionId);
      return failedResult(sessionId, err);
    }

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

  // eslint-disable-next-line @typescript-eslint/require-await
  async dispose(): Promise<void> {
    this.disposed = true;
    this.sdkPromise = null;
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
 */
export function renderPrompt(req: StageExecutionRequest): string {
  const blocks: string[] = [`# Stage: ${req.agentType}`, '', '## Work order', '', req.workOrder];
  const keys = Object.keys(req.priorOutputs);
  if (keys.length > 0) {
    blocks.push('', '## Prior outputs');
    for (const key of keys) {
      blocks.push('', `### ${key}`, '', req.priorOutputs[key]);
    }
  }
  return blocks.join('\n');
}

function mapUsage(usage: NonNullable<SdkMessage['usage']>): TokenUsage {
  const cache = (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
  return {
    input: usage.input_tokens ?? 0,
    output: usage.output_tokens ?? 0,
    cache,
  };
}

/**
 * Lift any `path:` annotations the agent emitted into ArtifactRefs. The agent
 * convention is one per line as `<path>: <description>`. Lines without that
 * shape are ignored.
 */
function extractArtifacts(resultText: string): ArtifactRef[] {
  const out: ArtifactRef[] = [];
  for (const raw of resultText.split('\n')) {
    const match = raw.match(/^\s*([\w./\-_]+):\s*(.+)$/);
    if (match) out.push({ path: match[1], description: match[2].trim() });
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
