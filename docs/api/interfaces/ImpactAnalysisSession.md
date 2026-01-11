[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ImpactAnalysisSession

# Interface: ImpactAnalysisSession

Defined in: [src/impact-analyzer/types.ts:375](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L375)

Impact analysis session

## Properties

### sessionId

> `readonly` **sessionId**: `string`

Defined in: [src/impact-analyzer/types.ts:377](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L377)

Session identifier

***

### projectId

> `readonly` **projectId**: `string`

Defined in: [src/impact-analyzer/types.ts:379](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L379)

Project identifier

***

### status

> `readonly` **status**: [`ImpactAnalysisSessionStatus`](../type-aliases/ImpactAnalysisSessionStatus.md)

Defined in: [src/impact-analyzer/types.ts:381](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L381)

Session status

***

### changeRequest

> `readonly` **changeRequest**: [`ChangeRequest`](ChangeRequest.md) \| `null`

Defined in: [src/impact-analyzer/types.ts:383](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L383)

Change request being analyzed

***

### impactAnalysis

> `readonly` **impactAnalysis**: [`ImpactAnalysis`](ImpactAnalysis.md) \| `null`

Defined in: [src/impact-analyzer/types.ts:385](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L385)

Impact analysis result

***

### startedAt

> `readonly` **startedAt**: `string`

Defined in: [src/impact-analyzer/types.ts:387](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L387)

Session start time

***

### updatedAt

> `readonly` **updatedAt**: `string`

Defined in: [src/impact-analyzer/types.ts:389](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L389)

Session last update time

***

### warnings

> `readonly` **warnings**: readonly `string`[]

Defined in: [src/impact-analyzer/types.ts:391](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L391)

Warnings during analysis

***

### errors

> `readonly` **errors**: readonly `string`[]

Defined in: [src/impact-analyzer/types.ts:393](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L393)

Errors during analysis
