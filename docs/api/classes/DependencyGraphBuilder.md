[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DependencyGraphBuilder

# Class: DependencyGraphBuilder

Defined in: [src/issue-generator/DependencyGraph.ts:34](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/DependencyGraph.ts#L34)

Builds and analyzes dependency graphs

## Constructors

### Constructor

> **new DependencyGraphBuilder**(): `DependencyGraphBuilder`

#### Returns

`DependencyGraphBuilder`

## Methods

### build()

> **build**(`components`, `componentToIssueId`): `DependencyGraph`

Defined in: [src/issue-generator/DependencyGraph.ts:44](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/DependencyGraph.ts#L44)

Build a dependency graph from SDS components

#### Parameters

##### components

readonly `SDSComponent`[]

Array of SDS components

##### componentToIssueId

`Map`\<`string`, `string`\>

Map of component IDs to issue IDs

#### Returns

`DependencyGraph`

Dependency graph structure

***

### getDependencies()

> **getDependencies**(`issueId`): readonly `string`[]

Defined in: [src/issue-generator/DependencyGraph.ts:298](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/DependencyGraph.ts#L298)

Get direct dependencies for an issue

#### Parameters

##### issueId

`string`

#### Returns

readonly `string`[]

***

### getDependents()

> **getDependents**(`issueId`): readonly `string`[]

Defined in: [src/issue-generator/DependencyGraph.ts:306](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/DependencyGraph.ts#L306)

Get direct dependents for an issue

#### Parameters

##### issueId

`string`

#### Returns

readonly `string`[]

***

### dependsOn()

> **dependsOn**(`issueA`, `issueB`): `boolean`

Defined in: [src/issue-generator/DependencyGraph.ts:314](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/DependencyGraph.ts#L314)

Check if issue A depends on issue B (directly or transitively)

#### Parameters

##### issueA

`string`

##### issueB

`string`

#### Returns

`boolean`

***

### getTransitiveDependencies()

> **getTransitiveDependencies**(`issueId`): readonly `string`[]

Defined in: [src/issue-generator/DependencyGraph.ts:344](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/DependencyGraph.ts#L344)

Get all transitive dependencies for an issue

#### Parameters

##### issueId

`string`

#### Returns

readonly `string`[]

***

### getStatistics()

> **getStatistics**(): `object`

Defined in: [src/issue-generator/DependencyGraph.ts:369](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/issue-generator/DependencyGraph.ts#L369)

Get statistics about the graph

#### Returns

`object`

##### totalNodes

> **totalNodes**: `number`

##### totalEdges

> **totalEdges**: `number`

##### maxDepth

> **maxDepth**: `number`

##### rootNodes

> **rootNodes**: `number`

##### leafNodes

> **leafNodes**: `number`
