[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / SystemComponent

# Interface: SystemComponent

Defined in: [src/document-reader/types.ts:188](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L188)

Component extracted from SDS

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/document-reader/types.ts:190](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L190)

Component ID (e.g., CMP-001)

***

### name

> `readonly` **name**: `string`

Defined in: [src/document-reader/types.ts:192](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L192)

Component name

***

### type

> `readonly` **type**: [`DocReaderComponentType`](../type-aliases/DocReaderComponentType.md)

Defined in: [src/document-reader/types.ts:194](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L194)

Component type

***

### description

> `readonly` **description**: `string`

Defined in: [src/document-reader/types.ts:196](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L196)

Component description

***

### responsibilities

> `readonly` **responsibilities**: readonly `string`[]

Defined in: [src/document-reader/types.ts:198](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L198)

Component responsibilities

***

### dependencies

> `readonly` **dependencies**: readonly `string`[]

Defined in: [src/document-reader/types.ts:200](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L200)

Dependencies on other components

***

### sourceFeatures

> `readonly` **sourceFeatures**: readonly `string`[]

Defined in: [src/document-reader/types.ts:202](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L202)

Source feature IDs (from SRS)

***

### sourceLocation

> `readonly` **sourceLocation**: `string`

Defined in: [src/document-reader/types.ts:204](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L204)

Source location (file:line)
