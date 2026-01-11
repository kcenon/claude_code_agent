[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / AnalyzedIssue

# Interface: AnalyzedIssue

Defined in: [src/controller/types.ts:85](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L85)

Analyzed issue with computed metrics

## Properties

### node

> `readonly` **node**: [`IssueNode`](IssueNode.md)

Defined in: [src/controller/types.ts:87](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L87)

Issue node data

***

### dependencies

> `readonly` **dependencies**: readonly `string`[]

Defined in: [src/controller/types.ts:89](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L89)

Direct dependencies (issues this issue depends on)

***

### dependents

> `readonly` **dependents**: readonly `string`[]

Defined in: [src/controller/types.ts:91](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L91)

Direct dependents (issues that depend on this issue)

***

### transitiveDependencies

> `readonly` **transitiveDependencies**: readonly `string`[]

Defined in: [src/controller/types.ts:93](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L93)

All transitive dependencies

***

### depth

> `readonly` **depth**: `number`

Defined in: [src/controller/types.ts:95](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L95)

Depth in dependency tree (0 = root)

***

### priorityScore

> `readonly` **priorityScore**: `number`

Defined in: [src/controller/types.ts:97](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L97)

Computed priority score

***

### isOnCriticalPath

> `readonly` **isOnCriticalPath**: `boolean`

Defined in: [src/controller/types.ts:99](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L99)

Whether this issue is on the critical path

***

### dependenciesResolved

> `readonly` **dependenciesResolved**: `boolean`

Defined in: [src/controller/types.ts:101](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L101)

Whether all dependencies are resolved
