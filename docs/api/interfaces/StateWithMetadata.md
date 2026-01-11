[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / StateWithMetadata

# Interface: StateWithMetadata\<T\>

Defined in: [src/state-manager/types.ts:207](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L207)

State with metadata

## Type Parameters

### T

`T`

## Properties

### value

> `readonly` **value**: `T`

Defined in: [src/state-manager/types.ts:209](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L209)

The state value

***

### projectId

> `readonly` **projectId**: `string`

Defined in: [src/state-manager/types.ts:211](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L211)

Project ID

***

### section

> `readonly` **section**: [`ScratchpadSection`](../type-aliases/ScratchpadSection.md)

Defined in: [src/state-manager/types.ts:213](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L213)

Section

***

### updatedAt

> `readonly` **updatedAt**: `string`

Defined in: [src/state-manager/types.ts:215](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L215)

Last update timestamp

***

### version

> `readonly` **version**: `number`

Defined in: [src/state-manager/types.ts:217](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L217)

State version

***

### history

> `readonly` **history**: [`StateHistory`](StateHistory.md)\<`T`\> \| `undefined`

Defined in: [src/state-manager/types.ts:219](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L219)

History (if requested)
