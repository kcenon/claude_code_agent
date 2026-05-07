# Execution Module

Single Claude Agent SDK entrypoint for the AD-SDLC pipeline. Per
[ARCH-RFC-001](../../docs/architecture/v0.1-hybrid-pipeline-rfc.md) §4.1
(ExecutionAdapter), every stage that needs to call out to an agent funnels
through one of the
`ExecutionAdapter` implementations exposed here, and every Edit/Write a stage
performs is captured by the hook pipeline so the next stage can consume it
through `priorOutputs`.

## Overview

The execution layer answers a single question: **how does any pipeline stage
talk to the Claude Agent SDK?** Five concerns share that answer:

| Concern            | What the funnel buys                                                                |
| ------------------ | ----------------------------------------------------------------------------------- |
| Testability        | Mock once, every stage benefits                                                     |
| Hooks              | `PreToolUse` / `PostToolUse` / `Stop` policy lives in the adapter, not in 35 places |
| Telemetry          | One span emitter; consistent attributes across stages                               |
| Endpoint switching | Anthropic / Bedrock / Vertex selection happens behind one interface                 |
| Hot-reload         | Rotate keys / models without touching pipeline code                                 |

Within the 3-tier architecture
([ARCH-RFC-001](../../docs/architecture/v0.1-hybrid-pipeline-rfc.md) §3),
this module sits at the Tier-3 boundary between the orchestrator (Tier-1) /
stage logic (Tier-2) and the actual SDK runtime. See ARCH-RFC-001 §6 in the
same document for how stages migrate onto this entrypoint.

### Public surface

```typescript
import {
  type ExecutionAdapter,
  type StageExecutionRequest,
  type StageExecutionResult,
  MockExecutionAdapter,
  SdkExecutionAdapter,
  buildHookPipeline,
  type ArtifactSink,
} from '@/execution';
```

## ExecutionAdapter Interface

The contract every adapter implements. Defined in
[`types.ts`](./types.ts).

```typescript
export interface ExecutionAdapter {
  execute(req: StageExecutionRequest): Promise<StageExecutionResult>;
  dispose(): Promise<void>;
}
```

### Request

`StageExecutionRequest` carries everything a stage needs to run a single
SDK call:

| Field          | Required | Purpose                                                          |
| -------------- | -------- | ---------------------------------------------------------------- |
| `agentType`    | yes      | Identifies which `.claude/agents/*.md` to load (e.g. `'worker'`) |
| `workOrder`    | yes      | Prompt body — the actual instruction the stage emits             |
| `priorOutputs` | yes      | Verbatim outputs from upstream stages, keyed by stage name       |
| `skills`       | no       | SDK skill names to enable for this call                          |
| `mcpServers`   | no       | MCP server config map forwarded to the SDK                       |
| `maxTurns`     | no       | Cap on agent turns; SDK aborts past this                         |
| `resume`       | no       | SDK session id to continue                                       |
| `signal`       | no       | `AbortSignal` for cancellation                                   |

### Result

`StageExecutionResult` is the same shape regardless of adapter:

| Field           | Meaning                                                              |
| --------------- | -------------------------------------------------------------------- |
| `status`        | `'success' \| 'failed' \| 'aborted'`                                 |
| `artifacts`     | `ArtifactRef[]` — files the stage produced; lifted from agent output |
| `sessionId`     | SDK session id (for `resume` on a later call)                        |
| `toolCallCount` | Number of agent turns observed                                       |
| `tokenUsage`    | `{ input, output, cache }` token counts                              |
| `error`         | `SerializedError`, populated only when `status !== 'success'`        |

### `priorOutputs` contract

