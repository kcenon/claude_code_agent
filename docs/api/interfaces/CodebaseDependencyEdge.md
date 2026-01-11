[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / CodebaseDependencyEdge

# Interface: CodebaseDependencyEdge

Defined in: [src/codebase-analyzer/types.ts:303](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L303)

Dependency graph edge

## Properties

### from

> `readonly` **from**: `string`

Defined in: [src/codebase-analyzer/types.ts:305](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L305)

Source node ID

***

### to

> `readonly` **to**: `string`

Defined in: [src/codebase-analyzer/types.ts:307](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L307)

Target node ID

***

### type

> `readonly` **type**: [`CodebaseDependencyType`](../type-aliases/CodebaseDependencyType.md)

Defined in: [src/codebase-analyzer/types.ts:309](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L309)

Dependency type

***

### weight

> `readonly` **weight**: `number`

Defined in: [src/codebase-analyzer/types.ts:311](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L311)

Edge weight (number of imports)
