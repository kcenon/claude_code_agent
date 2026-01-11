[**AD-SDLC API Reference v0.0.1**](../README.md)

***

[AD-SDLC API Reference](../globals.md) / APISpecification

# Interface: APISpecification

Defined in: [src/document-reader/types.ts:210](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L210)

API specification extracted from SDS

## Properties

### id

> `readonly` **id**: `string`

Defined in: [src/document-reader/types.ts:212](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L212)

API ID (e.g., API-001)

***

### name

> `readonly` **name**: `string`

Defined in: [src/document-reader/types.ts:214](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L214)

API name

***

### method?

> `readonly` `optional` **method**: `string`

Defined in: [src/document-reader/types.ts:216](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L216)

HTTP method (for REST APIs)

***

### endpoint?

> `readonly` `optional` **endpoint**: `string`

Defined in: [src/document-reader/types.ts:218](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L218)

Endpoint path

***

### requestSchema?

> `readonly` `optional` **requestSchema**: `Record`\<`string`, `unknown`\>

Defined in: [src/document-reader/types.ts:220](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L220)

Request schema

***

### responseSchema?

> `readonly` `optional` **responseSchema**: `Record`\<`string`, `unknown`\>

Defined in: [src/document-reader/types.ts:222](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L222)

Response schema

***

### componentId

> `readonly` **componentId**: `string`

Defined in: [src/document-reader/types.ts:224](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L224)

Parent component ID

***

### sourceLocation

> `readonly` **sourceLocation**: `string`

Defined in: [src/document-reader/types.ts:226](https://github.com/kcenon/claude_code_agent/blob/cde634e050ae021d7f064b981e2a4704cd4d07b8/src/document-reader/types.ts#L226)

Source location (file:line)
