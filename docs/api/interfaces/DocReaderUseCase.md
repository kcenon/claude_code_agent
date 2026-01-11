[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / DocReaderUseCase

# Interface: DocReaderUseCase

Defined in: [src/document-reader/types.ts:166](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L166)

Use case extracted from SRS

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/document-reader/types.ts:168](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L168)

Use case ID (e.g., UC-001)

***

### name

> `readonly` **name**: `string`

Defined in: [src/document-reader/types.ts:170](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L170)

Use case name

***

### primaryActor?

> `readonly` `optional` **primaryActor**: `string`

Defined in: [src/document-reader/types.ts:172](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L172)

Primary actor

***

### preconditions?

> `readonly` `optional` **preconditions**: readonly `string`[]

Defined in: [src/document-reader/types.ts:174](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L174)

Preconditions

***

### mainFlow?

> `readonly` `optional` **mainFlow**: readonly `string`[]

Defined in: [src/document-reader/types.ts:176](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L176)

Main flow steps

***

### alternativeFlows?

> `readonly` `optional` **alternativeFlows**: readonly `string`[]

Defined in: [src/document-reader/types.ts:178](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L178)

Alternative flows

***

### postconditions?

> `readonly` `optional` **postconditions**: readonly `string`[]

Defined in: [src/document-reader/types.ts:180](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L180)

Postconditions

***

### sourceLocation

> `readonly` **sourceLocation**: `string`

Defined in: [src/document-reader/types.ts:182](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L182)

Source location (file:line)
