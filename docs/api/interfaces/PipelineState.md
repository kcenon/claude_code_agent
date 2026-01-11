[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / PipelineState

# Interface: PipelineState

Defined in: [src/analysis-orchestrator/types.ts:81](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L81)

Pipeline state for tracking progress

## Properties

### analysisId

> `readonly` **analysisId**: `string`

Defined in: [src/analysis-orchestrator/types.ts:83](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L83)

Unique analysis identifier

***

### projectId

> `readonly` **projectId**: `string`

Defined in: [src/analysis-orchestrator/types.ts:85](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L85)

Project identifier

***

### projectPath

> `readonly` **projectPath**: `string`

Defined in: [src/analysis-orchestrator/types.ts:87](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L87)

Project root path

***

### startedAt

> `readonly` **startedAt**: `string`

Defined in: [src/analysis-orchestrator/types.ts:89](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L89)

Pipeline start timestamp

***

### updatedAt

> `readonly` **updatedAt**: `string`

Defined in: [src/analysis-orchestrator/types.ts:91](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L91)

Last update timestamp

***

### overallStatus

> `readonly` **overallStatus**: [`PipelineStatus`](../type-aliases/PipelineStatus.md)

Defined in: [src/analysis-orchestrator/types.ts:93](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L93)

Overall pipeline status

***

### scope

> `readonly` **scope**: [`AnalysisScope`](../type-aliases/AnalysisScope.md)

Defined in: [src/analysis-orchestrator/types.ts:95](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L95)

Analysis scope

***

### generateIssues

> `readonly` **generateIssues**: `boolean`

Defined in: [src/analysis-orchestrator/types.ts:97](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L97)

Whether to generate issues

***

### stages

> `readonly` **stages**: readonly [`PipelineStage`](PipelineStage.md)[]

Defined in: [src/analysis-orchestrator/types.ts:99](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L99)

Individual stage statuses

***

### statistics

> `readonly` **statistics**: [`PipelineStatistics`](PipelineStatistics.md)

Defined in: [src/analysis-orchestrator/types.ts:101](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L101)

Execution statistics

***

### warnings

> `readonly` **warnings**: readonly `string`[]

Defined in: [src/analysis-orchestrator/types.ts:103](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L103)

Warnings during execution

***

### errors

> `readonly` **errors**: readonly `string`[]

Defined in: [src/analysis-orchestrator/types.ts:105](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L105)

Errors during execution
