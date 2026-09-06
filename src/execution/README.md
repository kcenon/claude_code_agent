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

| Field          | Required | Purpose                                                                           |
| -------------- | -------- | --------------------------------------------------------------------------------- |
| `projectDir`   | yes      | Absolute target project directory; normalized at session/configuration boundaries |
| `agentType`    | yes      | Identifies which `.claude/agents/*.md` to load (e.g. `'worker'`)                  |
| `workOrder`    | yes      | Prompt body — the actual instruction the stage emits                              |
| `priorOutputs` | yes      | Verbatim outputs from upstream stages, keyed by stage name                        |
| `skills`       | no       | SDK skill names to enable for this call                                           |
| `mcpServers`   | no       | MCP server config map forwarded to the SDK                                        |
| `maxTurns`     | no       | Cap on agent turns; SDK aborts past this                                          |
| `resume`       | no       | SDK session id to continue                                                        |
| `signal`       | no       | `AbortSignal` for cancellation                                                    |

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

The SDK runtime loads lazily through a literal, typed dynamic `import()`.
Production options use the installed SDK's `Options` and `AgentDefinition`;
query input is derived from `Parameters<typeof query>[0]` and messages use
`SDKMessage`. The package must be installed for TypeScript checks. Offline
tests inject `query()` returning `AsyncIterable<SDKMessage> &
Pick<Query, 'close' | 'return'>`. The lifecycle methods use the official `Query`
method types; doubles need not implement unrelated streaming control APIs.

Before loading or calling the SDK, the adapter validates `agentType` and reads
`<projectDir>/.claude/agents/<agentType>.md`. The resolver reuses AD-SDLC's
frontmatter parser and required metadata schema, without ambient `agents.yaml`
discovery. It requires a matching name, valid description/tools/model, and a
nonempty Markdown prompt. Supported SDK metadata such as skills, disallowed
tools, MCP servers, permissions, memory, and effort is preserved. The installed
project definition is authoritative, including user edits; packaged checksums
are not enforced and definitions are not cached.

`projectDir` must be absolute and identify a directory at the adapter boundary.
Relative roots are resolved once when configuring a worker or starting a session.
Resumed sessions use the explicitly selected project, including when persisted
state contains an old root. Worker pools require `WorkerPoolConfig.projectRoot`
for SDK execution. Collector SDK callers require `CollectorAgentConfig.projectDir`
(or an explicit project directory when constructing `LLMExtractor` or
`InvestigationEngine`). No execution changes `process.cwd()`.

Every query explicitly sets `cwd`, `agent`, and `agents[agentType]`, as well as
`settingSources: ['user', 'project', 'local']`. Project support agents and skills
remain discoverable and user/local plugin settings remain enabled. The required
main agent is always validated in the target project. Local mode uses the same
path for `local-reviewer` and `local-issue-reader`. The `# Stage: ...` prompt
heading provides context; SDK options select the persona.

Missing, unreadable, malformed, empty, or incorrectly named definitions produce
a failed `StageExecutionResult` with the agent name, attempted path, and useful
validation or I/O details, before `query()` is called. Invalid agent names and
project roots are rejected before constructing an unsafe definition path.

The adapter maps `StageExecutionRequest` → SDK options:

| Request field         | SDK option                        | Note                                                 |
| --------------------- | --------------------------------- | ---------------------------------------------------- |
| `projectDir`          | `options.cwd`                     | Absolute target project root                         |
| `agentType`           | `options.agent`, `options.agents` | Explicit main-thread persona from the target project |
| `workOrder`           | prompt body                       |                                                      |
| `priorOutputs`        | prompt context                    | Verbatim, labeled by key                             |
| `skills`              | `options.skills`                  |                                                      |
| `mcpServers`          | `options.mcpServers`              |                                                      |
| `maxTurns`            | `options.maxTurns`                |                                                      |
| `resume`              | `options.resume`                  | Continue an earlier session                          |
| `signal`              | `options.abortController`         | Per-execution bridge, preserving the abort reason    |
| `hooks` (constructor) | `options.hooks`                   | Optional hook pipeline; see below                    |

Readonly request skills and MCP stdio arguments are copied into mutable SDK
arrays; other server settings are retained. Optional request fields are omitted
when unprovided. Every execution receives a distinct owned `abortController`,
including requests without a caller signal. A caller's abort reason (Error or
non-Error) is forwarded unchanged; the adapter never aborts the caller's
controller or another execution's controller.

#### Completion and disposal

