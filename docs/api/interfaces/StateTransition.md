[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / StateTransition

# Interface: StateTransition

Defined in: [src/state-manager/types.ts:119](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L119)

State transition definition

## Properties

### from

> `readonly` **from**: [`ProjectState`](../type-aliases/ProjectState.md)

Defined in: [src/state-manager/types.ts:121](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L121)

Source state

***

### to

> `readonly` **to**: [`ProjectState`](../type-aliases/ProjectState.md)

Defined in: [src/state-manager/types.ts:123](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L123)

Target state

***

### description?

> `readonly` `optional` **description**: `string`

Defined in: [src/state-manager/types.ts:125](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L125)

Transition description
