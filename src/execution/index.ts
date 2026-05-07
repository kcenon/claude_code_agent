/**
 * AD-SDLC Execution layer — single SDK entrypoint for the pipeline.
 *
 * See `./README.md` and ARCH-RFC-001 §4.1 for the contract.
 *
 * @packageDocumentation
 */

export type {
  ArtifactRef,
  ExecutionAdapter,
  McpServerConfig,
  StageExecutionRequest,
  StageExecutionResult,
  StageExecutionStatus,
  TokenUsage,
} from './types.js';

export { MockExecutionAdapter } from './MockExecutionAdapter.js';
export type { MockExecutionAdapterOptions, MockExecutionHandler } from './MockExecutionAdapter.js';

export { SdkExecutionAdapter, renderPrompt } from './SdkExecutionAdapter.js';
export type {
  SdkExecutionAdapterOptions,
  SdkLike,
  SdkLoader,
  SdkMessage,
  SdkQueryOptions,
} from './SdkExecutionAdapter.js';

export { buildHookPipeline } from './hooks.js';
export type {
  ArtifactCaptureEntry,
  ArtifactSink,
  BuildHookPipelineOptions,
  HookPipeline,
  SdkHookCallback,
  SdkHookEntry,
  SdkToolUseEvent,
} from './hooks.js';
