[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / StageResult

# Interface: StageResult

Defined in: [src/analysis-orchestrator/types.ts:431](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L431)

Stage result for individual stage execution

## Properties

### stage

> `readonly` **stage**: [`PipelineStageName`](../type-aliases/PipelineStageName.md)

Defined in: [src/analysis-orchestrator/types.ts:433](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L433)

Stage name

***

### success

> `readonly` **success**: `boolean`

Defined in: [src/analysis-orchestrator/types.ts:435](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L435)

Whether stage succeeded

***

### outputPath

> `readonly` **outputPath**: `string` \| `null`

Defined in: [src/analysis-orchestrator/types.ts:437](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L437)

Output file path if successful

***

### error

> `readonly` **error**: `string` \| `null`

Defined in: [src/analysis-orchestrator/types.ts:439](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L439)

Error message if failed

***

### durationMs

> `readonly` **durationMs**: `number`

Defined in: [src/analysis-orchestrator/types.ts:441](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L441)

Duration in milliseconds

***

### retryCount

> `readonly` **retryCount**: `number`

Defined in: [src/analysis-orchestrator/types.ts:443](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L443)

Retry count
