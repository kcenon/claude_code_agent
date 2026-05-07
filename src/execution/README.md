# Execution Layer

Single Claude Agent SDK entrypoint for the AD-SDLC pipeline. Per
[ARCH-RFC-001 §4.1](../../docs/architecture/v0.1-hybrid-pipeline-rfc.md#41-executionadapter),
every stage that needs to call out to an agent goes through one of the
`ExecutionAdapter` implementations exposed here.

## Why a single funnel

| Concern | What the funnel buys |
|---|---|
| Testability | Mock once, every stage benefits |
| Hooks | `PreToolUse` / `PostToolUse` policy lives in the adapter, not in 35 places |
| Telemetry | One span emitter; consistent attributes across stages |
| Endpoint switching | Anthropic / Bedrock / Vertex selection happens behind one interface |
| Hot-reload | Rotate keys / models without touching pipeline code |

## Public surface

```typescript
import {
  type ExecutionAdapter,
  type StageExecutionRequest,
  type StageExecutionResult,
  MockExecutionAdapter,
  SdkExecutionAdapter,
} from '@/execution';
```

## Two implementations

### `SdkExecutionAdapter`

Wraps `@anthropic-ai/claude-agent-sdk`'s `query()` async iterable. The SDK is
loaded with a dynamic `import()` so this module compiles even in environments
where the SDK is not yet installed (the dynamic import only runs when
`execute()` is called). Tests inject a fake `loader` to avoid touching the
real package.

| Request field | SDK option | Note |
|---|---|---|
| `agentType` | (prompt prefix) | Identifies which `.claude/agents/*.md` to load |
| `workOrder` | prompt body | |
| `priorOutputs` | prompt context | Verbatim, labeled by key |
| `skills` | `options.skills` | |
| `mcpServers` | `options.mcpServers` | |
| `maxTurns` | `options.maxTurns` | |
| `resume` | `options.resume` | Continue an earlier session |
| `signal` | `options.signal` | |

### `MockExecutionAdapter`

Deterministic in-memory adapter for tests. Records every call on
`adapter.calls` and returns either a default success result or a scripted
response chosen by predicate.

```typescript
const adapter = new MockExecutionAdapter({
  handlers: [
    {
      match: (req) => req.agentType === 'worker',
      respond: { status: 'success', artifacts: [...], sessionId: 'fake', toolCallCount: 1, tokenUsage: { input: 10, output: 20, cache: 0 } },
    },
  ],
});

const result = await adapter.execute({ agentType: 'worker', workOrder: 'do thing', priorOutputs: {} });
expect(adapter.calls).toHaveLength(1);
```

## Contract: `priorOutputs` must reach the prompt

Adapters MUST forward every entry of `priorOutputs` into the prompt verbatim.
The reference implementation (`renderPrompt`) emits a `## Prior outputs`
section with one `### <key>` block per entry. Stage code relies on these
section headers when it needs to extract a specific upstream output.

A unit test in `tests/execution/SdkExecutionAdapter.test.ts` asserts this
contract — modify `renderPrompt` and the test must continue to pass.

## What this module does NOT do (yet)

- Wiring stages to actually call the adapter — see AD-09.
- Hook pipeline integration — see AD-07.
- Telemetry bridge — Phase 3.
- Bedrock / Vertex endpoint selection — Phase 4.

## Issue references

- AD-03 (`#789`): `@anthropic-ai/claude-agent-sdk` dependency add
- AD-06 (`#790`): this module
- AD-07 (`#791`): hook pipeline integration
- AD-08 (`#792`): telemetry bridge integration
- AD-09 (`#793`): pilot stage cutover
