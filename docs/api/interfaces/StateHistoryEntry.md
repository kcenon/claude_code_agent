[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / StateHistoryEntry

# Interface: StateHistoryEntry\<T\>

Defined in: [src/state-manager/types.ts:89](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L89)

State history entry

## Type Parameters

### T

`T` = `unknown`

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/state-manager/types.ts:91](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L91)

History entry ID

***

### value

> `readonly` **value**: `T`

Defined in: [src/state-manager/types.ts:93](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L93)

State value at this point

***

### timestamp

> `readonly` **timestamp**: `string`

Defined in: [src/state-manager/types.ts:95](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L95)

Timestamp of this entry

***

### description

> `readonly` **description**: `string` \| `undefined`

Defined in: [src/state-manager/types.ts:97](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L97)

Change description

***

### previousId

> `readonly` **previousId**: `string` \| `undefined`

Defined in: [src/state-manager/types.ts:99](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L99)

Previous entry ID (for chain)
