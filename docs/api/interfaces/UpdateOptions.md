[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / UpdateOptions

# Interface: UpdateOptions

Defined in: [src/state-manager/types.ts:185](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L185)

State update options

## Properties

### merge?

> `readonly` `optional` **merge**: `boolean`

Defined in: [src/state-manager/types.ts:187](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L187)

Whether to merge with existing state (default: true)

***

### description?

> `readonly` `optional` **description**: `string`

Defined in: [src/state-manager/types.ts:189](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L189)

Description of the change for history

***

### skipValidation?

> `readonly` `optional` **skipValidation**: `boolean`

Defined in: [src/state-manager/types.ts:191](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L191)

Skip validation (default: false)
