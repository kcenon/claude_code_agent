[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / RawDependencyGraph

# Interface: RawDependencyGraph

Defined in: [src/controller/types.ts:75](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L75)

Raw dependency graph structure (loaded from file)

## Properties

### nodes

> `readonly` **nodes**: readonly [`IssueNode`](IssueNode.md)[]

Defined in: [src/controller/types.ts:77](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L77)

Graph nodes

***

### edges

> `readonly` **edges**: readonly [`ControllerDependencyEdge`](ControllerDependencyEdge.md)[]

Defined in: [src/controller/types.ts:79](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L79)

Graph edges
