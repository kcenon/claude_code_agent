[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / GraphStatistics

# Interface: GraphStatistics

Defined in: [src/controller/types.ts:184](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L184)

Graph statistics

## Properties

### totalIssues

> `readonly` **totalIssues**: `number`

Defined in: [src/controller/types.ts:186](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L186)

Total number of issues

***

### totalDependencies

> `readonly` **totalDependencies**: `number`

Defined in: [src/controller/types.ts:188](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L188)

Total number of dependencies

***

### maxDepth

> `readonly` **maxDepth**: `number`

Defined in: [src/controller/types.ts:190](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L190)

Maximum depth in the graph

***

### rootIssues

> `readonly` **rootIssues**: `number`

Defined in: [src/controller/types.ts:192](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L192)

Number of root issues (no dependencies)

***

### leafIssues

> `readonly` **leafIssues**: `number`

Defined in: [src/controller/types.ts:194](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L194)

Number of leaf issues (no dependents)

***

### criticalPathLength

> `readonly` **criticalPathLength**: `number`

Defined in: [src/controller/types.ts:196](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L196)

Number of issues on critical path

***

### byPriority

> `readonly` **byPriority**: `Record`\<[`ControllerPriority`](../type-aliases/ControllerPriority.md), `number`\>

Defined in: [src/controller/types.ts:198](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L198)

Issues by priority

***

### byStatus

> `readonly` **byStatus**: `Record`\<[`IssueStatus`](../type-aliases/IssueStatus.md), `number`\>

Defined in: [src/controller/types.ts:200](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L200)

Issues by status
