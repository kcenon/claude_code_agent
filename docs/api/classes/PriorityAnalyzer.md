[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / PriorityAnalyzer

# Class: PriorityAnalyzer

Defined in: [src/controller/PriorityAnalyzer.ts:55](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/PriorityAnalyzer.ts#L55)

Priority Analyzer for dependency graph analysis and work prioritization

## Constructors

### Constructor

> **new PriorityAnalyzer**(`config`): `PriorityAnalyzer`

Defined in: [src/controller/PriorityAnalyzer.ts:62](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/PriorityAnalyzer.ts#L62)

#### Parameters

##### config

[`PriorityAnalyzerConfig`](../interfaces/PriorityAnalyzerConfig.md) = `{}`

#### Returns

`PriorityAnalyzer`

## Methods

### loadGraph()

> **loadGraph**(`filePath`): `Promise`\<[`RawDependencyGraph`](../interfaces/RawDependencyGraph.md)\>

Defined in: [src/controller/PriorityAnalyzer.ts:81](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/PriorityAnalyzer.ts#L81)

Load and parse a dependency graph from a JSON file

#### Parameters

##### filePath

`string`

Path to the dependency graph JSON file

#### Returns

`Promise`\<[`RawDependencyGraph`](../interfaces/RawDependencyGraph.md)\>

Parsed dependency graph

#### Throws

GraphNotFoundError if file does not exist

#### Throws

GraphParseError if JSON parsing fails

#### Throws

GraphValidationError if graph structure is invalid

***

### analyze()

> **analyze**(`graph`): [`GraphAnalysisResult`](../interfaces/GraphAnalysisResult.md)

Defined in: [src/controller/PriorityAnalyzer.ts:290](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/PriorityAnalyzer.ts#L290)

Analyze a dependency graph and compute prioritization

Gracefully handles circular dependencies by:
1. Detecting all cycles without throwing
2. Marking cyclic nodes as blocked
3. Propagating blocking to dependent nodes
4. Continuing analysis for non-blocked nodes

#### Parameters

##### graph

[`RawDependencyGraph`](../interfaces/RawDependencyGraph.md)

The dependency graph to analyze

#### Returns

[`GraphAnalysisResult`](../interfaces/GraphAnalysisResult.md)

Complete analysis result including cycle information

#### Throws

EmptyGraphError if graph has no nodes

***

### areDependenciesResolved()

> **areDependenciesResolved**(`issueId`): `boolean`

Defined in: [src/controller/PriorityAnalyzer.ts:779](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/PriorityAnalyzer.ts#L779)

Check if all dependencies of an issue are resolved

#### Parameters

##### issueId

`string`

The issue ID to check

#### Returns

`boolean`

True if all dependencies are completed, false otherwise

***

### getNextExecutableIssue()

> **getNextExecutableIssue**(): `string` \| `null`

Defined in: [src/controller/PriorityAnalyzer.ts:799](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/PriorityAnalyzer.ts#L799)

Get the next executable issue

#### Returns

`string` \| `null`

The highest priority issue with resolved dependencies, or null

***

### getDependencies()

> **getDependencies**(`issueId`): readonly `string`[]

Defined in: [src/controller/PriorityAnalyzer.ts:820](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/PriorityAnalyzer.ts#L820)

Get direct dependencies for an issue

#### Parameters

##### issueId

`string`

The issue ID to get dependencies for

#### Returns

readonly `string`[]

Array of issue IDs that this issue depends on

#### Throws

IssueNotFoundError if issue does not exist

***

### getDependents()

> **getDependents**(`issueId`): readonly `string`[]

Defined in: [src/controller/PriorityAnalyzer.ts:835](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/PriorityAnalyzer.ts#L835)

Get direct dependents for an issue (issues that depend on this one)

#### Parameters

##### issueId

`string`

The issue ID to get dependents for

#### Returns

readonly `string`[]

Array of issue IDs that depend on this issue

#### Throws

IssueNotFoundError if issue does not exist

***

### getTransitiveDependencies()

> **getTransitiveDependencies**(`issueId`): readonly `string`[]

Defined in: [src/controller/PriorityAnalyzer.ts:850](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/PriorityAnalyzer.ts#L850)

Get all transitive dependencies for an issue (direct and indirect)

#### Parameters

##### issueId

`string`

The issue ID to get transitive dependencies for

#### Returns

readonly `string`[]

Array of issue IDs that this issue depends on (directly or transitively)

#### Throws

IssueNotFoundError if issue does not exist

***

### dependsOn()

> **dependsOn**(`issueA`, `issueB`): `boolean`

Defined in: [src/controller/PriorityAnalyzer.ts:885](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/PriorityAnalyzer.ts#L885)

Check if issue A depends on issue B (directly or transitively)

#### Parameters

##### issueA

`string`

The issue ID to check dependencies for

##### issueB

`string`

The issue ID to check as a potential dependency

#### Returns

`boolean`

True if issueA depends on issueB, false otherwise

#### Throws

IssueNotFoundError if issueA does not exist

***

### getCycles()

> **getCycles**(): readonly `CycleInfo`[]

Defined in: [src/controller/PriorityAnalyzer.ts:972](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/PriorityAnalyzer.ts#L972)

Get all detected cycles in the graph

#### Returns

readonly `CycleInfo`[]

Array of cycle information

***

### hasCycles()

> **hasCycles**(): `boolean`

Defined in: [src/controller/PriorityAnalyzer.ts:980](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/PriorityAnalyzer.ts#L980)

Check if the graph has any circular dependencies

#### Returns

`boolean`

true if cycles were detected

***

### isBlockedByCycle()

> **isBlockedByCycle**(`issueId`): `boolean`

Defined in: [src/controller/PriorityAnalyzer.ts:989](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/PriorityAnalyzer.ts#L989)

Check if a specific issue is blocked by a circular dependency

#### Parameters

##### issueId

`string`

The issue ID to check

#### Returns

`boolean`

true if the issue is blocked by a cycle

***

### getBlockedByCycle()

> **getBlockedByCycle**(): readonly `string`[]

Defined in: [src/controller/PriorityAnalyzer.ts:998](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/PriorityAnalyzer.ts#L998)

Get all issue IDs that are blocked by circular dependencies
This includes both nodes directly in cycles and nodes that depend on cyclic nodes

#### Returns

readonly `string`[]

Array of blocked issue IDs

***

### getExecutableIssues()

> **getExecutableIssues**(): readonly `string`[]

Defined in: [src/controller/PriorityAnalyzer.ts:1006](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/PriorityAnalyzer.ts#L1006)

Get issues that can be executed (not blocked by cycles)

#### Returns

readonly `string`[]

Array of executable issue IDs sorted by priority
