[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / StateManagerOptions

# Interface: StateManagerOptions

Defined in: [src/state-manager/types.ts:36](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L36)

State Manager configuration options

## Properties

### basePath?

> `readonly` `optional` **basePath**: `string`

Defined in: [src/state-manager/types.ts:38](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L38)

Base directory for state storage (default: '.ad-sdlc/scratchpad')

***

### enableLocking?

> `readonly` `optional` **enableLocking**: `boolean`

Defined in: [src/state-manager/types.ts:40](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L40)

Enable file locking for concurrent access (default: true)

***

### lockTimeout?

> `readonly` `optional` **lockTimeout**: `number`

Defined in: [src/state-manager/types.ts:42](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L42)

Lock timeout in milliseconds (default: 5000)

***

### enableHistory?

> `readonly` `optional` **enableHistory**: `boolean`

Defined in: [src/state-manager/types.ts:44](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L44)

Enable state history tracking (default: true)

***

### maxHistoryEntries?

> `readonly` `optional` **maxHistoryEntries**: `number`

Defined in: [src/state-manager/types.ts:46](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/state-manager/types.ts#L46)

Maximum history entries to keep per state (default: 50)
