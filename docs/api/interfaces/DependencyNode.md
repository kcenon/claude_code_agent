[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DependencyNode

# Interface: DependencyNode

Defined in: [src/codebase-analyzer/types.ts:287](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L287)

Dependency graph node

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/codebase-analyzer/types.ts:289](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L289)

Unique node identifier

***

### type

> `readonly` **type**: [`NodeType`](../type-aliases/NodeType.md)

Defined in: [src/codebase-analyzer/types.ts:291](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L291)

Node type (internal or external)

***

### path?

> `readonly` `optional` **path**: `string`

Defined in: [src/codebase-analyzer/types.ts:293](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L293)

File path for internal modules

***

### language?

> `readonly` `optional` **language**: [`ProgrammingLanguage`](../type-aliases/ProgrammingLanguage.md)

Defined in: [src/codebase-analyzer/types.ts:295](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L295)

Programming language

***

### exports

> `readonly` **exports**: readonly `string`[]

Defined in: [src/codebase-analyzer/types.ts:297](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L297)

Exported symbols
