[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / PipelineStage

# Interface: PipelineStage

Defined in: [src/analysis-orchestrator/types.ts:45](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L45)

Pipeline stage configuration

## Properties

### name

> `readonly` **name**: [`PipelineStageName`](../type-aliases/PipelineStageName.md)

Defined in: [src/analysis-orchestrator/types.ts:47](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L47)

Stage name identifier

***

### status

> `readonly` **status**: [`PipelineStageStatus`](../type-aliases/PipelineStageStatus.md)

Defined in: [src/analysis-orchestrator/types.ts:49](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L49)

Current stage status

***

### startedAt

> `readonly` **startedAt**: `string` \| `null`

Defined in: [src/analysis-orchestrator/types.ts:51](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L51)

Stage start timestamp

***

### completedAt

> `readonly` **completedAt**: `string` \| `null`

Defined in: [src/analysis-orchestrator/types.ts:53](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L53)

Stage completion timestamp

***

### outputPath

> `readonly` **outputPath**: `string` \| `null`

Defined in: [src/analysis-orchestrator/types.ts:55](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L55)

Output file path if completed

***

### error

> `readonly` **error**: `string` \| `null`

Defined in: [src/analysis-orchestrator/types.ts:57](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L57)

Error message if failed

***

### retryCount

> `readonly` **retryCount**: `number`

Defined in: [src/analysis-orchestrator/types.ts:59](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L59)

Retry count for this stage
