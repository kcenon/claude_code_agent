[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / AnalysisOrchestratorConfig

# Interface: AnalysisOrchestratorConfig

Defined in: [src/analysis-orchestrator/types.ts:302](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L302)

Analysis orchestrator configuration

## Properties

### scratchpadBasePath?

> `readonly` `optional` **scratchpadBasePath**: `string`

Defined in: [src/analysis-orchestrator/types.ts:304](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L304)

Base path for scratchpad (defaults to .ad-sdlc/scratchpad)

***

### parallelExecution?

> `readonly` `optional` **parallelExecution**: `boolean`

Defined in: [src/analysis-orchestrator/types.ts:306](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L306)

Whether to run document and code readers in parallel

***

### continueOnError?

> `readonly` `optional` **continueOnError**: `boolean`

Defined in: [src/analysis-orchestrator/types.ts:308](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L308)

Whether to continue on stage failure

***

### maxRetries?

> `readonly` `optional` **maxRetries**: `number`

Defined in: [src/analysis-orchestrator/types.ts:310](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L310)

Maximum retry attempts per stage

***

### retryDelayMs?

> `readonly` `optional` **retryDelayMs**: `number`

Defined in: [src/analysis-orchestrator/types.ts:312](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L312)

Retry delay in milliseconds

***

### stageTimeoutMs?

> `readonly` `optional` **stageTimeoutMs**: `number`

Defined in: [src/analysis-orchestrator/types.ts:314](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L314)

Default timeout per stage in milliseconds

***

### stageTimeouts?

> `readonly` `optional` **stageTimeouts**: `StageTimeoutConfig`

Defined in: [src/analysis-orchestrator/types.ts:316](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L316)

Per-stage timeout overrides

***

### circuitBreaker?

> `readonly` `optional` **circuitBreaker**: `CircuitBreakerConfig`

Defined in: [src/analysis-orchestrator/types.ts:318](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L318)

Circuit breaker configuration

***

### parallelExecutionConfig?

> `readonly` `optional` **parallelExecutionConfig**: `ParallelExecutionConfig`

Defined in: [src/analysis-orchestrator/types.ts:320](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L320)

Parallel execution configuration

***

### outputFormat?

> `readonly` `optional` **outputFormat**: [`OutputFormat`](../type-aliases/OutputFormat.md)

Defined in: [src/analysis-orchestrator/types.ts:322](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/analysis-orchestrator/types.ts#L322)

Output format for reports
