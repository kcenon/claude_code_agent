[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DependencyGraph

# Interface: DependencyGraph

Defined in: [src/codebase-analyzer/types.ts:349](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L349)

Dependency graph output

## Properties

### nodes

> `readonly` **nodes**: readonly [`DependencyNode`](DependencyNode.md)[]

Defined in: [src/codebase-analyzer/types.ts:351](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L351)

Graph nodes

***

### edges

> `readonly` **edges**: readonly [`CodebaseDependencyEdge`](CodebaseDependencyEdge.md)[]

Defined in: [src/codebase-analyzer/types.ts:353](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L353)

Graph edges

***

### externalDependencies

> `readonly` **externalDependencies**: readonly [`ExternalDependency`](ExternalDependency.md)[]

Defined in: [src/codebase-analyzer/types.ts:355](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L355)

External dependencies

***

### statistics

> `readonly` **statistics**: [`DependencyGraphStats`](DependencyGraphStats.md)

Defined in: [src/codebase-analyzer/types.ts:357](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L357)

Graph statistics