Executions enter the active registry before agent resolution or SDK loading.
Pre-aborted requests skip both. Cancellation and disposal are rechecked after
each awaited setup step and before `query()`, so deferred setup cannot start a
late query. Setup rejection remains observed even if cancellation has already
returned a cleanup failure.

For success, ordinary SDK failure, cancellation, timeout, and disposal, completion
means **both the original Query lifecycle and message consumption have settled**,
or the result explicitly reports `EXEC-004` cleanup failure. Cancellation aborts
the owned controller promptly. Finalization initiates `query.close()` and awaits
`query.return(undefined)` plus consumption. The same finalization is shared by
execution and disposal. An SDK failure remains `failed` even when teardown aborts
its controller; caller/pipeline cancellation and disposal are `aborted`. Cleanup
failure adds a fatal diagnostic to those outcomes; it is never successful
cancellation and must not be interpreted as proof that the query stopped.

SDK 0.3.258's `close(): void` initiates shutdown. Its outer Query's asynchronous
`return(undefined)` awaits cleanup. `query[Symbol.asyncIterator]()` returns a
separate inner generator, so finishing/returning that iterator alone is
insufficient. `interrupt()` is a streaming control request, not whole-query
finalization. The adapter uses no private transport state or invented public
process-wait API.

`dispose()` stops admission synchronously, aborts **all** owned executions,
including those without caller signals or still in setup, and joins their cleanup
boundaries. Concurrent/repeated calls share the same promise and outcome. A
failure in one execution does not skip cleanup of siblings. Failures are aggregated
in a fatal `ExecutionCleanupError`. After successful disposal, no adapter-owned
forwarding listeners, timers, active queries, or pending setups remain. Subsequent
`execute()` rejects with `EXEC-002`.

#### Cleanup grace and failure policy

`SdkExecutionAdapterOptions.cleanupGraceMs` is a positive finite value, defaulting
to **5,000 ms**, independent of the stage execution budget. SDK 0.3.258 bounds its
internal process-exit wait at 2,000 ms; the default allows another 3,000 ms for
other cleanup and message-consumption settlement. The `resolveAgent` and `loader`
options allow deferred setup tests without a live SDK call.

If close/return throws or setup/cleanup/consumption fails to settle within that
grace, the adapter reports `EXEC-004`, category `fatal`, with the original reason
as cause and cleanup details in context. `context.unresolved` identifies pending
operations at the observation boundary; a settled but rejected cleanup still does
not establish successful shutdown. Any observed cleanup failure blocks further
execution through that adapter. An unresolved execution stays registered until
its actual settlement; late fulfillment/rejection remains observed. Forwarding
listeners and grace timers are removed at the bounded completion boundary, but
unresolved SDK work is never silently erased. Even if that work later settles,
the failed adapter remains disabled and repeated disposal retains its failure.

The production scheduler retains every invocation. On timeout it preserves the
`StageTimeoutError` and controller abort reason, then waits for invocation cleanup
before surfacing the timeout. Pipeline cancellation follows the same ordering and
cannot turn a late SDK success into a completed stage. Its fallback budget is the
current adapter's `cleanupGraceMs` **plus 1,000 ms** (6,000 ms by default), allowing
adapter diagnostics to reach the scheduler before a fallback error can mask them.
An invocation that ignores cancellation produces the same fatal cleanup code with
`context.phase: 'scheduler'`; adapter diagnostics use `'adapter'`.

Fatal cleanup errors explicitly map to RetryExecutor's `non-retryable` category
(the error contracts use different category vocabularies). They stop queued DAG
work and never launch a replacement on the affected adapter. Normal retryable
failures finish cleanup before the existing exponential backoff and next attempt.
The stage deadline still covers all attempts and backoff; a timeout normally
exhausts that total budget. Cancellation is checked before attempts/backoff, during
backoff, and immediately before invocation after any delay. Production backoff
cancellation clears its timer.

The orchestrator retains its adapter while disposal is pending and blocks late
stage invocations from creating a replacement. A new session can reset that
barrier only after successful prior pipeline disposal. Public orchestrator
disposal also joins concurrent callers. Stage `errorDetails` preserves serialized
code, category, context, cause and partial usage through `AppError.fromJSON`;
first-attempt fatal failures retain meaningful diagnostics and zero retries.
Disposal failures are logged at ERROR and exposed on the primary thrown pipeline
error's `cleanupErrors`; without a primary error, disposal failure rejects the
pipeline itself.

These boundaries are **SDK-observable cleanup**, not independent confirmation that
every operating-system process exited. The SDK's own process-exit wait is bounded.
Process-level confirmation belongs to the later live acceptance lane; the offline
regressions do not establish lingering or terminated live SDK processes.