Adapters MUST forward every entry of `priorOutputs` into the prompt verbatim.
The reference implementation (`renderPrompt` in
[`SdkExecutionAdapter.ts`](./SdkExecutionAdapter.ts)) emits a `## Prior outputs`
section with one `### <key>` block per entry; downstream agents parse those
section headers to retrieve specific upstream outputs. A unit test in
[`tests/execution/SdkExecutionAdapter.test.ts`](../../tests/execution/SdkExecutionAdapter.test.ts)
asserts this contract — modify `renderPrompt` and the test must continue to
pass.

## Adapters

### `SdkExecutionAdapter`

Production adapter that drives `@anthropic-ai/claude-agent-sdk`. Defined in
[`SdkExecutionAdapter.ts`](./SdkExecutionAdapter.ts).

The SDK is loaded with a dynamic `import()` so this module compiles even in
environments where the SDK is not yet installed (the dynamic import only
runs when `execute()` is called). Tests inject a fake `loader` to avoid
touching the real package.

The adapter maps `StageExecutionRequest` → SDK options:

| Request field         | SDK option           | Note                                           |
| --------------------- | -------------------- | ---------------------------------------------- |
| `agentType`           | (prompt prefix)      | Identifies which `.claude/agents/*.md` to load |
| `workOrder`           | prompt body          |                                                |
| `priorOutputs`        | prompt context       | Verbatim, labeled by key                       |
| `skills`              | `options.skills`     |                                                |
| `mcpServers`          | `options.mcpServers` |                                                |
| `maxTurns`            | `options.maxTurns`   |                                                |
| `resume`              | `options.resume`     | Continue an earlier session                    |
| `signal`              | `options.signal`     | Forwarded to the SDK for cancellation          |
| `hooks` (constructor) | `options.hooks`      | Optional hook pipeline; see below              |

#### Example: production wiring

```typescript
import { SdkExecutionAdapter, buildHookPipeline } from '@/execution';

const adapter = new SdkExecutionAdapter({
  hooks: buildHookPipeline(artifactSink),
});

const result = await adapter.execute({
  agentType: 'worker',
  workOrder: 'Implement the login endpoint per the SRS.',
  priorOutputs: {
    srs: srsMarkdown,
    controllerPlan: controllerYaml,
  },
  skills: ['code-review'],
  maxTurns: 20,
});

if (result.status === 'success') {
  console.log(`session=${result.sessionId} artifacts=${result.artifacts.length}`);
}

await adapter.dispose();
```

### `MockExecutionAdapter`

Deterministic in-memory adapter for tests. Defined in
[`MockExecutionAdapter.ts`](./MockExecutionAdapter.ts). Two modes:

1. **Default success** — with no scripted handlers, every `execute` resolves
   to a canned successful result. Useful for "does the pipeline call the
   adapter at all" tests.
2. **Scripted** — pass a list of `MockExecutionHandler`s. Handlers are
   matched by predicate against the request, in registration order; the
   first match wins. Unmatched calls fall back to the default success.

Every call is recorded on `adapter.calls` so tests can assert against the
request payload — most importantly, that `priorOutputs` was forwarded as
documented above.

#### Example: scripted mock

```typescript
import { MockExecutionAdapter } from '@/execution';

const adapter = new MockExecutionAdapter({
  handlers: [
    {
      match: (req) => req.agentType === 'worker',
      respond: {
        status: 'success',
        artifacts: [{ path: 'src/login.ts', description: 'new endpoint' }],
        sessionId: 'mock-worker-1',
        toolCallCount: 3,
        tokenUsage: { input: 1200, output: 450, cache: 0 },
      },
    },
  ],
});

const result = await adapter.execute({
  agentType: 'worker',
  workOrder: 'Implement login',
  priorOutputs: { srs: 'SRS body' },
});

expect(result.artifacts).toHaveLength(1);
expect(adapter.calls).toHaveLength(1);
expect(adapter.calls[0].priorOutputs.srs).toBe('SRS body');
```

## Hook Pipeline

Hooks are how the execution layer observes what the agent does without the
stage code having to instrument every tool call. Defined in
[`hooks.ts`](./hooks.ts) and built via `buildHookPipeline(sink, options?)`.

