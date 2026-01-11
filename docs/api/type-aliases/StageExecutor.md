[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / StageExecutor

# Type Alias: StageExecutor()

> **StageExecutor** = (`projectPath`, `projectId`, `inputPaths`) => `Promise`\<[`StageResult`](../interfaces/StageResult.md)\>

Defined in: [src/analysis-orchestrator/types.ts:449](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L449)

Stage executor function type

## Parameters

### projectPath

`string`

### projectId

`string`

### inputPaths

`Record`\<`string`, `string`\>

## Returns

`Promise`\<[`StageResult`](../interfaces/StageResult.md)\>
