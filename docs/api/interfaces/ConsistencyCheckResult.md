[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ConsistencyCheckResult

# Interface: ConsistencyCheckResult

Defined in: [src/prd-writer/types.ts:121](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L121)

Consistency check result

## Properties

### isConsistent

> `readonly` **isConsistent**: `boolean`

Defined in: [src/prd-writer/types.ts:123](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L123)

Whether the requirements are consistent

***

### issues

> `readonly` **issues**: readonly [`ConsistencyIssue`](ConsistencyIssue.md)[]

Defined in: [src/prd-writer/types.ts:125](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L125)

List of consistency issues found

***

### priorityDistribution

> `readonly` **priorityDistribution**: [`PriorityDistribution`](PriorityDistribution.md)

Defined in: [src/prd-writer/types.ts:127](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L127)

Priority distribution analysis

***

### dependencyAnalysis

> `readonly` **dependencyAnalysis**: [`DependencyAnalysis`](DependencyAnalysis.md)

Defined in: [src/prd-writer/types.ts:129](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/prd-writer/types.ts#L129)

Dependency analysis
