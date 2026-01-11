[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / AffectedComponent

# Interface: AffectedComponent

Defined in: [src/impact-analyzer/types.ts:89](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L89)

Affected component information

## Properties

### componentId

> `readonly` **componentId**: `string`

Defined in: [src/impact-analyzer/types.ts:91](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L91)

Component identifier from SDS

***

### componentName

> `readonly` **componentName**: `string`

Defined in: [src/impact-analyzer/types.ts:93](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L93)

Human-readable component name

***

### type

> `readonly` **type**: [`ImpactType`](../type-aliases/ImpactType.md)

Defined in: [src/impact-analyzer/types.ts:95](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L95)

Whether impact is direct or indirect

***

### impactLevel

> `readonly` **impactLevel**: [`ImpactLevel`](../type-aliases/ImpactLevel.md)

Defined in: [src/impact-analyzer/types.ts:97](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L97)

Level of impact

***

### reason

> `readonly` **reason**: `string`

Defined in: [src/impact-analyzer/types.ts:99](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L99)

Reason for the impact

***

### source

> `readonly` **source**: [`ComponentSource`](../type-aliases/ComponentSource.md)

Defined in: [src/impact-analyzer/types.ts:101](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L101)

Source of the impact (code, documentation, or both)
