[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / ProjectInfo

# Interface: ProjectInfo

Defined in: [src/scratchpad/types.ts:55](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/types.ts#L55)

Project information stored in scratchpad

## Properties

### projectId

> `readonly` **projectId**: `string`

Defined in: [src/scratchpad/types.ts:57](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/types.ts#L57)

Unique project identifier

***

### name

> `readonly` **name**: `string`

Defined in: [src/scratchpad/types.ts:59](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/types.ts#L59)

Project name

***

### createdAt

> `readonly` **createdAt**: `string`

Defined in: [src/scratchpad/types.ts:61](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/types.ts#L61)

Project creation timestamp

***

### updatedAt

> `readonly` **updatedAt**: `string`

Defined in: [src/scratchpad/types.ts:63](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/types.ts#L63)

Last update timestamp

***

### status

> `readonly` **status**: `"completed"` \| `"active"` \| `"archived"`

Defined in: [src/scratchpad/types.ts:65](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/scratchpad/types.ts#L65)

Project status
