[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / GraphAnalysisResult

# Interface: GraphAnalysisResult

Defined in: [src/controller/types.ts:162](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L162)

Graph analysis result

## Properties

### issues

> `readonly` **issues**: `ReadonlyMap`\<`string`, [`AnalyzedIssue`](AnalyzedIssue.md)\>

Defined in: [src/controller/types.ts:164](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L164)

Analyzed issues map

***

### executionOrder

> `readonly` **executionOrder**: readonly `string`[]

Defined in: [src/controller/types.ts:166](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L166)

Topologically sorted execution order

***

### parallelGroups

> `readonly` **parallelGroups**: readonly [`ControllerParallelGroup`](ControllerParallelGroup.md)[]

Defined in: [src/controller/types.ts:168](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L168)

Parallel execution groups

***

### criticalPath

> `readonly` **criticalPath**: [`CriticalPath`](CriticalPath.md)

Defined in: [src/controller/types.ts:170](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L170)

Critical path information

***

### prioritizedQueue

> `readonly` **prioritizedQueue**: [`PrioritizedQueue`](PrioritizedQueue.md)

Defined in: [src/controller/types.ts:172](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L172)

Prioritized work queue

***

### statistics

> `readonly` **statistics**: [`GraphStatistics`](GraphStatistics.md)

Defined in: [src/controller/types.ts:174](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L174)

Graph statistics

***

### cycles

> `readonly` **cycles**: readonly `CycleInfo`[]

Defined in: [src/controller/types.ts:176](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L176)

Detected cycles (empty if no cycles)

***

### blockedByCycle

> `readonly` **blockedByCycle**: readonly `string`[]

Defined in: [src/controller/types.ts:178](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L178)

Issue IDs blocked by circular dependencies
