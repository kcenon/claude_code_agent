[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ControllerParallelGroup

# Interface: ControllerParallelGroup

Defined in: [src/controller/types.ts:107](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L107)

Group of issues that can be executed in parallel

## Properties

### groupIndex

> `readonly` **groupIndex**: `number`

Defined in: [src/controller/types.ts:109](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L109)

Group index (execution order)

***

### issueIds

> `readonly` **issueIds**: readonly `string`[]

Defined in: [src/controller/types.ts:111](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L111)

Issue IDs in this group

***

### totalEffort

> `readonly` **totalEffort**: `number`

Defined in: [src/controller/types.ts:113](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L113)

Total estimated effort for this group
