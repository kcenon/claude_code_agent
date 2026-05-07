/**
 * Execution hook pipeline — minimal skeleton.
 *
 * Builds a hook configuration object that the SDK driver passes through to
 * `@anthropic-ai/claude-agent-sdk`'s `query()`. The current scope is the
 * `PostToolUse` matcher for `Edit` and `Write` tools: when the underlying
 * agent edits or writes a file, the hook captures the `tool_input.file_path`
 * and forwards it to an injected {@link ArtifactSink} so the next stage can
 * consume the artifact via its `priorOutputs`.
 *
 * Scope is intentionally narrow — `PreToolUse` and `Stop` matchers are
 * declared as TODO stubs that currently no-op. They will be expanded in
 * follow-up issues:
 *
 * - `PreToolUse` policy enforcement → AD-SDLC P3 (telemetry / policy engine)
 * - `Stop` finalization → AD-SDLC P3 (telemetry bridge)
 *
 * Failure semantics: any hook callback that throws aborts the SDK stage.
 * This module never swallows errors — it surfaces them up so the
 * {@link SdkExecutionAdapter} can return a `failed` {@link StageExecutionResult}.
 *
 * @packageDocumentation
 */

import { AppError } from '../errors/AppError.js';
import { ErrorSeverity } from '../errors/types.js';

/**
 * Minimal sink the hook needs to record an artifact. Decoupled from the full
 * Scratchpad to keep the hook trivially testable. Production wiring adapts
 * the real `Scratchpad` to this interface (a thin shim is sufficient).
 */
export interface ArtifactSink {
  /**
   * Record that a tool produced or modified the file at `filePath`.
   * MUST be idempotent — the SDK may re-emit the same path across retries.
   * Implementations may persist asynchronously; the returned promise is
   * awaited by the hook so persistence failure aborts the stage.
   */
  recordArtifact(entry: ArtifactCaptureEntry): void | Promise<void>;
}

/**
 * Single artifact-capture event passed to the {@link ArtifactSink}. The
 * shape mirrors what a downstream stage needs to pick the file up via
 * `priorOutputs`.
 */
export interface ArtifactCaptureEntry {
  /** File path the tool wrote or edited (verbatim from `tool_input.file_path`). */
  readonly filePath: string;
  /** Tool name that produced the artifact (`Edit` or `Write`). */
  readonly toolName: 'Edit' | 'Write';
  /** Wall-clock timestamp the hook fired (ISO-8601). */
  readonly capturedAt: string;
  /** SDK session id when available — useful for cross-referencing logs. */
  readonly sessionId?: string;
}

/**
 * Generic shape of a tool-use event the SDK forwards to a hook callback.
 * We intentionally accept a wide `tool_input` so callers do not need to
 * keep this in lockstep with the SDK's evolving tool catalog.
 */
export interface SdkToolUseEvent {
  readonly tool_name: string;
  readonly tool_input?: Record<string, unknown>;
  readonly session_id?: string;
}

/**
 * Callback signature the SDK invokes for matched tool events. Return value
 * is intentionally `void | Promise<void>` so the hook can be async.
 */
export type SdkHookCallback = (event: SdkToolUseEvent) => void | Promise<void>;

/**
 * Single hook entry: the `matcher` is a regex string the SDK applies to
 * `tool_name`; the `callback` runs when it matches.
 */
export interface SdkHookEntry {
  readonly matcher: string;
  readonly callback: SdkHookCallback;
}

/**
 * Hook pipeline shape consumed by {@link SdkExecutionAdapter}. Mirrors the
 * SDK's hook configuration: each top-level key is a hook event name, the
 * value is the list of (matcher, callback) entries.
 */
export interface HookPipeline {
  readonly PreToolUse?: readonly SdkHookEntry[];
  readonly PostToolUse?: readonly SdkHookEntry[];
  readonly Stop?: readonly SdkHookEntry[];
}

/**
 * Options accepted by {@link buildHookPipeline}.
 */
export interface BuildHookPipelineOptions {
  /** Optional clock injection point for deterministic tests. */
  readonly now?: () => Date;
}

/**
 * Tools whose `PostToolUse` event we capture into the artifact sink.
 * Combined into a single regex matcher so the SDK fires one callback for
 * either tool — keeping the per-event work O(1).
 */
