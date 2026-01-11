[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ProjectStateSummary

# Interface: ProjectStateSummary

Defined in: [src/state-manager/types.ts:147](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L147)

Project state summary

## Properties

### projectId

> `readonly` **projectId**: `string`

Defined in: [src/state-manager/types.ts:149](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L149)

Project ID

***

### currentState

> `readonly` **currentState**: [`ProjectState`](../type-aliases/ProjectState.md)

Defined in: [src/state-manager/types.ts:151](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L151)

Current project state

***

### lastUpdated

> `readonly` **lastUpdated**: `string`

Defined in: [src/state-manager/types.ts:153](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L153)

Last update timestamp

***

### historyCount

> `readonly` **historyCount**: `number`

Defined in: [src/state-manager/types.ts:155](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L155)

State history count

***

### hasPendingChanges

> `readonly` **hasPendingChanges**: `boolean`

Defined in: [src/state-manager/types.ts:157](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L157)

Has pending changes
