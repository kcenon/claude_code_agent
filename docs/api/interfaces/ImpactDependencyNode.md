[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ImpactDependencyNode

# Interface: ImpactDependencyNode

Defined in: [src/impact-analyzer/types.ts:319](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L319)

Dependency graph node (from Codebase Analyzer)

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/impact-analyzer/types.ts:320](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L320)

***

### type

> `readonly` **type**: `"external"` \| `"internal"`

Defined in: [src/impact-analyzer/types.ts:321](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L321)

***

### path?

> `readonly` `optional` **path**: `string`

Defined in: [src/impact-analyzer/types.ts:322](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L322)

***

### language?

> `readonly` `optional` **language**: `string`

Defined in: [src/impact-analyzer/types.ts:323](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L323)

***

### exports?

> `readonly` `optional` **exports**: readonly `string`[]

Defined in: [src/impact-analyzer/types.ts:324](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L324)