const ARTIFACT_TOOL_NAMES = ['Edit', 'Write'] as const;
type ArtifactToolName = (typeof ARTIFACT_TOOL_NAMES)[number];
const ARTIFACT_TOOL_MATCHER = ARTIFACT_TOOL_NAMES.join('|');

/**
 * Build the hook pipeline that captures `Edit`/`Write` tool outputs into the
 * provided {@link ArtifactSink}.
 *
 * The returned object is shaped so the {@link SdkExecutionAdapter} can pass
 * it straight through to the SDK. Hook callbacks throw {@link AppError} on
 * any failure path (missing input, sink rejection) — the SDK stage aborts
 * as a result.
 *
 * @param sink Destination for captured artifact events.
 * @param options Optional knobs; `now` is the only injection point today.
 * @returns Hook pipeline object suitable for `query({ options: { hooks } })`.
 */
export function buildHookPipeline(
  sink: ArtifactSink,
  options: BuildHookPipelineOptions = {}
): HookPipeline {
  // Runtime guard for callers crossing the type boundary (e.g. JS or
  // dynamically-built sinks). The cast lets us inspect the value without
  // the type system insisting it must already be valid.
  const candidate = sink as ArtifactSink | null | undefined;
  if (
    candidate === null ||
    candidate === undefined ||
    typeof candidate.recordArtifact !== 'function'
  ) {
    throw new AppError('EXEC-101', 'buildHookPipeline: sink.recordArtifact is required', {
      severity: ErrorSeverity.HIGH,
    });
  }
  const now = options.now ?? ((): Date => new Date());

  const postToolUse: SdkHookEntry[] = [
    {
      matcher: ARTIFACT_TOOL_MATCHER,
      callback: async (event): Promise<void> => captureEditOrWrite(event, sink, now),
    },
  ];

  // PreToolUse and Stop are placeholders. We do NOT register no-op callbacks
  // with the SDK — the matcher list is empty so the SDK skips the hook event
  // entirely. The keys stay in the type for downstream wiring discoverability.
  // TODO(AD-P3): PreToolUse policy enforcement (issue follow-up).
  // TODO(AD-P3): Stop finalization → telemetry bridge (issue follow-up).
  return {
    PostToolUse: postToolUse,
  };
}

/**
 * Per-event capture logic. Validates the tool name and `file_path`, builds
 * an {@link ArtifactCaptureEntry}, and forwards it to the sink. Awaits any
 * async sink so a rejection aborts the stage.
 *
 * @param event Tool-use event the SDK forwarded to the matched hook.
 * @param sink Destination for the captured artifact entry.
 * @param now Clock function used to stamp `capturedAt`.
 */
async function captureEditOrWrite(
  event: SdkToolUseEvent,
  sink: ArtifactSink,
  now: () => Date
): Promise<void> {
  const toolName = event.tool_name;
  if (!isArtifactToolName(toolName)) {
    // Defensive: matcher should have filtered, but never trust the SDK.
    throw new AppError(
      'EXEC-102',
      `Hook captureEditOrWrite invoked for unsupported tool: ${toolName}`,
      { severity: ErrorSeverity.HIGH, context: { toolName } }
    );
  }

  const filePath = readFilePath(event.tool_input);
  if (filePath === null) {
    throw new AppError('EXEC-103', `Hook PostToolUse(${toolName}) missing tool_input.file_path`, {
      severity: ErrorSeverity.HIGH,
      context: { toolName },
    });
  }

  const entry: ArtifactCaptureEntry = {
    filePath,
    toolName,
    capturedAt: now().toISOString(),
    ...(event.session_id !== undefined ? { sessionId: event.session_id } : {}),
  };

  // Deliberate await: a sink failure must abort the stage.
  await sink.recordArtifact(entry);
}

function isArtifactToolName(name: string): name is ArtifactToolName {
  return (ARTIFACT_TOOL_NAMES as readonly string[]).includes(name);
}

function readFilePath(input: Record<string, unknown> | undefined): string | null {
  if (!input) return null;
  const value = input.file_path;
  if (typeof value !== 'string' || value.length === 0) return null;
  return value;
}
