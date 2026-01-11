[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / InitResult

# Interface: InitResult

Defined in: [src/init/types.ts:143](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L143)

Result of project initialization

## Properties

### success

> `readonly` **success**: `boolean`

Defined in: [src/init/types.ts:145](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L145)

Whether initialization succeeded

***

### projectPath

> `readonly` **projectPath**: `string`

Defined in: [src/init/types.ts:148](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L148)

Path to the initialized project

***

### createdFiles

> `readonly` **createdFiles**: readonly `string`[]

Defined in: [src/init/types.ts:151](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L151)

List of created files and directories

***

### warnings

> `readonly` **warnings**: readonly `string`[]

Defined in: [src/init/types.ts:154](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L154)

Any warnings generated during initialization

***

### error?

> `readonly` `optional` **error**: `string`

Defined in: [src/init/types.ts:157](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/init/types.ts#L157)

Error message if initialization failed
