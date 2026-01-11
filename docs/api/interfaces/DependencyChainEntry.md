[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DependencyChainEntry

# Interface: DependencyChainEntry

Defined in: [src/impact-analyzer/types.ts:135](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L135)

Dependency chain entry

## Properties

### fromComponent

> `readonly` **fromComponent**: `string`

Defined in: [src/impact-analyzer/types.ts:137](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L137)

Source component in the chain

***

### toComponent

> `readonly` **toComponent**: `string`

Defined in: [src/impact-analyzer/types.ts:139](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L139)

Target component in the chain

***

### relationship

> `readonly` **relationship**: `string`

Defined in: [src/impact-analyzer/types.ts:141](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L141)

Relationship between components

***

### impactPropagation

> `readonly` **impactPropagation**: [`ImpactPropagation`](../type-aliases/ImpactPropagation.md)

Defined in: [src/impact-analyzer/types.ts:143](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L143)

How strongly the impact propagates
