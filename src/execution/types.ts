/**
 * ExecutionAdapter — single SDK entrypoint contract for AD-SDLC v0.1.
 *
 * All Claude Agent SDK calls in the pipeline funnel through this interface so
 * that mocking, hooks, telemetry, and endpoint switching (Anthropic / Bedrock /
 * Vertex) can be applied at one place. See ARCH-RFC-001 §4.1.
 *
 * @packageDocumentation
 */

import type { SerializedError } from '../errors/types.js';

/**
 * Reference to an artifact produced by a stage. Path is relative to the
 * project's scratchpad root (e.g., `.ad-sdlc/scratchpad/...`). The optional
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
  | {
      readonly type: 'stdio';
      readonly command: string;
      readonly args?: readonly string[];
      readonly env?: Record<string, string>;
    }
  | {
      readonly type: 'http';
      readonly url: string;
      readonly headers?: Record<string, string>;
    };

/**
 * Token usage breakdown returned by every adapter call.
 */
export interface TokenUsage {
  readonly input: number;
  readonly output: number;
  readonly cache: number;
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
 * `status !== 'success'`.
 */
export interface StageExecutionResult {
  readonly status: StageExecutionStatus;
  readonly artifacts: readonly ArtifactRef[];
  readonly sessionId: string;
  readonly toolCallCount: number;
  readonly tokenUsage: TokenUsage;
  readonly error?: SerializedError;
}

/**
 * Single SDK entrypoint for the pipeline. Implementations include
 * {@link SdkExecutionAdapter} (real `@anthropic-ai/claude-agent-sdk`)
 * and {@link MockExecutionAdapter} (testing).
 */
export interface ExecutionAdapter {
  execute(req: StageExecutionRequest): Promise<StageExecutionResult>;
  dispose(): Promise<void>;
}
