[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / AnalysisSession

# Interface: AnalysisSession

Defined in: [src/analysis-orchestrator/types.ts:388](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L388)

Analysis session for tracking active analysis

## Properties

### sessionId

> `readonly` **sessionId**: `string`

Defined in: [src/analysis-orchestrator/types.ts:390](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L390)

Unique session identifier

***

### analysisId

> `readonly` **analysisId**: `string`

Defined in: [src/analysis-orchestrator/types.ts:392](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L392)

Analysis identifier

***

### pipelineState

> `readonly` **pipelineState**: [`PipelineState`](PipelineState.md)

Defined in: [src/analysis-orchestrator/types.ts:394](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L394)

Current pipeline state

***

### startedAt

> `readonly` **startedAt**: `string`

Defined in: [src/analysis-orchestrator/types.ts:396](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L396)

Session start timestamp

***

### updatedAt

> `readonly` **updatedAt**: `string`

Defined in: [src/analysis-orchestrator/types.ts:398](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L398)

Last update timestamp
