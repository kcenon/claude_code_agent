[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / FileLock

# Interface: FileLock

Defined in: [src/scratchpad/types.ts:255](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/types.ts#L255)

File lock information

## Properties

### filePath

> `readonly` **filePath**: `string`

Defined in: [src/scratchpad/types.ts:257](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/types.ts#L257)

Locked file path

***

### holderId

> `readonly` **holderId**: `string`

Defined in: [src/scratchpad/types.ts:259](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/types.ts#L259)

Lock holder ID

***

### acquiredAt

> `readonly` **acquiredAt**: `string`

Defined in: [src/scratchpad/types.ts:261](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/types.ts#L261)

Lock acquisition timestamp

***

### expiresAt

> `readonly` **expiresAt**: `string`

Defined in: [src/scratchpad/types.ts:263](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/types.ts#L263)

Lock expiration timestamp

***

### generation?

> `readonly` `optional` **generation**: `number`

Defined in: [src/scratchpad/types.ts:265](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/types.ts#L265)

Lock generation counter for detecting concurrent modifications (ABA problem prevention)
