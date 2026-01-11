[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / StateWatcher

# Interface: StateWatcher

Defined in: [src/state-manager/types.ts:75](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L75)

State watcher handle for cleanup

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/state-manager/types.ts:77](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L77)

Watcher identifier

***

### projectId

> `readonly` **projectId**: `string`

Defined in: [src/state-manager/types.ts:79](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L79)

Project ID being watched

***

### section

> `readonly` **section**: [`ScratchpadSection`](../type-aliases/ScratchpadSection.md) \| `null`

Defined in: [src/state-manager/types.ts:81](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L81)

Section being watched (null for all sections)

***

### unsubscribe()

> `readonly` **unsubscribe**: () => `void`

Defined in: [src/state-manager/types.ts:83](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L83)

Stop watching

#### Returns

`void`
