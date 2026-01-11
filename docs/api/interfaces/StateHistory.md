[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / StateHistory

# Interface: StateHistory\<T\>

Defined in: [src/state-manager/types.ts:105](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L105)

State history for a specific section

## Type Parameters

### T

`T` = `unknown`

## Properties

### projectId

> `readonly` **projectId**: `string`

Defined in: [src/state-manager/types.ts:107](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L107)

Project ID

***

### section

> `readonly` **section**: [`ScratchpadSection`](../type-aliases/ScratchpadSection.md)

Defined in: [src/state-manager/types.ts:109](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L109)

Section

***

### entries

> `readonly` **entries**: readonly [`StateHistoryEntry`](StateHistoryEntry.md)\<`T`\>[]

Defined in: [src/state-manager/types.ts:111](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L111)

History entries (newest first)

***

### currentId

> `readonly` **currentId**: `string`

Defined in: [src/state-manager/types.ts:113](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L113)

Current entry ID