### Current scope

| SDK event                     | Behaviour today                                                                                                   | Roadmap                              |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `PostToolUse` (`Edit\|Write`) | Captures `tool_input.file_path` into the supplied `ArtifactSink`; awaited so persistence failure aborts the stage | Stable                               |
| `PreToolUse`                  | Not registered (no-op)                                                                                            | Policy enforcement → AD-SDLC Phase 3 |
| `Stop`                        | Not registered (no-op)                                                                                            | Telemetry bridge → AD-SDLC Phase 3   |

The matcher list for `PreToolUse` and `Stop` is intentionally empty so the
SDK skips those hook events entirely; only the keys are reserved in the
type for downstream wiring discoverability.

### `ArtifactSink`

The hook needs only one method:

```typescript
export interface ArtifactSink {
  recordArtifact(entry: ArtifactCaptureEntry): void | Promise<void>;
}

export interface ArtifactCaptureEntry {
  readonly filePath: string;
  readonly toolName: 'Edit' | 'Write';
  readonly capturedAt: string; // ISO-8601 timestamp
  readonly sessionId?: string; // SDK session id when available
}
```

`recordArtifact` MUST be idempotent — the SDK may re-emit the same path
across retries. Production wiring adapts the real `Scratchpad`
([`src/scratchpad/`](../scratchpad/)) to this interface with a thin shim;
tests use an in-memory array.

### Failure semantics

Any hook callback that throws aborts the SDK stage. This module never
swallows errors — it surfaces them up so the `SdkExecutionAdapter` returns a
`failed` `StageExecutionResult`. Specifically, the hook throws `AppError`
with codes:

| Code       | Meaning                                                     |
| ---------- | ----------------------------------------------------------- |
| `EXEC-101` | `buildHookPipeline` called without a valid `recordArtifact` |
| `EXEC-102` | Matcher invoked for an unsupported tool name (defensive)    |
| `EXEC-103` | `tool_input.file_path` missing or empty                     |

#### Example: define and wire a hook

```typescript
import { SdkExecutionAdapter, buildHookPipeline, type ArtifactSink } from '@/execution';

const sink: ArtifactSink = {
  async recordArtifact(entry) {
    // persist into the scratchpad, telemetry, etc.
    console.log(`[capture] ${entry.toolName} ${entry.filePath}`);
  },
};

const adapter = new SdkExecutionAdapter({
  hooks: buildHookPipeline(sink, { now: () => new Date() }),
});
```

## Testing Strategy

The module is split into three test files, all under
[`tests/execution/`](../../tests/execution/):

| File                                                                                 | Scope                                                                                                                                                               |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`MockExecutionAdapter.test.ts`](../../tests/execution/MockExecutionAdapter.test.ts) | Mock semantics: default success, handler matching order, `calls[]` recording, `dispose` behaviour, abort handling                                                   |
| [`SdkExecutionAdapter.test.ts`](../../tests/execution/SdkExecutionAdapter.test.ts)   | `renderPrompt` contract (including the `priorOutputs` verbatim guarantee), SDK message reduction (`session_id`, `toolCallCount`, `tokenUsage`), error / abort paths |
| [`hooks.test.ts`](../../tests/execution/hooks.test.ts)                               | `buildHookPipeline` shape, `PostToolUse(Edit\|Write)` capture, error codes, end-to-end wiring through `SdkExecutionAdapter` with a fake SDK loader                  |

### Recommended pattern: stages use the mock

Stage tests should depend on `ExecutionAdapter` and inject
`MockExecutionAdapter`, not `SdkExecutionAdapter`. The mock gives:

- Deterministic results (no live SDK call, no network, no token cost).
- A `calls[]` array to assert the exact request the stage produced.
- The same `priorOutputs` contract the production adapter honours, so
  upstream wiring is exercised.

