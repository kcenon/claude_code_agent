[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / CodebaseAnalysisSession

# Interface: CodebaseAnalysisSession

Defined in: [src/codebase-analyzer/types.ts:363](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L363)

Codebase analysis session

## Properties

### sessionId

> `readonly` **sessionId**: `string`

Defined in: [src/codebase-analyzer/types.ts:365](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L365)

Session identifier

***

### projectId

> `readonly` **projectId**: `string`

Defined in: [src/codebase-analyzer/types.ts:367](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L367)

Project identifier

***

### status

> `readonly` **status**: [`AnalysisSessionStatus`](../type-aliases/AnalysisSessionStatus.md)

Defined in: [src/codebase-analyzer/types.ts:369](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L369)

Session status

***

### rootPath

> `readonly` **rootPath**: `string`

Defined in: [src/codebase-analyzer/types.ts:371](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L371)

Root path being analyzed

***

### architectureOverview

> `readonly` **architectureOverview**: [`ArchitectureOverview`](ArchitectureOverview.md) \| `null`

Defined in: [src/codebase-analyzer/types.ts:373](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L373)

Architecture overview result

***

### dependencyGraph

> `readonly` **dependencyGraph**: [`DependencyGraph`](DependencyGraph.md) \| `null`

Defined in: [src/codebase-analyzer/types.ts:375](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L375)

Dependency graph result

***

### startedAt

> `readonly` **startedAt**: `string`

Defined in: [src/codebase-analyzer/types.ts:377](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L377)

Session start time

***

### updatedAt

> `readonly` **updatedAt**: `string`

Defined in: [src/codebase-analyzer/types.ts:379](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L379)

Session last update time

***

### warnings

> `readonly` **warnings**: readonly `string`[]

Defined in: [src/codebase-analyzer/types.ts:381](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L381)

Warnings during analysis

***

### errors

> `readonly` **errors**: readonly `string`[]

Defined in: [src/codebase-analyzer/types.ts:383](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L383)

Errors during analysis
