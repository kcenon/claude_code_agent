[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ChangeScope

# Interface: ChangeScope

Defined in: [src/impact-analyzer/types.ts:77](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L77)

Change scope information

## Properties

### type

> `readonly` **type**: [`ChangeType`](../type-aliases/ChangeType.md)

Defined in: [src/impact-analyzer/types.ts:79](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L79)

Type of change being analyzed

***

### estimatedSize

> `readonly` **estimatedSize**: [`ChangeSize`](../type-aliases/ChangeSize.md)

Defined in: [src/impact-analyzer/types.ts:81](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L81)

Estimated size of the change

***

### confidence

> `readonly` **confidence**: `number`

Defined in: [src/impact-analyzer/types.ts:83](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L83)

Confidence in the classification (0.0 - 1.0)
