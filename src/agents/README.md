# Agents public module

`src/agents/index.ts` is the aggregation barrel for agent implementations and
shared lifecycle types. It does not create or register agents. Since the v0.1
cutover, pipeline execution is owned by `ExecutionAdapter`, and concrete agent
modules are instantiated directly or through their module-local singleton
helpers.

## Public imports

The package root re-exports this module:

```typescript
import {
  CollectorAgent,
  getCollectorAgent,
  resetCollectorAgent,
  isAgent,
  type IAgent,
} from 'ad-sdlc';

const collector = getCollectorAgent();
await collector.initialize();

if (isAgent(collector)) {
  await collector.dispose();
}

resetCollectorAgent();
```

Use direct exports for symbols with unique names. Modules that have overlapping
type names are also exposed through namespaces such as `IssueGen`, `CodeReader`,
`Worker`, `CIFixer`, and `Controller`.

```typescript
import { IssueGen, Worker } from 'ad-sdlc';

function connect(issue: IssueGen.GeneratedIssue, order: Worker.WorkOrder): string {
  return `${issue.title}: ${order.issueId}`;
}
```

## Lifecycle contract

`IAgent` provides the common identification and cleanup contract used by
concrete modules. It is not a registration requirement for the SDK: the SDK
executes the declarative agent definition named by a pipeline stage.

```typescript
import type { IAgent } from 'ad-sdlc';

class CustomAgent implements IAgent {
  public readonly agentId = 'custom-agent';
  public readonly name = 'Custom Agent';

  public async initialize(): Promise<void> {
    await Promise.resolve();
  }

  public async dispose(): Promise<void> {
    await Promise.resolve();
  }
}
```

Concrete modules generally expose all three of the following when singleton
convenience is appropriate:

- the class constructor, for explicit dependency injection;
- a `get*Agent()` accessor, for the module-local shared instance;
- a `reset*Agent()` helper, primarily for deterministic test cleanup.

There is no global registry or dependency container. Pass dependencies through
constructors/config objects and reset only the module whose shared instance was
used.

## Pipeline execution

Application callers normally enter through the orchestrator. Every AI-backed
stage is converted to a `StageExecutionRequest` and sent through the configured
`ExecutionAdapter`.

```typescript
import { AdsdlcOrchestratorAgent } from 'ad-sdlc';

const orchestrator = new AdsdlcOrchestratorAgent();
const result = await orchestrator.executePipeline(
  process.cwd(),
  'Add account recovery with expiring one-time links'
);

await orchestrator.dispose();
console.log(result.overallStatus);
```

Tests can inject the mock adapter at the execution boundary or construct a
concrete deterministic module directly. Avoid reintroducing an alternate SDK
dispatch path.

## Definition inventory

Prompt definitions and runtime stages are not one-to-one. The checked-in
Markdown definitions include direct pipeline agents, orchestrators, local-mode
aliases, and delegated support agents. Current source-derived counts are kept in
[`docs/architecture/runtime-inventory.md`](../../docs/architecture/runtime-inventory.md)
and verified by `npm run docs:check-inventory`.

## Adding an agent

1. Add a deterministic TypeScript module only if the agent needs domain code.
2. Export its public surface from the appropriate barrel and, when intended,
   from `src/agents/index.ts`.
3. Add `.claude/agents/<agent-type>.md` when the SDK needs a new declarative
   role.
4. Add a `PipelineStageDefinition` only when the role is a direct stage rather
   than a delegated helper.
5. Add unit tests for deterministic code and adapter/orchestrator tests for
   execution behavior.
6. Run `npm run docs:check`, `npm run build`, and the relevant test suite.

## Related documentation

- [Execution and agent definition layers](../../docs/architecture/dual-layer-design.md)
- [Runtime inventory](../../docs/architecture/runtime-inventory.md)
- [Headless execution](../../docs/headless-execution.md)
- [Configuration reference](../../docs/config.md)