#### Partial usage and outcomes

All results retain the latest observed session ID (or requested resume ID), turn
count, and available usage. Before a result message, assistant `message.usage` is
accumulated once per distinct assistant message ID, using its latest observation.
Repeated IDs replace that contribution and add no turns or duplicate usage. Aggregate result usage, including SDK error
results, is authoritative and replaces the assistant fallback; it is never added
to that same usage again. The turn count retains the maximum of observed assistant
turns and result `num_turns`. `TokenUsage.cache` includes cache-read **plus**
cache-creation input tokens. With no observed usage, counters remain zero.

Thrown SDK failures and aborted executions retain these partial observations.
They are available data, not comprehensive billing metrics. Successful artifact
extraction is unchanged; artifact manifests and expanded metrics remain separate
work.

#### Example: production wiring

```typescript
import { SdkExecutionAdapter, buildHookPipeline } from '@/execution';

const adapter = new SdkExecutionAdapter({
  hooks: buildHookPipeline(artifactSink),
});

const result = await adapter.execute({
  projectDir: '/absolute/path/to/project',
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
  projectDir: '/absolute/path/to/project',
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

Offline execution tests live under
[`tests/execution/`](../../tests/execution/):

| File                                                                                 | Scope                                                                                                                                                               |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`MockExecutionAdapter.test.ts`](../../tests/execution/MockExecutionAdapter.test.ts) | Mock semantics: default success, handler matching order, `calls[]` recording, `dispose` behaviour, abort handling                                                   |
| [`SdkExecutionAdapter.test.ts`](../../tests/execution/SdkExecutionAdapter.test.ts)   | `renderPrompt` contract (including the `priorOutputs` verbatim guarantee), SDK message reduction (`session_id`, `toolCallCount`, `tokenUsage`), error / abort paths |
| [`hooks.test.ts`](../../tests/execution/hooks.test.ts)                               | `buildHookPipeline` shape, `PostToolUse(Edit\|Write)` capture, error codes, end-to-end wiring through `SdkExecutionAdapter` with a fake SDK loader                  |

The project-isolation test launches a separate Node process with cwd set to
project A, then targets project B with conflicting same-named definitions. A
query double writes sentinel files relative to the captured `options.cwd`.
It also checks validation failures and overlapping A/B requests without mocking
the resolver. `projectContext.test.ts` exercises the real orchestrator local-mode
substitutions and resumed requests through the SDK adapter.

`SdkExecutionAdapter.lifecycle.test.ts` uses a controlled asynchronous Query with
an official owned controller, separate inner iterator, synchronous close initiation,
deferred outer cleanup, and a sentinel artifact writer. Fake timers cover cleanup
timeouts and late rejections. Production integration coverage lives in
[`sdkLifecycle.test.ts`](../../tests/ad-sdlc-orchestrator/sdkLifecycle.test.ts), so
it runs in the focused orchestrator lane (no separate integration configuration
is needed). It verifies timeout cleanup, early-failure retry ordering, exhausted
budgets, cancellation during backoff, fatal first-attempt diagnostics, queued DAG
work, and concurrent orchestrator disposal.

```bash
npm run test:sdk-contract
npx vitest run tests/execution tests/ad-sdlc-orchestrator
npm run build
npm run lint
npm run docs:check
```

These tests verify the SDK boundary contract. They do not verify live model
persona behavior; live Import acceptance is a separate scenario.

`npm run build` type-checks production SDK input. `npm run test:sdk-contract`
invokes `tsc -p tsconfig.sdk-contract.json` to additionally check execution
fixtures and doubles against official SDK types; Vitest transpilation alone
does not establish compatibility.

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
2. Build a `SdkHookEntry` with a `matcher` regex string and `hooks: [callback]`.
   Official callbacks receive `(input, toolUseID, { signal })` and return
   `Promise<HookJSONOutput>`. Artifact capture awaits the sink and returns `{}`;
   sink failures propagate to the adapter.
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

- [ ] Resolves the required target-project agent and explicitly sets agent selection
      and cwd without changing the process directory.
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

- Telemetry bridge (`Stop` finalisation) — Phase 3.
- Bedrock / Vertex endpoint selection — Phase 4.

## Issue references

- AD-03 (`#789`): `@anthropic-ai/claude-agent-sdk` dependency add
- AD-06 (`#790` / PR #810): this module's adapters
- AD-07 (`#791` / PR #811): hook pipeline integration
- AD-08 (`#792`): this README
- AD-09 (`#793`): pilot stage cutover
- #948: owned execution lifecycle, bounded cleanup, disposal and retry barriers
