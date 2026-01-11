[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / Recommendation

# Interface: Recommendation

Defined in: [src/impact-analyzer/types.ts:191](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L191)

Recommendation for the change

## Properties

### type

> `readonly` **type**: [`RecommendationType`](../type-aliases/RecommendationType.md)

Defined in: [src/impact-analyzer/types.ts:193](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L193)

Type of recommendation

***

### priority

> `readonly` **priority**: `number`

Defined in: [src/impact-analyzer/types.ts:195](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L195)

Priority (1-5, 1 being highest)

***

### message

> `readonly` **message**: `string`

Defined in: [src/impact-analyzer/types.ts:197](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L197)

Recommendation message

***

### action

> `readonly` **action**: `string`

Defined in: [src/impact-analyzer/types.ts:199](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L199)

Suggested action
