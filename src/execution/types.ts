/**
 * ExecutionAdapter — single SDK entrypoint contract for AD-SDLC v0.1.
 *
 * All Claude Agent SDK calls in the pipeline funnel through this interface so
 * that mocking, hooks, telemetry, and endpoint switching (Anthropic / Bedrock /
 * Vertex) can be applied at one place. See ARCH-RFC-001 §4.1.
 *
 * @packageDocumentation
 */

import type { McpStdioServerConfig, McpHttpServerConfig } from '@anthropic-ai/claude-agent-sdk';
import type { SerializedError } from '../errors/types.js';
import type { ArtifactContext, ArtifactManifest, ManifestReference } from './artifacts/schemas.js';

/**
 * Reference to an artifact produced by a stage. Path is relative to the
 * project root, using portable `/` separators. The optional SHA-256
 * checksum lets downstream consumers detect drift between recorded and
 * on-disk content.
 */
export interface ArtifactRef {
  readonly path: string;
  readonly description?: string;
  readonly checksum?: string;
}

/**
 * MCP server configuration consumed by the underlying SDK. Mirrors the shape
 * accepted by `@anthropic-ai/claude-agent-sdk` to keep the boundary thin.
 */
export type McpServerConfig =
  | (Readonly<Omit<McpStdioServerConfig, 'args' | 'type'>> & {
      readonly type: 'stdio';
      readonly args?: readonly string[];
    })
  | Readonly<McpHttpServerConfig>;

/**
 * Legacy token totals, kept for compatibility. SDK result `usage` (main agent
 * loop only) is used when the result reports it; otherwise distinct assistant
 * messages supply partial totals. `cache` merges cache-read and cache-creation
 * tokens, and a value the SDK did not report is 0. Use
 * {@link ExecutionMetrics.usage} to tell unknown from zero.
 */
export interface TokenUsage {
  readonly input: number;
  readonly output: number;
  readonly cache: number;
}

/**
 * Where the token counts of {@link UsageMetrics} come from.
 *
 * - `result`: the SDK result message (`modelUsage` totals over every model
 *   call, else its `usage`).
 * - `partial`: no usable result (failure, cancellation, timeout, or a zeroed
 *   error result); the sum of distinct assistant messages seen so far, which
 *   is a lower bound.
 * - `recovered`: no SDK call was made; resume reused a committed manifest, so
 *   the attempt consumed no tokens.
 * - `none`: nothing was reported; every token field is `null`.
 */
export type UsageSource = 'result' | 'partial' | 'recovered' | 'none';

/**
 * SDK token usage of one execution. A field is `null` when the SDK did not
 * report it (unknown), which is never the same as a measured 0.
 */
export interface UsageMetrics {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
  readonly cacheReadInputTokens: number | null;
  readonly cacheCreationInputTokens: number | null;
  readonly source: UsageSource;
}

/**
 * SDK observations of one execution, reported on every outcome. See
 * docs/guides/delivery-metrics.md.
 */
export interface ExecutionMetrics {
  readonly usage: UsageMetrics;
  /** SDK `num_turns` of the result message; `null` without a result. */
  readonly turnCount: number | null;
  /**
   * Tool invocations: distinct `tool_use` (and server or MCP tool use) content
   * blocks of assistant messages, deduplicated by block id. `null` when no SDK
   * message was observed.
   */
  readonly toolUseCount: number | null;
  /** Invocations per tool name; names that are not plain identifiers count as `other`. */
  readonly toolUses: Readonly<Record<string, number>>;
  /** Model of the SDK session (`system/init`), else the first model observed. */
  readonly modelId: string | null;
  /** Every model observed (init, assistant messages, result `modelUsage`), sorted. */
  readonly models: readonly string[];
  /** Installed `@anthropic-ai/claude-agent-sdk` package version. */
  readonly sdkVersion: string | null;
  /** Claude Code version reported by `system/init`. */
  readonly claudeCodeVersion: string | null;
}

/**
 * Outcome of a single stage execution.
 */
export type StageExecutionStatus = 'success' | 'failed' | 'aborted';

/**
 * Request payload for {@link ExecutionAdapter.execute}.
 *
 * `priorOutputs` is the canonical mechanism to feed upstream stage results
 * into the prompt. Adapters MUST include all entries verbatim somewhere in
 * the rendered prompt — see {@link MockExecutionAdapter} for the contract
 * test that asserts this.
 */
export interface StageExecutionRequest {
  /** Trusted invocation identity and output policy; enables durable manifests. */
  readonly artifactContext?: ArtifactContext;
  /** Hydrated upstream records, including for non-file scratchpad backends. */
  readonly priorManifests?: readonly ArtifactManifest[];
  /** Absolute root of the target project; never inferred by the SDK adapter. */
  readonly projectDir: string;
  readonly agentType: string;
  readonly workOrder: string;
  readonly priorOutputs: Record<string, string>;
  readonly skills?: readonly string[];
  readonly mcpServers?: Record<string, McpServerConfig>;
  readonly maxTurns?: number;
  readonly permissionMode?: 'default' | 'acceptEdits' | 'plan';
  readonly resume?: string;
  readonly signal?: AbortSignal;
}

/**
 * Result of a stage execution. `error` is populated only when
 * `status !== 'success'`. Available session/turn/usage observations survive failure
 * and cancellation. EXEC-004 means cleanup could not be established, even when
 * the causal status is aborted.
 */
export interface StageExecutionResult {
  /** Immutable manifest reference; authoritative when present. */
  readonly manifest?: ManifestReference;
  readonly status: StageExecutionStatus;
  readonly artifacts: readonly ArtifactRef[];
  readonly sessionId: string;
  /**
   * The larger of the distinct assistant messages and the SDK `num_turns`.
   * It counts turns, not tool invocations; the value is unchanged for
   * compatibility.
   * @deprecated Use `metrics.turnCount` for turns and `metrics.toolUseCount`
   * for tool invocations.
   */
  readonly toolCallCount: number;
  /**
   * Legacy totals with unknown values as 0.
   * @deprecated Use `metrics.usage`, which keeps unknown (`null`) apart from 0
   * and cache reads apart from cache creation.
   */
  readonly tokenUsage: TokenUsage;
  /**
   * SDK observations (usage, turns, tool invocations, model, versions),
   * including partial usage on failure, cancellation, and timeout. Optional
   * so adapters that cannot observe them stay valid.
   */
  readonly metrics?: ExecutionMetrics;
  readonly error?: SerializedError;
}

/**
 * Single SDK entrypoint for the pipeline. Implementations include
 * {@link SdkExecutionAdapter} (real `@anthropic-ai/claude-agent-sdk`)
 * and {@link MockExecutionAdapter} (testing).
 */
export interface ExecutionAdapter {
  /** Cleanup budget used to coordinate the scheduler fallback (default: 5000ms). */
  readonly cleanupGraceMs?: number;
  /** Completes after observable lifecycle cleanup, or reports a fatal cleanup error. */
  execute(req: StageExecutionRequest): Promise<StageExecutionResult>;
  /** Stops admission and joins all owned cleanup; concurrent calls share the outcome. */
  dispose(): Promise<void>;
}
