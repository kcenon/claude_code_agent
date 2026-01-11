[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / PrioritizedQueue

# Interface: PrioritizedQueue

Defined in: [src/controller/types.ts:131](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L131)

Prioritized work queue

## Properties

### queue

> `readonly` **queue**: readonly `string`[]

Defined in: [src/controller/types.ts:133](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L133)

Ordered list of issue IDs (highest priority first)

***

### readyForExecution

> `readonly` **readyForExecution**: readonly `string`[]

Defined in: [src/controller/types.ts:135](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L135)

Issues ready for execution (no pending dependencies)

***

### blocked

> `readonly` **blocked**: readonly `string`[]

Defined in: [src/controller/types.ts:137](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/controller/types.ts#L137)

Issues blocked by dependencies
