[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ScratchpadOptions

# Interface: ScratchpadOptions

Defined in: [src/scratchpad/types.ts:31](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/types.ts#L31)

Scratchpad configuration options

## Properties

### basePath?

> `readonly` `optional` **basePath**: `string`

Defined in: [src/scratchpad/types.ts:33](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/types.ts#L33)

Base directory for scratchpad (default: '.ad-sdlc/scratchpad')

***

### fileMode?

> `readonly` `optional` **fileMode**: `number`

Defined in: [src/scratchpad/types.ts:35](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/types.ts#L35)

File permission mode for created files (default: 0o600)

***

### dirMode?

> `readonly` `optional` **dirMode**: `number`

Defined in: [src/scratchpad/types.ts:37](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/types.ts#L37)

Directory permission mode for created directories (default: 0o700)

***

### enableLocking?

> `readonly` `optional` **enableLocking**: `boolean`

Defined in: [src/scratchpad/types.ts:39](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/types.ts#L39)

Enable file locking for concurrent access (default: true)

***

### lockTimeout?

> `readonly` `optional` **lockTimeout**: `number`

Defined in: [src/scratchpad/types.ts:41](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/types.ts#L41)

Lock timeout in milliseconds (default: 5000)

***

### projectRoot?

> `readonly` `optional` **projectRoot**: `string`

Defined in: [src/scratchpad/types.ts:43](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/types.ts#L43)

Project root directory for path validation (default: process.cwd())

***

### lockRetryAttempts?

> `readonly` `optional` **lockRetryAttempts**: `number`

Defined in: [src/scratchpad/types.ts:45](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/types.ts#L45)

Number of retry attempts when lock is contended (default: 10)

***

### lockRetryDelayMs?

> `readonly` `optional` **lockRetryDelayMs**: `number`

Defined in: [src/scratchpad/types.ts:47](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/types.ts#L47)

Base delay in ms between retries (default: 100)

***

### lockStealThresholdMs?

> `readonly` `optional` **lockStealThresholdMs**: `number`

Defined in: [src/scratchpad/types.ts:49](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/types.ts#L49)

Time in ms after which expired lock can be stolen (default: 5000)
