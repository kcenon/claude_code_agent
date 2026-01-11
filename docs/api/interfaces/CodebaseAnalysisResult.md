[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / CodebaseAnalysisResult

# Interface: CodebaseAnalysisResult

Defined in: [src/codebase-analyzer/types.ts:462](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L462)

Codebase analysis result

## Properties

### success

> `readonly` **success**: `boolean`

Defined in: [src/codebase-analyzer/types.ts:464](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L464)

Whether analysis was successful

***

### projectId

> `readonly` **projectId**: `string`

Defined in: [src/codebase-analyzer/types.ts:466](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L466)

Project ID

***

### architectureOutputPath

> `readonly` **architectureOutputPath**: `string`

Defined in: [src/codebase-analyzer/types.ts:468](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L468)

Path to architecture_overview.yaml

***

### dependencyOutputPath

> `readonly` **dependencyOutputPath**: `string`

Defined in: [src/codebase-analyzer/types.ts:470](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L470)

Path to dependency_graph.json

***

### architectureOverview

> `readonly` **architectureOverview**: [`ArchitectureOverview`](ArchitectureOverview.md)

Defined in: [src/codebase-analyzer/types.ts:472](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L472)

Architecture overview

***

### dependencyGraph

> `readonly` **dependencyGraph**: [`DependencyGraph`](DependencyGraph.md)

Defined in: [src/codebase-analyzer/types.ts:474](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L474)

Dependency graph

***

### stats

> `readonly` **stats**: [`CodebaseAnalysisStats`](CodebaseAnalysisStats.md)

Defined in: [src/codebase-analyzer/types.ts:476](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L476)

Analysis statistics

***

### warnings

> `readonly` **warnings**: readonly `string`[]

Defined in: [src/codebase-analyzer/types.ts:478](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/codebase-analyzer/types.ts#L478)

Warnings during analysis