```typescript
import { MockExecutionAdapter } from '@/execution';
import { runWorkerStage } from '@/worker';

const adapter = new MockExecutionAdapter();
await runWorkerStage(adapter, workOrder);

expect(adapter.calls).toHaveLength(1);
expect(adapter.calls[0].agentType).toBe('worker');
expect(adapter.calls[0].priorOutputs.srs).toContain('# SRS');
```

### Unit vs integration

- **Unit** — exercise a single class (`buildHookPipeline`, `MockExecutionAdapter`).
  No real SDK loader, no real scratchpad. Fast (< 50 ms each).
- **Integration** — exercise `SdkExecutionAdapter` with a fake SDK loader
  that yields a scripted message stream, plus a real or fake `ArtifactSink`.
  See `hooks.test.ts` for the wiring template.
- **End-to-end with the real SDK** — out of scope here; lives with the
  pipeline-level e2e suite once a stage cuts over.

Run only the execution tests:

```bash
npm test -- tests/execution
```

## Extension Points

### Adding a new hook event

`buildHookPipeline` is the only entry point that should produce a
`HookPipeline`. To extend it:

1. Add the new entry type to `HookPipeline` in [`hooks.ts`](./hooks.ts) if
   the SDK exposes a new event family (otherwise reuse the existing keys).
2. Build a `SdkHookEntry` with a `matcher` regex string and an async
   `callback` that throws `AppError` on any failure path.
3. Register the entry under the matching event key in the returned object.
4. Add a focused test in `tests/execution/hooks.test.ts` that drives the
   callback directly (do not couple the test to the SDK's event loop).

The `PreToolUse` and `Stop` placeholders documented above are the canonical
expansion points — see the `TODO(AD-P3)` comments in `hooks.ts`.

### Adding a new adapter (e.g. `BedrockExecutionAdapter`)

Implement the `ExecutionAdapter` interface from [`types.ts`](./types.ts):

```typescript
import type { ExecutionAdapter, StageExecutionRequest, StageExecutionResult } from '@/execution';

export class BedrockExecutionAdapter implements ExecutionAdapter {
  async execute(req: StageExecutionRequest): Promise<StageExecutionResult> {
    // 1. Honour `req.signal?.aborted` up front.
    // 2. Render `priorOutputs` verbatim into whatever Bedrock's prompt shape requires.
    // 3. Forward `req.skills`, `req.mcpServers`, `req.maxTurns`, `req.resume`.
    // 4. Return a StageExecutionResult with the canonical status / token shape.
    throw new Error('not yet implemented');
  }

  async dispose(): Promise<void> {
    // Release any client / connection pool the adapter owns.
  }
}
```

Checklist when implementing a new adapter:

- [ ] Forwards every `priorOutputs` entry verbatim into the prompt
      (mirror the existing contract test).
- [ ] Returns the canonical `StageExecutionResult` shape, including a
      `tokenUsage` object even when the upstream API does not provide one
      (use zeros).
- [ ] Honours `req.signal?.aborted` both before issuing the call and on
      mid-call cancellation, returning `status: 'aborted'`.
- [ ] Maps any thrown error to `status: 'failed'` with a `SerializedError`
      payload — never let exceptions escape `execute()`.
- [ ] Is `dispose()`-safe: subsequent `execute()` calls throw rather than
      silently re-initialise.
- [ ] Add a contract test alongside `SdkExecutionAdapter.test.ts` that
      replays the same scenarios.

## What this module does NOT do (yet)

- Wiring stages to actually call the adapter — see issue #793.
- Telemetry bridge (`Stop` finalisation) — Phase 3.
- Bedrock / Vertex endpoint selection — Phase 4.

## Issue references

- AD-03 (`#789`): `@anthropic-ai/claude-agent-sdk` dependency add
- AD-06 (`#790` / PR #810): this module's adapters
- AD-07 (`#791` / PR #811): hook pipeline integration
- AD-08 (`#792`): this README
- AD-09 (`#793`): pilot stage cutover
