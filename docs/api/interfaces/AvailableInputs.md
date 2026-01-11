[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / AvailableInputs

# Interface: AvailableInputs

Defined in: [src/impact-analyzer/types.ts:455](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L455)

Input sources available for analysis

## Properties

### hasCurrentState

> `readonly` **hasCurrentState**: `boolean`

Defined in: [src/impact-analyzer/types.ts:457](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L457)

Whether current_state.yaml exists

***

### hasArchitectureOverview

> `readonly` **hasArchitectureOverview**: `boolean`

Defined in: [src/impact-analyzer/types.ts:459](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L459)

Whether architecture_overview.yaml exists

***

### hasDependencyGraph

> `readonly` **hasDependencyGraph**: `boolean`

Defined in: [src/impact-analyzer/types.ts:461](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L461)

Whether dependency_graph.json exists

***

### paths

> `readonly` **paths**: `object`

Defined in: [src/impact-analyzer/types.ts:463](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/impact-analyzer/types.ts#L463)

Paths to available inputs

#### currentState

> `readonly` **currentState**: `string` \| `undefined`

#### architectureOverview

> `readonly` **architectureOverview**: `string` \| `undefined`

#### dependencyGraph

> `readonly` **dependencyGraph**: `string` \| `undefined`
