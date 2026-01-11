[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / StateChangeEvent

# Interface: StateChangeEvent\<T\>

Defined in: [src/state-manager/types.ts:52](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L52)

State change event

## Type Parameters

### T

`T` = `unknown`

## Properties

### projectId

> `readonly` **projectId**: `string`

Defined in: [src/state-manager/types.ts:54](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L54)

Project ID

***

### section

> `readonly` **section**: [`ScratchpadSection`](../type-aliases/ScratchpadSection.md)

Defined in: [src/state-manager/types.ts:56](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L56)

Section that changed

***

### previousValue

> `readonly` **previousValue**: `T` \| `null`

Defined in: [src/state-manager/types.ts:58](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L58)

Previous state value

***

### newValue

> `readonly` **newValue**: `T`

Defined in: [src/state-manager/types.ts:60](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L60)

New state value

***

### timestamp

> `readonly` **timestamp**: `string`

Defined in: [src/state-manager/types.ts:62](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L62)

Change timestamp

***

### changeType

> `readonly` **changeType**: `"create"` \| `"delete"` \| `"update"`

Defined in: [src/state-manager/types.ts:64](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L64)

Change type
