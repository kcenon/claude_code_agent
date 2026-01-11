[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / AnalysisInput

# Interface: AnalysisInput

Defined in: [src/analysis-orchestrator/types.ts:374](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L374)

Analysis input options

## Properties

### projectPath

> `readonly` **projectPath**: `string`

Defined in: [src/analysis-orchestrator/types.ts:376](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L376)

Path to project root

***

### projectId?

> `readonly` `optional` **projectId**: `string`

Defined in: [src/analysis-orchestrator/types.ts:378](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L378)

Custom project ID (auto-generated if not provided)

***

### scope?

> `readonly` `optional` **scope**: [`AnalysisScope`](../type-aliases/AnalysisScope.md)

Defined in: [src/analysis-orchestrator/types.ts:380](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L380)

Analysis scope

***

### generateIssues?

> `readonly` `optional` **generateIssues**: `boolean`

Defined in: [src/analysis-orchestrator/types.ts:382](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L382)

Whether to generate GitHub issues from gaps
