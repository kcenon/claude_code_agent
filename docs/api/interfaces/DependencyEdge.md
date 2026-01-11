[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DependencyEdge

# Interface: DependencyEdge

Defined in: [src/issue-generator/types.ts:286](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L286)

Dependency graph edge

## Properties

### from

> `readonly` **from**: `string`

Defined in: [src/issue-generator/types.ts:288](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L288)

Source issue ID

***

### to

> `readonly` **to**: `string`

Defined in: [src/issue-generator/types.ts:290](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L290)

Target issue ID

***

### type

> `readonly` **type**: [`DependencyType`](../type-aliases/DependencyType.md)

Defined in: [src/issue-generator/types.ts:292](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/types.ts#L292)

Dependency type
