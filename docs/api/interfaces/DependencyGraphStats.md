[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DependencyGraphStats

# Interface: DependencyGraphStats

Defined in: [src/codebase-analyzer/types.ts:331](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L331)

Dependency graph statistics

## Properties

### totalNodes

> `readonly` **totalNodes**: `number`

Defined in: [src/codebase-analyzer/types.ts:333](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L333)

Total number of nodes

***

### totalEdges

> `readonly` **totalEdges**: `number`

Defined in: [src/codebase-analyzer/types.ts:335](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L335)

Total number of edges

***

### externalPackages

> `readonly` **externalPackages**: `number`

Defined in: [src/codebase-analyzer/types.ts:337](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L337)

Number of external packages

***

### avgDependenciesPerModule

> `readonly` **avgDependenciesPerModule**: `number`

Defined in: [src/codebase-analyzer/types.ts:339](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L339)

Average dependencies per module

***

### mostDependedOn

> `readonly` **mostDependedOn**: readonly `string`[]

Defined in: [src/codebase-analyzer/types.ts:341](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L341)

Most depended-on modules

***

### circularDependencies

> `readonly` **circularDependencies**: readonly `string`[][]

Defined in: [src/codebase-analyzer/types.ts:343](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L343)

Circular dependencies detected
