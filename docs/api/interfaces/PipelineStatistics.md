[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / PipelineStatistics

# Interface: PipelineStatistics

Defined in: [src/analysis-orchestrator/types.ts:65](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L65)

Pipeline execution statistics

## Properties

### totalStages

> `readonly` **totalStages**: `number`

Defined in: [src/analysis-orchestrator/types.ts:67](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L67)

Total number of stages

***

### completedStages

> `readonly` **completedStages**: `number`

Defined in: [src/analysis-orchestrator/types.ts:69](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L69)

Number of completed stages

***

### failedStages

> `readonly` **failedStages**: `number`

Defined in: [src/analysis-orchestrator/types.ts:71](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L71)

Number of failed stages

***

### skippedStages

> `readonly` **skippedStages**: `number`

Defined in: [src/analysis-orchestrator/types.ts:73](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L73)

Number of skipped stages

***

### totalDurationMs

> `readonly` **totalDurationMs**: `number`

Defined in: [src/analysis-orchestrator/types.ts:75](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L75)

Total execution duration in milliseconds
