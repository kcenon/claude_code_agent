[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / TransitionResult

# Interface: TransitionResult

Defined in: [src/state-manager/types.ts:131](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L131)

State transition result

## Properties

### success

> `readonly` **success**: `boolean`

Defined in: [src/state-manager/types.ts:133](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L133)

Whether transition was successful

***

### previousState

> `readonly` **previousState**: [`ProjectState`](../type-aliases/ProjectState.md)

Defined in: [src/state-manager/types.ts:135](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L135)

Previous state

***

### newState

> `readonly` **newState**: [`ProjectState`](../type-aliases/ProjectState.md)

Defined in: [src/state-manager/types.ts:137](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L137)

New state (same as previous if failed)

***

### error?

> `readonly` `optional` **error**: `string`

Defined in: [src/state-manager/types.ts:139](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L139)

Error message if failed

***

### timestamp

> `readonly` **timestamp**: `string`

Defined in: [src/state-manager/types.ts:141](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L141)

Transition timestamp
