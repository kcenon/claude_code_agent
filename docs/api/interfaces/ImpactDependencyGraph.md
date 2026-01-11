[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ImpactDependencyGraph

# Interface: ImpactDependencyGraph

Defined in: [src/impact-analyzer/types.ts:340](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L340)

Dependency graph (from Codebase Analyzer)

## Properties

### nodes

> `readonly` **nodes**: readonly [`ImpactDependencyNode`](ImpactDependencyNode.md)[]

Defined in: [src/impact-analyzer/types.ts:341](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L341)

***

### edges

> `readonly` **edges**: readonly [`ImpactDependencyEdge`](ImpactDependencyEdge.md)[]

Defined in: [src/impact-analyzer/types.ts:342](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L342)

***

### statistics?

> `readonly` `optional` **statistics**: `object`

Defined in: [src/impact-analyzer/types.ts:343](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L343)

#### totalNodes

> `readonly` **totalNodes**: `number`

#### totalEdges

> `readonly` **totalEdges**: `number`

#### circularDependencies?

> `readonly` `optional` **circularDependencies**: readonly `string`[][]
