[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ResumeOptions

# Interface: ResumeOptions

Defined in: [src/analysis-orchestrator/types.ts:458](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L458)

Resume options for continuing a failed analysis

## Properties

### analysisId

> `readonly` **analysisId**: `string`

Defined in: [src/analysis-orchestrator/types.ts:460](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L460)

Analysis ID to resume

***

### skipFailed?

> `readonly` `optional` **skipFailed**: `boolean`

Defined in: [src/analysis-orchestrator/types.ts:462](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L462)

Whether to skip failed stages

***

### retryFailed?

> `readonly` `optional` **retryFailed**: `boolean`

Defined in: [src/analysis-orchestrator/types.ts:464](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L464)

Whether to retry failed stages
